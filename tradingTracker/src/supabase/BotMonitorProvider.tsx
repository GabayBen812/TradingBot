import React, { createContext, useContext, useEffect, useRef } from 'react'
import { supabase } from './client'
import { fetchPrice } from '@/sage/market'

type Ctx = {}
const MonitorCtx = createContext<Ctx | undefined>(undefined)

const TTL_MS = 24 * 60 * 60 * 1000 // 24h

export function BotMonitorProvider({ children }: { children: React.ReactNode }) {
  const runningRef = useRef(false)

  useEffect(() => {
    if (runningRef.current) return
    runningRef.current = true
    const timer = setInterval(async () => {
      try {
        // Read open bot trades (tagged via reason contains [BOT])
        const { data, error } = await supabase
          .from('trades')
          .select('id, symbol, side, entry, stop, take, date, reason, exit, closed_at')
          .is('exit', null)
          .ilike('reason', '%[BOT]%')
          .limit(200)
        if (error || !data) return
        const rows = data as any[]
        for (const r of rows) {
          const opened = new Date(r.date).getTime()
          const price = await fetchPrice(r.symbol)
          let hit = false
          if (r.stop != null && r.take != null) {
            if (r.side === 'LONG' && (price <= r.stop || price >= r.take)) hit = true
            if (r.side === 'SHORT' && (price >= r.stop || price <= r.take)) hit = true
          }
          if (!hit && Date.now() - opened > TTL_MS) hit = true
          if (hit) {
            const exitAt = r.side === 'LONG' ? (price <= (r.stop ?? -Infinity) ? r.stop : (price >= (r.take ?? Infinity) ? r.take : price)) : (price >= (r.stop ?? Infinity) ? r.stop : (price <= (r.take ?? -Infinity) ? r.take : price))
            const notes = r.side === 'LONG' ? (price <= (r.stop ?? -Infinity) ? 'auto-closed at SL' : (price >= (r.take ?? Infinity) ? 'auto-closed at TP' : 'auto-closed TTL')) : (price >= (r.stop ?? Infinity) ? 'auto-closed at SL' : (price <= (r.take ?? -Infinity) ? 'auto-closed at TP' : 'auto-closed TTL'))
            await supabase.from('trades').update({ exit: exitAt, closed_at: new Date().toISOString(), notes }).eq('id', r.id)
          }
        }
      } catch {}
    }, 60_000)
    return () => { clearInterval(timer); runningRef.current = false }
  }, [])

  return (
    <MonitorCtx.Provider value={{}}>
      {children}
    </MonitorCtx.Provider>
  )
}

export function useBotMonitor() {
  const v = useContext(MonitorCtx)
  if (!v) throw new Error('useBotMonitor must be used within BotMonitorProvider')
  return v
}



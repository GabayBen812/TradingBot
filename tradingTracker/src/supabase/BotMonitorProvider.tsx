import React, { createContext, useContext, useEffect, useRef } from 'react'
import { supabase } from './client'
import { fetchPrice } from '@/sage/market'

type Ctx = {}
const MonitorCtx = createContext<Ctx | undefined>(undefined)

const TTL_BY_TF: Record<string, number> = { '5m': 2 * 60 * 60 * 1000, '15m': 6 * 60 * 60 * 1000, '1h': 24 * 60 * 60 * 1000 }

export function BotMonitorProvider({ children }: { children: React.ReactNode }) {
  const runningRef = useRef(false)

  useEffect(() => {
    if (runningRef.current) return
    runningRef.current = true
    const timer = setInterval(async () => {
      try {
        // 1) Promote filled PENDING orders into trades when price hits entry
        const { data: od } = await supabase
          .from('orders')
          .select('id, user_id, symbol, side, entry, stop, take, size, status, created_at, mode, executor, timeframe, expires_at')
          .eq('status', 'PENDING')
          .order('created_at', { ascending: true })
          .limit(200)
        if (od && od.length) {
          for (const o of od as any[]) {
            try {
              const price = await fetchPrice(o.symbol)
              // Cancel expired
              const ttlMs = TTL_BY_TF[o.timeframe] ?? 6 * 60 * 60 * 1000
              const exp = o.expires_at ? new Date(o.expires_at).getTime() : (new Date(o.created_at).getTime() + ttlMs)
              if (Date.now() > exp) { await supabase.from('orders').update({ status: 'CANCELED', cancel_reason: 'expired' } as any).eq('id', o.id); continue }
              const shouldFill = (o.side === 'LONG' ? price <= o.entry : price >= o.entry)
              if (shouldFill) {
                const { error: e1 } = await supabase.from('trades').insert({ user_id: o.user_id, date: new Date().toISOString(), symbol: o.symbol, side: o.side, entry: o.entry, stop: o.stop, take: o.take, size: o.size, reason: '[BOT] limit fill', mode: o.mode, executor: o.executor })
                if (!e1) await supabase.from('orders').update({ status: 'FILLED', filled_at: new Date().toISOString() }).eq('id', o.id)
              }
            } catch {}
          }
        }

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
          // Fallback TTL for open trades: 24h
          if (!hit && Date.now() - opened > 24 * 60 * 60 * 1000) hit = true
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



export type BotTrade = {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entry: number
  exit?: number | null
  stop?: number | null
  take?: number | null
  pnl?: number | null
  opened_at: string
  closed_at?: string | null
  notes?: string | null
}

const BOT_API = (import.meta as any).env?.VITE_BOT_API_BASE ?? '/proxy/bot'
const USE_MOCK = (import.meta as any).env?.VITE_BOT_USE_MOCK === 'true'

import { supabase } from '@/supabase/client'

export async function fetchBotTrades({ useMock = USE_MOCK, mode }: { useMock?: boolean; mode?: 'supervised'|'strict'|'explore' } = {}): Promise<BotTrade[]> {
  if (useMock) return generateMockTrades()
  // Client-only mode: read bot trades from Supabase for current user (tagged by reason prefix [BOT])
  const { data, error } = await supabase
    .from('trades')
    .select('id, symbol, side, entry, exit, stop, take, size, date, closed_at, reason, notes, mode, executor')
    .ilike('reason', '%[BOT]%')
    .order('date', { ascending: false })
    .limit(200)
  if (error) throw error
  const rows = (data as any[]) || []
  const filtered = mode ? rows.filter(r => r.mode === mode) : rows
  return filtered.map((r) => {
    const entry = Number(r.entry)
    const exit = r.exit == null ? null : Number(r.exit)
    const stop = r.stop == null ? null : Number(r.stop)
    const take = r.take == null ? null : Number(r.take)
    const size = r.size == null ? null : Number(r.size)
    let pnl: number | null = null
    if (exit != null && size != null && isFinite(entry) && entry !== 0) {
      const dir = r.side === 'LONG' ? 1 : -1
      pnl = Number((((exit - entry) / entry) * dir * size).toFixed(2))
    }
    const opened_at = new Date(r.date).toISOString()
    const closed_at = r.closed_at ? new Date(r.closed_at).toISOString() : null
    return { id: String(r.id), symbol: r.symbol, side: r.side, entry, exit, stop, take, pnl, opened_at, closed_at, notes: r.notes ?? null } as BotTrade
  })
}

export function generateMockTrades(): BotTrade[] {
  const base = Date.now()
  const syms = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XAUTUSDT','HYVEUSDT','ADAUSDT']
  const list: BotTrade[] = []
  for (let i = 0; i < 18; i++) {
    const symbol = syms[i % syms.length]
    const side = Math.random() > 0.5 ? 'LONG' : 'SHORT'
    const entry = Number((Math.random() * 100 + 20).toFixed(2))
    const hasExit = Math.random() > 0.3
    const move = (Math.random() - 0.45) * 0.1 * entry
    const exit = hasExit ? Number((entry + (side === 'LONG' ? move : -move)).toFixed(2)) : null
    const size = 100 + Math.random() * 900
    const pnl = exit != null ? Number((((exit - entry) / entry) * (side === 'LONG' ? 1 : -1) * size).toFixed(2)) : null
    const risk = Number((entry * 0.01).toFixed(4))
    const stop = side === 'LONG' ? Number((entry - risk).toFixed(4)) : Number((entry + risk).toFixed(4))
    const take = side === 'LONG' ? Number((entry + risk * 2.5).toFixed(4)) : Number((entry - risk * 2.5).toFixed(4))
    const opened_at = new Date(base - i * 36e5).toISOString()
    const closed_at = hasExit ? new Date(base - i * 32e5).toISOString() : null
    list.push({ id: `m${i}`, symbol, side, entry, exit, stop, take, pnl, opened_at, closed_at })
  }
  return list
}

export function computeBotStats(trades: BotTrade[]) {
  let wins = 0, total = 0
  let net = 0
  let totalR = 0
  for (const t of trades) {
    if (t.exit != null) {
      total++
      if ((t.pnl ?? 0) >= 0) wins++
      net += t.pnl ?? 0
      if (t.entry != null && t.stop != null) {
        const riskPerUnit = Math.abs(t.entry - t.stop)
        if (riskPerUnit > 0 && t.exit != null) {
          const dir = t.side === 'LONG' ? 1 : -1
          const move = (t.exit - t.entry) * dir
          let r = move / riskPerUnit
          // If exit is effectively at stop (within 0.1%), clamp to -1R
          const isAtStop = Math.abs((t.exit - t.stop) / (t.stop || 1)) < 0.001
          if (isAtStop && r < -1) r = -1
          totalR += r
        }
      }
    }
  }
  const avg = total ? net / total : 0
  const open = trades.filter(t => t.exit == null).length
  const avgR = total ? totalR / total : 0
  return { winRate: total ? (wins / total) * 100 : 0, netPnL: net, avgTrade: avgR, openPositions: open, totalR }
}

export const BotConfig = {
  API_BASE: BOT_API,
}



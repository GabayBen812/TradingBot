export type BotTrade = {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entry: number
  exit?: number | null
  pnl?: number | null
  opened_at: string
  closed_at?: string | null
}

const BOT_API = (import.meta as any).env?.VITE_BOT_API_BASE ?? '/proxy/bot'
const USE_MOCK = (import.meta as any).env?.VITE_BOT_USE_MOCK === 'true'

import { supabase } from '@/supabase/client'

export async function fetchBotTrades({ useMock = USE_MOCK }: { useMock?: boolean } = {}): Promise<BotTrade[]> {
  if (useMock) return generateMockTrades()
  // Client-only mode: read bot trades from Supabase for current user (tagged by reason prefix [BOT])
  const { data, error } = await supabase
    .from('trades')
    .select('id, symbol, side, entry, exit, size, date, closed_at, reason')
    .ilike('reason', '%[BOT]%')
    .order('date', { ascending: false })
    .limit(200)
  if (error) throw error
  const rows = (data as any[]) || []
  return rows.map((r) => {
    const entry = Number(r.entry)
    const exit = r.exit == null ? null : Number(r.exit)
    const size = r.size == null ? null : Number(r.size)
    let pnl: number | null = null
    if (exit != null && size != null && isFinite(entry) && entry !== 0) {
      const dir = r.side === 'LONG' ? 1 : -1
      pnl = Number((((exit - entry) / entry) * dir * size).toFixed(2))
    }
    const opened_at = new Date(r.date).toISOString()
    const closed_at = r.closed_at ? new Date(r.closed_at).toISOString() : null
    return { id: String(r.id), symbol: r.symbol, side: r.side, entry, exit, pnl, opened_at, closed_at } as BotTrade
  })
}

export function generateMockTrades(): BotTrade[] {
  const base = Date.now()
  const syms = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','ADAUSDT']
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
    const opened_at = new Date(base - i * 36e5).toISOString()
    const closed_at = hasExit ? new Date(base - i * 32e5).toISOString() : null
    list.push({ id: `m${i}`, symbol, side, entry, exit, pnl, opened_at, closed_at })
  }
  return list
}

export function computeBotStats(trades: BotTrade[]) {
  let wins = 0, total = 0
  let net = 0
  for (const t of trades) {
    if (t.exit != null) {
      total++
      if ((t.pnl ?? 0) >= 0) wins++
      net += t.pnl ?? 0
    }
  }
  const avg = total ? net / total : 0
  const open = trades.filter(t => t.exit == null).length
  return { winRate: total ? (wins / total) * 100 : 0, netPnL: net, avgTrade: avg, openPositions: open }
}

export const BotConfig = {
  API_BASE: BOT_API,
}



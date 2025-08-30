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

export async function fetchBotTrades({ useMock = USE_MOCK }: { useMock?: boolean } = {}): Promise<BotTrade[]> {
  if (useMock) return generateMockTrades()
  const res = await fetch(`${BOT_API}/trades`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    throw new Error('Non-JSON response from bot API. In dev, select Mock or run Netlify dev proxy.')
  }
  return (await res.json()) as BotTrade[]
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



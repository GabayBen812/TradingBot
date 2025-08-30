import { fetchKlines, type Candle } from '@/sage/market'
import { rsi, detectFVG, lastSwing, fibLevel, findPivots, slope } from './ta'
import { supabase } from '@/supabase/client'

export type BotSignal = {
  id: string
  symbol: string
  timeframe: '5m' | '15m' | '1h'
  side: 'LONG' | 'SHORT'
  reason: string
  entry: number
  stop: number
  take: number
  created_at: string
}

export type BotRuntimeOptions = {
  symbols?: string[]
  interval?: '5m' | '15m' | '1h'
  topCount?: number
  onSignals?: (signals: BotSignal[]) => void
}

const DEFAULT_SYMBOLS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','TONUSDT','TRXUSDT','AVAXUSDT']

export class ClientBotRuntime {
  private timer: any = null
  private signals: BotSignal[] = []
  private priceMap = new Map<string, number>()
  constructor(private opts: BotRuntimeOptions = {}) {}

  start() {
    if (this.timer) return
    this.scanOnce()
    this.timer = setInterval(() => this.scanOnce(), 60_000)
  }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null } }

  getSignals() { return this.signals }

  private async scanOnce() {
    const symbols = this.opts.symbols ?? DEFAULT_SYMBOLS
    const interval = this.opts.interval ?? '15m'
    const all: BotSignal[] = []
    await Promise.all(symbols.map(async (sym) => {
      try {
        const candles = await fetchKlines(sym, interval, 300)
        const last = candles[candles.length - 1]
        if (last) this.priceMap.set(sym, last.close)
        const s = detectSetups(sym, candles)
        all.push(...s)
      } catch {}
    }))
    this.signals = dedupeSignals(all)
    try { this.opts.onSignals?.(this.signals) } catch {}
  }

  getLivePrice(symbol: string): number | undefined { return this.priceMap.get(symbol) }
}

function dedupeSignals(list: BotSignal[]): BotSignal[] {
  const map = new Map<string, BotSignal>()
  for (const s of list) {
    const key = `${s.symbol}|${s.timeframe}|${s.side}`
    const prev = map.get(key)
    if (!prev || new Date(s.created_at).getTime() > new Date(prev.created_at).getTime()) map.set(key, s)
  }
  return Array.from(map.values())
}

function detectSetups(symbol: string, candles: Candle[]): BotSignal[] {
  if (candles.length < 60) return []
  const close = candles.map(c => c.close)
  const high = candles.map(c => c.high)
  const low = candles.map(c => c.low)
  const last = candles[candles.length - 1]
  const price = last.close

  // RSI filter
  const r = rsi(close, 14)
  const rsiNow = r[r.length - 1]

  // Trend via slope of EMA(50)
  const ema50 = emaArray(close, 50)
  const trendSlope = slope(ema50, 20)
  const trendUp = trendSlope > 0
  const trendDown = trendSlope < 0

  // FVG detection
  const fvg = detectFVG(high, low)
  const lastFvg = fvg[fvg.length - 1]

  // Swings for Fib
  const swing = lastSwing(high, low)

  const pivots = findPivots(high, low, 3)

  const signals: BotSignal[] = []

  if (swing && lastFvg) {
    if (swing.dir === 'up' && trendUp && rsiNow && rsiNow > 40 && rsiNow < 70) {
      const level618 = fibLevel(swing.high, swing.low, 0.618)
      const level786 = fibLevel(swing.high, swing.low, 0.786)
      const zoneLow = Math.min(level618, level786)
      const zoneHigh = Math.max(level618, level786)
      const nearFvg = lastFvg.type === 'bull' && lastFvg.low <= zoneHigh && lastFvg.high >= zoneLow
      if (nearFvg && price > zoneHigh) {
        const entry = level618
        const stop = Math.min(...low.slice(swing.from, swing.to + 1))
        const take = swing.high
        if (rrAtLeast(entry, stop, take, 2)) {
          signals.push(buildSignal(symbol, '15m', 'LONG', `Fib 0.618/0.786 + Bull FVG + Trend up + RSI ${rsiNow.toFixed(0)}`, entry, stop, take))
        }
      }
    }
    if (swing && swing.dir === 'down' && trendDown && rsiNow && rsiNow < 60 && rsiNow > 30) {
      const level618 = fibLevel(swing.low, swing.high, 0.382) // mirror for short pullback
      const level786 = fibLevel(swing.low, swing.high, 0.214)
      const zoneLow = Math.min(level618, level786)
      const zoneHigh = Math.max(level618, level786)
      const nearFvg = lastFvg.type === 'bear' && lastFvg.high >= zoneLow && lastFvg.low <= zoneHigh
      if (nearFvg && price < zoneLow) {
        const entry = level618
        const stop = Math.max(...high.slice(swing.to, swing.from + 1).filter(n => isFinite(n))) || Math.max(...high)
        const take = swing.low
        if (rrAtLeast(entry, stop, take, 2)) {
          signals.push(buildSignal(symbol, '15m', 'SHORT', `Fib pullback + Bear FVG + Trend down + RSI ${rsiNow.toFixed(0)}`, entry, stop, take))
        }
      }
    }
  }

  // Support/Resistance proximity (use recent pivots)
  const nearest = pivots.length ? pivots[pivots.length - 1].price : price
  if (Math.abs((price - nearest) / price) < 0.003) {
    const side: 'LONG' | 'SHORT' = price > nearest ? 'LONG' : 'SHORT'
    const stop = side === 'LONG' ? Math.min(...low.slice(-10)) : Math.max(...high.slice(-10))
    const take = side === 'LONG' ? price + (price - stop) * 2.5 : price - (stop - price) * 2.5
    signals.push(buildSignal(symbol, '15m', side, 'SR proximity confluence', price, stop, take))
  }

  return signals
}

function emaArray(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = []
  let prev = values[0]
  out.push(prev)
  for (let i = 1; i < values.length; i++) { const v = values[i] * k + prev * (1 - k); out.push(v); prev = v }
  return out
}

function rrAtLeast(entry: number, stop: number, take: number, minRR: number): boolean {
  const risk = Math.abs(entry - stop)
  const reward = Math.abs(take - entry)
  return risk > 0 && reward / risk >= minRR
}

function buildSignal(symbol: string, timeframe: '5m' | '15m' | '1h', side: 'LONG' | 'SHORT', reason: string, entry: number, stop: number, take: number): BotSignal {
  return {
    id: `${symbol}-${Date.now()}`,
    symbol,
    timeframe,
    side,
    reason,
    entry: Number(entry.toFixed(4)),
    stop: Number(stop.toFixed(4)),
    take: Number(take.toFixed(4)),
    created_at: new Date().toISOString(),
  }
}

export async function insertBotTrade(signal: BotSignal, size = 100): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) throw new Error('Please sign in to save bot trades')
  const payload = {
    user_id: user.id,
    date: new Date().toISOString(),
    symbol: signal.symbol,
    side: signal.side,
    entry: signal.entry,
    stop: signal.stop,
    take: signal.take,
    size,
    reason: `[BOT] ${signal.reason}`,
  }
  const { error } = await supabase.from('trades').insert(payload)
  if (error) throw error
}



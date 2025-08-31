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
  tags?: string[]
  confidence?: number // 0-100
}

export type BotRuntimeOptions = {
  symbols?: string[]
  interval?: '5m' | '15m' | '1h'
  topCount?: number
  onSignals?: (signals: BotSignal[]) => void
  strategy?: StrategyConfig
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
        const s = detectSetups(sym, candles, this.opts.strategy)
        all.push(...s)
      } catch {}
    }))
    let deduped = dedupeSignals(all)
    // Optional per-symbol limit and ordering
    const order = this.opts.strategy?.order || 'confidence'
    if (this.opts.strategy?.maxSignalsPerSymbol && this.opts.strategy.maxSignalsPerSymbol > 0) {
      const limit = this.opts.strategy.maxSignalsPerSymbol
      const groups = new Map<string, BotSignal[]>()
      for (const s of deduped) {
        const g = groups.get(s.symbol) || []
        g.push(s)
        groups.set(s.symbol, g)
      }
      const merged: BotSignal[] = []
      for (const [_, arr] of groups) {
        arr.sort((a,b) => order === 'confidence' ? (b.confidence ?? 0) - (a.confidence ?? 0) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        merged.push(...arr.slice(0, limit))
      }
      deduped = merged
    }
    this.signals = deduped
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

export type StrategyConfig = {
  enabled?: Partial<Record<'FIB'|'FVG'|'SR'|'TREND'|'RSI', boolean>>
  weights?: Partial<Record<'FIB'|'FVG'|'SR'|'TREND'|'RSI'|'RR', number>> // 0..1
  marketBias?: 'bearish' | 'neutral' | 'bullish'
  order?: 'confidence' | 'time'
  maxSignalsPerSymbol?: number
}

function isEnabled(tag: string, strategy?: StrategyConfig) {
  // @ts-ignore
  const e = strategy?.enabled?.[tag as any]
  return e !== false
}

function weightOf(f: 'FIB'|'FVG'|'SR'|'TREND'|'RSI'|'RR', strategy?: StrategyConfig) {
  const w = strategy?.weights?.[f]
  return typeof w === 'number' ? Math.max(0, Math.min(1, w)) : 1
}

function detectSetups(symbol: string, candles: Candle[], strategy?: StrategyConfig): BotSignal[] {
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
      // 1) Fib + FVG confluence pullback
      if (nearFvg && price > zoneHigh) {
        const entry = level618
        const stop = Math.min(...low.slice(swing.from, swing.to + 1))
        const take = swing.high
        if (rrAtLeast(entry, stop, take, 2) && isEnabled('FIB', strategy) && isEnabled('FVG', strategy) && isEnabled('TREND', strategy) && isEnabled('RSI', strategy)) {
          const tags = ['FIB','FVG','TREND','RSI']
          const conf = scoreConfidence({ trendUp: true, rsi: rsiNow, hasFvg: true, sr: false, rr: computeRR(entry, stop, take) }, strategy)
          const confAdj = adjustForBias(conf, 'LONG', strategy)
          signals.push(buildSignal(symbol, '15m', 'LONG', `Fib 0.618/0.786 + Bull FVG + Trend up + RSI ${rsiNow.toFixed(0)}`, entry, stop, take, tags, confAdj))
        }
      }
      // 2) Pure Fib pullback (no FVG requirement)
      if (price > zoneLow && price < zoneHigh) {
        const entry = level618
        const stop = Math.min(...low.slice(swing.from, swing.to + 1))
        const take = swing.high
        if (rrAtLeast(entry, stop, take, 1.8) && isEnabled('FIB', strategy) && isEnabled('TREND', strategy)) {
          const tags = ['FIB','TREND']
          const conf = scoreConfidence({ trendUp: true, rsi: rsiNow, hasFvg: false, sr: false, rr: computeRR(entry, stop, take) }, strategy)
          const confAdj = adjustForBias(conf, 'LONG', strategy)
          signals.push(buildSignal(symbol, '15m', 'LONG', `Fibonacci retrace 0.618 (trend up)`, entry, stop, take, tags, confAdj))
        }
      }
      // 3) Bull FVG retest (price inside last FVG)
      if (lastFvg.type === 'bull' && price >= lastFvg.low && price <= lastFvg.high) {
        const entry = (lastFvg.low + lastFvg.high) / 2
        const stop = lastFvg.low - Math.abs(lastFvg.high - lastFvg.low) * 0.2
        const take = swing.high
        if (rrAtLeast(entry, stop, take, 1.8) && isEnabled('FVG', strategy) && isEnabled('TREND', strategy)) {
          const tags = ['FVG','TREND']
          const conf = scoreConfidence({ trendUp: true, hasFvg: true, sr: false, rr: computeRR(entry, stop, take) }, strategy)
          const confAdj = adjustForBias(conf, 'LONG', strategy)
          signals.push(buildSignal(symbol, '15m', 'LONG', `Bull FVG retest within gap`, entry, stop, take, tags, confAdj))
        }
      }
    }
    if (swing && swing.dir === 'down' && trendDown && rsiNow && rsiNow < 60 && rsiNow > 30) {
      const level618 = fibLevel(swing.low, swing.high, 0.382) // mirror for short pullback
      const level786 = fibLevel(swing.low, swing.high, 0.214)
      const zoneLow = Math.min(level618, level786)
      const zoneHigh = Math.max(level618, level786)
      const nearFvg = lastFvg.type === 'bear' && lastFvg.high >= zoneLow && lastFvg.low <= zoneHigh
      // 1) Fib + FVG confluence pullback (short)
      if (nearFvg && price < zoneLow) {
        const entry = level618
        const stop = Math.max(...high.slice(swing.to, swing.from + 1).filter(n => isFinite(n))) || Math.max(...high)
        const take = swing.low
        if (rrAtLeast(entry, stop, take, 2) && isEnabled('FIB', strategy) && isEnabled('FVG', strategy) && isEnabled('TREND', strategy) && isEnabled('RSI', strategy)) {
          const tags = ['FIB','FVG','TREND','RSI']
          const conf = scoreConfidence({ trendDown: true, rsi: rsiNow, hasFvg: true, sr: false, rr: computeRR(entry, stop, take) }, strategy)
          const confAdj = adjustForBias(conf, 'SHORT', strategy)
          signals.push(buildSignal(symbol, '15m', 'SHORT', `Fib pullback + Bear FVG + Trend down + RSI ${rsiNow.toFixed(0)}`, entry, stop, take, tags, confAdj))
        }
      }
      // 2) Pure Fib pullback (short)
      if (price > zoneLow && price < zoneHigh) {
        const entry = level618
        const stop = Math.max(...high.slice(swing.to, swing.from + 1).filter(n => isFinite(n))) || Math.max(...high)
        const take = swing.low
        if (rrAtLeast(entry, stop, take, 1.8) && isEnabled('FIB', strategy) && isEnabled('TREND', strategy)) {
          const tags = ['FIB','TREND']
          const conf = scoreConfidence({ trendDown: true, rsi: rsiNow, hasFvg: false, sr: false, rr: computeRR(entry, stop, take) }, strategy)
          const confAdj = adjustForBias(conf, 'SHORT', strategy)
          signals.push(buildSignal(symbol, '15m', 'SHORT', `Fibonacci retrace 0.618 (trend down)`, entry, stop, take, tags, confAdj))
        }
      }
      // 3) Bear FVG retest
      if (lastFvg.type === 'bear' && price >= lastFvg.low && price <= lastFvg.high) {
        const entry = (lastFvg.low + lastFvg.high) / 2
        const stop = lastFvg.high + Math.abs(lastFvg.high - lastFvg.low) * 0.2
        const take = swing.low
        if (rrAtLeast(entry, stop, take, 1.8) && isEnabled('FVG', strategy) && isEnabled('TREND', strategy)) {
          const tags = ['FVG','TREND']
          const conf = scoreConfidence({ trendDown: true, hasFvg: true, sr: false, rr: computeRR(entry, stop, take) }, strategy)
          const confAdj = adjustForBias(conf, 'SHORT', strategy)
          signals.push(buildSignal(symbol, '15m', 'SHORT', `Bear FVG retest within gap`, entry, stop, take, tags, confAdj))
        }
      }
    }
  }

  // Support/Resistance proximity (use recent pivots)
  const nearest = pivots.length ? pivots[pivots.length - 1].price : price
  if (Math.abs((price - nearest) / price) < 0.002 && isEnabled('SR', strategy)) {
    const side: 'LONG' | 'SHORT' = price > nearest ? 'LONG' : 'SHORT'
    const stop = side === 'LONG' ? Math.min(...low.slice(-10)) : Math.max(...high.slice(-10))
    const take = side === 'LONG' ? price + (price - stop) * 2.5 : price - (stop - price) * 2.5
    const rr = computeRR(price, stop, take)
    const conf = scoreConfidence({ sr: true, rr }, strategy)
    const confAdj = adjustForBias(conf, side, strategy)
    signals.push(buildSignal(symbol, '15m', side, 'SR proximity confluence', price, stop, take, ['SR'], confAdj))
  }

  // RSI oversold/overbought snap with trend filter
  if (rsiNow != null && isEnabled('RSI', strategy)) {
    if (rsiNow < 30 && trendUp && isEnabled('TREND', strategy)) {
      const stop = Math.min(...low.slice(-10))
      const entry = price
      const take = entry + (entry - stop) * 2.2
      if (rrAtLeast(entry, stop, take, 1.6)) {
        const conf = scoreConfidence({ rsi: rsiNow, trendUp: true, rr: computeRR(entry, stop, take) }, strategy)
        const confAdj = adjustForBias(conf, 'LONG', strategy)
        signals.push(buildSignal(symbol, '15m', 'LONG', 'RSI oversold bounce (trend up)', entry, stop, take, ['RSI','TREND'], confAdj))
      }
    }
    if (rsiNow > 70 && trendDown && isEnabled('TREND', strategy)) {
      const stop = Math.max(...high.slice(-10))
      const entry = price
      const take = entry - (stop - entry) * 2.2
      if (rrAtLeast(entry, stop, take, 1.6)) {
        const conf = scoreConfidence({ rsi: rsiNow, trendDown: true, rr: computeRR(entry, stop, take) }, strategy)
        const confAdj = adjustForBias(conf, 'SHORT', strategy)
        signals.push(buildSignal(symbol, '15m', 'SHORT', 'RSI overbought fade (trend down)', entry, stop, take, ['RSI','TREND'], confAdj))
      }
    }
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

function buildSignal(symbol: string, timeframe: '5m' | '15m' | '1h', side: 'LONG' | 'SHORT', reason: string, entry: number, stop: number, take: number, tags: string[] = [], confidence = 50): BotSignal {
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
    tags,
    confidence,
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

function computeRR(entry: number, stop: number, take: number): number | null {
  const risk = Math.abs(entry - stop)
  if (risk === 0) return null
  const reward = Math.abs(take - entry)
  return reward / risk
}

function scoreConfidence(opts: { trendUp?: boolean; trendDown?: boolean; rsi?: number; hasFvg?: boolean; sr?: boolean; rr?: number | null }, strategy?: StrategyConfig): number {
  let score = 0
  const wTREND = weightOf('TREND', strategy)
  const wFVG = weightOf('FVG', strategy)
  const wSR = weightOf('SR', strategy)
  const wRSI = weightOf('RSI', strategy)
  const wRR = weightOf('RR', strategy)
  if (opts.trendUp || opts.trendDown) score += 25 * wTREND
  if (opts.hasFvg) score += 20 * wFVG
  if (opts.sr) score += 15 * wSR
  if (opts.rr != null) score += Math.min(40, Math.max(0, (opts.rr - 1) * 20)) * wRR
  if (opts.rsi != null) {
    const dist = Math.min(Math.abs(50 - opts.rsi), 25)
    score += (25 - dist) * 0.4 * wRSI
  }
  return Math.round(Math.max(0, Math.min(100, score)))
}

function adjustForBias(conf: number, side: 'LONG'|'SHORT', strategy?: StrategyConfig) {
  const bias = strategy?.marketBias || 'neutral'
  if (bias === 'neutral') return conf
  const boost = 10
  if (bias === 'bullish' && side === 'LONG') return Math.min(100, conf + boost)
  if (bias === 'bearish' && side === 'SHORT') return Math.min(100, conf + boost)
  return conf
}



export type SeriesPoint = { time: number; value: number }

export function sma(values: number[], period: number): number[] {
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    out.push(i >= period - 1 ? sum / period : NaN)
  }
  return out
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = []
  const k = 2 / (period + 1)
  let prev = values[0]
  out.push(prev)
  for (let i = 1; i < values.length; i++) {
    const v = values[i] * k + prev * (1 - k)
    out.push(v)
    prev = v
  }
  return out
}

export function rsi(values: number[], period = 14): number[] {
  if (values.length === 0) return []
  const gains: number[] = [0]
  const losses: number[] = [0]
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? -diff : 0)
  }
  const avgGain = ema(gains, period)
  const avgLoss = ema(losses, period)
  return avgGain.map((g, i) => {
    const l = avgLoss[i]
    if (!isFinite(g) || !isFinite(l) || l === 0) return 100
    const rs = g / l
    return 100 - 100 / (1 + rs)
  })
}

export type Pivot = { index: number; price: number; type: 'high' | 'low' }

export function findPivots(high: number[], low: number[], lookback = 3): Pivot[] {
  const pivots: Pivot[] = []
  for (let i = lookback; i < high.length - lookback; i++) {
    let isHigh = true, isLow = true
    for (let j = 1; j <= lookback; j++) {
      if (high[i] <= high[i - j] || high[i] <= high[i + j]) isHigh = false
      if (low[i] >= low[i - j] || low[i] >= low[i + j]) isLow = false
      if (!isHigh && !isLow) break
    }
    if (isHigh) pivots.push({ index: i, price: high[i], type: 'high' })
    else if (isLow) pivots.push({ index: i, price: low[i], type: 'low' })
  }
  return pivots
}

export type FVG = { start: number; end: number; type: 'bull' | 'bear'; high: number; low: number }

export function detectFVG(high: number[], low: number[]): FVG[] {
  const gaps: FVG[] = []
  for (let i = 2; i < high.length; i++) {
    const h0 = high[i - 2], l0 = low[i - 2]
    const h2 = high[i], l2 = low[i]
    if (l2 > h0) gaps.push({ start: i - 2, end: i, type: 'bull', high: h0, low: l2 })
    if (h2 < l0) gaps.push({ start: i - 2, end: i, type: 'bear', high: h2, low: l0 })
  }
  return gaps
}

export function lastSwing(high: number[], low: number[]): { dir: 'up' | 'down'; from: number; to: number; high: number; low: number } | null {
  const piv = findPivots(high, low, 3)
  if (piv.length < 2) return null
  const p1 = piv[piv.length - 1]
  const p0 = piv[piv.length - 2]
  if (p0.type === 'low' && p1.type === 'high') {
    return { dir: 'up', from: p0.index, to: p1.index, high: p1.price, low: p0.price }
  }
  if (p0.type === 'high' && p1.type === 'low') {
    return { dir: 'down', from: p0.index, to: p1.index, high: p0.price, low: p1.price }
  }
  return null
}

export function fibLevel(a: number, b: number, ratio: number): number {
  return a + (b - a) * ratio
}

export function nearestLevels(pivots: Pivot[], price: number, max = 5): number[] {
  const sorted = [...pivots]
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
    .slice(0, max)
    .map(p => p.price)
  return sorted
}

export function slope(values: number[], period = 20): number {
  if (values.length < period) return 0
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  for (let i = 0; i < period; i++) {
    const x = i
    const y = values[values.length - period + i]
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x
  }
  const n = period
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}



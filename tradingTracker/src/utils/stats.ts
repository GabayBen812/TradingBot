import type { Trade } from '../types'

function normalizeToEntry(entry: number, value: number): number {
  if (!isFinite(entry) || !isFinite(value) || entry === 0) return value
  let v = value
  const e = Math.abs(entry)
  let i = 0
  // Bring v within ~[e/10, e*10] to avoid order-of-magnitude typos
  while (Math.abs(v) > e * 10 && i < 6) { v = v / 10; i++ }
  while (Math.abs(v) < e / 10 && Math.abs(v) > 0 && i < 12) { v = v * 10; i++ }
  return v
}

export function computeRiskPct(entry?: number | null, stop?: number | null): number | null {
  if (entry == null || stop == null) return null
  const risk = Math.abs(entry - stop)
  return (risk / entry) * 100
}

export function computeRR(entry?: number | null, stop?: number | null, take?: number | null): number | null {
  if (entry == null || stop == null || take == null) return null
  const risk = Math.abs(entry - stop)
  if (risk === 0) return null
  const reward = Math.abs(take - entry)
  return reward / risk
}

export function computePnLValue(t: Trade): number | null {
  if (t.exit == null || t.entry == null || t.size == null) return null
  // Guard against accidental decimal scale mismatches (e.g., entry in 18 decimals, exit raw)
  const entry = Number(t.entry)
  let exit = Number(t.exit)
  if (!isFinite(entry) || !isFinite(exit)) return null
  exit = normalizeToEntry(entry, exit)
  const direction = t.side === 'LONG' ? 1 : -1
  const pct = ((exit - entry) / entry) * direction
  return pct * t.size
}

export function computeOutcome(t: Trade): 'W' | 'L' | '-' {
  if (t.exit == null || t.entry == null) return '-'
  const isWin = (t.side === 'LONG' && (t.exit as number) > (t.entry as number)) ||
                (t.side === 'SHORT' && (t.exit as number) < (t.entry as number))
  return isWin ? 'W' : 'L'
}

export function computeRealizedR(t: Trade): number | null {
  if (t.entry == null || t.stop == null || t.exit == null) return null
  const entry = Number(t.entry)
  let stop = Number(t.stop)
  let exit = Number(t.exit)
  if (!isFinite(entry) || !isFinite(stop) || !isFinite(exit)) return null
  stop = normalizeToEntry(entry, stop)
  exit = normalizeToEntry(entry, exit)
  const riskPerUnit = Math.abs(entry - stop)
  if (riskPerUnit === 0) return null
  const direction = t.side === 'LONG' ? 1 : -1
  const move = (exit - entry) * direction
  return move / riskPerUnit
}

export function computeReturnPct(t: Trade): number | null {
  if (t.entry == null || t.exit == null) return null
  const direction = t.side === 'LONG' ? 1 : -1
  return ((t.exit - t.entry) / t.entry) * direction
}

export function computeRiskDollar(t: Trade): number | null {
  // Approximate risk in quote currency, assuming size is quote exposure
  if (t.entry == null || t.stop == null || t.size == null) return null
  const riskPct = Math.abs(t.entry - t.stop) / t.entry
  return riskPct * t.size
}

export function aggregateStats(trades: Trade[]) {
  let wins = 0, total = 0
  let grossProfit = 0, grossLoss = 0
  let rrSum = 0, rrCount = 0
  const equity: { date: string; value: number }[] = []
  const equityR: { date: string; rsum: number }[] = []
  let running = 0
  let runningR = 0
  let totalRisk = 0

  for (const t of trades.slice().sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime())) {
    const pnl = computePnLValue(t)
    if (pnl != null) {
      running += pnl
      equity.push({ date: new Date(t.date).toLocaleDateString(), value: Number(running.toFixed(2)) })
    }
    const r = computeRealizedR(t)
    if (r != null) {
      runningR += r
      equityR.push({ date: new Date(t.date).toLocaleDateString(), rsum: Number(runningR.toFixed(2)) })
    }

    if (t.exit != null && t.entry != null) {
      total++
      const out = computeOutcome(t)
      if (out === 'W') wins++
      const value = pnl ?? 0
      if (value >= 0) grossProfit += value; else grossLoss += Math.abs(value)

      const rr = computeRR(t.entry, t.stop ?? null, t.take ?? null)
      if (rr != null) { rrSum += rr; rrCount++ }

      const risk$ = computeRiskDollar(t)
      if (risk$ != null) totalRisk += risk$
    }
  }

  return {
    winRate: total ? (wins / total) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    avgRR: rrCount ? rrSum / rrCount : 0,
    equity,
    equityR,
    totals: { grossProfit, grossLoss, net: grossProfit - grossLoss },
    totalRisk,
    portfolioR: totalRisk > 0 ? (grossProfit - grossLoss) / totalRisk : 0,
  }
}

export function groupByHourWinRate(trades: Trade[]) {
  const buckets = new Map<number, { wins: number; total: number }>()
  for (const t of trades) {
    if (t.exit == null || t.entry == null) continue
    const d = new Date(t.date)
    const h = d.getHours()
    const b = buckets.get(h) || { wins: 0, total: 0 }
    b.total++
    if (computeOutcome(t) === 'W') b.wins++
    buckets.set(h, b)
  }
  return Array.from({ length: 24 }, (_, h) => {
    const b = buckets.get(h) || { wins: 0, total: 0 }
    return { hour: `${h}:00`, winRate: b.total ? (b.wins / b.total) * 100 : 0 }
  })
}

export function histogramR(trades: Trade[]) {
  const rs: number[] = []
  for (const t of trades) {
    const r = computeRealizedR(t)
    if (r != null) rs.push(r)
  }
  const bins = [-5,-3,-2,-1,-0.5,0,0.5,1,2,3,5]
  const labels = ["≤-5","-5:-3","-3:-2","-2:-1","-1:-0.5","-0.5:0","0:0.5","0.5:1","1:2","2:3","≥3"]
  const counts = new Array(labels.length).fill(0)
  for (const r of rs) {
    let idx = 0
    if (r <= -5) idx = 0
    else if (r < -3) idx = 1
    else if (r < -2) idx = 2
    else if (r < -1) idx = 3
    else if (r < -0.5) idx = 4
    else if (r < 0) idx = 5
    else if (r < 0.5) idx = 6
    else if (r < 1) idx = 7
    else if (r < 2) idx = 8
    else if (r < 3) idx = 9
    else idx = 10
    counts[idx]++
  }
  return labels.map((bucket, i) => ({ bucket, count: counts[i] }))
}
import type { Trade } from '../types'

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
  const direction = t.side === 'LONG' ? 1 : -1
  const pct = ((t.exit - t.entry) / t.entry) * direction
  return pct * t.size
}

export function computeOutcome(t: Trade): 'W' | 'L' | '-' {
  if (t.exit == null || t.entry == null) return '-'
  const isWin = (t.side === 'LONG' && (t.exit as number) > (t.entry as number)) ||
                (t.side === 'SHORT' && (t.exit as number) < (t.entry as number))
  return isWin ? 'W' : 'L'
}

export function aggregateStats(trades: Trade[]) {
  let wins = 0, total = 0
  let grossProfit = 0, grossLoss = 0
  let rrSum = 0, rrCount = 0
  const equity: { date: string; value: number }[] = []
  let running = 0

  for (const t of trades.slice().sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime())) {
    const pnl = computePnLValue(t)
    if (pnl != null) {
      running += pnl
      equity.push({ date: new Date(t.date).toLocaleDateString(), value: Number(running.toFixed(2)) })
    }

    if (t.exit != null && t.entry != null) {
      total++
      const out = computeOutcome(t)
      if (out === 'W') wins++
      const value = pnl ?? 0
      if (value >= 0) grossProfit += value; else grossLoss += Math.abs(value)

      const rr = computeRR(t.entry, t.stop ?? null, t.take ?? null)
      if (rr != null) { rrSum += rr; rrCount++ }
    }
  }

  return {
    winRate: total ? (wins / total) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    avgRR: rrCount ? rrSum / rrCount : 0,
    equity,
    totals: { grossProfit, grossLoss, net: grossProfit - grossLoss },
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
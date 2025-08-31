import React from 'react'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { supabase } from '../supabase/client'
import type { Trade } from '../types'
import { computePnLValue, computeRealizedR } from '../utils/stats'

export default function CrossAnalytics() {
  const [trades, setTrades] = React.useState<Trade[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    (async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('date', { ascending: true })
      if (!error) setTrades((data ?? []) as any)
      setLoading(false)
    })()
  }, [])

  const symbolPerf = React.useMemo(() => {
    const map: Record<string, { wins: number; total: number; rsum: number }> = {}
    for (const t of trades) {
      if (t.exit == null || t.entry == null || t.stop == null) continue
      const sym = t.symbol
      const m = map[sym] || { wins: 0, total: 0, rsum: 0 }
      const dir = t.side === 'LONG' ? 1 : -1
      const r = ((t.exit - t.entry) * dir) / Math.abs(t.entry - t.stop)
      m.total++
      m.rsum += r
      if (r > 0) m.wins++
      map[sym] = m
    }
    return Object.entries(map).map(([symbol, v]) => ({ symbol, winRate: v.total ? (v.wins / v.total) * 100 : 0, avgR: v.total ? v.rsum / v.total : 0, trades: v.total }))
  }, [trades])

  const { equity$, equityR, totals } = React.useMemo(() => {
    const sorted = trades.slice().filter(t => t.exit != null).sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime())
    const e$: number[] = []
    const eR: number[] = []
    let running$ = 0
    let runningR = 0
    let wins = 0, total = 0
    for (const t of sorted) {
      const pnl$ = computePnLValue(t as any) || 0
      const r = computeRealizedR(t as any) || 0
      running$ += pnl$
      runningR += r
      e$.push(Number(running$.toFixed(2)))
      eR.push(Number(runningR.toFixed(2)))
      total++
      if (r > 0) wins++
    }
    return { equity$: e$, equityR: eR, totals: { pnl: running$, totalR: runningR, winRate: total ? (wins/total)*100 : 0 } }
  }, [trades])

  const Sparkline: React.FC<{ data: number[]; height?: number; label?: string; color?: string }> = ({ data, height = 160, label, color = '#34D399' }) => {
    const width = 640
    if (data.length === 0) return <div className="text-gray-400 text-sm">No data</div>
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const stepX = width / (data.length - 1)
    const points = data.map((v, i) => {
      const x = i * stepX
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    }).join(' ')
    const last = data[data.length - 1]
    return (
      <div>
        {label && <div className="text-sm text-gray-300 mb-2">{label} <span className="text-gray-400">(min {min.toFixed(2)}, max {max.toFixed(2)}, last {last.toFixed(2)})</span></div>}
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
          <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cross Analytics</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold">Overview</div>
        </CardHeader>
        <CardBody>
          {loading ? (<div className="text-gray-400">Loading…</div>) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <Sparkline data={equity$} label={`Community Equity ($) — total ${totals.pnl.toFixed(2)}$`} color="#60A5FA" />
                <div className="mt-6"><Sparkline data={equityR} label={`Cumulative R — total ${totals.totalR.toFixed(2)} R`} color="#F59E0B" /></div>
              </div>
              <div>
                <div className="text-sm text-gray-300 mb-2">Per-symbol performance (all users)</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="text-left px-3 py-2">Symbol</th>
                        <th className="text-right px-3 py-2">Win %</th>
                        <th className="text-right px-3 py-2">Avg R</th>
                        <th className="text-right px-3 py-2">Trades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {symbolPerf.sort((a,b)=> b.trades - a.trades).map((r) => (
                        <tr key={r.symbol} className="border-b border-gray-800">
                          <td className="px-3 py-2">{r.symbol}</td>
                          <td className="px-3 py-2 text-right">{r.winRate.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right">{r.avgR.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{r.trades}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-sm text-gray-400">Overall win rate: {totals.winRate.toFixed(1)}%</div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}



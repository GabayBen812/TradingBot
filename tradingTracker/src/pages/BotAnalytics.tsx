import React from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { fetchBotTrades, type BotTrade } from '@/services/bot'

export default function BotAnalytics() {
  const [trades, setTrades] = React.useState<BotTrade[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const data = await fetchBotTrades({ useMock: false })
        setTrades(data)
      } finally { setLoading(false) }
    })()
  }, [])

  const symbolPerf = React.useMemo(() => {
    const map: Record<string, { wins: number; total: number; rsum: number }> = {}
    for (const t of trades) {
      const k = t.symbol
      const m = map[k] || { wins: 0, total: 0, rsum: 0 }
      if (t.exit != null && t.stop != null) {
        m.total++
        const r = ((t.exit - t.entry) * (t.side === 'LONG' ? 1 : -1)) / Math.abs(t.entry - t.stop)
        m.rsum += r
        if (r > 0) m.wins++
        map[k] = m
      }
    }
    return Object.entries(map).map(([symbol, v]) => ({ symbol, winRate: v.total ? (v.wins / v.total) * 100 : 0, avgR: v.total ? v.rsum / v.total : 0, trades: v.total }))
  }, [trades])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bot Analytics</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold">Per-symbol performance</div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="text-gray-400">Loading…</div>
          ) : (
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
          )}
        </CardBody>
      </Card>

      {/* Placeholder for future charts: equity curve & drawdown */}
      <Card>
        <CardHeader>
          <div className="font-semibold">Equity and Drawdown (coming soon)</div>
        </CardHeader>
        <CardBody>
          <div className="text-gray-400 text-sm">I can add a lightweight chart here with a small library or SVG to visualize equity over time and drawdown.</div>
        </CardBody>
      </Card>
    </div>
  )
}



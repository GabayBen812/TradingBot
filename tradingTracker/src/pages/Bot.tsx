import React from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import { fetchBotTrades, computeBotStats, BotConfig, type BotTrade as SvcBotTrade } from '@/services/bot'
import { ClientBotRuntime, type BotSignal, insertBotTrade } from '@/services/clientBot'
import { ensureNotificationPermission, subscribePush } from '@/utils/push'

type BotTrade = SvcBotTrade

type BotStats = {
  winRate: number
  netPnL: number
  avgTrade: number
  openPositions: number
}

const USE_MOCK = (import.meta as any).env?.VITE_BOT_USE_MOCK === 'true'

export default function Bot() {
  const { t } = useTranslation()
  const [trades, setTrades] = React.useState<BotTrade[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [useMock, setUseMock] = React.useState<boolean>(() => {
    const saved = localStorage.getItem('bot_mode')
    if (saved === 'mock') return true
    if (saved === 'live') return false
    return true // default to mock
  })
  const [signals, setSignals] = React.useState<BotSignal[]>([])
  const runtimeRef = React.useRef<ClientBotRuntime | null>(null)

  const fetchTrades = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchBotTrades({ useMock })
      setTrades(data)
    } catch (e: any) {
      setError(e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }, [useMock])

  React.useEffect(() => {
    fetchTrades()
    const id = setInterval(fetchTrades, 30_000)
    return () => clearInterval(id)
  }, [fetchTrades])

  React.useEffect(() => {
    // Start client bot runtime for scanning signals
    const runtime = new ClientBotRuntime({ onSignals: setSignals })
    runtime.start()
    runtimeRef.current = runtime
    return () => runtime.stop()
  }, [])

  // Push subscription prompt (once)
  React.useEffect(() => {
    (async () => {
      await ensureNotificationPermission()
      await subscribePush()
    })()
  }, [])

  const stats = React.useMemo(() => (trades ? computeBotStats(trades) : null), [trades])
  const [initialCapital, setInitialCapital] = React.useState<number>(() => Number(localStorage.getItem('bot_initial_capital') || '5000'))
  const [riskPerTrade, setRiskPerTrade] = React.useState<number>(() => Number(localStorage.getItem('bot_risk_per_trade') || '100'))
  const equity = React.useMemo(() => {
    // Equity tracks in $ using realized R times configured risk plus initial
    const risk = Number.isFinite(riskPerTrade) ? riskPerTrade : 0
    const realizedR = stats?.totalR ?? 0
    return initialCapital + realizedR * risk
  }, [stats?.totalR, initialCapital, riskPerTrade])

  // Auto-manage open trades: live price, auto-close by SL/TP or timeout
  React.useEffect(() => {
    if (!trades || trades.length === 0) return
    const runtime = runtimeRef.current
    if (!runtime) return
    const interval = setInterval(async () => {
      const open = trades.filter(t => t.exit == null)
      for (const t of open) {
        const price = runtime.getLivePrice(t.symbol)
        if (price == null) continue
        const sl = t.stop ?? null
        const tp = t.take ?? null
        let shouldClose = false
        if (sl != null && tp != null) {
          if (t.side === 'LONG' && (price <= sl || price >= tp)) shouldClose = true
          if (t.side === 'SHORT' && (price >= sl || price <= tp)) shouldClose = true
        }
        // Timeout: 24h since opened
        const openedMs = new Date(t.opened_at).getTime()
        if (!shouldClose && Date.now() - openedMs > 24 * 60 * 60 * 1000) shouldClose = true
        if (shouldClose) {
          try {
            const { error } = await (await import('@/supabase/client')).supabase
              .from('trades')
              .update({ exit: price, closed_at: new Date().toISOString() })
              .eq('id', t.id)
            if (!error) fetchTrades()
          } catch {}
        }
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [trades, fetchTrades])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('bot.title')}</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400 hidden sm:block">{t('bot.mode')}</label>
          <select
            className="bg-gray-800 rounded px-2 py-1 text-sm"
            value={useMock ? 'mock' : 'live'}
            onChange={(e) => { const m = e.target.value === 'mock'; setUseMock(m); localStorage.setItem('bot_mode', m ? 'mock' : 'live') }}
            aria-label={t('bot.mode') as string}
          >
            <option value="mock">{t('bot.mode.mock')}</option>
            <option value="live">{t('bot.mode.live')}</option>
          </select>
          <Button size="sm" variant="secondary" onClick={fetchTrades}>{t('bot.refresh')}</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label={t('bot.kpi.winRate') as string} value={`${stats ? stats.winRate.toFixed(1) : '-'}%`} />
        <StatCard label={t('bot.kpi.netPnl') as string} value={`${stats ? stats.netPnL.toFixed(2) : '-'}`} />
        <StatCard label={t('bot.kpi.avgTrade') as string} value={`${stats ? stats.avgTrade.toFixed(2) : '-'}`} />
        <StatCard label={t('bot.kpi.openPositions') as string} value={`${stats ? stats.openPositions : '-'}`} />
        <StatCard label={t('bot.kpi.equity') as string} value={`${equity.toFixed(2)}`} />
        <StatCard label={t('bot.kpi.totalR') as string} value={`${stats ? stats.totalR.toFixed(2) : '-'}`} />
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <div className="font-semibold">Settings</div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
            <div>
              <div className="text-gray-400 mb-1">{t('bot.settings.initial')}</div>
              <input id="initial-cap" type="number" min={0} value={initialCapital} onChange={(e)=>{ const v = Number(e.target.value || '0'); setInitialCapital(v); localStorage.setItem('bot_initial_capital', String(v)) }} className="bg-gray-800 rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-gray-400 mb-1">{t('bot.settings.risk')}</div>
              <input id="risk-trade" type="number" min={0} value={riskPerTrade} onChange={(e)=>{ const v = Number(e.target.value || '0'); setRiskPerTrade(v); localStorage.setItem('bot_risk_per_trade', String(v)) }} className="bg-gray-800 rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-gray-400 mb-1">Auto-close after (hours)</div>
              <input id="ttl-hours" type="number" min={1} defaultValue={24} className="bg-gray-800 rounded px-3 py-2 w-full" />
            </div>
            <div>
              <div className="text-gray-400 mb-1">Enable notifications</div>
              <button className="bg-gray-700 px-3 py-2 rounded" onClick={async ()=>{ await ensureNotificationPermission(); await subscribePush(); alert('Notifications enabled (if permitted)') }}>Enable</button>
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={()=>{ fetchTrades(); runtimeRef.current?.start?.() }}>Scan now</Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* System status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-semibold">{t('bot.section.status')}</div>
            <span className={`text-xs px-2 py-0.5 rounded ${error ? 'bg-red-600' : loading ? 'bg-amber-600' : 'bg-emerald-600'}`}>
              {error ? t('bot.status.error') : loading ? t('bot.status.loading') : t('bot.status.healthy')}
            </span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="text-sm text-gray-300 flex flex-wrap gap-6">
            <div>
              <div className="text-gray-400">{t('bot.status.source')}</div>
              <div className="font-medium">{useMock ? t('bot.mode.mock') : t('bot.mode.live')}</div>
            </div>
            <div>
              <div className="text-gray-400">{t('bot.status.endpoint')}</div>
              <div className="font-mono text-xs break-all">{BotConfig.API_BASE}/trades</div>
            </div>
            <div>
              <div className="text-gray-400">{t('bot.status.updated')}</div>
              <div>{new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Trades table */}
      {/* Signals */}
      {signals.length > 0 && (
        <Card>
          <CardHeader className="bg-gray-900">
            <div className="font-semibold">{t('bot.section.signals')}</div>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left px-3 py-2">{t('bot.table.timeOpen')}</th>
                    <th className="text-left px-3 py-2">{t('bot.table.symbol')}</th>
                    <th className="text-left px-3 py-2">TF</th>
                    <th className="text-left px-3 py-2">{t('bot.table.side')}</th>
                    <th className="text-left px-3 py-2">Reason</th>
                    <th className="text-right px-3 py-2">{t('bot.table.entry')}</th>
                    <th className="text-right px-3 py-2">{t('table.sl')}</th>
                    <th className="text-right px-3 py-2">{t('table.tp')}</th>
                    <th className="text-right px-3 py-2">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map(s => (
                    <tr key={s.id} className="border-b border-gray-800">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{s.symbol}</td>
                      <td className="px-3 py-2">{s.timeframe}</td>
                      <td className="px-3 py-2">{s.side}</td>
                      <td className="px-3 py-2 max-w-[28ch] truncate" title={s.reason}>{s.reason}</td>
                      <td className="px-3 py-2 text-right">{s.entry.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">{s.stop.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">{s.take.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" onClick={async () => {
                          try { await insertBotTrade(s, 200); alert('Inserted bot trade to Supabase'); }
                          catch (e: any) { alert(e?.message || 'Failed') }
                        }}>{t('actions.save') || 'Save'}</Button>
                        <Button size="sm" variant="secondary" className="ml-2" onClick={() => {
                          const qp = new URLSearchParams({ symbol: s.symbol, side: s.side, tf: s.timeframe, entry: String(s.entry), stop: String(s.stop), take: String(s.take), reason: s.reason })
                          window.open(`/bot/signal?${qp.toString()}`, '_blank')
                        }}>View</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
      {loading && <div>{t('common.loading')}</div>}
      {error && !useMock && (
        <div className="text-red-400 mb-3">
          {t('bot.error', { msg: error })}
        </div>
      )}
      {!loading && !error && (!trades || trades.length === 0) && (
        <div className="text-gray-400">{t('bot.empty')}</div>
      )}
      {trades && trades.length > 0 && (
        <Card>
          <CardHeader className="bg-gray-900">
            <div className="font-semibold">{t('bot.section.trades')}</div>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left px-3 py-2">{t('bot.table.timeOpen')}</th>
                    <th className="text-left px-3 py-2">{t('bot.table.symbol')}</th>
                    <th className="text-left px-3 py-2">{t('bot.table.side')}</th>
                    <th className="text-right px-3 py-2">{t('bot.table.entry')}</th>
                    <th className="text-right px-3 py-2">{t('table.sl')}</th>
                    <th className="text-right px-3 py-2">{t('table.tp')}</th>
                    <th className="text-right px-3 py-2">Live</th>
                    <th className="text-right px-3 py-2">{t('bot.table.exit')}</th>
                    <th className="text-right px-3 py-2">{t('bot.table.pnl')}</th>
                    <th className="text-left px-3 py-2">{t('bot.table.timeClose')}</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trow) => {
                    const live = runtimeRef.current?.getLivePrice(trow.symbol)
                    return (
                    <tr key={trow.id} className="border-b border-gray-800 hover:bg-gray-800/60">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(trow.opened_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{trow.symbol}</td>
                      <td className="px-3 py-2">{trow.side}</td>
                      <td className="px-3 py-2 text-right">{trow.entry.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">{trow.stop != null ? trow.stop.toFixed(4) : '-'}</td>
                      <td className="px-3 py-2 text-right">{trow.take != null ? trow.take.toFixed(4) : '-'}</td>
                      <td className="px-3 py-2 text-right">{live != null ? live.toFixed(4) : '-'}</td>
                      <td className="px-3 py-2 text-right">{trow.exit != null ? trow.exit.toFixed(4) : '-'}</td>
                      <td className={`px-3 py-2 text-right ${trow.pnl != null ? (trow.pnl >= 0 ? 'text-emerald-400' : 'text-red-400') : ''}`}>{trow.pnl != null ? trow.pnl.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{trow.closed_at ? new Date(trow.closed_at).toLocaleString() : '-'}</td>
                    </tr>)
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}



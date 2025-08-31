import React from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import { fetchBotTrades, computeBotStats, BotConfig, type BotTrade as SvcBotTrade } from '@/services/bot'
import { ClientBotRuntime, type BotSignal, insertBotTrade, placeBotOrder, type StrategyConfig } from '@/services/clientBot'
import { fetchKlines } from '@/sage/market'
import { ensureNotificationPermission, subscribePush } from '@/utils/push'
import { supabase } from '@/supabase/client'

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
  const [strategy, setStrategy] = React.useState<StrategyConfig>(() => {
    try { return JSON.parse(localStorage.getItem('bot_strategy') || '{}') } catch { return {} }
  })
  const [showSettings, setShowSettings] = React.useState(false)
  const [showSignalControls, setShowSignalControls] = React.useState(false)
  const [signalTf, setSignalTf] = React.useState<'5m'|'15m'|'1h'>(() => (localStorage.getItem('bot_signal_tf') as any) || '15m')
  const [minConf, setMinConf] = React.useState<number>(() => Number(localStorage.getItem('bot_min_conf') || '0'))
  const [tagFilter, setTagFilter] = React.useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('bot_tag_filter') || '{}') } catch { return {} }
  })
  type OrderRow = { id: string; created_at: string; filled_at?: string | null; symbol: string; side: 'LONG'|'SHORT'; entry: number; stop?: number|null; take?: number|null; size?: number|null; status: 'PENDING'|'FILLED'|'CANCELED' }
  const [orders, setOrders] = React.useState<OrderRow[]>([])
  type SigStatus = 'NEW' | 'WATCHING' | 'IGNORED' | 'SAVED'
  type SigState = { status: SigStatus; snoozeUntil?: number }
  const [sigState, setSigState] = React.useState<Record<string, SigState>>(() => {
    try { return JSON.parse(localStorage.getItem('bot_signal_state_v1') || '{}') } catch { return {} }
  })
  const [tab, setTab] = React.useState<SigStatus>('NEW')
  const setSig = (id: string, partial: Partial<SigState>) => {
    setSigState(s => { const curr = s[id] || { status: 'NEW' as SigStatus }; const n = { ...s, [id]: { ...curr, ...partial } }; localStorage.setItem('bot_signal_state_v1', JSON.stringify(n)); return n })
  }

  const applyPreset = (preset: 'balanced' | 'highProb' | 'highR') => {
    if (preset === 'balanced') {
      setStrategy(s => ({ ...s, weights: { FIB: 1, FVG: 1, SR: 1, TREND: 1, RSI: 1, RR: 1 }, marketBias: 'neutral' }))
    } else if (preset === 'highProb') {
      setStrategy(s => ({ ...s, weights: { FIB: 1, FVG: 1, SR: 1, TREND: 1, RSI: 1, RR: 0.5 }, marketBias: 'neutral' }))
    } else if (preset === 'highR') {
      setStrategy(s => ({ ...s, weights: { FIB: 0.8, FVG: 0.8, SR: 0.6, TREND: 0.8, RSI: 0.5, RR: 1.2 }, marketBias: 'neutral' }))
    }
  }

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
    const runtime = new ClientBotRuntime({ onSignals: setSignals, strategy, interval: signalTf })
    runtime.start()
    runtimeRef.current = runtime
    return () => runtime.stop()
  }, [])

  React.useEffect(() => {
    runtimeRef.current && (runtimeRef.current as any).opts && ((runtimeRef.current as any).opts.strategy = strategy)
    localStorage.setItem('bot_strategy', JSON.stringify(strategy))
  }, [strategy])

  React.useEffect(() => {
    if (runtimeRef.current && (runtimeRef.current as any).opts) {
      (runtimeRef.current as any).opts.interval = signalTf
    }
    localStorage.setItem('bot_signal_tf', signalTf)
  }, [signalTf])

  React.useEffect(() => { localStorage.setItem('bot_min_conf', String(minConf)) }, [minConf])
  React.useEffect(() => { localStorage.setItem('bot_tag_filter', JSON.stringify(tagFilter)) }, [tagFilter])

  // Orders fetcher
  const fetchOrders = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, filled_at, symbol, side, entry, stop, take, size, status')
        .order('created_at', { ascending: false })
        .limit(200)
      if (!error && data) setOrders(data as any)
    } catch {}
  }, [])

  React.useEffect(() => {
    fetchOrders()
    const id = setInterval(fetchOrders, 30_000)
    return () => clearInterval(id)
  }, [fetchOrders])

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

  // Pagination for recent trades
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const totalPages = React.useMemo(() => trades ? Math.max(1, Math.ceil(trades.length / pageSize)) : 1, [trades, pageSize])
  const paginatedTrades = React.useMemo(() => {
    if (!trades) return [] as BotTrade[]
    const start = (page - 1) * pageSize
    return trades.slice(start, start + pageSize)
  }, [trades, page, pageSize])
  React.useEffect(() => { setPage(1) }, [trades, pageSize])

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
        let exitAt = price
        if (sl != null && tp != null) {
          if (t.side === 'LONG') {
            if (price <= sl) { shouldClose = true; exitAt = sl }
            else if (price >= tp) { shouldClose = true; exitAt = tp }
          } else {
            if (price >= sl) { shouldClose = true; exitAt = sl }
            else if (price <= tp) { shouldClose = true; exitAt = tp }
          }
        }
        // Timeout: 24h since opened
        const openedMs = new Date(t.opened_at).getTime()
        if (!shouldClose && Date.now() - openedMs > 24 * 60 * 60 * 1000) shouldClose = true
        if (shouldClose) {
          try {
            const { error } = await (await import('@/supabase/client')).supabase
              .from('trades')
              .update({ exit: exitAt, closed_at: new Date().toISOString() })
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
          <Button size="sm" onClick={() => window.open('/bot/analytics', '_blank')}>Analytics</Button>
          <Button size="sm" variant="secondary" onClick={fetchTrades}>{t('bot.refresh')}</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label={t('bot.kpi.winRate') as string} value={`${stats ? stats.winRate.toFixed(1) : '-'}%`} />
        <StatCard label={t('bot.kpi.netPnl') as string} value={`${(equity - initialCapital).toFixed(2)}$`} />
        <StatCard label={t('bot.kpi.avgTrade') as string} value={`${stats ? stats.avgTrade.toFixed(2) : '-'}`} />
        <StatCard label={t('bot.kpi.openPositions') as string} value={`${stats ? stats.openPositions : '-'}`} />
        <StatCard label={t('bot.kpi.equity') as string} value={`${equity.toFixed(2)}$`} />
        <StatCard label={t('bot.kpi.totalR') as string} value={`${stats ? stats.totalR.toFixed(2) + ' R' : '-'}`} />
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-semibold">Settings</div>
            <button className="text-sm text-gray-300" onClick={()=> setShowSettings(s => !s)}>{showSettings ? 'Hide' : 'Show'}</button>
          </div>
        </CardHeader>
        {showSettings && (<CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
            <div>
              <div className="text-gray-400 mb-1">{t('bot.settings.initial')}</div>
              <input id="initial-cap" disabled={true} type="number" min={0} value={initialCapital} onChange={(e)=>{ const v = Number(e.target.value || '0'); setInitialCapital(v); localStorage.setItem('bot_initial_capital', String(v)) }} className="bg-gray-800 rounded px-3 py-2 w-full" />
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
          <div className="mt-4">
            <div className="text-sm text-gray-300 mb-2">Strategy weights</div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
              {(['FIB','FVG','SR','TREND','RSI','RR'] as const).map((k) => (
                <div key={k} className="flex flex-col">
                  <label className="text-gray-400 mb-1">{k}</label>
                  {k !== 'RR' && (
                    <label className="inline-flex items-center gap-2 mb-1">
                      <input type="checkbox" checked={(strategy.enabled?.[k] ?? true)} onChange={(e)=> setStrategy(s => ({ ...s, enabled: { ...(s.enabled||{}), [k]: e.target.checked } }))} />
                      <span>Enabled</span>
                    </label>
                  )}
                  <input type="range" min={0} max={1} step={0.05} value={(strategy.weights?.[k] ?? 1)} onChange={(e)=> setStrategy(s => ({ ...s, weights: { ...(s.weights||{}), [k]: Number(e.target.value) } }))} />
                  <div className="text-xs text-gray-400">w={(strategy.weights?.[k] ?? 1).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </CardBody>)}
      </Card>

      {/* Signal controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-semibold">Signal controls</div>
            <button className="text-sm text-gray-300" onClick={()=> setShowSignalControls(s => !s)}>{showSignalControls ? 'Hide' : 'Show'}</button>
          </div>
        </CardHeader>
        {showSignalControls && (
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400 mb-1">Win rate ⇄ R:R</div>
              <input type="range" min={0} max={1} step={0.05} value={(strategy.weights?.RR ?? 1)} onChange={(e)=> setStrategy(s => ({ ...s, weights: { ...(s.weights||{}), RR: Number(e.target.value) } }))} />
              <div className="text-xs text-gray-400 flex justify-between">
                <span>Favor Win%</span><span>wRR={(strategy.weights?.RR ?? 1).toFixed(2)}</span><span>Favor R</span>
              </div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Scan timeframe</div>
              <div className="inline-flex gap-2">
                {(['5m','15m','1h'] as const).map(tf => (
                  <button key={tf} className={`px-3 py-1 rounded border ${signalTf===tf? 'bg-blue-600 border-blue-500':'bg-gray-800 border-gray-700'}`} onClick={()=> setSignalTf(tf)}>{tf}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Minimum confidence</div>
              <input type="range" min={0} max={100} step={5} value={minConf} onChange={(e)=> setMinConf(Number(e.target.value))} />
              <div className="text-xs text-gray-400">{minConf}%</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Market bias</div>
              <div className="inline-flex gap-2">
                {(['bearish','neutral','bullish'] as const).map(b => (
                  <button key={b} className={`px-3 py-1 rounded border ${strategy.marketBias===b? 'bg-blue-600 border-blue-500':'bg-gray-800 border-gray-700'}`} onClick={()=> setStrategy(s => ({ ...s, marketBias: b }))}>{b}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Order by</div>
              <select className="bg-gray-800 rounded px-2 py-1" value={strategy.order ?? 'confidence'} onChange={(e)=> setStrategy(s => ({ ...s, order: e.target.value as any }))}>
                <option value="confidence">Confidence</option>
                <option value="time">Newest</option>
              </select>
              <div className="mt-2 text-gray-400 mb-1">Max per symbol</div>
              <input className="bg-gray-800 rounded px-2 py-1 w-24" type="number" min={0} value={strategy.maxSignalsPerSymbol ?? 0} onChange={(e)=> setStrategy(s => ({ ...s, maxSignalsPerSymbol: Number(e.target.value) }))} />
            </div>
            <div>
              <div className="text-gray-400 mb-1">Filter by tags (any)</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['FIB','FVG','SR','TREND','RSI'] as const).map(tag => (
                  <label key={tag} className="inline-flex items-center gap-1">
                    <input type="checkbox" checked={!!tagFilter[tag]} onChange={(e)=> setTagFilter(f => ({ ...f, [tag]: e.target.checked }))} />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-3 flex items-center gap-2">
              <Button variant="secondary" onClick={()=> applyPreset('balanced')}>Preset: Balanced</Button>
              <Button variant="secondary" onClick={()=> applyPreset('highProb')}>Preset: High‑Prob</Button>
              <Button variant="secondary" onClick={()=> applyPreset('highR')}>Preset: High‑R</Button>
              <Button onClick={()=> { setStrategy({}); setMinConf(0); setTagFilter({}); }}>Reset</Button>
            </div>
          </div>
        </CardBody>)}
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
      {/* Orders section */}
      <Card>
        <CardHeader className="bg-gray-900">
          <div className="font-semibold">Pending orders</div>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left px-3 py-2">Created</th>
                  <th className="text-left px-3 py-2">Symbol</th>
                  <th className="text-left px-3 py-2">Side</th>
                  <th className="text-right px-3 py-2">Entry</th>
                  <th className="text-right px-3 py-2">SL</th>
                  <th className="text-right px-3 py-2">TP</th>
                  <th className="text-right px-3 py-2">Size</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-800">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{o.symbol}</td>
                    <td className="px-3 py-2">{o.side}</td>
                    <td className="px-3 py-2 text-right">{o.entry?.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right">{o.stop != null ? o.stop.toFixed(4) : '-'}</td>
                    <td className="px-3 py-2 text-right">{o.take != null ? o.take.toFixed(4) : '-'}</td>
                    <td className="px-3 py-2 text-right">{o.size ?? '-'}</td>
                    <td className="px-3 py-2">{o.status}</td>
                    <td className="px-3 py-2 text-right">
                      {o.status === 'PENDING' && (
                        <Button size="sm" variant="secondary" onClick={async ()=>{ try { await supabase.from('orders').update({ status: 'CANCELED', cancel_reason: 'user' } as any).eq('id', o.id); fetchOrders() } catch {} }}>Cancel</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td className="px-3 py-4 text-center text-gray-400" colSpan={9}>No orders</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
      {/* Signals */}
      {signals.length > 0 && (
        <Card>
          <CardHeader className="bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{t('bot.section.signals')}</div>
              <div className="inline-flex gap-2 text-sm">
                {(['NEW','WATCHING','IGNORED','SAVED'] as const).map(s => {
                  const cnt = signals.filter(x => ((sigState[x.id]?.status ?? 'NEW') === s) && (!sigState[x.id]?.snoozeUntil || sigState[x.id]!.snoozeUntil! <= Date.now() || s!== 'NEW')).length
                  return (
                    <button key={s} className={`px-3 py-1 rounded ${tab===s? 'bg-blue-600':'bg-gray-800'}`} onClick={()=> setTab(s)}>{s} ({cnt})</button>
                  )
                })}
              </div>
            </div>
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
                    <th className="text-left px-3 py-2">Tags</th>
                    <th className="text-left px-3 py-2">Conf</th>
                    <th className="text-left px-3 py-2">Reason</th>
                    <th className="text-right px-3 py-2">{t('bot.table.entry')}</th>
                    <th className="text-right px-3 py-2">{t('table.sl')}</th>
                    <th className="text-right px-3 py-2">{t('table.tp')}</th>
                    <th className="text-right px-3 py-2">Mini</th>
                    <th className="text-right px-3 py-2">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.filter(s => (s.confidence ?? 100) >= minConf).filter(s => {
                    const selected = Object.keys(tagFilter).filter(k => tagFilter[k])
                    if (selected.length === 0) return true
                    const tags = s.tags || []
                    return selected.some(t => tags.includes(t))
                  }).filter(s => {
                    const st = sigState[s.id]?.status ?? 'NEW'
                    const snooze = sigState[s.id]?.snoozeUntil
                    const snoozed = snooze && snooze > Date.now()
                    if (tab === 'NEW') return st === 'NEW' && !snoozed
                    if (tab === 'WATCHING') return st === 'WATCHING' && !snoozed
                    if (tab === 'IGNORED') return st === 'IGNORED'
                    if (tab === 'SAVED') return st === 'SAVED'
                    return true
                  }).map(s => (
                    <tr key={s.id} className="border-b border-gray-800">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{s.symbol}</td>
                      <td className="px-3 py-2">{s.timeframe}</td>
                      <td className="px-3 py-2">{s.side}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {(s.tags||[]).map(tg => <span key={tg} className="inline-block px-2 py-0.5 mr-1 rounded bg-gray-700">{tg}</span>)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        <span className={`px-2 py-0.5 rounded-full ${((s.confidence ?? 0) >= 70)?'bg-emerald-700':((s.confidence ?? 0)>=40?'bg-amber-700':'bg-gray-700')}`}>{s.confidence != null ? `${s.confidence}%` : '-'}</span>
                      </td>
                      <td className="px-3 py-2 max-w-[28ch] truncate" title={s.reason}>{s.reason}</td>
                      <td className="px-3 py-2 text-right">{s.entry.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">{s.stop.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">{s.take.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">
                        {/* Sparkline */}
                        <Spark symbol={s.symbol} interval={s.timeframe} entry={s.entry} stop={s.stop} take={s.take} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" onClick={async () => {
                          // Place limit-style pending order
                          const risk = riskPerTrade || 100
                          const perUnitRisk = Math.abs(s.entry - s.stop)
                          const sizeQuote = perUnitRisk > 0 ? (risk / perUnitRisk) * s.entry : 100
                          try { await placeBotOrder(s, Math.round(sizeQuote)); setSig(s.id, { status: 'SAVED' }); alert('Order placed'); }
                          catch (e: any) { alert(e?.message || 'Failed') }
                        }}>{'Place order'}</Button>
                        <Button size="sm" variant="secondary" className="ml-2" onClick={() => {
                          const qp = new URLSearchParams({ id: s.id, symbol: s.symbol, side: s.side, tf: s.timeframe, entry: String(s.entry), stop: String(s.stop), take: String(s.take), reason: s.reason })
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
                  {paginatedTrades.map((trow) => {
                    const live = runtimeRef.current?.getLivePrice(trow.symbol)
                    const realizedR = trow.exit != null && trow.stop != null ? Math.max(-1, ((trow.exit - trow.entry) * (trow.side === 'LONG' ? 1 : -1)) / Math.abs(trow.entry - trow.stop)) : null
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
                      <td className={`px-3 py-2 text-right ${realizedR != null ? (realizedR >= 0 ? 'text-emerald-400' : 'text-red-400') : ''}`}>{realizedR != null ? realizedR.toFixed(2) + ' R' : '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{trow.closed_at ? new Date(trow.closed_at).toLocaleString() : '-'}</td>
                    </tr>)
                  })}
                </tbody>
              </table>
              {/* Pagination controls */}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-400">
                  Page {page} of {totalPages} • {trades?.length ?? 0} trades
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-gray-400">Rows:</label>
                  <select className="bg-gray-800 rounded px-2 py-1" value={pageSize} onChange={(e)=> setPageSize(Number(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <Button size="sm" variant="secondary" disabled={page <= 1} onClick={()=> setPage(p => Math.max(1, p-1))}>Prev</Button>
                  <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={()=> setPage(p => Math.min(totalPages, p+1))}>Next</Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function Spark({ symbol, interval, entry, stop, take }: { symbol: string; interval: '5m'|'15m'|'1h'; entry: number; stop: number; take: number }) {
  const [candles, setCandles] = React.useState<{ time: number; open: number; high: number; low: number; close: number }[]>([])
  React.useEffect(() => { (async () => { try { const ks = await fetchKlines(symbol, interval as any, 40); setCandles(ks) } catch {} })() }, [symbol, interval])
  const lows = candles.map(c => c.low)
  const highs = candles.map(c => c.high)
  const min = lows.length ? Math.min(...lows) : 0
  const max = highs.length ? Math.max(...highs) : 1
  const range = max - min || 1
  const w = 120, h = 34
  const n = candles.length || 1
  const step = w / n
  const bodyW = Math.max(1, step * 0.6)

  const y = (v: number) => h - ((v - min) / range) * h

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-28 h-8" preserveAspectRatio="none">
      {candles.map((c, i) => {
        const x = i * step + (step - bodyW) / 2
        const up = c.close >= c.open
        const top = y(up ? c.close : c.open)
        const bottom = y(up ? c.open : c.close)
        const color = up ? '#34D399' : '#EF4444'
        return (
          <g key={c.time}>
            <line x1={x + bodyW / 2} x2={x + bodyW / 2} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1} />
            <rect x={x} y={top} width={bodyW} height={Math.max(1, bottom - top)} fill={color} />
          </g>
        )
      })}
    </svg>
  )
}



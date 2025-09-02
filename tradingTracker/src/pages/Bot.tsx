import React from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import { getOrders, cancelOrder, getBotSettings, getSignals, getTrades, getBotMetrics } from '@/services/serverBot'
import { ServerStatus } from '@/components/ServerStatus'
import { supabase } from '@/supabase/client'
import { fetchKlines } from '@/sage/market'

type BotTrade = {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entry: number
  exit?: number | null
  stop?: number | null
  take?: number | null
  pnl?: number | null
  confidence?: number
  conf?: number
  opened_at: string
  closed_at?: string | null
  notes?: string | null
  mode?: 'supervised' | 'strict' | 'explore'
  executor?: 'human' | 'bot_strict' | 'bot_explore'
}

type BotSignal = {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entry: number
  stop: number
  take: number
  confidence?: number
  conf?: number
  tags?: string[]
  tag?: string[]
  timeframe?: string
  tf?: string
  mode?: 'supervised' | 'strict' | 'explore'
  status?: 'NEW' | 'WATCHING' | 'IGNORED' | 'SAVED'
  createdAt?: string
  created_at?: string
  date?: string
  reason?: string
}

type BotOrder = {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entry: number
  stop: number
  take: number
  size: number
  status: 'PENDING' | 'FILLED' | 'CANCELED' | 'EXPIRED'
  mode: 'supervised' | 'strict' | 'explore'
  executor: 'human' | 'bot_strict' | 'bot_explore'
  createdAt: string
  filledAt?: string
}

type BotStats = {
  winRate: number
  netPnL: number
  avgTrade: number
  openPositions: number
  totalR: number
}

type BotSettings = {
  id?: string
  user_id?: string
  mode: 'supervised' | 'strict' | 'explore'
  strategy: {
    enabled: Record<string, boolean>
    weights: Record<string, number>
    marketBias: 'bearish' | 'neutral' | 'bullish'
    order: 'confidence' | 'time'
    maxSignalsPerSymbol: number
  }
  signal_tf: string[]
  min_conf: number
  tag_filter: Record<string, boolean>
  initial_capital: number
  risk_per_trade: number
  auto_close_hours: number
  notifications: boolean
  created_at?: string
  updated_at?: string
}

export default function Bot() {
  const { t } = useTranslation()
  const [mode, setMode] = React.useState<'supervised' | 'strict' | 'explore'>(() => (localStorage.getItem('bot_mode_tab') as any) || 'supervised')
  
  // Data states
  const [signals, setSignals] = React.useState<BotSignal[]>([])
  const [trades, setTrades] = React.useState<BotTrade[]>([])
  const [orders, setOrders] = React.useState<BotOrder[]>([])
  const [metrics, setMetrics] = React.useState<any>(null)
  
  // UI states
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showSettings, setShowSettings] = React.useState(false)
  const [showSignalControls, setShowSignalControls] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  
  // Signal state management
  type SigStatus = 'NEW' | 'WATCHING' | 'IGNORED' | 'SAVED'
  type SigState = { status: SigStatus; snoozeUntil?: number; notifyAt?: number }
  const [sigState, setSigState] = React.useState<Record<string, SigState>>(() => {
    try { return JSON.parse(localStorage.getItem('bot_signal_state_v1') || '{}') } catch { return {} }
  })
  const [tab, setTab] = React.useState<SigStatus>('NEW')
  
  const setSig = (id: string, partial: Partial<SigState>) => {
    setSigState(s => { 
      const curr = s[id] || { status: 'NEW' as SigStatus }; 
      const n = { ...s, [id]: { ...curr, ...partial } }; 
      localStorage.setItem('bot_signal_state_v1', JSON.stringify(n)); 
      return n 
    })
  }
  
  // Settings state
  const [settings, setSettings] = React.useState<BotSettings>({
    mode: 'supervised',
    strategy: {
      enabled: { FIB: true, FVG: true, SR: true, TREND: true, RSI: true },
      weights: { FIB: 1, FVG: 1, SR: 1, TREND: 1, RSI: 1, RR: 1 },
      marketBias: 'neutral',
      order: 'confidence',
      maxSignalsPerSymbol: 0
    },
    signal_tf: ['15m'],
    min_conf: 70,
    tag_filter: { FIB: false, FVG: false, SR: false, TREND: false, RSI: false },
    initial_capital: 10000,
    risk_per_trade: 1,
    auto_close_hours: 24,
    notifications: false
  })
  const [settingsLoading, setSettingsLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  
  // Risk per trade for order sizing
  const riskPerTrade = settings.risk_per_trade || 100

  // Live % change per signal over its timeframe
  const [signalChangePct, setSignalChangePct] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    if (!signals || signals.length === 0) {
      setSignalChangePct({})
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const entries = await Promise.all(signals.map(async (s) => {
          try {
            const tf = (s.timeframe || s.tf || '15m') as any
            const ks = await fetchKlines(s.symbol, tf, 2)
            if (ks && ks.length >= 2) {
              const prev = ks[ks.length - 2].close
              const last = ks[ks.length - 1].close
              if (prev && isFinite(prev) && isFinite(last) && prev !== 0) {
                const pct = ((last - prev) / prev) * 100
                return [s.id, pct] as const
              }
            }
          } catch {}
          return [s.id, NaN] as const
        }))
        if (cancelled) return
        const map: Record<string, number> = {}
        for (const [id, pct] of entries) {
          if (typeof pct === 'number' && isFinite(pct)) map[id] = pct
        }
        setSignalChangePct(map)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [signals])

  // Pagination states
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  // Helper: shallow compare arrays by id to avoid unnecessary re-renders
  const arraysEqualById = React.useCallback((a: any[], b: any[]) => {
    if (a === b) return true
    if (!a || !b) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i]?.id !== b[i]?.id) return false
    }
    return true
  }, [])

  // Fetch data based on mode (stale‑while‑revalidate)
  const fetchData = React.useCallback(async () => {
    try {
      // If we already have some data, don't blank the UI; mark as refreshing
      const hasData = signals.length > 0 || trades.length > 0 || orders.length > 0
      if (!hasData) setLoading(true)
      else setIsRefreshing(true)
      setError(null)
      
      const [signalsRes, tradesRes, ordersRes, metricsRes] = await Promise.all([
        getSignals({ mode, min_conf: settings.min_conf ?? 0, max_age_minutes: 30, limit: 100 }),
        getTrades({ mode, user_id: mode === 'supervised' ? '040c9594-52a9-428d-8ff3-4f19cdfd11be' : undefined, limit: 100 }),
        getOrders({ status: 'PENDING', mode }),
        getBotMetrics('24h')
      ])
      
      const nextSignals = signalsRes.data || []
      const nextTrades = tradesRes.data || []
      const nextOrders = ordersRes.data || []

      setSignals(curr => (arraysEqualById(curr, nextSignals) ? curr : nextSignals))
      setTrades(curr => (arraysEqualById(curr, nextTrades) ? curr : nextTrades))
      setOrders(curr => (arraysEqualById(curr, nextOrders) ? curr : nextOrders))
      setMetrics(metricsRes)
      
      // Debug: log what data we're getting
      if (tradesRes.data && tradesRes.data.length > 0) {
        console.log('First trade data structure:', tradesRes.data[0])
        console.log('All trade keys:', Object.keys(tradesRes.data[0]))
      }
      if (signalsRes.data && signalsRes.data.length > 0) {
        console.log('First signal data structure:', signalsRes.data[0])
        console.log('All signal keys:', Object.keys(signalsRes.data[0]))
      }
      
    } catch (e: any) {
      console.error('Failed to fetch data:', e)
      setError(e?.message || 'Failed to fetch data')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  // include relevant deps
  }, [mode, settings.min_conf, arraysEqualById, signals.length, trades.length, orders.length])

  // Load settings from server or Supabase
  const loadSettings = React.useCallback(async () => {
    try {
      setSettingsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Try server first
      try {
        const response = await getBotSettings(user.id, mode)
        if (response.data) {
          setSettings(prev => ({ ...prev, ...response.data }))
          return
        }
      } catch (serverError) {
        console.warn('Server unavailable, falling back to Supabase:', serverError)
      }

      // Fallback to Supabase
      const { data, error } = await supabase
        .from('bot_settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('mode', mode)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load settings:', error)
        return
      }

      if (data) {
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    } finally {
      setSettingsLoading(false)
    }
  }, [mode])

  // Save settings to Supabase
  const saveSettings = React.useCallback(async () => {
    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const updatedSettings = { 
        ...settings, 
        user_id: user.id,
        updated_at: new Date().toISOString() 
      }
      
      if (settings.id) {
        // Update existing
        const { error } = await supabase
          .from('bot_settings')
          .update(updatedSettings)
          .eq('id', settings.id)
        
        if (error) throw error
      } else {
        // Create new
        const { data, error } = await supabase
          .from('bot_settings')
          .insert([{ ...updatedSettings, created_at: new Date().toISOString() }])
          .select()
          .single()
        
        if (error) throw error
        setSettings(prev => ({ ...prev, id: data.id }))
      }

      alert('Settings saved successfully!')
    } catch (e: any) {
      console.error('Failed to save settings:', e)
      alert(`Failed to save settings: ${e?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }, [settings])

  // Apply preset configurations
  const applyPreset = React.useCallback((preset: 'balanced' | 'highProb' | 'highR') => {
    const presets = {
      balanced: {
        strategy: {
          enabled: { FIB: true, FVG: true, SR: true, TREND: true, RSI: true },
          weights: { FIB: 0.8, FVG: 0.9, SR: 0.7, TREND: 0.6, RSI: 0.8, RR: 0.5 },
          marketBias: 'neutral' as const,
          order: 'confidence' as const,
          maxSignalsPerSymbol: 2
        },
        min_conf: 65
      },
      highProb: {
        strategy: {
          enabled: { FIB: true, FVG: true, SR: true, TREND: true, RSI: true },
          weights: { FIB: 0.6, FVG: 0.7, SR: 0.8, TREND: 0.5, RSI: 0.9, RR: 0.3 },
          marketBias: 'neutral' as const,
          order: 'confidence' as const,
          maxSignalsPerSymbol: 1
        },
        min_conf: 80
      },
      highR: {
        strategy: {
          enabled: { FIB: true, FVG: true, SR: true, TREND: true, RSI: true },
          weights: { FIB: 0.9, FVG: 0.8, SR: 0.6, TREND: 0.7, RSI: 0.5, RR: 0.8 },
          marketBias: 'neutral' as const,
          order: 'confidence' as const,
          maxSignalsPerSymbol: 3
        },
        min_conf: 60
      }
    }

    const newSettings = presets[preset]
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  // Compute stats from trades
  const stats = React.useMemo(() => {
    if (!trades.length) return null
    
    let totalClosed = 0
    let wins = 0
    let totalR = 0
    let open = 0

    for (const t of trades) {
      const isClosed = t.exit != null
      if (!isClosed) {
        open++
        continue
      }

      totalClosed++
      // Compute realized R when possible; otherwise use directional outcome
      let r: number | null = null
      if (t.entry != null && t.stop != null && t.exit != null) {
        const riskPerUnit = Math.abs(t.entry - t.stop)
        if (riskPerUnit > 0) {
          const dir = t.side === 'LONG' ? 1 : -1
          r = ((t.exit - t.entry) * dir) / riskPerUnit
          // Normalize near-stop slippage to -1 R at most
          const isAtStop = Math.abs((t.exit - t.stop) / (t.stop || 1)) < 0.001
          if (isAtStop && r < -1) r = -1
        }
      }
      if (r == null && t.entry != null && t.exit != null) {
        // Fallback: sign-only using price movement if no stop
        const dir = t.side === 'LONG' ? 1 : -1
        r = ((t.exit - t.entry) * dir) / Math.max(Math.abs(t.entry), 1)
      }

      if (r != null) {
        totalR += r
        if (r > 0) wins++
      }
    }

    const avgR = totalClosed > 0 ? totalR / totalClosed : 0
    const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0

    return {
      winRate,
      netPnL: 0, // not shown in KPIs currently
      avgTrade: avgR,
      openPositions: open,
      totalR,
    }
  }, [trades])

  // Pagination for data
  const totalPages = React.useMemo(() => {
    const data = mode === 'supervised' ? signals : trades
    return Math.max(1, Math.ceil(data.length / pageSize))
  }, [mode, signals, trades, pageSize])

  // Dedicated total pages for trades (used in supervised table pagination)
  const totalTradePages = React.useMemo(() => {
    return Math.max(1, Math.ceil(trades.length / pageSize))
  }, [trades, pageSize])

  const paginatedSignals = React.useMemo(() => {
    const start = (page - 1) * pageSize
    return signals.slice(start, start + pageSize)
  }, [signals, page, pageSize])

  const paginatedTrades = React.useMemo(() => {
    const start = (page - 1) * pageSize
    return trades.slice(start, start + pageSize)
  }, [trades, page, pageSize])

  // Effects
  React.useEffect(() => {
    localStorage.setItem('bot_mode_tab', mode)
    setPage(1)
  }, [mode])

  React.useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 60_000) // Refresh every 60 seconds
    return () => clearInterval(id)
  }, [fetchData])

  React.useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Handle order cancellation
  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder(orderId, 'User cancelled')
      fetchData() // Refresh data
    } catch (e: any) {
      alert(e?.message || 'Failed to cancel order')
    }
  }
  
  // Place bot order function
  const placeBotOrder = async (signal: BotSignal, size = 100, mode: 'supervised' | 'strict' | 'explore' = 'supervised', executor: 'human' | 'bot_strict' | 'bot_explore' = 'human') => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in to place orders')
      
      const payload = {
        user_id: user.id,
        created_at: new Date().toISOString(),
        status: 'PENDING',
        symbol: signal.symbol,
        side: signal.side,
        entry: signal.entry,
        stop: signal.stop,
        take: signal.take,
        size,
        timeframe: signal.timeframe,
        reason: `[BOT] ${signal.tags?.join(', ') || 'Signal'}`,
        mode,
        executor,
      }
      
      const { error } = await supabase.from('orders').insert(payload)
      if (error) throw error
      
      return { success: true }
    } catch (e: any) {
      throw new Error(e?.message || 'Failed to place order')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('bot.title')}</h1>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 mr-2">
            <button 
              className={`px-3 py-1 rounded ${mode==='supervised'?'bg-blue-600':'bg-gray-800'}`} 
              onClick={()=> setMode('supervised')}
            >
              Supervised
            </button>
            <button 
              className={`px-3 py-1 rounded ${mode==='strict'?'bg-blue-600':'bg-gray-800'}`} 
              onClick={()=> setMode('strict')}
            >
              Autonomous (Strict)
            </button>
            <button 
              className={`px-3 py-1 rounded ${mode==='explore'?'bg-blue-600':'bg-gray-800'}`} 
              onClick={()=> setMode('explore')}
            >
              Autonomous (Explore)
            </button>
          </div>
          <div className="text-sm text-gray-400 hidden sm:block">
            {mode === 'supervised' ? 'Manual signal review' : 'Automatic trading'}
          </div>
          <Button size="sm" onClick={() => window.open('/bot/analytics', '_blank')}>Analytics</Button>
          <Button size="sm" variant="secondary" onClick={fetchData}>Refresh</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <>
          <StatCard label={t('bot.kpi.winRate') as string} value={`${stats ? stats.winRate.toFixed(1) : '-'}%`} />
          <StatCard label={t('bot.kpi.avgTrade') as string} value={`${stats ? stats.avgTrade.toFixed(2) : '-'}`} />
          <StatCard label={t('bot.kpi.openPositions') as string} value={`${stats ? stats.openPositions : '-'}`} />
          <StatCard label={t('bot.kpi.totalR') as string} value={`${stats ? stats.totalR.toFixed(2) + ' R' : '-'}`} />
        </>
      </div>

      {/* Server Status */}
      <ServerStatus />

      {/* Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-semibold">Settings</div>
            <button className="text-sm text-gray-300" onClick={()=> setShowSettings(s => !s)}>
              {showSettings ? 'Hide' : 'Show'}
            </button>
          </div>
        </CardHeader>
        {showSettings && (
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
              <div>
                <div className="text-gray-400 mb-1">{t('bot.settings.initial')}</div>
                <input 
                  type="number" 
                  min={0} 
                  value={settings.initial_capital} 
                  onChange={(e)=>{ 
                    const v = Number(e.target.value || '0'); 
                    setSettings(prev => ({ ...prev, initial_capital: v }))
                  }} 
                  className="bg-gray-800 rounded px-3 py-2 w-full" 
                />
              </div>
              <div>
                <div className="text-gray-400 mb-1">{t('bot.settings.risk')}</div>
                <input 
                  type="number" 
                  min={0} 
                  value={settings.risk_per_trade} 
                  onChange={(e)=>{ 
                    const v = Number(e.target.value || '0'); 
                    setSettings(prev => ({ ...prev, risk_per_trade: v }))
                  }} 
                  className="bg-gray-800 rounded px-3 py-2 w-full" 
                />
              </div>
              <div>
                <div className="text-gray-400 mb-1">Auto-close after (hours)</div>
                <input 
                  type="number" 
                  min={1} 
                  value={settings.auto_close_hours} 
                  onChange={(e)=>{ 
                    const v = Number(e.target.value || '24'); 
                    setSettings(prev => ({ ...prev, auto_close_hours: v }))
                  }} 
                  className="bg-gray-800 rounded px-3 py-2 w-full" 
                />
              </div>
              <div>
                <div className="text-gray-400 mb-1">Enable notifications</div>
                <button 
                  className={`px-3 py-2 rounded ${settings.notifications ? 'bg-blue-600' : 'bg-gray-700'}`} 
                  onClick={()=> setSettings(prev => ({ ...prev, notifications: !prev.notifications }))}
                >
                  {settings.notifications ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              <div className="flex items-end">
                <Button variant="secondary" onClick={fetchData}>Refresh</Button>
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
                        <input 
                          type="checkbox" 
                          checked={settings.strategy.enabled[k] ?? true} 
                          onChange={(e)=> setSettings(prev => ({ 
                            ...prev, 
                            strategy: { 
                              ...prev.strategy, 
                              enabled: { ...prev.strategy.enabled, [k]: e.target.checked } 
                            } 
                          }))} 
                        />
                        <span>Enabled</span>
                      </label>
                    )}
                    <input 
                      type="range" 
                      min={0} 
                      max={1} 
                      step={0.05} 
                      value={settings.strategy.weights[k] ?? 1} 
                      onChange={(e)=> setSettings(prev => ({ 
                        ...prev, 
                        strategy: { 
                          ...prev.strategy, 
                          weights: { ...prev.strategy.weights, [k]: Number(e.target.value) } 
                        } 
                      }))} 
                    />
                    <div className="text-xs text-gray-400">w={(settings.strategy.weights[k] ?? 1).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </CardBody>
        )}
      </Card>

      {/* Signal controls - Separate section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-semibold">Signal controls</div>
            <button className="text-sm text-gray-300" onClick={()=> setShowSignalControls(s => !s)}>
              {showSignalControls ? 'Hide' : 'Show'}
            </button>
          </div>
        </CardHeader>
        {showSignalControls && (
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Win rate ⇄ R:R</div>
                <input 
                  type="range" 
                  min={0} 
                  max={1} 
                  step={0.05} 
                  value={settings.strategy.weights.RR ?? 1} 
                  onChange={(e)=> setSettings(prev => ({ 
                    ...prev, 
                    strategy: { 
                      ...prev.strategy, 
                      weights: { ...prev.strategy.weights, RR: Number(e.target.value) } 
                    } 
                  }))} 
                />
                <div className="text-xs text-gray-400 flex justify-between">
                  <span>Favor Win%</span><span>wRR={(settings.strategy.weights.RR ?? 1).toFixed(2)}</span><span>Favor R</span>
                </div>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Scan timeframes (multiple selection)</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(['5m','15m','1h','4h','1d'] as const).map(tf => (
                    <label key={tf} className="inline-flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={settings.signal_tf.includes(tf)} 
                        onChange={(e)=> {
                          const newTf = [...settings.signal_tf];
                          if (e.target.checked) {
                            newTf.push(tf);
                          } else {
                            newTf.splice(newTf.indexOf(tf), 1);
                          }
                          setSettings(prev => ({ ...prev, signal_tf: newTf }));
                        }}
                      />
                      <span>{tf}</span>
                    </label>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Selected: {settings.signal_tf.length > 0 ? settings.signal_tf.join(', ') : 'None'}
                </div>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Minimum confidence</div>
                <input 
                  type="range" 
                  min={0} 
                  max={100} 
                  step={5} 
                  value={settings.min_conf} 
                  onChange={(e)=> setSettings(prev => ({ ...prev, min_conf: Number(e.target.value) }))} 
                />
                <div className="text-xs text-gray-400">{settings.min_conf}%</div>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Market bias</div>
                <div className="inline-flex gap-2">
                  {(['bearish','neutral','bullish'] as const).map(b => (
                    <button 
                      key={b} 
                      className={`px-3 py-1 rounded border ${settings.strategy.marketBias===b? 'bg-blue-600 border-blue-500':'bg-gray-800 border-gray-700'}`} 
                      onClick={()=> setSettings(prev => ({ 
                        ...prev, 
                        strategy: { ...prev.strategy, marketBias: b } 
                      }))}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Order by</div>
                <select 
                  className="bg-gray-800 rounded px-2 py-1" 
                  value={settings.strategy.order ?? 'confidence'} 
                  onChange={(e)=> setSettings(prev => ({ 
                    ...prev, 
                    strategy: { ...prev.strategy, order: e.target.value as any } 
                  }))}
                >
                  <option value="confidence">Confidence</option>
                  <option value="time">Newest</option>
                </select>
                <div className="mt-2 text-gray-400 mb-1">Max per symbol</div>
                <input 
                  className="bg-gray-800 rounded px-2 py-1 w-24" 
                  type="number" 
                  min={0} 
                  value={settings.strategy.maxSignalsPerSymbol ?? 0} 
                  onChange={(e)=> setSettings(prev => ({ 
                    ...prev, 
                    strategy: { ...prev.strategy, maxSignalsPerSymbol: Number(e.target.value) } 
                  }))} 
                />
              </div>
              <div>
                <div className="text-gray-400 mb-1">Filter by tags (any)</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {(['FIB','FVG','SR','TREND','RSI'] as const).map(tag => (
                    <label key={tag} className="inline-flex items-center gap-1">
                      <input 
                        type="checkbox" 
                        checked={!!settings.tag_filter[tag]} 
                        onChange={(e)=> setSettings(prev => ({ 
                          ...prev, 
                          tag_filter: { ...prev.tag_filter, [tag]: e.target.checked } 
                        }))} 
                      />
                      <span>{tag}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-3 flex items-center gap-2">
                <Button variant="secondary" onClick={()=> applyPreset('balanced')}>Preset: Balanced</Button>
                <Button variant="secondary" onClick={()=> applyPreset('highProb')}>Preset: High‑Prob</Button>
                <Button variant="secondary" onClick={()=> applyPreset('highR')}>Preset: High‑R</Button>
                <Button onClick={()=> { 
                  const defaultSettings = {
                    strategy: {
                      enabled: { FIB: true, FVG: true, SR: true, TREND: true, RSI: true },
                      weights: { FIB: 1, FVG: 1, SR: 1, TREND: 1, RSI: 1, RR: 1 },
                      marketBias: 'neutral' as const,
                      order: 'confidence' as const,
                      maxSignalsPerSymbol: 0
                    },
                    signal_tf: ['15m'],
                    min_conf: 70,
                    tag_filter: { FIB: false, FVG: false, SR: false, TREND: false, RSI: false }
                  }
                  setSettings(prev => ({ ...prev, ...defaultSettings }))
                }}>Reset</Button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Signal Controls'}
              </Button>
            </div>
          </CardBody>
        )}
      </Card>

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
                {orders
                  .filter(o => o && o.symbol && o.side)
                  .map(o => (
                  <tr key={o.id} className="border-b border-gray-800">
                    <td className="px-3 py-2 whitespace-nowrap">{o.createdAt ? new Date(o.createdAt).toLocaleString() : 'Unknown'}</td>
                    <td className="px-3 py-2">{o.symbol || 'Unknown'}</td>
                    <td className="px-3 py-2">{o.side || 'Unknown'}</td>
                    <td className="px-3 py-2 text-right">{o.entry ? o.entry.toFixed(4) : '-'}</td>
                    <td className="px-3 py-2 text-right">{o.stop != null ? o.stop.toFixed(4) : '-'}</td>
                    <td className="px-3 py-2 text-right">{o.take != null ? o.take.toFixed(4) : '-'}</td>
                    <td className="px-3 py-2 text-right">{o.size ?? '-'}</td>
                    <td className="px-3 py-2">{o.status || 'Unknown'}</td>
                    <td className="px-3 py-2 text-right">
                      {o.status === 'PENDING' && (
                        <Button size="sm" variant="secondary" onClick={() => handleCancelOrder(o.id)}>
                          Cancel
                        </Button>
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

      {/* Main Content - Mode Specific */}
      {loading && <div className="text-center py-8">{t('common.loading')}</div>}
      {!loading && isRefreshing && (
        <div className="text-center text-xs text-gray-400">Refreshing…</div>
      )}
      {error && (
        <div className="text-red-400 mb-3 text-center">
          {t('bot.error', { msg: error })}
        </div>
      )}
      
      {/* Supervised Mode - Show Signals */}
      {mode === 'supervised' && !loading && !error && (
        <Card>
          <CardHeader className="bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Trading Signals ({signals.length})</div>
              <div className="flex gap-2">
                {(['NEW','WATCHING','IGNORED','SAVED'] as const).map(s => {
                  const cnt = signals.filter(x => ((sigState[x.id]?.status ?? 'NEW') === s) && (!sigState[x.id]?.snoozeUntil || sigState[x.id]!.snoozeUntil! <= Date.now() || s!== 'NEW')).length
                  return (
                    <button key={s} className={`px-3 py-1 rounded ${tab===s? 'bg-blue-600':'bg-gray-800'}`} onClick={()=> setTab(s)}>
                      {s} ({cnt})
                    </button>
                  )
                })}
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {signals.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No signals found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="text-left px-3 py-2">Time</th>
                      <th className="text-left px-3 py-2">Symbol</th>
                      <th className="text-left px-3 py-2">TF</th>
                      <th className="text-left px-3 py-2">Change</th>
                      <th className="text-left px-3 py-2">Side</th>
                      <th className="text-left px-3 py-2">Tags</th>
                      <th className="text-left px-3 py-2">Conf</th>
                      <th className="text-left px-3 py-2">Reason</th>
                      <th className="text-right px-3 py-2">Entry</th>
                      <th className="text-right px-3 py-2">SL</th>
                      <th className="text-right px-3 py-2">TP</th>
                      <th className="text-right px-3 py-2">Mini</th>
                      <th className="text-right px-3 py-2">Manage</th>
                      <th className="text-right px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals
                      .filter(signal => signal && signal.symbol && signal.side && signal.entry != null)
                      .filter(s => {
                        const st = sigState[s.id]?.status ?? 'NEW'
                        const snooze = sigState[s.id]?.snoozeUntil
                        const snoozed = snooze && snooze > Date.now()
                        if (tab === 'NEW') return st === 'NEW' && !snoozed
                        if (tab === 'WATCHING') return st === 'WATCHING' && !snoozed
                        if (tab === 'IGNORED') return st === 'IGNORED'
                        if (tab === 'SAVED') return st === 'SAVED'
                        return true
                      })
                      .map((signal: BotSignal) => {
                        if (signal.id === signals[0]?.id) {
                          console.log('Signal data structure:', signal)
                        }
                        return (
                      <tr key={signal.id} className="border-b border-gray-800 hover:bg-gray-800/60">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {signal.createdAt ? new Date(signal.createdAt).toLocaleString() : 
                           signal.created_at ? new Date(signal.created_at).toLocaleString() : 
                           signal.date ? new Date(signal.date).toLocaleString() : 'Unknown'}
                        </td>
                        <td className="px-3 py-2">{signal.symbol || 'Unknown'}</td>
                        <td className="px-3 py-2">{signal.timeframe || signal.tf || '15m'}</td>
                        <td className="px-3 py-2">
                          {(() => {
                            const pct = signalChangePct[signal.id]
                            if (pct == null || !isFinite(pct)) return <span className="text-gray-500">-</span>
                            const cls = pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-red-400' : 'text-gray-300'
                            return <span className={cls}>{pct.toFixed(2)}%</span>
                          })()}
                        </td>
                        <td className="px-3 py-2">{signal.side || 'Unknown'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          {(() => {
                            if (signal.id === signals[0]?.id) {
                              console.log('Tags data:', { tags: signal.tags, tag: signal.tag, reason: signal.reason, allKeys: Object.keys(signal) })
                            }
                            let tags = signal.tags || signal.tag || []
                            if ((!tags || tags.length === 0) && signal.reason) {
                              if (signal.reason.includes('[BOT]')) {
                                tags = [signal.reason.replace('[BOT] ', '')]
                              } else {
                                tags = [signal.reason]
                              }
                            }
                            if (!tags || tags.length === 0) {
                              tags = ['Signal']
                              if (signal.entry && signal.stop && signal.take) {
                                const riskReward = Math.abs(signal.take - signal.entry) / Math.abs(signal.entry - signal.stop)
                                if (riskReward >= 2) tags.push('High R:R')
                                if (riskReward >= 1.5) tags.push('Good R:R')
                              }
                            }
                            if (Array.isArray(tags)) {
                              return tags.length > 0 ? tags.map(tg => <span key={tg} className="inline-block px-2 py-0.5 mr-1 rounded bg-gray-700">{tg}</span>) : <span className="text-gray-500">-</span>
                            } else if (typeof tags === 'string') {
                              return <span className="inline-block px-2 py-0.5 mr-1 rounded bg-gray-700">{tags}</span>
                            }
                            return <span className="text-gray-500">-</span>
                          })()}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          {(() => {
                            if (signal.id === signals[0]?.id) {
                              console.log('Confidence data:', { confidence: signal.confidence, conf: signal.conf, allKeys: Object.keys(signal) })
                            }
                            const conf = signal.confidence ?? signal.conf ?? 0
                            const colorClass = conf >= 70 ? 'bg-emerald-700' : conf >= 40 ? 'bg-amber-700' : 'bg-gray-700'
                            return (
                              <span className={`px-2 py-0.5 rounded-full ${colorClass}`}>
                                {conf > 0 ? `${conf}%` : '-'}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-3 py-2 max-w-[28ch] truncate" title={signal.reason || (Array.isArray(signal.tags) ? signal.tags.join(', ') : signal.tags) || 'Signal'}>
                          {signal.reason || (Array.isArray(signal.tags) ? signal.tags.join(', ') : signal.tags) || 'Signal'}
                        </td>
                       <td className="px-3 py-2 text-right">{signal.entry ? signal.entry.toFixed(4) : '-'}</td>
                       <td className="px-3 py-2 text-right">{signal.stop ? signal.stop.toFixed(4) : '-'}</td>
                       <td className="px-3 py-2 text-right">{signal.take ? signal.take.toFixed(4) : '-'}</td>
                       <td className="px-3 py-2 text-right">
                         {/* Sparkline */}
                         <Spark symbol={signal.symbol || ''} interval={signal.timeframe || '15m'} entry={signal.entry || 0} stop={signal.stop || 0} take={signal.take || 0} />
                       </td>
                       <td className="px-3 py-2 text-right whitespace-nowrap">
                         <Button size="sm" variant="secondary" onClick={()=> setSig(signal.id, { status: 'IGNORED' })}>
                           Ignore
                         </Button>
                         <Button size="sm" variant="secondary" className="ml-2" onClick={()=> setSig(signal.id, { notifyAt: signal.entry })}>
                           Snooze
                         </Button>
                       </td>
                       <td className="px-3 py-2 text-right">
                         <Button size="sm" onClick={async () => {
                           const perUnitRisk = Math.abs((signal.entry || 0) - (signal.stop || 0))
                           const sizeQuote = perUnitRisk > 0 ? (riskPerTrade / perUnitRisk) * (signal.entry || 0) : 100
                           try { 
                             await placeBotOrder(signal, Math.round(sizeQuote), mode, 'human'); 
                             setSig(signal.id, { status: 'SAVED' }); 
                             alert('Order placed successfully!');
                             fetchData();
                           } catch (e: any) { 
                             alert(e?.message || 'Failed to place order') 
                           }
                         }}>
                           Place order
                         </Button>
                         <Button size="sm" variant="secondary" className="ml-2" onClick={() => {
                           const qp = new URLSearchParams({ 
                             id: signal.id, 
                             symbol: signal.symbol || '', 
                             side: signal.side || '', 
                             tf: signal.timeframe || '15m', 
                             entry: String(signal.entry || 0), 
                             stop: String(signal.stop || 0), 
                             take: String(signal.take || 0), 
                             reason: signal.tags?.join(', ') || 'Signal' 
                           })
                           window.open(`/bot/signal?${qp.toString()}`, '_blank')
                         }}>
                           View
                         </Button>
                       </td>
                     </tr>
                     )
                   })}
                 </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    )}

      {/* Trade Table in Supervised Mode */}
      {mode === 'supervised' && !loading && !error && trades.length > 0 && (
        <Card>
          <CardHeader className="bg-gray-900">
            <div className="font-semibold">Your Trades ({trades.length})</div>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left px-3 py-2">Time</th>
                    <th className="text-left px-3 py-2">Symbol</th>
                    <th className="text-left px-3 py-2">Side</th>
                    <th className="text-right px-3 py-2">Entry</th>
                    <th className="text-right px-3 py-2">SL</th>
                    <th className="text-right px-3 py-2">TP</th>
                    <th className="text-right px-3 py-2">Exit</th>
                    {/* <th className="text-right px-3 py-2">Confidence</th> */}
                    <th className="text-right px-3 py-2">P&L</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrades
                    .filter(trow => trow && trow.symbol && trow.side && trow.entry != null)
                    .map((trow: BotTrade) => {
                    const realizedR = trow.exit != null && trow.stop != null ? 
                      Math.max(-1, ((trow.exit - trow.entry) * (trow.side === 'LONG' ? 1 : -1)) / Math.abs(trow.entry - trow.stop)) : null
                    return (
                      <tr key={trow.id} className="border-b border-gray-800 hover:bg-gray-800/60">
                        <td className="px-3 py-2 whitespace-nowrap">{trow.opened_at ? new Date(trow.opened_at).toLocaleString() : 'Unknown'}</td>
                        <td className="px-3 py-2">{trow.symbol || 'Unknown'}</td>
                        <td className="px-3 py-2">{trow.side || 'Unknown'}</td>
                        <td className="px-3 py-2 text-right">{trow.entry ? trow.entry.toFixed(4) : '-'}</td>
                        <td className="px-3 py-2 text-right">{trow.stop != null ? trow.stop.toFixed(4) : '-'}</td>
                        <td className="px-3 py-2 text-right">{trow.take != null ? trow.take.toFixed(4) : '-'}</td>
                        <td className="px-3 py-2 text-right">{trow.exit != null ? trow.exit.toFixed(4) : '-'}</td>
                        {/* <td className="px-3 py-2 text-right">
                          {(() => {
                            // Debug: log trade confidence data
                            if (trow.id === trades[0]?.id) {
                              console.log('Trade confidence data:', { confidence: trow.confidence, conf: trow.conf, allKeys: Object.keys(trow) })
                            }
                            
                            const conf = trow.confidence ?? trow.conf ?? 0
                            const colorClass = conf >= 70 ? 'text-emerald-400' : conf >= 40 ? 'text-amber-400' : 'text-gray-400'
                            
                            return (
                              <span className={colorClass}>
                                {conf > 0 ? `${conf}%` : '-'}
                              </span>
                            )
                          })()}
                        </td> */}
                        <td className={`px-3 py-2 text-right ${realizedR != null ? (realizedR >= 0 ? 'text-emerald-400' : 'text-red-400') : ''}`}>
                          {realizedR != null ? realizedR.toFixed(2) + ' R' : '-'}
                        </td>
                        <td className="px-3 py-2">{trow.exit != null ? 'Closed' : 'Open'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {/* Pagination controls for supervised trades */}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-400">
                  Page {page} of {totalTradePages} • {trades.length} trades
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-gray-400">Rows:</label>
                  <select className="bg-gray-800 rounded px-2 py-1" value={pageSize} onChange={(e)=> setPageSize(Number(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <Button size="sm" variant="secondary" disabled={page <= 1} onClick={()=> setPage(p => Math.max(1, p-1))}>Prev</Button>
                  <Button size="sm" variant="secondary" disabled={page >= totalTradePages} onClick={()=> setPage(p => Math.min(totalTradePages, p+1))}>Next</Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Autonomous Modes - Show Trades */}
      {(mode === 'strict' || mode === 'explore') && !loading && !error && (
        <Card>
          <CardHeader className="bg-gray-900">
            <div className="font-semibold">{t('bot.section.trades')} ({trades.length})</div>
          </CardHeader>
          <CardBody>
            {trades.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No trades found</div>
            ) : (
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
                       <th className="text-right px-3 py-2">Confidence</th>
                       <th className="text-right px-3 py-2">{t('bot.table.pnl')}</th>
                       <th className="text-left px-3 py-2">{t('bot.table.timeClose')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTrades
                      .filter(trow => trow && trow.symbol && trow.side && trow.entry != null)
                      .map((trow: BotTrade) => {
                      const realizedR = trow.exit != null && trow.stop != null ? 
                        Math.max(-1, ((trow.exit - trow.entry) * (trow.side === 'LONG' ? 1 : -1)) / Math.abs(trow.entry - trow.stop)) : null
                      return (
                        <tr key={trow.id} className="border-b border-gray-800 hover:bg-gray-800/60">
                          <td className="px-3 py-2 whitespace-nowrap">{trow.opened_at ? new Date(trow.opened_at).toLocaleString() : 'Unknown'}</td>
                          <td className="px-3 py-2">{trow.symbol || 'Unknown'}</td>
                          <td className="px-3 py-2">{trow.side || 'Unknown'}</td>
                          <td className="px-3 py-2 text-right">{trow.entry ? trow.entry.toFixed(4) : '-'}</td>
                          <td className="px-3 py-2 text-right">{trow.stop != null ? trow.stop.toFixed(4) : '-'}</td>
                          <td className="px-3 py-2 text-right">{trow.take != null ? trow.take.toFixed(4) : '-'}</td>
                                                     <td className="px-3 py-2 text-right">-</td>
                           <td className="px-3 py-2 text-right">{trow.exit != null ? trow.exit.toFixed(4) : '-'}</td>
                           <td className="px-3 py-2 text-right">
                             {(() => {
                               const conf = trow.confidence ?? trow.conf ?? 0
                               const colorClass = conf >= 70 ? 'text-emerald-400' : conf >= 40 ? 'text-amber-400' : 'text-gray-400'
                               
                               return (
                                 <span className={colorClass}>
                                   {conf > 0 ? `${conf}%` : '-'}
                                 </span>
                               )
                             })()}
                           </td>
                           <td className={`px-3 py-2 text-right ${realizedR != null ? (realizedR >= 0 ? 'text-emerald-400' : 'text-red-400') : ''}`}>{realizedR != null ? `${realizedR.toFixed(2)} R` : '-'}</td>
                           <td className="px-3 py-2">{trow.exit != null ? new Date(trow.closed_at || trow.opened_at).toLocaleString() : 'Open'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {/* Pagination controls for autonomous trades */}
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                  <div className="text-gray-400">
                    Page {page} of {totalTradePages} • {trades.length} trades
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-gray-400">Rows:</label>
                    <select className="bg-gray-800 rounded px-2 py-1" value={pageSize} onChange={(e)=> setPageSize(Number(e.target.value))}>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <Button size="sm" variant="secondary" disabled={page <= 1} onClick={()=> setPage(p => Math.max(1, p-1))}>Prev</Button>
                    <Button size="sm" variant="secondary" disabled={page >= totalTradePages} onClick={()=> setPage(p => Math.min(totalTradePages, p+1))}>Next</Button>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}

// Mini spark chart for signals
function Spark({ symbol, interval, entry, stop, take }: { symbol: string; interval: string; entry: number; stop: number; take: number }) {
	const [candles, setCandles] = React.useState<{ time: number; open: number; high: number; low: number; close: number }[]>([])

	React.useEffect(() => {
		(async () => {
			try {
				const ks = await fetchKlines(symbol, interval as any, 40)
				setCandles(ks)
			} catch {}
		})()
	}, [symbol, interval])

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
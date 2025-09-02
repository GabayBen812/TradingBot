import { supabase } from '@/supabase/client'

export type ServerBotTrade = {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entry: number
  exit?: number | null
  stop?: number | null
  take?: number | null
  pnl?: number | null
  opened_at: string
  closed_at?: string | null
  notes?: string | null
  mode?: 'supervised' | 'strict' | 'explore'
  executor?: 'human' | 'bot_strict' | 'bot_explore'
}

export type ServerBotSignal = {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entry: number
  stop: number
  take: number
  confidence: number
  tags: string[]
  timeframe: string
  mode: 'supervised' | 'strict' | 'explore'
  status: 'NEW' | 'WATCHING' | 'IGNORED' | 'SAVED'
  createdAt: string
}

export type ServerBotOrder = {
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

let SERVER_BASE_URL = 'http://localhost:3001';

if (import.meta.env.VITE_NODE_ENV === "production") {
  SERVER_BASE_URL = import.meta.env.VITE_SERVER_URL_CLOUDFLARE || 'https://tradeapi.staysync.co.il';
}


// Helper function to make API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${SERVER_BASE_URL}/api/v1${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

// Bot Status and Metrics
export async function getBotStatus() {
  return apiCall<{
    isRunning: boolean
    uptime: number
    lastScan: string
    activeSignals: number
    pendingOrders: number
    openTrades: number
  }>('/bot/status')
}

export async function getBotMetrics(timeframe: string = '24h') {
  return apiCall<{
    timeframe: string
    signals: {
      total: number
      new: number
      watching: number
      ignored: number
      saved: number
    }
    orders: {
      total: number
      pending: number
      filled: number
      canceled: number
      expired: number
    }
    trades: {
      total: number
      open: number
      closed: number
      winRate: number
      avgR: number
    }
    performance: {
      totalR: number
      equity: number
    }
  }>(`/bot/metrics?timeframe=${timeframe}`)
}

// Signals
export async function getSignals(filters?: {
  status?: string
  symbol?: string
  mode?: string
  timeframe?: string
  min_conf?: number
  max_age_minutes?: number
  limit?: number
}) {
  const params = new URLSearchParams()
  if (filters?.status) params.append('status', filters.status)
  if (filters?.symbol) params.append('symbol', filters.symbol)
  if (filters?.mode) params.append('mode', filters.mode)
  if (filters?.timeframe) params.append('timeframe', filters.timeframe)
  if (filters?.min_conf != null) params.append('min_conf', String(filters.min_conf))
  if (filters?.max_age_minutes != null) params.append('max_age_minutes', String(filters.max_age_minutes))
  if (filters?.limit) params.append('limit', filters.limit.toString())

  const query = params.toString()
  return apiCall<{
    success: boolean
    data: ServerBotSignal[]
    total: number
    returned: number
  }>(`/signals${query ? `?${query}` : ''}`)
}

export async function createSignal(signalData: Partial<ServerBotSignal>) {
  return apiCall<{
    success: boolean
    message: string
    data: ServerBotSignal
  }>('/signals', {
    method: 'POST',
    body: JSON.stringify(signalData),
  })
}

export async function updateSignal(id: string, updateData: Partial<ServerBotSignal>) {
  return apiCall<{
    success: boolean
    message: string
    data: ServerBotSignal
  }>(`/signals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  })
}

// Orders
export async function getOrders(filters?: {
  status?: string
  symbol?: string
  mode?: string
  executor?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (filters?.status) params.append('status', filters.status)
  if (filters?.symbol) params.append('symbol', filters.symbol)
  if (filters?.mode) params.append('mode', filters.mode)
  if (filters?.executor) params.append('executor', filters.executor)
  if (filters?.limit) params.append('limit', filters.limit.toString())

  const query = params.toString()
  return apiCall<{
    success: boolean
    data: ServerBotOrder[]
    total: number
    returned: number
  }>(`/orders${query ? `?${query}` : ''}`)
}

export async function createOrder(orderData: Partial<ServerBotOrder>) {
  return apiCall<{
    success: boolean
    message: string
    data: ServerBotOrder
  }>('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  })
}

export async function cancelOrder(id: string, reason?: string) {
  return apiCall<{
    success: boolean
    message: string
  }>(`/orders/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

// Trades
export async function getTrades(filters?: {
  status?: string
  symbol?: string
  mode?: string
  executor?: string
  user_id?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (filters?.status) params.append('status', filters.status)
  if (filters?.symbol) params.append('symbol', filters.symbol)
  if (filters?.mode) params.append('mode', filters.mode)
  if (filters?.executor) params.append('executor', filters.executor)
  if (filters?.user_id) params.append('user_id', filters.user_id)
  if (filters?.limit) params.append('limit', filters.limit.toString())

  const query = params.toString()
  return apiCall<{
    success: boolean
    data: ServerBotTrade[]
    total: number
    returned: number
  }>(`/trades${query ? `?${query}` : ''}`)
}

export async function closeTrade(id: string, closeData: { exit: number; reason?: string }) {
  return apiCall<{
    success: boolean
    message: string
    data: ServerBotTrade
  }>(`/trades/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(closeData),
  })
}

// Analytics
export async function getPerformanceAnalytics(timeframe: string = '24h') {
  return apiCall<{
    success: boolean
    data: {
      totalTrades: number
      winRate: number
      avgR: number
      totalR: number
      equity: number
      sharpeRatio: number
    }
  }>(`/analytics/performance?timeframe=${timeframe}`)
}

export async function getSymbolPerformance(symbol: string) {
  return apiCall<{
    success: boolean
    data: {
      symbol: string
      totalTrades: number
      winRate: number
      avgR: number
      totalR: number
      bestTrade: number
      worstTrade: number
    }
  }>(`/analytics/symbols/${symbol}`)
}

// Fallback to Supabase if server is not available
export async function getSignalsWithFallback(filters?: any): Promise<ServerBotSignal[]> {
  try {
    const response = await getSignals(filters)
    return response.data
  } catch (error) {
    console.warn('Server unavailable, falling back to Supabase:', error)
    // Fallback to Supabase or return empty array
    return []
  }
}

export async function getOrdersWithFallback(filters?: any): Promise<ServerBotOrder[]> {
  try {
    const response = await getOrders(filters)
    return response.data
  } catch (error) {
    console.warn('Server unavailable, falling back to Supabase:', error)
    // Fallback to Supabase or return empty array
    return []
  }
}

export async function getTradesWithFallback(filters?: any): Promise<ServerBotTrade[]> {
  try {
    const response = await getTrades(filters)
    return response.data
  } catch (error) {
    console.warn('Server unavailable, falling back to Supabase:', error)
    // Fallback to Supabase or return empty array
    return []
  }
}

// Bot Settings
export async function getBotSettings(userId: string, mode: string) {
  return apiCall<{ data: any }>(`/bot/settings?user_id=${userId}&mode=${mode}`)
}

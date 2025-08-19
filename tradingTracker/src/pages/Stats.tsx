import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase/client'
import type { Trade } from '../types'
import { useAuth } from '../supabase/SupabaseProvider'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend
} from 'recharts'
import { aggregateStats, groupByHourWinRate } from '../utils/stats'
import { useTranslation } from 'react-i18next'

export default function Stats() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()
  const { user } = useAuth()

  useEffect(() => {
    const fetchTrades = async () => {
      if (!user) return
      setLoading(true)
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
      if (error) console.error(error)
      setTrades((data ?? []).map((t: any) => ({ ...t, date: t.date })))
      setLoading(false)
    }
    fetchTrades()
  }, [user?.id])

  const stats = useMemo(() => aggregateStats(trades), [trades])
  const winBySymbol = useMemo(() => {
    const map = new Map<string, { wins: number, total: number }>()
    for (const t of trades) {
      if (t.exit == null || t.entry == null) continue
      const rec = map.get(t.symbol) || { wins: 0, total: 0 }
      rec.total++
      const isWin = (t.side === 'LONG' && (t.exit as number) > (t.entry as number)) || (t.side === 'SHORT' && (t.exit as number) < (t.entry as number))
      if (isWin) rec.wins++
      map.set(t.symbol, rec)
    }
    return Array.from(map.entries()).map(([symbol, { wins, total }]) => ({ symbol, winRate: total ? (wins / total) * 100 : 0 }))
  }, [trades])

  const byHour = useMemo(() => groupByHourWinRate(trades), [trades])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('nav.stats')}</h1>
      {loading ? (
        <div className="text-gray-400">{t('trades.loading')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded p-4">
              <div className="text-gray-400 text-sm">Win Rate</div>
              <div className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</div>
            </div>
            <div className="bg-gray-800 rounded p-4">
              <div className="text-gray-400 text-sm">Avg R:R</div>
              <div className="text-2xl font-bold">{stats.avgRR.toFixed(2)}</div>
            </div>
            <div className="bg-gray-800 rounded p-4">
              <div className="text-gray-400 text-sm">Profit Factor</div>
              <div className="text-2xl font-bold">{Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'}</div>
            </div>
            <div className="bg-gray-800 rounded p-4">
              <div className="text-gray-400 text-sm">{t('nav.trades')}</div>
              <div className="text-2xl font-bold">{trades.length}</div>
            </div>
          </div>

          <div className="bg-gray-800 rounded p-4">
            <div className="mb-2 font-semibold">Cumulative P/L</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.equity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF"/>
                  <YAxis stroke="#9CA3AF"/>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#34D399" strokeWidth={2} dot={false} name="P/L" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded p-4">
              <div className="mb-2 font-semibold">Win Rate by Symbol</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={winBySymbol}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="symbol" stroke="#9CA3AF"/>
                    <YAxis stroke="#9CA3AF"/>
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} />
                    <Legend />
                    <Bar dataKey="winRate" fill="#60A5FA" name="Win %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-800 rounded p-4">
              <div className="mb-2 font-semibold">Win Rate by Time of Day</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" stroke="#9CA3AF"/>
                    <YAxis stroke="#9CA3AF"/>
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} />
                    <Legend />
                    <Bar dataKey="winRate" fill="#F59E0B" name="Win %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
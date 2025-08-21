import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase/client'
import type { Trade } from '../types'
import { useAuth } from '../supabase/SupabaseProvider'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend, AreaChart, Area
} from 'recharts'
import { aggregateStats, computePnLValue, computeRealizedR } from '../utils/stats'
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
  const pnl = useMemo(() => trades.reduce((acc, t) => acc + (computePnLValue(t) ?? 0), 0), [trades])
  const contributing = useMemo(() => trades.filter(t => computePnLValue(t) != null).length, [trades])
  const avgPnl = useMemo(() => (contributing ? pnl / contributing : 0), [pnl, contributing])
  const totalR = useMemo(() => trades.reduce((acc, t) => acc + (computeRealizedR(t) ?? 0), 0), [trades])
  const pnlBySymbol = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of trades) {
      const v = computePnLValue(t)
      if (v == null) continue
      map.set(t.symbol, (map.get(t.symbol) || 0) + v)
    }
    return Array.from(map.entries()).map(([symbol, value]) => ({ symbol, value }))
  }, [trades])
  const pnlByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of trades) {
      const v = computePnLValue(t)
      if (v == null) continue
      const key = new Date(t.date).toLocaleDateString()
      map.set(key, (map.get(key) || 0) + v)
    }
    return Array.from(map.entries()).sort((a,b)=> new Date(a[0]).getTime()-new Date(b[0]).getTime()).map(([date, value]) => ({ date, value }))
  }, [trades])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('nav.stats')}</h1>
      {loading ? (
        <div className="text-gray-400">{t('trades.loading')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded p-4"><div className="text-gray-400 text-sm">Net PnL ($)</div><div className="text-2xl font-bold">{pnl.toFixed(2)}</div></div>
            <div className="bg-gray-800 rounded p-4"><div className="text-gray-400 text-sm">Closed Trades (PnL)</div><div className="text-2xl font-bold">{contributing}</div></div>
            <div className="bg-gray-800 rounded p-4"><div className="text-gray-400 text-sm">Avg PnL / Trade ($)</div><div className="text-2xl font-bold">{avgPnl.toFixed(2)}</div></div>
            <div className="bg-gray-800 rounded p-4"><div className="text-gray-400 text-sm">Overall R (sum)</div><div className="text-2xl font-bold">{totalR.toFixed(2)}R</div></div>
          </div>

          <div className="bg-gray-800 rounded p-4">
            <div className="mb-2 font-semibold">Cumulative PnL</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.equity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF"/>
                  <YAxis stroke="#9CA3AF"/>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} />
                  <Legend />
                  <Area type="monotone" dataKey="value" stroke="#34D399" fill="#065F46" name="PnL ($)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded p-4">
              <div className="mb-2 font-semibold">PnL by Symbol ($)</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlBySymbol}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="symbol" stroke="#9CA3AF"/>
                    <YAxis stroke="#9CA3AF"/>
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} />
                    <Legend />
                    <Bar dataKey="value" fill="#60A5FA" name="PnL" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-800 rounded p-4">
              <div className="mb-2 font-semibold">PnL by Day ($)</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF"/>
                    <YAxis stroke="#9CA3AF"/>
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} />
                    <Legend />
                    <Bar dataKey="value" fill="#F472B6" name="PnL" />
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
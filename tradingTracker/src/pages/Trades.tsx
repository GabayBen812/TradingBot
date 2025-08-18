import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase/client'
import type { Trade } from '../types'
import TradesTable from '../components/TradesTable'
import TradeForm from '../components/TradeForm'
import Papa from 'papaparse'
import { useAuth } from '../supabase/SupabaseProvider'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { useTranslation } from 'react-i18next'

export default function Trades() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Trade | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchTrades = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false })
    if (error) console.error(error)
    setTrades((data ?? []).map((t: any) => ({ ...t, date: t.date })))
    setLoading(false)
  }

  useEffect(() => {
    fetchTrades()
  }, [])

  const onDelete = async (trade: Trade) => {
    if (!confirm(t('trades.deleteConfirm') as string)) return
    const { error } = await supabase.from('trades').delete().eq('id', trade.id)
    if (error) return alert(error.message)
    fetchTrades()
  }

  const exportCSV = () => {
    const csv = Papa.unparse(trades)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trades_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = useMemo(() => {
    const wins = trades.filter(t => t.exit != null && t.entry != null && ((t.side === 'LONG' && (t.exit as number) > (t.entry as number)) || (t.side === 'SHORT' && (t.exit as number) < (t.entry as number)))).length
    const count = trades.filter(t => t.exit != null).length
    return {
      winRate: count ? (wins / count) * 100 : 0,
    }
  }, [trades])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('trades.title')}</h1>
          <p className="text-gray-400 text-sm">{t('nav.user', { email: user?.email })}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setEditing(null); setShowForm(true) }}>{t('trades.add')}</Button>
          <Button variant="secondary" onClick={exportCSV}>{t('trades.export')}</Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <div className="font-semibold">{editing ? t('trades.editTitle') : t('trades.addTitle')}</div>
          </CardHeader>
          <CardBody>
            <TradeForm
              initial={editing ?? undefined}
              onSaved={() => { setShowForm(false); fetchTrades() }}
              onCancel={() => setShowForm(false)}
            />
          </CardBody>
        </Card>
      )}

      {loading ? (
        <div className="text-gray-400">{t('trades.loading')}</div>
      ) : trades.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title={t('trades.emptyTitle')} description={t('trades.emptyDesc') as string} action={<Button onClick={() => setShowForm(true)}>{t('trades.add')}</Button>} />
          </CardBody>
        </Card>
      ) : (
        <TradesTable trades={trades} onEdit={(t) => { setEditing(t); setShowForm(true) }} onDelete={onDelete} />
      )}

      <div className="text-sm text-gray-400">{t('trades.winRate', { value: stats.winRate.toFixed(1) })}</div>
    </div>
  )
}
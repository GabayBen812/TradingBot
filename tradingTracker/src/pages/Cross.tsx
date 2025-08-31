import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase/client'
import type { Trade } from '../types'
import TradesTable from '../components/TradesTable'
import { Card, CardBody } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../supabase/SupabaseProvider'

export default function Cross() {
  const { t } = useTranslation()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const { user } = useAuth()

  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .not('reason', 'ilike', '%[BOT]%')
        .order('date', { ascending: false })
      if (error) console.error(error)
      setTrades((data ?? []).map((t: any) => ({ ...t, date: t.date })))
      setLoading(false)
    }
    fetchTrades()
  }, [])

  // Fetch nicknames for involved users (no auth required to read)
  useEffect(() => {
    (async () => {
      const userIds = Array.from(new Set(trades.map(t => t.user_id)))
      if (userIds.length === 0) return
      const { data, error } = await supabase.from('profiles').select('id, nickname').in('id', userIds)
      if (error) return
      const map: Record<string, string> = {}
      for (const row of (data as any[])) {
        if (row.nickname) map[row.id] = row.nickname
      }
      setUserNames(map)
    })()
  }, [trades])

  const stats = useMemo(() => {
    const wins = trades.filter(t => t.exit != null && t.entry != null && ((t.side === 'LONG' && (t.exit as number) > (t.entry as number)) || (t.side === 'SHORT' && (t.exit as number) < (t.entry as number)))).length
    const count = trades.filter(t => t.exit != null).length
    return {
      winRate: count ? (wins / count) * 100 : 0,
    }
  }, [trades])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('nav.cross')}</h1>
        <div>
          <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded" onClick={()=> window.open('/cross/analytics', '_blank')}>Analytics</button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400">{t('trades.loading')}</div>
      ) : trades.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title={t('trades.emptyTitle')} description={t('trades.emptyDesc') as string} />
          </CardBody>
        </Card>
      ) : (
        <TradesTable trades={trades} onEdit={() => {}} onDelete={() => {}} readOnly showUser userNames={userNames} />
      )}

      <div className="text-sm text-gray-400">{t('trades.winRate', { value: stats.winRate.toFixed(1) })}</div>
    </div>
  )
}



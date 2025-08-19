import React, { useMemo, useState } from 'react'
import type { Trade } from '../types'
import { computeOutcome, computeRR } from '../utils/stats'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

type Props = {
  trades: Trade[]
  onEdit: (t: Trade) => void
  onDelete: (t: Trade) => void
  readOnly?: boolean
  showUser?: boolean
  userNames?: Record<string, string>
  onClose?: (t: Trade) => void
}

export default function TradesTable({ trades, onEdit, onDelete, readOnly = false, showUser = false, userNames, onClose }: Props) {
  const { t: tr } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<keyof Trade>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? trades.filter(t => `${t.symbol} ${t.side} ${t.reason ?? ''} ${t.notes ?? ''}`.toLowerCase().includes(q))
      : trades
    return [...list].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      let cmp = 0
      if (va == null && vb != null) cmp = -1
      else if (va != null && vb == null) cmp = 1
      else if (va == null && vb == null) cmp = 0
      else if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [trades, query, sortKey, sortDir])

  const setSort = (key: keyof Trade) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const headerCell = (label: string, key: keyof Trade) => (
    <th className="px-3 py-2 cursor-pointer select-none" onClick={() => setSort(key)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === key && <span className="text-xs text-gray-400">{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <input
          placeholder={tr('table.search') as string}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-gray-800 rounded px-3 py-2 w-full sm:w-80"
        />
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 sm:hidden">
        {filtered.map((t) => {
          const rr = computeRR(t.entry, t.stop ?? null, t.take ?? null)
          const outcome = computeOutcome(t)
          const isActive = t.exit == null
          return (
            <div key={t.id} className="bg-gray-800 rounded p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.symbol} • {t.side}</div>
                <div className="flex items-center gap-2">
                  {isActive && <span className="text-xs px-2 py-0.5 rounded bg-amber-600">{tr('status.active') as string}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded ${outcome === 'W' ? 'bg-emerald-600' : outcome === 'L' ? 'bg-red-600' : 'bg-gray-700'}`}>{outcome}</span>
                </div>
              </div>
              <div className="text-xs text-gray-400">{new Date(t.date).toLocaleString()}</div>
              {showUser && (
                <div className="text-xs text-gray-400">{userNames?.[t.user_id] ?? t.user_id}</div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>{tr('form.entry')}: {t.entry}</div>
                <div>{tr('form.exit')}: {t.exit ?? '-'}</div>
                <div>{tr('table.sl')}: {t.stop ?? '-'}</div>
                <div>{tr('table.tp')}: {t.take ?? '-'}</div>
                <div>{tr('form.riskPct')}: {t.risk_pct ?? '-'}</div>
                <div>{tr('form.autoRR')}: {rr != null ? rr.toFixed(2) : '-'}</div>
              </div>
              <div className="mt-2 flex gap-3 text-sm">
                <button className="text-sky-400" onClick={() => navigate(`/trades/${t.id}`)}>{tr('actions.view')}</button>
                {!readOnly && <button className="text-blue-400" onClick={() => onEdit(t)}>{tr('actions.edit')}</button>}
                {!readOnly && <button className="text-red-400" onClick={() => onDelete(t)}>{tr('actions.delete')}</button>}
                {!readOnly && isActive && onClose && <button className="text-amber-400" onClick={() => onClose(t)}>{tr('actions.close')}</button>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="overflow-x-auto hidden sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              {headerCell(tr('form.date'), 'date')}
              {headerCell(tr('form.symbol'), 'symbol')}
              {headerCell('Side', 'side')}
              {headerCell(tr('form.entry'), 'entry')}
              {headerCell(tr('form.exit'), 'exit' as any)}
              {headerCell(tr('form.stop'), 'stop' as any)}
              {headerCell(tr('form.take'), 'take' as any)}
              {headerCell(tr('form.riskPct'), 'risk_pct' as any)}
              <th className="px-3 py-2">{tr('table.outcome')}</th>
              <th className="px-3 py-2">{tr('table.rr')}</th>
              {headerCell(tr('table.size'), 'size' as any)}
              <th className="px-3 py-2">{tr('table.status')}</th>
              {showUser && <th className="px-3 py-2">{tr('table.user') as string}</th>}
              {!readOnly && <th className="px-3 py-2">{tr('table.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const rr = computeRR(t.entry, t.stop ?? null, t.take ?? null)
              const outcome = computeOutcome(t)
              const isActive = t.exit == null
              return (
                <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/60 cursor-pointer" onClick={() => navigate(`/trades/${t.id}`)}>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(t.date).toLocaleString()}</td>
                  <td className="px-3 py-2">{t.symbol}</td>
                  <td className="px-3 py-2">{t.side}</td>
                  <td className="px-3 py-2">{t.entry}</td>
                  <td className="px-3 py-2">{t.exit ?? '-'}</td>
                  <td className="px-3 py-2">{t.stop ?? '-'}</td>
                  <td className="px-3 py-2">{t.take ?? '-'}</td>
                  <td className="px-3 py-2">{t.risk_pct ?? '-'}</td>
                  <td className="px-3 py-2">{outcome}</td>
                  <td className="px-3 py-2">{rr != null ? rr.toFixed(2) : '-'}</td>
                  <td className="px-3 py-2">{t.size ?? '-'}</td>
                  <td className="px-3 py-2">{isActive ? (tr('status.active') as string) : (tr('status.closed') as string)}</td>
                  {showUser && <td className="px-3 py-2">{userNames?.[t.user_id] ?? t.user_id}</td>}
                  {!readOnly && (
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button className="text-sky-400 hover:text-sky-300 mr-3" onClick={(e) => { e.stopPropagation(); navigate(`/trades/${t.id}`) }}>{tr('actions.view')}</button>
                      <button className="text-blue-400 hover:text-blue-300 mr-3" onClick={(e) => { e.stopPropagation(); onEdit(t) }}>{tr('actions.edit')}</button>
                      <button className="text-red-400 hover:text-red-300 mr-3" onClick={(e) => { e.stopPropagation(); onDelete(t) }}>{tr('actions.delete')}</button>
                      {isActive && onClose && <button className="text-amber-400 hover:text-amber-300" onClick={(e) => { e.stopPropagation(); onClose(t) }}>{tr('actions.close')}</button>}
                    </td>
                  )}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={16} className="px-3 py-6 text-center text-gray-400">{tr('table.noTrades')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
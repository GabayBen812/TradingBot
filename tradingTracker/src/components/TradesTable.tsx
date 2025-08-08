import React, { useMemo, useState } from 'react'
import type { Trade } from '../types'
import { computeOutcome, computeRR } from '../utils/stats'

type Props = {
  trades: Trade[]
  onEdit: (t: Trade) => void
  onDelete: (t: Trade) => void
}

export default function TradesTable({ trades, onEdit, onDelete }: Props) {
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
          placeholder="Search..."
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
          return (
            <div key={t.id} className="bg-gray-800 rounded p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.symbol} • {t.side}</div>
                <div className={`text-xs px-2 py-0.5 rounded ${outcome === 'W' ? 'bg-emerald-600' : outcome === 'L' ? 'bg-red-600' : 'bg-gray-700'}`}>{outcome}</div>
              </div>
              <div className="text-xs text-gray-400">{new Date(t.date).toLocaleString()}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>Entry: {t.entry}</div>
                <div>Exit: {t.exit ?? '-'}</div>
                <div>SL: {t.stop ?? '-'}</div>
                <div>TP: {t.take ?? '-'}</div>
                <div>Risk %: {t.risk_pct ?? '-'}</div>
                <div>R:R: {rr != null ? rr.toFixed(2) : '-'}</div>
              </div>
              <div className="mt-2 flex gap-3 text-sm">
                <button className="text-blue-400" onClick={() => onEdit(t)}>Edit</button>
                <button className="text-red-400" onClick={() => onDelete(t)}>Delete</button>
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
              {headerCell('Date', 'date')}
              {headerCell('Symbol', 'symbol')}
              {headerCell('Side', 'side')}
              {headerCell('Entry', 'entry')}
              {headerCell('Exit', 'exit' as any)}
              {headerCell('Stop', 'stop' as any)}
              {headerCell('Take', 'take' as any)}
              {headerCell('Risk %', 'risk_pct' as any)}
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">R:R</th>
              {headerCell('Size', 'size' as any)}
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const rr = computeRR(t.entry, t.stop ?? null, t.take ?? null)
              const outcome = computeOutcome(t)
              return (
                <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/60">
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
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button className="text-blue-400 hover:text-blue-300 mr-3" onClick={() => onEdit(t)}>Edit</button>
                    <button className="text-red-400 hover:text-red-300" onClick={() => onDelete(t)}>Delete</button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-gray-400">No trades found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
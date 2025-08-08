import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase/client'
import type { Trade } from '../types'
import { computeRiskPct, computeRR } from '../utils/stats'

const bucket = 'trade-images'

type Props = {
  initial?: Partial<Trade>
  onSaved: () => void
  onCancel: () => void
}

const defaultState: Partial<Trade> = {
  date: new Date().toISOString().slice(0, 16), // yyyy-mm-ddThh:mm
  side: 'LONG',
}

export default function TradeForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<Partial<Trade>>({ ...defaultState, ...initial })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm((f) => ({ ...f, ...initial }))
  }, [initial])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: name === 'date' ? value : ['entry','exit','stop','take','risk_pct','size'].includes(name) ? (value === '' ? null : Number(value)) : value }))
  }

  // Auto-calc risk% if entry & stop present
  const autoRisk = useMemo(() => computeRiskPct(form.entry ?? null, form.stop ?? null), [form.entry, form.stop])
  const autoRR = useMemo(() => computeRR(form.entry ?? null, form.stop ?? null, form.take ?? null), [form.entry, form.stop, form.take])

  const uploadImageIfAny = async (): Promise<string | undefined> => {
    if (!uploadFile) return form.image_url || undefined
    const ext = uploadFile.name.split('.').pop()
    const path = `${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, uploadFile, { upsert: false })
    if (upErr) throw upErr
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const image_url = await uploadImageIfAny()
      const payload: any = {
        date: new Date(form.date as string),
        symbol: form.symbol,
        side: form.side,
        entry: form.entry,
        exit: form.exit ?? null,
        stop: form.stop ?? null,
        take: form.take ?? null,
        risk_pct: form.risk_pct ?? (autoRisk != null ? Number(autoRisk.toFixed(2)) : null),
        size: form.size ?? null,
        reason: form.reason ?? null,
        notes: form.notes ?? null,
        image_url: image_url ?? null,
      }
      if (initial?.id) {
        const { error } = await supabase.from('trades').update(payload).eq('id', initial.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('trades').insert(payload)
        if (error) throw error
      }
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Failed to save trade')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">Date</span>
          <input name="date" type="datetime-local" value={form.date as string} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">Symbol</span>
          <input name="symbol" placeholder="SOLUSDT" value={form.symbol || ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">Position</span>
          <select name="side" value={form.side as any} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2">
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">Entry price</span>
          <input name="entry" type="number" step="0.0001" value={form.entry ?? ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">Exit price</span>
          <input name="exit" type="number" step="0.0001" value={form.exit ?? ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">Stop loss</span>
          <input name="stop" type="number" step="0.0001" value={form.stop ?? ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">Take profit</span>
          <input name="take" type="number" step="0.0001" value={form.take ?? ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">Risk %</span>
          <input name="risk_pct" type="number" step="0.01" value={form.risk_pct ?? (autoRisk != null ? Number(autoRisk.toFixed(2)) : '')} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">Size (quote)</span>
          <input name="size" type="number" step="0.01" value={form.size ?? ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div className="bg-gray-800 rounded p-3">
          <div className="text-gray-400">Auto Risk %</div>
          <div className="text-lg font-semibold">{autoRisk != null ? autoRisk.toFixed(2) + '%' : '-'}</div>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <div className="text-gray-400">Auto R:R</div>
          <div className="text-lg font-semibold">{autoRR != null ? autoRR.toFixed(2) : '-'}</div>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <div className="text-gray-400">Direction</div>
          <div className="text-lg font-semibold">{form.side}</div>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-300">Entry reason</span>
        <textarea name="reason" value={form.reason || ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" rows={3} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-300">Notes</span>
        <textarea name="notes" value={form.notes || ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" rows={3} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-300">Screenshot</span>
        <input type="file" accept="image/*" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
      </label>
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 rounded px-4 py-2">
          {saving ? 'Saving...' : initial?.id ? 'Update' : 'Add Trade'}
        </button>
        <button type="button" onClick={onCancel} className="bg-gray-700 hover:bg-gray-600 rounded px-4 py-2">Cancel</button>
      </div>
    </form>
  )
}
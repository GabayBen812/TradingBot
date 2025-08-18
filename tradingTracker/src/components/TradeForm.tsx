import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase/client'
import type { Trade } from '../types'
import { computeRiskPct, computeRR } from '../utils/stats'
import { useTranslation } from 'react-i18next'
import ImagesGallery from './ImagesGallery'

const bucket = (import.meta.env.VITE_SUPABASE_TRADE_BUCKET as string) || 'trade-images'

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
  const { t } = useTranslation()
  const [form, setForm] = useState<Partial<Trade>>({ ...defaultState, ...initial })
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const [existingUrls, setExistingUrls] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sizing helpers
  const [sizingMode, setSizingMode] = useState<'quantity' | 'risk'>('quantity')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [riskAmount, setRiskAmount] = useState<number | ''>('')
  const [accountBalance, setAccountBalance] = useState<number | ''>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setForm((f) => ({ ...f, ...initial }))
    const existing: string[] = []
    if (initial?.image_urls && Array.isArray(initial.image_urls)) existing.push(...(initial.image_urls as string[]))
    else if (initial?.image_url) existing.push(initial.image_url as string)
    setExistingUrls(existing)
  }, [initial])

  // Clean up object URLs
  useEffect(() => {
    return () => {
      newPreviews.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [newPreviews])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: name === 'date' ? value : ['entry','exit','stop','take','risk_pct','size'].includes(name) ? (value === '' ? null : Number(value)) : value }))
  }

  // Auto-calc risk% if entry & stop present
  const autoRisk = useMemo(() => computeRiskPct(form.entry ?? null, form.stop ?? null), [form.entry, form.stop])
  const autoRR = useMemo(() => computeRR(form.entry ?? null, form.stop ?? null, form.take ?? null), [form.entry, form.stop, form.take])

  // Derived sizing calculations
  const priceDiff = useMemo(() => {
    if (form.entry == null || form.stop == null) return null
    return Math.abs((form.entry as number) - (form.stop as number))
  }, [form.entry, form.stop])

  const derivedQuantityFromRisk = useMemo(() => {
    if (sizingMode !== 'risk') return null
    if (priceDiff == null || priceDiff === 0) return null
    if (riskAmount === '' || riskAmount == null) return null
    return (riskAmount as number) / priceDiff
  }, [sizingMode, priceDiff, riskAmount])

  const effectiveQuantity = useMemo(() => {
    if (sizingMode === 'quantity') return quantity === '' ? null : (quantity as number)
    return derivedQuantityFromRisk
  }, [sizingMode, quantity, derivedQuantityFromRisk])

  const derivedSizeQuote = useMemo(() => {
    if (effectiveQuantity == null || form.entry == null) return null
    return (effectiveQuantity as number) * (form.entry as number)
  }, [effectiveQuantity, form.entry])

  const suggestedLeverage = useMemo(() => {
    if (accountBalance === '' || accountBalance == null) return null
    if (derivedSizeQuote == null) return null
    const bal = accountBalance as number
    if (bal <= 0) return null
    return derivedSizeQuote / bal
  }, [accountBalance, derivedSizeQuote])

  const onFilesAdded = (files: FileList | null) => {
    if (!files) return
    const list = Array.from(files)
    setUploadFiles((prev) => [...prev, ...list])
    const urls = list.map((f) => URL.createObjectURL(f))
    setNewPreviews((prev) => [...prev, ...urls])
  }

  const uploadImagesIfAny = async (): Promise<string[]> => {
    if (!uploadFiles || uploadFiles.length === 0) return []
    const urls: string[] = []
    for (const file of uploadFiles) {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined, cacheControl: '31536000' })
      if (upErr) {
        const msg = (upErr?.message || '').toLowerCase()
        if (msg.includes('not found') || msg.includes('bucket')) {
          throw new Error(t('form.screenshots.bucketMissing', { bucket }))
        }
        throw upErr
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    return urls
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const imageUrls = await uploadImagesIfAny()

      // Determine size to save, prefer sizing helpers if provided
      let sizeToSave: number | null | undefined = form.size ?? null
      if (effectiveQuantity != null && form.entry != null) {
        sizeToSave = Number((effectiveQuantity * (form.entry as number)).toFixed(2))
      }

      const isoDate = form.date ? new Date(form.date as string).toISOString() : new Date().toISOString()
      const finalImageUrls = [...existingUrls, ...imageUrls]
      const payload: any = {
        date: isoDate,
        symbol: form.symbol,
        side: form.side,
        entry: form.entry,
        exit: form.exit ?? null,
        stop: form.stop ?? null,
        take: form.take ?? null,
        risk_pct: form.risk_pct ?? (autoRisk != null ? Number(autoRisk.toFixed(2)) : null),
        size: sizeToSave ?? null,
        reason: form.reason ?? null,
        notes: form.notes ?? null,
        image_url: finalImageUrls[0] ?? null,
      }

      if (finalImageUrls && finalImageUrls.length > 0) {
        payload.image_urls = finalImageUrls
      }

      const doWrite = async () => {
        if (initial?.id) {
          const { error } = await supabase.from('trades').update(payload).eq('id', initial.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('trades').insert(payload)
          if (error) throw error
        }
      }

      try {
        await doWrite()
      } catch (err: any) {
        if (payload.image_urls) delete payload.image_urls
        await doWrite()
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
          <span className="text-sm text-gray-300">{t('form.date')}</span>
          <input name="date" type="datetime-local" value={form.date as string} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">{t('form.symbol')}</span>
          <input name="symbol" placeholder="SOLUSDT" value={form.symbol || ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">{t('form.position')}</span>
          <select name="side" value={form.side as any} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2">
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">{t('form.entry')}</span>
          <input name="entry" type="number" step="0.0001" value={form.entry ?? ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">{t('form.exit')}</span>
          <input name="exit" type="number" step="0.0001" value={form.exit ?? ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">{t('form.stop')}</span>
          <input name="stop" type="number" step="0.0001" value={form.stop ?? ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">{t('form.take')}</span>
          <input name="take" type="number" step="0.0001" value={form.take ?? ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">{t('form.riskPct')}</span>
          <input name="risk_pct" type="number" step="0.01" value={form.risk_pct ?? (autoRisk != null ? Number(autoRisk.toFixed(2)) : '')} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div className="bg-gray-800 rounded p-3">
          <div className="text-gray-400">{t('form.autoRisk')}</div>
          <div className="text-lg font-semibold">{autoRisk != null ? autoRisk.toFixed(2) + '%' : '-'}</div>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <div className="text-gray-400">{t('form.autoRR')}</div>
          <div className="text-lg font-semibold">{autoRR != null ? autoRR.toFixed(2) : '-'}</div>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <div className="text-gray-400">{t('form.direction')}</div>
          <div className="text-lg font-semibold">{form.side}</div>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-300">{t('form.reason')}</span>
        <textarea name="reason" value={form.reason || ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" rows={3} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-300">{t('form.notes')}</span>
        <textarea name="notes" value={form.notes || ''} onChange={handleChange} className="bg-gray-800 rounded px-3 py-2" rows={3} />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2 bg-gray-800 rounded p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">{t('form.sizing.mode')}</span>
            <select className="bg-gray-700 rounded px-2 py-1 text-sm" value={sizingMode} onChange={(e) => setSizingMode(e.target.value as any)}>
              <option value="quantity">{t('form.sizing.byQty')}</option>
              <option value="risk">{t('form.sizing.byRisk')}</option>
            </select>
          </div>

          {sizingMode === 'quantity' ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-300">{t('form.sizing.qty')}</span>
              <input type="number" step="0.0001" value={quantity} onChange={(e)=> setQuantity(e.target.value === '' ? '' : Number(e.target.value))} className="bg-gray-700 rounded px-3 py-2" />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-300">{t('form.sizing.riskAmount')}</span>
                <input type="number" step="0.01" value={riskAmount} onChange={(e)=> setRiskAmount(e.target.value === '' ? '' : Number(e.target.value))} className="bg-gray-700 rounded px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-300">{t('form.sizing.balance')}</span>
                <input type="number" step="0.01" value={accountBalance} onChange={(e)=> setAccountBalance(e.target.value === '' ? '' : Number(e.target.value))} className="bg-gray-700 rounded px-3 py-2" />
              </label>
            </>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-gray-700 rounded p-2">
              <div className="text-gray-400">{t('form.sizing.calcQty')}</div>
              <div className="font-semibold">{effectiveQuantity != null ? Number(effectiveQuantity).toFixed(4) : '-'}</div>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <div className="text-gray-400">{t('form.sizing.calcSize')}</div>
              <div className="font-semibold">{derivedSizeQuote != null ? Number(derivedSizeQuote).toFixed(2) : '-'}</div>
            </div>
            <div className="bg-gray-700 rounded p-2 col-span-2">
              <div className="text-gray-400">{t('form.sizing.leverage')}</div>
              <div className="font-semibold">{suggestedLeverage != null ? `${suggestedLeverage.toFixed(2)}x` : '-'}</div>
            </div>
          </div>
        </div>

        <ImagesGallery
          title={t('form.screenshots') as string}
          existingUrls={existingUrls}
          onRemoveExisting={(idx) => setExistingUrls((arr) => arr.filter((_, i) => i !== idx))}
          newPreviews={newPreviews}
          onAddFiles={(files) => {
            const list = Array.from(files)
            setUploadFiles((prev) => [...prev, ...list])
            const urls = list.map((f) => URL.createObjectURL(f))
            setNewPreviews((prev) => [...prev, ...urls])
          }}
          onRemoveNew={(idx) => {
            setUploadFiles((arr) => arr.filter((_, i) => i !== idx))
            setNewPreviews((arr) => {
              const clone = [...arr]
              const [removed] = clone.splice(idx, 1)
              if (removed) URL.revokeObjectURL(removed)
              return clone
            })
          }}
        />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 rounded px-4 py-2">
          {saving ? '...' : (initial?.id ? t('form.update') : t('form.save'))}
        </button>
        <button type="button" onClick={onCancel} className="bg-gray-700 hover:bg-gray-600 rounded px-4 py-2">{t('form.cancel')}</button>
      </div>
    </form>
  )
}
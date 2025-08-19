import React, { useState } from 'react'
import { supabase } from '../supabase/client'
import Button from './ui/Button'
import { useTranslation } from 'react-i18next'

type Props = {
  open: boolean
  userId: string
  onSaved: (nickname: string) => void
}

export default function NicknameModal({ open, userId, onSaved }: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const save = async () => {
    const trimmed = value.trim()
    if (trimmed.length < 2 || trimmed.length > 24) {
      setError(t('nickname.error.invalid') as string)
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, nickname: trimmed }, { onConflict: 'id' })
    setSaving(false)
    if (error) {
      if ((error as any).code === '23505') setError(t('nickname.error.taken') as string)
      else setError(error.message)
      return
    }
    onSaved(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-1">{t('nickname.title')}</h2>
        <p className="text-gray-400 text-sm mb-4">{t('nickname.description')}</p>
        <input
          autoFocus
          disabled={saving}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('nickname.placeholder') as string}
          className="w-full bg-gray-800 rounded px-3 py-2 mb-3"
        />
        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button onClick={save} disabled={saving || value.trim().length < 2}>{saving ? t('nickname.saving') : t('nickname.save')}</Button>
        </div>
      </div>
    </div>
  )
}



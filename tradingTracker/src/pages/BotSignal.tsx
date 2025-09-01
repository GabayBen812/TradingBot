import React from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import TradeChart from '../components/TradeChart'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { analyzeSignalHebrew } from '../sage/geminiText'
import { computeRR } from '../utils/stats'
import { supabase } from '@/supabase/client'

export default function BotSignal() {
  const [params] = useSearchParams()
  const id = params.get('id') || ''
  const symbol = params.get('symbol') || 'BTCUSDT'
  const side = (params.get('side') as 'LONG' | 'SHORT') || 'LONG'
  const tf = (params.get('tf') as '1m' | '5m' | '15m' | '1h' | '4h') || '15m'
  const entry = Number(params.get('entry') || '0')
  const stop = params.get('stop') != null ? Number(params.get('stop')) : null
  const take = params.get('take') != null ? Number(params.get('take')) : null
  const reason = params.get('reason') || ''

  const [interval, setInterval] = React.useState<'1m' | '5m' | '15m' | '1h' | '4h'>(tf)
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiText, setAiText] = React.useState<string | null>(null)
  const [fibOverlays, setFibOverlays] = React.useState<{ price: number; color?: string; label?: string }[]>([])

  const rr = computeRR(entry || null, stop, take)

  const perUnitRisk = stop != null ? Math.abs((entry || 0) - stop) : null
  const suggestedSize = perUnitRisk && perUnitRisk > 0 ? Math.round((100 / perUnitRisk) * (entry || 0)) : 100
  const [size, setSize] = React.useState<number>(suggestedSize)

  const features = React.useMemo(() => {
    const list: string[] = []
    const txt = reason.toLowerCase()
    if (txt.includes('fib')) list.push('Fibonacci 61.8/78.6')
    if (txt.includes('fvg')) list.push('Fair Value Gap')
    if (txt.includes('trend')) list.push('Trend alignment (EMA slope)')
    if (txt.includes('rsi')) list.push('RSI filter')
    if (txt.includes('sr') || txt.includes('support') || txt.includes('resistance')) list.push('Support/Resistance proximity')
    return list
  }, [reason])

  React.useEffect(async () => {
    setAiLoading(true)
    try {
      const txt = await analyzeSignalHebrew({ symbol, side, entry, stop, take, rr, reason })
      setAiText(txt)
      // optional: set fib overlays based on AI suggestions (omitted here)
    } catch {
      setAiText(null)
    } finally {
      setAiLoading(false)
    }
  }, [symbol, side, entry, stop, take, rr, reason])

  const updateSignalState = (partial: Record<string, any>) => {
    try {
      const raw = localStorage.getItem('bot_signal_state_v1') || '{}'
      const obj = JSON.parse(raw)
      const curr = obj[id] || { status: 'NEW' }
      obj[id] = { ...curr, ...partial }
      localStorage.setItem('bot_signal_state_v1', JSON.stringify(obj))
    } catch {}
  }

  const handleIgnore = () => {
    updateSignalState({ status: 'IGNORED' })
    alert('Signal ignored')
  }

  const handleSnooze = () => {
    updateSignalState({ notifyAt: entry })
    alert('You will be notified when price hits entry')
  }

  const handlePlaceOrder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in')
      const payload = {
        user_id: user.id,
        created_at: new Date().toISOString(),
        status: 'PENDING',
        symbol,
        side,
        entry,
        stop,
        take,
        size,
        timeframe: tf,
        reason: reason || '[BOT] Signal',
        mode: 'supervised',
        executor: 'human',
      }
      const { error } = await supabase.from('orders').insert(payload)
      if (error) throw error
      updateSignalState({ status: 'SAVED' })
      alert('Order placed')
    } catch (e: any) {
      alert(e?.message || 'Failed to place order')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{symbol} • {side} • {interval}</h1>
        <div className="flex gap-2">
          <input
            type="number"
            className="bg-gray-800 rounded px-2 py-1 w-24"
            value={size}
            onChange={(e)=> setSize(Number(e.target.value || '0'))}
            title="Order size"
          />
          <Button onClick={handlePlaceOrder}>Place order</Button>
          <Button variant="secondary" onClick={handleSnooze}>Snooze</Button>
          <Button variant="secondary" onClick={handleIgnore}>Ignore</Button>
          <Link to="/bot"><Button variant="secondary">Back</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-semibold">Chart</div>
            <div className="flex gap-2 text-sm">
              {(['1m','5m','15m','1h','4h'] as const).map((t) => (
                <button key={t} onClick={() => setInterval(t)} className={`px-2 py-1 rounded ${interval === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>{t}</button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <TradeChart symbol={symbol} entry={entry || null} stop={stop ?? null} take={take ?? null} interval={interval} overlays={fibOverlays} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="font-semibold">Setup details</div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-gray-400">Entry</div><div>{entry || '-'}</div></div>
              <div><div className="text-gray-400">SL</div><div>{stop ?? '-'}</div></div>
              <div><div className="text-gray-400">TP</div><div>{take ?? '-'}</div></div>
              <div><div className="text-gray-400">R:R</div><div>{rr != null ? rr.toFixed(2) : '-'}</div></div>
            </div>
            {reason && (
              <div className="mt-4">
                <div className="text-gray-400 text-sm mb-1">Reason</div>
                <div className="bg-gray-800 rounded p-3 text-sm">{reason}</div>
              </div>
            )}
            {features.length > 0 && (
              <div className="mt-4">
                <div className="text-gray-400 text-sm mb-1">Indicators/Confluence</div>
                <ul className="list-disc ml-5 text-sm">
                  {features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="font-semibold">AI explanation</div>
          </CardHeader>
          <CardBody>
            <div className="flex justify-end mb-3"><Button onClick={async ()=>{
              setAiLoading(true)
              try {
                const txt = await analyzeSignalHebrew({ symbol, side, entry, stop, take, reason })
                setAiText(txt)
              } catch (e: any) {
                setAiText(e?.message || 'AI unavailable')
              } finally { setAiLoading(false) }
            }}>{aiLoading ? 'Thinking…' : 'Explain'}</Button></div>
            <div className="whitespace-pre-wrap text-sm leading-6 min-h-[120px] text-right" dir="rtl" lang="he">{aiText || '—'}</div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}



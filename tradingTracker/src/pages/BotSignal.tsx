import React from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import TradeChart from '../components/TradeChart'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { analyzeSignalHebrew } from '../sage/geminiText'
import { computeRR } from '../utils/stats'

export default function BotSignal() {
  const [params] = useSearchParams()
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

  React.useEffect(() => {
    (async () => {
      try {
        const { fetchKlines } = await import('../sage/market')
        const ks = await fetchKlines(symbol, interval, 150)
        if (ks.length < 10) { setFibOverlays([]); return }
        const highs = ks.map(k=>k.high), lows = ks.map(k=>k.low)
        const look = Math.min(80, ks.length)
        const hi = Math.max(...highs.slice(-look))
        const lo = Math.min(...lows.slice(-look))
        const isUp = lows.slice(-look).indexOf(lo) < highs.slice(-look).indexOf(hi)
        const rng = Math.abs(hi - lo)
        const f382 = isUp ? hi - 0.382*rng : lo + 0.382*rng
        const f50  = isUp ? hi - 0.5  *rng : lo + 0.5  *rng
        const f618 = isUp ? hi - 0.618*rng : lo + 0.618*rng
        const f786 = isUp ? hi - 0.786*rng : lo + 0.786*rng
        setFibOverlays([
          { price: f382, color: '#60A5FA', label: '0.382' },
          { price: f50,  color: '#22D3EE', label: '0.5' },
          { price: f618, color: '#3B82F6', label: '0.618' },
          { price: f786, color: '#8B5CF6', label: '0.786' },
        ])
      } catch { setFibOverlays([]) }
    })()
  }, [symbol, interval])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{symbol} • {side} • {interval}</h1>
        <div className="flex gap-2">
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



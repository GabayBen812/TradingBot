import React, { useEffect, useRef, useState } from 'react'
import type { Candle } from '../sage/market'
import { fetchKlines } from '../sage/market'
import { createChart, LineStyle } from 'lightweight-charts'

type Props = {
	symbol: string
	entry?: number | null
	stop?: number | null
	take?: number | null
	exit?: number | null
	interval?: '1m' | '5m' | '15m' | '1h' | '4h'
	limit?: number
}

export default function TradeChart({ symbol, entry, stop, take, exit, interval = '15m', limit = 400 }: Props) {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<any | null>(null)
	const candleSeriesRef = useRef<any | null>(null)
	const [candles, setCandles] = useState<Candle[]>([])

	useEffect(() => {
		if (!containerRef.current) return
		const chart = createChart(containerRef.current, {
			width: containerRef.current.clientWidth,
			height: 420,
			layout: { textColor: '#E5E7EB', background: { color: '#111827' } },
			grid: { horzLines: { color: '#1F2937' }, vertLines: { color: '#1F2937' } },
			rightPriceScale: { borderColor: '#374151' },
			timeScale: { borderColor: '#374151' },
		})
		const candleSeries = (chart as any).addCandlestickSeries({ upColor: '#34D399', downColor: '#EF4444', borderVisible: false, wickUpColor: '#34D399', wickDownColor: '#EF4444' })
		chartRef.current = chart
		candleSeriesRef.current = candleSeries
		const handleResize = () => {
			if (!containerRef.current || !chartRef.current) return
			chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
		}
		window.addEventListener('resize', handleResize)
		;(chart as any)._disposeHandler = () => window.removeEventListener('resize', handleResize)
		return () => {
			try { (chartRef.current as any)?._disposeHandler?.(); chartRef.current?.remove?.() } catch {}
			chartRef.current = null
			candleSeriesRef.current = null
		}
	}, [])

	useEffect(() => {
		(async () => {
			try {
				const data = await fetchKlines(symbol, interval, limit)
				setCandles(data)
			} catch {}
		})()
	}, [symbol, interval, limit])

	useEffect(() => {
		const candleSeries = candleSeriesRef.current
		if (!candleSeries || candles.length === 0) return
		;(candleSeries as any).setData(candles.map(c => ({ time: (c.time / 1000) as any, open: c.open, high: c.high, low: c.low, close: c.close })))
		chartRef.current?.timeScale().fitContent()

		// Draw lines
		const lines: any[] = []
		const add = (price: number, color: string, title: string) => {
			if (price == null) return
			const l = (candleSeries as any).createPriceLine({ price, color, lineStyle: LineStyle.Solid, lineWidth: 1, title })
			lines.push(l)
		}
		add(entry ?? (undefined as any), '#3B82F6', 'Entry')
		add(stop ?? (undefined as any), '#EF4444', 'SL')
		add(take ?? (undefined as any), '#10B981', 'TP')
		add(exit ?? (undefined as any), '#F59E0B', 'Exit')
		return () => {
			try { lines.forEach((pl) => (candleSeries as any).removePriceLine?.(pl)) } catch {}
		}
	}, [candles, entry, stop, take, exit])

	return <div ref={containerRef} className="w-full" />
}



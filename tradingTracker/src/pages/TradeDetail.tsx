import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase/client'
import type { Trade } from '../types'
import TradeChart from '../components/TradeChart'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'

export default function TradeDetail() {
	const { id } = useParams()
	const [trade, setTrade] = useState<Trade | null>(null)
	const [loading, setLoading] = useState(true)
	const [interval, setInterval] = useState<'1m' | '5m' | '15m' | '1h' | '4h'>('15m')

	useEffect(() => {
		(async () => {
			setLoading(true)
			const { data, error } = await supabase.from('trades').select('*').eq('id', id).single()
			if (!error && data) setTrade(data as Trade)
			setLoading(false)
		})()
	}, [id])

	if (loading) return <div className="text-gray-400">Loading...</div>
	if (!trade) return <div className="text-gray-400">Trade not found</div>

	const images: string[] = (trade as any).image_urls || (trade.image_url ? [trade.image_url] : [])

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-semibold">{trade.symbol} • {trade.side}</h1>
				<Link to="/"><Button variant="secondary">Back</Button></Link>
			</div>

			<Card>
				<CardBody>
					<div className="flex items-center justify-between mb-3">
						<div className="font-semibold">{trade.symbol} {interval}</div>
						<div className="flex gap-2 text-sm">
							{(['1m','5m','15m','1h','4h'] as const).map((tf) => (
								<button
									key={tf}
									onClick={() => setInterval(tf)}
									className={`px-2 py-1 rounded ${interval === tf ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
								>{tf}</button>
							))}
						</div>
					</div>
					<TradeChart symbol={trade.symbol} entry={trade.entry} stop={trade.stop ?? null} take={trade.take ?? null} exit={trade.exit ?? null} interval={interval} />
				</CardBody>
			</Card>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<Card className="lg:col-span-2">
					<CardHeader>
						<div className="font-semibold">Details</div>
					</CardHeader>
					<CardBody>
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
							<div><span className="text-gray-400">Symbol</span><div>{trade.symbol}</div></div>
							<div><span className="text-gray-400">Side</span><div>{trade.side}</div></div>
							<div><span className="text-gray-400">Date</span><div>{new Date(trade.date).toLocaleString()}</div></div>
							<div><span className="text-gray-400">Entry</span><div>{trade.entry}</div></div>
							<div><span className="text-gray-400">Exit</span><div>{trade.exit ?? '-'}</div></div>
							<div><span className="text-gray-400">SL</span><div>{trade.stop ?? '-'}</div></div>
							<div><span className="text-gray-400">TP</span><div>{trade.take ?? '-'}</div></div>
							<div><span className="text-gray-400">Risk %</span><div>{trade.risk_pct ?? '-'}</div></div>
							<div><span className="text-gray-400">Size</span><div>{trade.size ?? '-'}</div></div>
						</div>
						{trade.reason && (
							<div className="mt-4">
								<div className="text-gray-400 text-sm mb-1">Reason</div>
								<div className="bg-gray-800 rounded p-3 text-sm">{trade.reason}</div>
							</div>
						)}
						{trade.notes && (
							<div className="mt-4">
								<div className="text-gray-400 text-sm mb-1">Notes</div>
								<div className="bg-gray-800 rounded p-3 text-sm">{trade.notes}</div>
							</div>
						)}
					</CardBody>
				</Card>

				<Card>
					<CardHeader>
						<div className="font-semibold">Screenshots</div>
					</CardHeader>
					<CardBody>
						{images.length === 0 ? (
							<div className="text-sm text-gray-400">No screenshots</div>
						) : (
							<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
								{images.map((u, i) => (
									<a key={i} href={u} target="_blank" rel="noreferrer">
										<img src={u} alt="screenshot" className="w-full h-40 object-cover rounded" />
									</a>
								))}
							</div>
						)}
					</CardBody>
				</Card>
			</div>
		</div>
	)
}



export type Trade = {
  id: string
  user_id: string
  date: string // ISO string
  symbol: string
  side: 'LONG' | 'SHORT'
  entry: number
  exit?: number | null
  stop?: number | null
  take?: number | null
  risk_pct?: number | null
  size?: number | null
  reason?: string | null
  notes?: string | null
  image_url?: string | null
  created_at?: string
}
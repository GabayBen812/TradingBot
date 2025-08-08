import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

if (!url || !anon) {
  // Provide a clear message in the console so the app doesn't fail silently
  // Create tradingTracker/.env.local with:
  // VITE_SUPABASE_URL=your-supabase-url
  // VITE_SUPABASE_ANON_KEY=your-anon-key
  // Then restart: npm run dev
  console.error('[TradingTracker] Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in tradingTracker/.env.local and restart the dev server.')
}

export const supabase = createClient(
  url || 'https://example.supabase.co',
  anon || 'public-anon-key'
)
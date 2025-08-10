## CryptoSage

Client-only React (Vite + TS) crypto day-trading assistant using Gemini and Supabase.

### Setup

1) Install deps

```
npm i
```

2) Env vars: create `.env` in project root

```
VITE_GEMINI_API_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

3) Supabase SQL (SQL Editor)

```
-- Analyses table
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  symbol text not null,
  interval text not null,
  last_price double precision not null,
  ai jsonb not null,
  snapshot_url text
);
alter table public.analyses enable row level security;
create policy "read own" on public.analyses for select using (auth.uid() = user_id);
create policy "insert own" on public.analyses for insert with check (auth.uid() = user_id);
create policy "delete own" on public.analyses for delete using (auth.uid() = user_id);

-- Private bucket for snapshots
insert into storage.buckets (id, name, public) values ('snapshots','snapshots', false) on conflict do nothing;
create policy "read own snaps" on storage.objects for select using (bucket_id='snapshots' and owner=auth.uid());
create policy "write own snaps" on storage.objects for insert with check (bucket_id='snapshots' and owner=auth.uid());
create policy "delete own snaps" on storage.objects for delete using (bucket_id='snapshots' and owner=auth.uid());
```

4) Run

```
npm run dev
```

### Notes

- Auth via Supabase (Google + Magic Link). App is gated until signed-in.
- Market data from Binance REST/WS. TA locally computed.
- Gemini 1.5 Pro via `@google/generative-ai` with strict JSON parsing and auto-repair.
- Ensemble of 3 prompts, majority-vote + confidence gating to prefer No-Trade.
- History saved to Supabase; snapshot PNGs uploaded to a private bucket with 7-day signed URLs.

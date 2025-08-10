# Trading Tracker (Vite + Supabase)

This app is a client-side SPA. Vite prefixes public environment variables with `VITE_`, and they are embedded into the client bundle at build time. For Supabase, the `anon` key is a public client key by design and should live in the browser.

We disable Netlify secrets scanning for this site via `netlify.toml` because the scanner would otherwise flag `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` even though they are expected in the client bundle for a public SPA.

Deploy notes:
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify Environment.
- Build command: `npm run build`; Publish directory: `dist`.
- SPA routing handled via `public/_redirects`.

## Environment variables

Create a `.env.local` file in the repo root for local dev:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon
# CryptoSage (Gemini)
VITE_GEMINI_API_KEY=your-google-gemini-api-key
```

For production (Netlify), add the same variables to the site’s Environment variables.
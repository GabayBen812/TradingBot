# Trading Tracker (Vite + Supabase)

This app is a client-side SPA. Vite prefixes public environment variables with `VITE_`, and they are embedded into the client bundle at build time. For Supabase, the `anon` key is a public client key by design and should live in the browser.

We disable Netlify secrets scanning for this site via `netlify.toml` because the scanner would otherwise flag `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` even though they are expected in the client bundle for a public SPA.

Deploy notes:
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify Environment.
- Build command: `npm run build`; Publish directory: `dist`.
- SPA routing handled via `public/_redirects`.
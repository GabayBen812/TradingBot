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

## 🎯 **Bot Architecture - Simplified Flow**

The trading bot uses a clean, simplified architecture:

### **Signal → Order → Trade Flow:**
1. **Signal Detection**: Bot scans markets for trading setups
2. **Order Creation**: Setup immediately becomes a pending order
3. **Order Execution**: When price hits entry, order becomes active trade
4. **Trade Management**: Track P&L, manage stop/take, close positions

### **Three Execution Modes:**

#### **1. Supervised Mode**
- Bot detects setups and creates pending orders
- User manually reviews and approves/rejects orders
- Orders only execute after manual confirmation
- Perfect for learning and strategy validation

#### **2. Autonomous (Strict) Mode**
- Bot automatically executes only high-quality setups
- High confidence threshold (70%+) and good risk/reward (2:1+)
- Conservative approach for capital preservation
- Minimal trades, maximum quality

#### **3. Autonomous (Explore) Mode**
- Bot executes moderate-quality setups automatically
- Lower confidence threshold (50%+) and decent risk/reward (1.5:1+)
- Designed for data collection and strategy testing
- More trades, learning opportunities

### **Database Tables:**
- **`bot_settings`**: User configuration and strategy parameters
- **`orders`**: Pending and executed orders (also serves as signals)
- **`trades`**: Active and closed trading positions

### **Key Benefits:**
- ✅ **No duplicate data** - Orders serve as signals
- ✅ **Cleaner flow** - Signal → Order → Trade
- ✅ **Simpler state management** - Fewer tables to maintain
- ✅ **Real-time execution** - No intermediate signal storage
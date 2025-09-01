# Database Migrations

## Bot Settings Table

The `create_bot_settings_table.sql` file creates a table to store user bot configuration settings.

### Setup Instructions

1. **Run the migration in Supabase:**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy and paste the contents of `create_bot_settings_table.sql`
   - Execute the SQL

2. **Table Structure:**
   - `id`: Unique identifier for each settings record
   - `user_id`: References the authenticated user
   - `mode`: Bot execution mode (supervised, strict, explore)
   - `strategy`: JSON object containing strategy weights and settings
   - `signal_tf`: Signal scanning timeframe (5m, 15m, 1h)
   - `min_conf`: Minimum confidence threshold (0-100)
   - `tag_filter`: JSON object for filtering signals by tags
   - `initial_capital`: Starting capital amount
   - `risk_per_trade`: Risk percentage per trade
   - `auto_close_hours`: Auto-close trades after X hours
   - `notifications`: Enable/disable notifications

3. **Features:**
   - Row Level Security (RLS) enabled
   - Users can only access their own settings
   - One settings record per user per mode
   - Automatic timestamp updates
   - Data validation constraints

4. **Usage:**
   - The client-side Bot page will automatically save/load settings
   - Settings are synced between client and server
   - Server can read settings to apply bot configuration
   - Fallback to Supabase if server is unavailable

### Example Strategy Object

```json
{
  "enabled": {
    "FIB": true,
    "FVG": true,
    "SR": true,
    "TREND": true,
    "RSI": true
  },
  "weights": {
    "FIB": 0.8,
    "FVG": 0.9,
    "SR": 0.7,
    "TREND": 0.6,
    "RSI": 0.8,
    "RR": 0.5
  },
  "marketBias": "neutral",
  "order": "confidence",
  "maxSignalsPerSymbol": 2
}
```

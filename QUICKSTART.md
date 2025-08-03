# Quick Start Guide

Get your Fibonacci Retracement Detection Bot running in 5 minutes!

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set Up Discord Webhook
1. Go to your Discord server settings
2. Navigate to **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Copy the webhook URL

### 3. Configure Environment
Create a `.env` file in the project directory:
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL_HERE
```

### 4. Run the Bot
```bash
python main.py
```

That's it! The bot will:
- Send a test Discord message
- Start monitoring SOL/USDT every 5 minutes
- Alert you when Fibonacci 0.618 retracements are detected

## ⚙️ Customization

Edit `config.py` to customize:

```python
SYMBOL = "SOLUSDT"                    # Change trading pair
TIMEFRAME = "1h"                      # Change timeframe (1h, 4h, 1d)
MARGIN = 0.002                        # Adjust sensitivity (±0.2%)
CHECK_INTERVAL_MINUTES = 5            # Change check frequency
```

## 🧪 Testing

Run the test suite to verify everything works:
```bash
python test_bot.py
```

## 📊 What You'll Receive

When a Fibonacci 0.618 retracement is detected, you'll get a Discord alert with:

- **Professional chart image** with Fibonacci levels
- **Swing analysis** (high/low prices and move percentage)
- **All Fibonacci levels** (23.6%, 38.2%, 50%, 61.8%, 78.6%)
- **Trading levels** (entry, take profit, stop loss)
- **Risk management** warnings

## ⚠️ Important Notes

- **Not financial advice** - Use at your own risk
- **Always use stop losses** - Never risk more than you can afford to lose
- **Consider market conditions** - Fibonacci levels work best in trending markets
- **Test first** - Run the test script before using with real money

## 🆘 Need Help?

- Check the full `README.md` for detailed documentation
- Run `python test_bot.py` to diagnose issues
- Ensure your Discord webhook URL is correct
- Verify internet connection for Binance API access

---

**Ready to start? Run `python main.py` and watch for alerts!** 🎯 
# Fibonacci Retracement Detection Bot

A Python script that monitors Solana (SOL) price charts from Binance and sends Discord alerts when a Fibonacci 0.618 retracement setup is detected.

## 🎯 Features

- **Real-time Monitoring**: Continuously monitors SOL/USDT price on configurable timeframes
- **Automatic Detection**: Detects swing highs and lows automatically
- **Fibonacci Calculations**: Calculates all major Fibonacci retracement levels
- **Chart Generation**: Creates professional charts with Fibonacci levels drawn
- **Discord Alerts**: Sends detailed alerts with charts and trading levels
- **Risk Management**: Provides suggested entry, take profit, and stop loss levels
- **Configurable Parameters**: Easy to customize timeframe, margins, and detection criteria

## 📋 Requirements

- Python 3.7+
- Internet connection for Binance API and Discord webhook
- Discord server with webhook permissions

## 🚀 Installation

1. **Clone or download the project files**

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**:
   - Copy `env_example.txt` to `.env`
   - Add your Discord webhook URL
   - Optionally add Binance API credentials for higher rate limits

4. **Create Discord Webhook**:
   - Go to your Discord server settings
   - Navigate to Integrations → Webhooks
   - Create a new webhook
   - Copy the webhook URL to your `.env` file

## ⚙️ Configuration

Edit `config.py` to customize the bot behavior:

```python
# Trading Configuration
SYMBOL = "SOLUSDT"                    # Trading pair to monitor
TIMEFRAME = "1h"                      # Chart timeframe (1m, 5m, 15m, 1h, 4h, etc.)
MARGIN = 0.002                        # ±0.2% tolerance for 0.618 level
MIN_MOVE_PERCENT = 0.03              # 3% minimum move from swing low to high
SWING_LOOKBACK = 50                   # Candles to look back for swing detection
CHECK_INTERVAL_MINUTES = 5            # How often to check for setups
```

## 🎮 Usage

### Basic Usage

Run the bot:
```bash
python main.py
```

The bot will:
1. Send a test Discord message to verify webhook is working
2. Start monitoring SOL/USDT every 5 minutes
3. Send alerts when Fibonacci 0.618 retracements are detected

### Advanced Usage

You can modify the detection parameters in `config.py`:

- **Change timeframe**: Set `TIMEFRAME` to "4h", "1d", etc.
- **Adjust sensitivity**: Modify `MARGIN` for tighter/looser detection
- **Change symbol**: Monitor other pairs by changing `SYMBOL`
- **Customize intervals**: Adjust `CHECK_INTERVAL_MINUTES`

## 📊 Alert Information

When a Fibonacci 0.618 retracement is detected, you'll receive a Discord alert with:

- **Chart Image**: Professional candlestick chart with Fibonacci levels
- **Setup Analysis**: Swing high/low prices and move percentage
- **Fibonacci Levels**: All major retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%)
- **Trading Levels**: Suggested entry, take profit, and stop loss levels
- **Risk Management**: Important disclaimers and risk warnings

## 🔧 Technical Details

### Detection Logic

1. **Data Fetching**: Retrieves candlestick data from Binance API
2. **Swing Detection**: Identifies swing high and swing low points
3. **Move Validation**: Ensures minimum move percentage is met
4. **Fibonacci Calculation**: Computes retracement levels
5. **Price Check**: Verifies if current price is at 0.618 level ± margin
6. **Chart Generation**: Creates visual chart with all levels
7. **Alert Sending**: Sends Discord notification with details

### Chart Features

- **Dark Theme**: Professional dark background
- **Candlestick Chart**: Standard OHLC representation
- **Fibonacci Levels**: Horizontal lines with color coding
- **Diagonal Line**: Connects swing high to swing low
- **Current Price**: Highlighted with yellow dotted line
- **Legend**: Shows all levels with prices

## ⚠️ Important Notes

- **Not Financial Advice**: This bot is for educational purposes only
- **Risk Management**: Always use proper position sizing and stop losses
- **Market Conditions**: Consider overall market trend and conditions
- **API Limits**: Binance has rate limits; consider API keys for higher limits
- **Webhook Security**: Keep your Discord webhook URL private

## 🛠️ Troubleshooting

### Common Issues

1. **Discord webhook not working**:
   - Verify webhook URL is correct
   - Check Discord server permissions
   - Ensure webhook is enabled

2. **No alerts being sent**:
   - Check log files for errors
   - Verify SOL price movements meet criteria
   - Adjust margin or minimum move parameters

3. **Chart generation errors**:
   - Ensure matplotlib is installed correctly
   - Check disk space for chart files
   - Verify internet connection

### Log Files

The bot creates `fibonacci_bot.log` with detailed information about:
- Detection attempts
- Alert sending status
- Error messages
- Configuration details

## 📈 Example Alert

```
🚨 FIBONACCI 0.618 RETRACEMENT DETECTED 🚨

Symbol: SOLUSDT
Timeframe: 1h
Setup Type: LONG
Current Price: $85.23

📊 Swing Analysis:
• Swing High: $92.45
• Swing Low: $78.12
• Total Move: 18.35%

📈 Fibonacci Levels:
• 0% (Swing Low): $78.12
• 23.6%: $81.45
• 38.2%: $83.67
• 50%: $85.28
• 61.8%: $87.12 ⭐
• 78.6%: $89.34
• 100% (Swing High): $92.45

💰 Trading Levels:
• Entry: $85.23
• Take Profit 1: $85.28
• Take Profit 2: $83.67
• Take Profit 3: $81.45
• Stop Loss: $89.34
```

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests to improve the bot.

## 📄 License

This project is for educational purposes. Use at your own risk.

---

**Disclaimer**: This bot is for educational purposes only. Trading cryptocurrencies involves substantial risk. Always do your own research and never invest more than you can afford to lose. 
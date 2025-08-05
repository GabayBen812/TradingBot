import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Trading Configuration
SYMBOL = "SOLUSDT"
TIMEFRAME = "1h"  # Options: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
MARGIN = 0.002  # ±0.2% tolerance for 0.618 level
MIN_MOVE_PERCENT = 0.03  # 3% minimum move from swing low to high
SWING_LOOKBACK = 50  # Number of candles to look back for swing detection
CHECK_INTERVAL_MINUTES = 5  # How often to check for setups

# Fibonacci Levels
FIBONACCI_LEVELS = {
    0.0: "0%",
    0.236: "23.6%",
    0.382: "38.2%",
    0.5: "50%",
    0.618: "61.8%",
    0.786: "78.6%",
    1.0: "100%"
}

# Chart Configuration
CHART_COLORS = {
    'background': '#1a1a1a',
    'grid': '#2a2a2a',
    'text': '#ffffff',
    'candle_up': '#00ff88',
    'candle_down': '#ff4444',
    'fibonacci_line': '#888888',
    'fibonacci_levels': {
        0.0: '#ffffff',
        0.236: '#ff6b6b',
        0.382: '#ffa726',
        0.5: '#66bb6a',
        0.618: '#42a5f5',
        0.786: '#ab47bc',
        1.0: '#ffffff'
    }
}

# Discord Configuration
DISCORD_WEBHOOK_URL = os.getenv('DISCORD_WEBHOOK_URL', '')
DISCORD_USERNAME = "Fibonacci Bot"
DISCORD_AVATAR_URL = "https://cdn.discordapp.com/attachments/123456789/123456789/fibonacci.png"

# Binance API Configuration
BINANCE_API_KEY = os.getenv('BINANCE_API_KEY', '')
BINANCE_SECRET_KEY = os.getenv('BINANCE_SECRET_KEY', '')

# Chart Dimensions
CHART_WIDTH = 12
CHART_HEIGHT = 8
DPI = 100 
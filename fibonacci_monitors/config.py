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

# Detection Strictness/Profile
# Profiles: STRICT, BALANCED, LENIENT
DETECTION_PROFILE = os.getenv('DETECTION_PROFILE', 'BALANCED').upper()
if DETECTION_PROFILE not in ('STRICT', 'BALANCED', 'LENIENT'):
    DETECTION_PROFILE = 'BALANCED'

# Backward-compatibility flag; treat non-STRICT profiles as lenient for legacy checks
LENIENT_MODE = DETECTION_PROFILE != 'STRICT'

# Profile-tuned thresholds
if DETECTION_PROFILE == 'STRICT':
    ALLOWED_FIB_LEVELS = [0.618]
    PROFILE_REQUIRED_CONFLUENCES = 2
    PROFILE_MIN_RR = 1.5
    ATR_MARGIN_MAX = 0.002   # cap for ATR/current_price
    FALLBACK_MARGIN = 0.001  # used if no ATR
    WICK_MIN_RATIO_STD = 1.2
    WICK_MIN_RATIO_SLOW = 1.0
    VOLUME_MIN_MULTIPLIER = 0.8
elif DETECTION_PROFILE == 'LENIENT':
    ALLOWED_FIB_LEVELS = [0.618, 0.5, 0.382, 0.786]
    PROFILE_REQUIRED_CONFLUENCES = 0
    PROFILE_MIN_RR = 0.6
    ATR_MARGIN_MAX = 0.006
    FALLBACK_MARGIN = 0.004
    WICK_MIN_RATIO_STD = 0.8
    WICK_MIN_RATIO_SLOW = 0.6
    VOLUME_MIN_MULTIPLIER = 0.6
else:  # BALANCED
    ALLOWED_FIB_LEVELS = [0.618, 0.5, 0.786]
    PROFILE_REQUIRED_CONFLUENCES = 1
    PROFILE_MIN_RR = 0.9
    ATR_MARGIN_MAX = 0.004
    FALLBACK_MARGIN = 0.003
    WICK_MIN_RATIO_STD = 0.9
    WICK_MIN_RATIO_SLOW = 0.7
    VOLUME_MIN_MULTIPLIER = 0.7

# Advanced detection options (inspired by TradingView scripts)
# ZigZag pivots with ATR-based deviation
USE_ZIGZAG_PIVOTS = os.getenv('USE_ZIGZAG_PIVOTS', 'true' if LENIENT_MODE else 'false').lower() == 'true'
ZIGZAG_DEPTH = int(os.getenv('ZIGZAG_DEPTH', '11'))
ZIGZAG_ATR_LEN = int(os.getenv('ZIGZAG_ATR_LEN', '10'))
ZIGZAG_DEV_MULT = float(os.getenv('ZIGZAG_DEV_MULT', '3.0'))

# EMA + stdev Fibonacci band confluence
USE_FIB_BANDS_CONFLUENCE = os.getenv('USE_FIB_BANDS_CONFLUENCE', 'true').lower() == 'true'
FIB_BANDS_EMA_LEN = int(os.getenv('FIB_BANDS_EMA_LEN', '100'))
FIB_BANDS_STD_LEN = int(os.getenv('FIB_BANDS_STD_LEN', '100'))

# Fibonacci time confluence (trend-based time projections)
USE_FIB_TIME_CONFLUENCE = os.getenv('USE_FIB_TIME_CONFLUENCE', 'false').lower() == 'true'
FIB_TIME_TOL_BARS = int(os.getenv('FIB_TIME_TOL_BARS', '1'))

# AI/Notification Filtering
USE_AI_FILTER = os.getenv('USE_AI_FILTER', 'true').lower() == 'true'
AI_MIN_CONFIDENCE = float(os.getenv('AI_MIN_CONFIDENCE', '0.4'))

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
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import requests
import json
from typing import Tuple, Optional, Dict, List
import logging
from dataclasses import dataclass

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration constants
CHART_COLORS = {
    'background': '#1a1a1a',
    'text': '#ffffff',
    'grid': '#333333',
    'candle_up': '#00ff88',
    'candle_down': '#ff4444',
    'fibonacci_line': '#ffaa00',
    'fibonacci_levels': {
        0.0: '#ff0000',      # Red for 0%
        0.236: '#ff6600',    # Orange for 23.6%
        0.382: '#ffaa00',    # Yellow for 38.2%
        0.5: '#00aaff',      # Blue for 50%
        0.618: '#0066ff',    # Strong Blue for 61.8% (Golden Ratio)
        0.786: '#6600ff',    # Purple for 78.6%
        1.0: '#00ff00'       # Green for 100%
    }
}

FIBONACCI_LEVELS = {
    0.0: "0.0%",
    0.236: "23.6%", 
    0.382: "38.2%",
    0.5: "50.0%",
    0.618: "61.8%",
    0.786: "78.6%",
    1.0: "100.0%"
}

CHART_WIDTH = 16
CHART_HEIGHT = 10
DPI = 100

@dataclass
class PivotPoint:
    """Data class for pivot points"""
    index: int
    timestamp: pd.Timestamp
    price: float
    pivot_type: str  # 'high' or 'low'

@dataclass
class FibonacciSetup:
    """Data class for Fibonacci trading setup"""
    symbol: str
    timeframe: str
    current_price: float
    swing_high: PivotPoint
    swing_low: PivotPoint
    trend: str
    setup_type: str
    fibonacci_levels: Dict[float, float]
    trading_levels: Dict[str, float]
    confluences: int
    confidence: str
    risk_reward_ratio: float

class FibonacciDetector:
    def __init__(self, position_manager=None):
        self.last_alert_time = None
        self.position_manager = position_manager
        self.setup_matplotlib()
    
    def setup_matplotlib(self):
        """Configure matplotlib for dark theme and better styling"""
        plt.style.use('dark_background')
        plt.rcParams['figure.facecolor'] = CHART_COLORS['background']
        plt.rcParams['axes.facecolor'] = CHART_COLORS['background']
        plt.rcParams['text.color'] = CHART_COLORS['text']
        plt.rcParams['axes.labelcolor'] = CHART_COLORS['text']
        plt.rcParams['xtick.color'] = CHART_COLORS['text']
        plt.rcParams['ytick.color'] = CHART_COLORS['text']
    
    def get_binance_data(self, symbol: str, interval: str, limit: int = 500) -> pd.DataFrame:
        """Fetch candlestick data from Binance API with fallback"""
        data_sources = [
            self._fetch_binance_data,
            self._fetch_alternative_data
        ]
        
        for fetch_func in data_sources:
            try:
                df = fetch_func(symbol, interval, limit)
                if not df.empty and not df['close'].isna().all():
                    logger.info(f"Successfully fetched data using {fetch_func.__name__}")
                    return df
            except Exception as e:
                logger.warning(f"Failed to fetch data using {fetch_func.__name__}: {e}")
                continue
        
        logger.error(f"All data sources failed for {symbol}")
        return pd.DataFrame()
    
    def _fetch_binance_data(self, symbol: str, interval: str, limit: int = 500) -> pd.DataFrame:
        """Fetch candlestick data from Binance API"""
        try:
            url = "https://api.binance.com/api/v3/klines"
            params = {
                'symbol': symbol,
                'interval': interval,
                'limit': limit
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Convert to DataFrame
            df = pd.DataFrame(data, columns=[
                'timestamp', 'open', 'high', 'low', 'close', 'volume',
                'close_time', 'quote_volume', 'trades', 'taker_buy_base',
                'taker_buy_quote', 'ignore'
            ])
            
            # Convert types
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            for col in ['open', 'high', 'low', 'close', 'volume']:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            
            df.set_index('timestamp', inplace=True)
            
            # Calculate technical indicators
            df = self._add_technical_indicators(df)
            
            if df.empty or df['close'].isna().all():
                logger.error(f"Invalid data received for {symbol}")
                return pd.DataFrame()
                
            logger.info(f"Fetched {len(df)} candles for {symbol} {interval}")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching data from Binance: {e}")
            return pd.DataFrame()
    
    def _fetch_alternative_data(self, symbol: str, interval: str, limit: int = 500) -> pd.DataFrame:
        """Fetch data from alternative source (CoinGecko API)"""
        try:
            # Get coin ID from symbol
            coin_id = symbol.replace('USDT', '').lower()
            
            url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/ohlc"
            params = {
                'vs_currency': 'usd',
                'days': '30'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Convert to DataFrame
            df = pd.DataFrame(data, columns=['timestamp', 'open', 'high', 'low', 'close'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df['volume'] = 0
            
            for col in ['open', 'high', 'low', 'close']:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            
            df.set_index('timestamp', inplace=True)
            
            # Resample to match requested interval
            resample_rules = {
                '1h': '1H', '4h': '4H', '1d': 'D'
            }
            
            if interval in resample_rules:
                df = df.resample(resample_rules[interval]).agg({
                    'open': 'first', 'high': 'max', 'low': 'min', 
                    'close': 'last', 'volume': 'sum'
                }).dropna()
            
            df = df.tail(limit)
            df = self._add_technical_indicators(df)
            
            logger.info(f"Fetched {len(df)} candles from CoinGecko for {symbol} {interval}")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching data from CoinGecko: {e}")
            return pd.DataFrame()
    
    def _add_technical_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add technical indicators for confluence analysis"""
        try:
            # Simple Moving Averages
            df['sma_20'] = df['close'].rolling(window=20).mean()
            df['sma_50'] = df['close'].rolling(window=50).mean()
            df['sma_200'] = df['close'].rolling(window=200).mean()
            
            # Exponential Moving Averages
            df['ema_20'] = df['close'].ewm(span=20).mean()
            df['ema_50'] = df['close'].ewm(span=50).mean()
            
            # Volume Moving Average
            df['volume_ma'] = df['volume'].rolling(window=20).mean()
            
            # Average True Range for volatility
            df['high_low'] = df['high'] - df['low']
            df['high_close'] = np.abs(df['high'] - df['close'].shift())
            df['low_close'] = np.abs(df['low'] - df['close'].shift())
            df['true_range'] = df[['high_low', 'high_close', 'low_close']].max(axis=1)
            df['atr'] = df['true_range'].rolling(window=14).mean()
            
            # Clean up temporary columns
            df.drop(['high_low', 'high_close', 'low_close', 'true_range'], axis=1, inplace=True)
            
            return df
        except Exception as e:
            logger.error(f"Error adding technical indicators: {e}")
            return df
    
    def find_pivot_points(self, data: pd.DataFrame, left_bars: int = 5, right_bars: int = 5, 
                         lookback_period: int = 100) -> Tuple[List[PivotPoint], List[PivotPoint]]:
        """
        Find true pivot highs and lows using professional standards
        A pivot high must have lower highs on both left and right sides
        A pivot low must have higher lows on both left and right sides
        """
        try:
            if len(data) < (left_bars + right_bars + 1):
                return [], []
            
            # Use recent data for pivot detection
            recent_data = data.tail(lookback_period) if len(data) > lookback_period else data
            pivot_highs = []
            pivot_lows = []
            
            # Iterate through the data to find pivot points
            for i in range(left_bars, len(recent_data) - right_bars):
                current_idx = recent_data.index[i]
                current_high = recent_data.iloc[i]['high']
                current_low = recent_data.iloc[i]['low']
                
                # Check for pivot high
                is_pivot_high = True
                for j in range(i - left_bars, i + right_bars + 1):
                    if j != i and recent_data.iloc[j]['high'] >= current_high:
                        is_pivot_high = False
                        break
                
                # Check for pivot low
                is_pivot_low = True
                for j in range(i - left_bars, i + right_bars + 1):
                    if j != i and recent_data.iloc[j]['low'] <= current_low:
                        is_pivot_low = False
                        break
                
                if is_pivot_high:
                    pivot_highs.append(PivotPoint(
                        index=i, 
                        timestamp=current_idx, 
                        price=current_high, 
                        pivot_type='high'
                    ))
                
                if is_pivot_low:
                    pivot_lows.append(PivotPoint(
                        index=i, 
                        timestamp=current_idx, 
                        price=current_low, 
                        pivot_type='low'
                    ))
            
            # Sort by price to get the most significant pivots
            pivot_highs.sort(key=lambda x: x.price, reverse=True)
            pivot_lows.sort(key=lambda x: x.price)
            
            logger.info(f"Found {len(pivot_highs)} pivot highs and {len(pivot_lows)} pivot lows")
            return pivot_highs, pivot_lows
            
        except Exception as e:
            logger.error(f"Error finding pivot points: {e}")
            return [], []
    
    def identify_trend_structure(self, data: pd.DataFrame, pivot_highs: List[PivotPoint], 
                               pivot_lows: List[PivotPoint]) -> str:
        """
        Identify market trend using proper market structure analysis
        """
        try:
            if len(pivot_highs) < 2 or len(pivot_lows) < 2:
                return 'SIDEWAYS'
            
            # Get the last few pivot points for trend analysis
            recent_highs = sorted(pivot_highs[-3:], key=lambda x: x.timestamp)
            recent_lows = sorted(pivot_lows[-3:], key=lambda x: x.timestamp)
            
            # Check for higher highs and higher lows (uptrend)
            higher_highs = 0
            higher_lows = 0
            
            if len(recent_highs) >= 2:
                for i in range(1, len(recent_highs)):
                    if recent_highs[i].price > recent_highs[i-1].price:
                        higher_highs += 1
            
            if len(recent_lows) >= 2:
                for i in range(1, len(recent_lows)):
                    if recent_lows[i].price > recent_lows[i-1].price:
                        higher_lows += 1
            
            # Check for lower highs and lower lows (downtrend)  
            lower_highs = 0
            lower_lows = 0
            
            if len(recent_highs) >= 2:
                for i in range(1, len(recent_highs)):
                    if recent_highs[i].price < recent_highs[i-1].price:
                        lower_highs += 1
            
            if len(recent_lows) >= 2:
                for i in range(1, len(recent_lows)):
                    if recent_lows[i].price < recent_lows[i-1].price:
                        lower_lows += 1
            
            # Also check moving average alignment
            current_price = data['close'].iloc[-1]
            sma_20 = data['sma_20'].iloc[-1] if not pd.isna(data['sma_20'].iloc[-1]) else current_price
            sma_50 = data['sma_50'].iloc[-1] if not pd.isna(data['sma_50'].iloc[-1]) else current_price
            
            ma_uptrend = current_price > sma_20 > sma_50
            ma_downtrend = current_price < sma_20 < sma_50
            
            # Determine trend
            if (higher_highs > 0 and higher_lows > 0) or ma_uptrend:
                return 'UPTREND'
            elif (lower_highs > 0 and lower_lows > 0) or ma_downtrend:
                return 'DOWNTREND'
            else:
                return 'SIDEWAYS'
                
        except Exception as e:
            logger.error(f"Error identifying trend structure: {e}")
            return 'SIDEWAYS'
    
    def calculate_fibonacci_levels(self, swing_high: float, swing_low: float, trend: str) -> Dict[float, float]:
        """
        Calculate Fibonacci retracement levels using CORRECT professional formula
        
        CRITICAL FIX: Proper Fibonacci calculation for both trends
        - For UPTREND: 0% = Swing Low (start), 100% = Swing High (end), retracement DOWN from high
        - For DOWNTREND: 0% = Swing High (start), 100% = Swing Low (end), retracement UP from low
        """
        price_range = abs(swing_high - swing_low)
        
        if trend == "DOWNTREND":
            # Main move: High -> Low (down move)
            # Retracement: UP from the swing low
            # 0% = Swing High (start of down move)
            # 100% = Swing Low (end of down move)
            # 61.8% retracement = Swing Low + 0.618 × (Swing High - Swing Low)
            fib_levels = {
                0.0: swing_high,    # 0% - Start of down move
                0.236: swing_low + (0.236 * price_range),  # 23.6% retracement up
                0.382: swing_low + (0.382 * price_range),  # 38.2% retracement up
                0.5: swing_low + (0.5 * price_range),      # 50% retracement up
                0.618: swing_low + (0.618 * price_range),  # 61.8% retracement up (KEY LEVEL)
                0.786: swing_low + (0.786 * price_range),  # 78.6% retracement up
                1.0: swing_low      # 100% - End of down move
            }
        else:
            # Main move: Low -> High (up move)  
            # Retracement: DOWN from the swing high
            # 0% = Swing Low (start of up move)
            # 100% = Swing High (end of up move)
            # 61.8% retracement = Swing High - 0.618 × (Swing High - Swing Low)
            fib_levels = {
                0.0: swing_low,     # 0% - Start of up move
                0.236: swing_high - (0.236 * price_range),  # 23.6% retracement down
                0.382: swing_high - (0.382 * price_range),  # 38.2% retracement down
                0.5: swing_high - (0.5 * price_range),      # 50% retracement down
                0.618: swing_high - (0.618 * price_range),  # 61.8% retracement down (KEY LEVEL)
                0.786: swing_high - (0.786 * price_range),  # 78.6% retracement down
                1.0: swing_high     # 100% - End of up move
            }
        
        return fib_levels
    
    def check_confluence_factors(self, data: pd.DataFrame, fib_level: float, 
                               setup_type: str) -> Tuple[int, List[str]]:
        """
        Check for confluence factors that strengthen the Fibonacci setup
        Returns: (confluence_count, list_of_confluences)
        """
        confluences = []
        current_price = data['close'].iloc[-1]
        tolerance = fib_level * 0.002  # 0.2% tolerance
        
        try:
            # 1. Volume Confirmation
            if self._check_volume_confluence(data, fib_level, tolerance):
                confluences.append("Volume Expansion")
            
            # 2. Moving Average Confluence
            if self._check_ma_confluence(data, fib_level, tolerance):
                confluences.append("Moving Average Support/Resistance")
            
            # 3. Previous Support/Resistance
            if self._check_historical_sr(data, fib_level, tolerance):
                confluences.append("Historical Support/Resistance")
            
            # 4. Round Number Confluence
            if self._check_round_number(fib_level):
                confluences.append("Round Number Level")
            
            # 5. Multiple Timeframe Confluence (simplified)
            if self._check_price_action_confluence(data, setup_type):
                confluences.append("Price Action Pattern")
            
            return len(confluences), confluences
            
        except Exception as e:
            logger.error(f"Error checking confluence factors: {e}")
            return 0, []
    
    def _check_volume_confluence(self, data: pd.DataFrame, fib_level: float, tolerance: float) -> bool:
        """Check if volume is expanding as price approaches the Fibonacci level"""
        try:
            recent_volume = data['volume'].tail(10)
            volume_ma = data['volume_ma'].iloc[-1]
            
            # Check if recent volume is above average
            if pd.isna(volume_ma):
                return False
                
            current_volume = recent_volume.iloc[-1]
            return current_volume > volume_ma * 1.2  # 20% above average
            
        except Exception as e:
            return False
    
    def _check_ma_confluence(self, data: pd.DataFrame, fib_level: float, tolerance: float) -> bool:
        """Check if Fibonacci level aligns with moving averages"""
        try:
            mas = ['sma_20', 'sma_50', 'ema_20', 'ema_50']
            
            for ma in mas:
                if ma in data.columns and not pd.isna(data[ma].iloc[-1]):
                    ma_value = data[ma].iloc[-1]
                    if abs(ma_value - fib_level) <= tolerance:
                        return True
            
            return False
            
        except Exception as e:
            return False
    
    def _check_historical_sr(self, data: pd.DataFrame, fib_level: float, tolerance: float) -> bool:
        """Check if Fibonacci level aligns with historical support/resistance"""
        try:
            # Look at historical highs and lows
            lookback_data = data.tail(200)
            historical_levels = []
            
            # Get significant highs and lows
            for i in range(10, len(lookback_data) - 10):
                high = lookback_data.iloc[i]['high']
                low = lookback_data.iloc[i]['low']
                
                # Check if it's a local high/low
                if high == lookback_data.iloc[i-5:i+5]['high'].max():
                    historical_levels.append(high)
                if low == lookback_data.iloc[i-5:i+5]['low'].min():
                    historical_levels.append(low)
            
            # Check if fib level aligns with any historical level
            for level in historical_levels:
                if abs(level - fib_level) <= tolerance:
                    return True
            
            return False
            
        except Exception as e:
            return False
    
    def _check_round_number(self, fib_level: float) -> bool:
        """Check if Fibonacci level is near a round number (psychological level)"""
        try:
            # Check for round numbers (multiples of 10, 50, 100, etc.)
            round_numbers = []
            
            # Generate round numbers around the fib level
            base = int(fib_level)
            for multiplier in [0.01, 0.1, 1, 10, 50, 100]:
                for offset in range(-5, 6):
                    round_num = round((base + offset) / multiplier) * multiplier
                    round_numbers.append(round_num)
            
            # Check if fib level is close to any round number
            tolerance = fib_level * 0.005  # 0.5% tolerance
            
            for round_num in round_numbers:
                if abs(fib_level - round_num) <= tolerance:
                    return True
            
            return False
            
        except Exception as e:
            return False
    
    def _check_price_action_confluence(self, data: pd.DataFrame, setup_type: str) -> bool:
        """Check for price action patterns that support the setup"""
        try:
            recent_candles = data.tail(5)
            
            if setup_type == "LONG":
                # Look for bullish patterns: hammer, doji, bullish engulfing
                for _, candle in recent_candles.iterrows():
                    body_size = abs(candle['close'] - candle['open'])
                    total_size = candle['high'] - candle['low']
                    
                    # Hammer pattern
                    if (candle['close'] > candle['open'] and 
                        (candle['open'] - candle['low']) > 2 * body_size and
                        body_size > 0):
                        return True
                        
            else:  # SHORT setup
                # Look for bearish patterns: shooting star, bearish engulfing
                for _, candle in recent_candles.iterrows():
                    body_size = abs(candle['close'] - candle['open'])
                    
                    # Shooting star pattern
                    if (candle['close'] < candle['open'] and
                        (candle['high'] - candle['open']) > 2 * body_size and
                        body_size > 0):
                        return True
            
            return False
            
        except Exception as e:
            return False
    
    def validate_entry_signal(self, data: pd.DataFrame, fib_level: float, 
                            setup_type: str, margin: float = 0.001) -> bool:
        """
        Comprehensive entry validation with multiple confirmation criteria
        """
        try:
            current_price = data['close'].iloc[-1]
            tolerance = fib_level * margin
            
            # 1. Price must be within tolerance of Fibonacci level
            if abs(current_price - fib_level) > tolerance:
                return False
            
            # 2. Multi-candle confirmation (last 3 candles, looser)
            last_3_candles = data.tail(3)
            
            if setup_type == "LONG":
                # For LONG: Need bullish momentum and rejection of lower levels
                bullish_candles = 0
                for _, candle in last_3_candles.iterrows():
                    if candle['close'] > candle['open']:
                        bullish_candles += 1
                
                if bullish_candles < 1:  # At least 1 of last 3 bullish
                    return False
                    
            else:  # SHORT setup
                # For SHORT: Need bearish momentum and rejection of higher levels
                bearish_candles = 0
                for _, candle in last_3_candles.iterrows():
                    if candle['close'] < candle['open']:
                        bearish_candles += 1
                
                if bearish_candles < 1:  # At least 1 of last 3 bearish
                    return False
            
            # 3. No immediate strong resistance/support that could block the move
            if self._check_immediate_obstacles(data, current_price, setup_type):
                return False
            
            # 4. Volume confirmation
            recent_volume = data['volume'].iloc[-1]
            avg_volume = data['volume'].tail(20).mean()
            
            if recent_volume < avg_volume * 0.8:  # Volume should be reasonable
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating entry signal: {e}")
            return False
    
    def _check_immediate_obstacles(self, data: pd.DataFrame, current_price: float, setup_type: str) -> bool:
        """Check for immediate obstacles that could prevent the trade from working"""
        try:
            # Look for recent significant levels that could act as resistance/support
            recent_data = data.tail(50)
            
            if setup_type == "LONG":
                # Check for resistance above current price
                resistance_levels = []
                for i in range(len(recent_data)):
                    high = recent_data.iloc[i]['high']
                    if high > current_price * 1.001:  # Above current price
                        resistance_levels.append(high)
                
                # Check if there's strong resistance within 1% above
                nearby_resistance = [r for r in resistance_levels if r < current_price * 1.01]
                if len(nearby_resistance) > 3:  # Too many resistance levels
                    return True
                    
            else:  # SHORT setup
                # Check for support below current price
                support_levels = []
                for i in range(len(recent_data)):
                    low = recent_data.iloc[i]['low']
                    if low < current_price * 0.999:  # Below current price
                        support_levels.append(low)
                
                # Check if there's strong support within 1% below
                nearby_support = [s for s in support_levels if s > current_price * 0.99]
                if len(nearby_support) > 3:  # Too many support levels
                    return True
            
            return False
            
        except Exception as e:
            return False
    
    def calculate_trading_levels(self, fib_levels: Dict[float, float], current_price: float, 
                               setup_type: str, atr: float = None) -> Dict[str, float]:
        """
        Calculate professional trading levels with proper risk management
        """
        try:
            if setup_type == "LONG":
                # LONG setup: Buy near 61.8% support, target higher levels
                entry = current_price
                tp1 = fib_levels[0.5]      # First target: 50% level
                tp2 = fib_levels[0.382]    # Second target: 38.2% level
                tp3 = fib_levels[0.236]    # Third target: 23.6% level
                
                # Stop loss below 78.6% level with buffer
                sl_base = fib_levels[0.786]
                if atr:
                    sl = sl_base - (atr * 0.5)  # Use ATR for dynamic stop
                else:
                    sl = sl_base * 0.995  # 0.5% buffer below 78.6%
                
            else:  # SHORT setup
                # SHORT setup: Sell near 61.8% resistance, target lower levels (toward swing low)
                entry = current_price
                tp1 = fib_levels[0.5]      # 50% level (below entry)
                tp2 = fib_levels[0.382]    # 38.2% level
                tp3 = fib_levels[0.236]    # 23.6% level
                
                # Stop loss above 78.6% level with buffer
                sl_base = fib_levels[0.786]
                if atr:
                    sl = sl_base + (atr * 0.5)
                else:
                    sl = sl_base * 1.005  # 0.5% buffer above 78.6%
            
            # Calculate risk/reward ratios
            risk = abs(entry - sl)
            reward1 = abs(tp1 - entry)
            reward2 = abs(tp2 - entry) 
            reward3 = abs(tp3 - entry)
            
            rr1 = reward1 / risk if risk > 0 else 0
            rr2 = reward2 / risk if risk > 0 else 0
            rr3 = reward3 / risk if risk > 0 else 0
            
            return {
                'entry': round(entry, 4),
                'tp1': round(tp1, 4),
                'tp2': round(tp2, 4),
                'tp3': round(tp3, 4),
                'sl': round(sl, 4),
                'setup_type': setup_type,
                'risk_amount': round(risk, 4),
                'reward1': round(reward1, 4),
                'reward2': round(reward2, 4),
                'reward3': round(reward3, 4),
                'risk_reward_1': round(rr1, 2),
                'risk_reward_2': round(rr2, 2),
                'risk_reward_3': round(rr3, 2)
            }
            
        except Exception as e:
            logger.error(f"Error calculating trading levels: {e}")
            return {}
    
    def detect_618_retracement(self, symbol: str, timeframe: str, 
                             min_confluence: int = 2, min_move_percent: float = 1.0) -> Optional[FibonacciSetup]:
        """
        Professional 61.8% Fibonacci retracement detection with strict validation
        """
        try:
            # 1. Fetch market data
            data = self.get_binance_data(symbol, timeframe, 500)
            if data.empty or len(data) < 100:
                logger.warning(f"Insufficient data for {symbol}")
                return None
            
            # 2. Find proper pivot points
            pivot_highs, pivot_lows = self.find_pivot_points(data)
            if not pivot_highs or not pivot_lows:
                logger.info(f"No valid pivot points found for {symbol}")
                return None
            
            # 3. Identify the most significant swing points
            swing_high = pivot_highs[0]  # Highest high
            swing_low = pivot_lows[0]    # Lowest low
            
            # 4. Validate minimum move size
            move_percent = abs(swing_high.price - swing_low.price) / swing_low.price * 100
            if move_percent < min_move_percent:
                logger.info(f"Move size {move_percent:.2f}% below minimum {min_move_percent}%")
                return None
            
            # 5. Determine trend structure
            trend = self.identify_trend_structure(data, pivot_highs, pivot_lows)
            
            # 6. Calculate Fibonacci levels (CORRECTED LOGIC)
            fib_levels = self.calculate_fibonacci_levels(swing_high.price, swing_low.price, trend)
            
            # 7. Check if current price is near 61.8% level
            current_price = data['close'].iloc[-1]
            fib_618 = fib_levels[0.618]
            
            # Dynamic margin based on volatility
            atr = data['atr'].iloc[-1] if 'atr' in data.columns and not pd.isna(data['atr'].iloc[-1]) else None
            if atr and atr > 0:
                margin = min(0.002, atr / current_price)  # Use ATR or max 0.2%
            else:
                margin = 0.001  # Default 0.1%
            
            # Slightly wider tolerance on fast timeframes
            base_margin = margin
            if timeframe in ('1m', '5m', '15m'):
                base_margin = max(margin, 0.0015)  # at least 0.15%
            tolerance = fib_618 * base_margin
            if abs(current_price - fib_618) > tolerance:
                logger.info(f"Price {current_price:.4f} not at 61.8% level {fib_618:.4f} (±{tolerance:.4f})")
                return None
            
            # 9. Validate entry signal (looser)
            if not self.validate_entry_signal(data, fib_618, setup_type, base_margin):
                logger.info(f"Entry validation failed for {symbol}")
                return None
            
            # 10. Check confluence factors (require at least 1)
            confluence_count, confluence_list = self.check_confluence_factors(data, fib_618, setup_type)
            if confluence_count < max(1, min_confluence - 1):
                logger.info(f"Insufficient confluences ({confluence_count}/{min_confluence}) for {symbol}")
                return None
            
            # 11. Calculate trading levels
            trading_levels = self.calculate_trading_levels(fib_levels, current_price, setup_type, atr)
            
            # 12. Validate risk/reward ratio
            min_rr = 1.5  # keep reasonable but not too strict
            if trading_levels.get('risk_reward_1', 0) < min_rr:
                logger.info(f"Risk/reward ratio {trading_levels.get('risk_reward_1', 0):.2f} below minimum {min_rr}")
                return None
            
            # 13. Final pattern validation
            if not self._validate_fibonacci_pattern(data, swing_high, swing_low, current_price, setup_type):
                logger.info(f"Fibonacci pattern validation failed for {symbol}")
                return None
            
            # 14. Determine confidence level
            if confluence_count >= 4 and trading_levels.get('risk_reward_1', 0) >= 2.0:
                confidence = "HIGH"
            elif confluence_count >= 3 and trading_levels.get('risk_reward_1', 0) >= 1.8:
                confidence = "MEDIUM"
            else:
                confidence = "LOW"
            
            # Create the setup object
            fibonacci_setup = FibonacciSetup(
                symbol=symbol,
                timeframe=timeframe,
                current_price=current_price,
                swing_high=swing_high,
                swing_low=swing_low,
                trend=trend,
                setup_type=setup_type,
                fibonacci_levels=fib_levels,
                trading_levels=trading_levels,
                confluences=confluence_count,
                confidence=confidence,
                risk_reward_ratio=trading_levels.get('risk_reward_1', 0)
            )
            
            logger.info(f"✅ VALID 61.8% Fibonacci setup detected for {symbol}")
            logger.info(f"   Setup: {setup_type} | Confidence: {confidence}")
            logger.info(f"   Price: {current_price:.4f} | 61.8% Level: {fib_618:.4f}")
            logger.info(f"   Confluences: {confluence_count} ({', '.join(confluence_list)})")
            logger.info(f"   R/R Ratio: {trading_levels.get('risk_reward_1', 0):.2f}")
            
            return fibonacci_setup
            
        except Exception as e:
            logger.error(f"Error detecting 61.8% retracement for {symbol}: {e}")
            return None

    # ----------------------
    # Backward-compatibility
    # ----------------------
    def _setup_to_result(self, setup: FibonacciSetup, chart_filename: Optional[str] = None) -> Dict:
        """Convert FibonacciSetup dataclass to the legacy result dict expected by other modules."""
        trend_map = {"UPTREND": "UP", "DOWNTREND": "DOWN", "SIDEWAYS": "SIDEWAYS"}
        result = {
            'symbol': setup.symbol,
            'timeframe': setup.timeframe,
            'current_price': setup.current_price,
            'swing_high': setup.swing_high.price,
            'swing_low': setup.swing_low.price,
            'trend': trend_map.get(setup.trend, setup.trend),
            'setup_type': setup.setup_type,
            'fibonacci_levels': setup.fibonacci_levels,
            'trading_levels': setup.trading_levels,
            'move_percent': abs(setup.swing_high.price - setup.swing_low.price) / setup.swing_low.price * 100,
            'confidence': setup.confidence,
        }
        if chart_filename:
            result['chart_filename'] = chart_filename
        return result

    def run_detection_with_params(self, symbol: str, timeframe: str, margin: float,
                                  min_move_percent: float, swing_lookback: int) -> Optional[Dict]:
        """Legacy API shim: returns a dict compatible with notifier/monitors."""
        try:
            setup = self.detect_618_retracement(symbol, timeframe, min_confluence=2, min_move_percent=min_move_percent)
            if not setup:
                return None
            # Generate chart using current data
            df = self.get_binance_data(symbol, timeframe, 500)
            if df.empty:
                return self._setup_to_result(setup)
            chart = self.generate_professional_chart(setup, df)
            return self._setup_to_result(setup, chart)
        except Exception as e:
            logger.error(f"Error in run_detection_with_params for {symbol}: {e}")
            return None

    def generate_chart(self, df: pd.DataFrame, swing_high_idx, swing_low_idx, 
                        fib_levels: Dict[float, float], current_price: float, symbol: str, timeframe: str, trend: str) -> Optional[str]:
        """Legacy API shim for chart generation. Builds a minimal setup and delegates to professional chart."""
        try:
            # Build minimal PivotPoints using provided indices/prices
            if isinstance(swing_high_idx, (int, np.integer)):
                ts_high = df.index[swing_high_idx]
            else:
                ts_high = swing_high_idx
            if isinstance(swing_low_idx, (int, np.integer)):
                ts_low = df.index[swing_low_idx]
            else:
                ts_low = swing_low_idx
            setup = FibonacciSetup(
                symbol=symbol,
                timeframe=timeframe,
                current_price=current_price,
                swing_high=PivotPoint(index=0, timestamp=ts_high, price=fib_levels.get(0.0) if trend in ("UP", "UPTREND") else fib_levels.get(1.0), pivot_type='high'),
                swing_low=PivotPoint(index=0, timestamp=ts_low, price=fib_levels.get(1.0) if trend in ("UP", "UPTREND") else fib_levels.get(0.0), pivot_type='low'),
                trend="UPTREND" if trend in ("UP", "UPTREND") else "DOWNTREND",
                setup_type='LONG' if trend in ("UP", "UPTREND") else 'SHORT',
                fibonacci_levels=fib_levels,
                trading_levels={'entry': current_price, 'tp1': fib_levels.get(0.5, current_price), 'tp2': fib_levels.get(0.382, current_price), 'tp3': fib_levels.get(0.236, current_price), 'sl': fib_levels.get(0.786, current_price)},
                confluences=0,
                confidence='LOW',
                risk_reward_ratio=0
            )
            return self.generate_professional_chart(setup, df)
        except Exception as e:
            logger.error(f"Error in legacy generate_chart: {e}")
            return None
    
    def _validate_fibonacci_pattern(self, data: pd.DataFrame, swing_high: PivotPoint, 
                                  swing_low: PivotPoint, current_price: float, setup_type: str) -> bool:
        """
        Validate that the Fibonacci pattern is still intact and not broken
        """
        try:
            # 1. Pattern should not be too old
            latest_timestamp = data.index[-1]
            swing_age_high = (latest_timestamp - swing_high.timestamp).total_seconds() / 3600  # hours
            swing_age_low = (latest_timestamp - swing_low.timestamp).total_seconds() / 3600   # hours
            
            # Swing points shouldn't be older than reasonable timeframes
            max_age_hours = {'1m': 4, '5m': 12, '15m': 48, '1h': 168, '4h': 720, '1d': 2160}  # Various limits
            max_age = max_age_hours.get(data.attrs.get('timeframe', '1h'), 168)  # Default 1 week
            
            if max(swing_age_high, swing_age_low) > max_age:
                logger.info("Fibonacci pattern too old")
                return False
            
            # 2. Pattern should not be broken
            if setup_type == "LONG":
                # For LONG setups, price should not have broken below swing low significantly
                if current_price < swing_low.price * 0.995:  # 0.5% buffer
                    logger.info("LONG pattern broken: price below swing low")
                    return False
            else:  # SHORT setup
                # For SHORT setups, price should not have broken above swing high significantly
                if current_price > swing_high.price * 1.005:  # 0.5% buffer
                    logger.info("SHORT pattern broken: price above swing high")
                    return False
            
            # 3. Recent price action should support the setup
            recent_data = data.tail(10)
            
            if setup_type == "LONG":
                # For LONG, we want to see some buying interest (not constant selling)
                red_candles = sum(1 for _, candle in recent_data.iterrows() if candle['close'] < candle['open'])
                if red_candles > 8:  # Too many red candles
                    logger.info("Too much selling pressure for LONG setup")
                    return False
            else:  # SHORT setup
                # For SHORT, we want to see some selling pressure (not constant buying)
                green_candles = sum(1 for _, candle in recent_data.iterrows() if candle['close'] > candle['open'])
                if green_candles > 8:  # Too many green candles
                    logger.info("Too much buying pressure for SHORT setup")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating Fibonacci pattern: {e}")
            return False
    
    def generate_professional_chart(self, setup: FibonacciSetup, data: pd.DataFrame) -> Optional[str]:
        """
        Generate a professional trading chart with all relevant information
        """
        try:
            # Create figure with subplots for price and volume
            fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(CHART_WIDTH, CHART_HEIGHT), 
                                         gridspec_kw={'height_ratios': [3, 1]}, dpi=DPI)
            
            # Plot candlesticks on main chart
            plot_data = data.tail(200).copy()
            
            for i, (timestamp, row) in enumerate(plot_data.iterrows()):
                color = CHART_COLORS['candle_up'] if row['close'] >= row['open'] else CHART_COLORS['candle_down']
                
                # Draw candlestick body
                body_height = abs(row['close'] - row['open'])
                body_bottom = min(row['open'], row['close'])
                
                ax1.bar(i, body_height, bottom=body_bottom, color=color, width=0.8, alpha=0.8)
                
                # Draw wicks
                ax1.plot([i, i], [row['low'], row['high']], color=color, linewidth=1)
            
            # Plot moving averages if available
            if 'sma_20' in plot_data.columns:
                ax1.plot(range(len(plot_data)), plot_data['sma_20'], color='orange', linewidth=1, alpha=0.7, label='SMA 20')
            if 'sma_50' in plot_data.columns:
                ax1.plot(range(len(plot_data)), plot_data['sma_50'], color='blue', linewidth=1, alpha=0.7, label='SMA 50')
            
            # Draw Fibonacci levels
            for level, price in setup.fibonacci_levels.items():
                color = CHART_COLORS['fibonacci_levels'][level]
                label = f"{FIBONACCI_LEVELS[level]}: ${price:.4f}"
                
                ax1.axhline(y=price, color=color, linestyle='--', linewidth=2, alpha=0.8, label=label)
                
                # Highlight the 61.8% level
                if level == 0.618:
                    ax1.axhline(y=price, color=color, linestyle='-', linewidth=4, alpha=0.9)
                    ax1.axhspan(price * 0.999, price * 1.001, alpha=0.2, color=color)
                
                # Add level labels on the right
                ax1.text(len(plot_data) + 2, price, f"{FIBONACCI_LEVELS[level]}", 
                        color=color, fontsize=10, fontweight='bold', verticalalignment='center')
            
            # Mark swing points
            try:
                swing_high_pos = plot_data.index.get_loc(setup.swing_high.timestamp) if setup.swing_high.timestamp in plot_data.index else 0
                swing_low_pos = plot_data.index.get_loc(setup.swing_low.timestamp) if setup.swing_low.timestamp in plot_data.index else len(plot_data) - 1
            except:
                swing_high_pos = len(plot_data) // 4
                swing_low_pos = len(plot_data) * 3 // 4
            
            ax1.plot(swing_high_pos, setup.swing_high.price, 'v', color='red', markersize=12, label=f'Swing High (${setup.swing_high.price:.4f})')
            ax1.plot(swing_low_pos, setup.swing_low.price, '^', color='green', markersize=12, label=f'Swing Low (${setup.swing_low.price:.4f})')
            
            # Draw trend line
            ax1.plot([swing_low_pos, swing_high_pos], [setup.swing_low.price, setup.swing_high.price], 
                    color=CHART_COLORS['fibonacci_line'], linestyle='-', linewidth=3, alpha=0.8, label='Trend Line')
            
            # Mark current price and entry
            current_pos = len(plot_data) - 1
            ax1.axhline(y=setup.current_price, color='yellow', linestyle='-', linewidth=3, alpha=0.9, 
                       label=f'Current Price (${setup.current_price:.4f})')
            
            # Mark trading levels
            trading_levels = setup.trading_levels
            ax1.axhline(y=trading_levels['tp1'], color='lime', linestyle=':', linewidth=2, alpha=0.8, label=f"TP1 (${trading_levels['tp1']:.4f})")
            ax1.axhline(y=trading_levels['tp2'], color='lime', linestyle=':', linewidth=2, alpha=0.6, label=f"TP2 (${trading_levels['tp2']:.4f})")
            ax1.axhline(y=trading_levels['sl'], color='red', linestyle=':', linewidth=2, alpha=0.8, label=f"SL (${trading_levels['sl']:.4f})")
            
            # Add setup information box
            setup_info = (
                f"Setup: {setup.setup_type}\n"
                f"Trend: {setup.trend}\n"
                f"Confidence: {setup.confidence}\n"
                f"Confluences: {setup.confluences}\n"
                f"R/R Ratio: {setup.risk_reward_ratio:.2f}\n"
                f"Entry: ${trading_levels['entry']:.4f}\n"
                f"Risk: ${trading_levels['risk_amount']:.4f}"
            )
            
            ax1.text(0.02, 0.98, setup_info, transform=ax1.transAxes, fontsize=10,
                    verticalalignment='top', bbox=dict(boxstyle='round', facecolor='black', alpha=0.8),
                    color='white', fontweight='bold')
            
            # Chart title and labels
            ax1.set_title(f'{setup.symbol} - Fibonacci 61.8% Retracement Setup ({setup.timeframe})', 
                         color=CHART_COLORS['text'], fontsize=16, fontweight='bold', pad=20)
            ax1.set_ylabel('Price (USDT)', color=CHART_COLORS['text'], fontsize=12)
            
            # Format x-axis
            step = max(1, len(plot_data) // 8)
            ax1.set_xticks(range(0, len(plot_data), step))
            ax1.set_xticklabels([plot_data.index[i].strftime('%H:%M\n%m/%d') for i in range(0, len(plot_data), step)], 
                               rotation=45, color=CHART_COLORS['text'], fontsize=8)
            
            # Add legend
            ax1.legend(loc='center left', bbox_to_anchor=(1, 0.5), fontsize=8, framealpha=0.8)
            ax1.grid(True, alpha=0.3, color=CHART_COLORS['grid'])
            ax1.set_facecolor(CHART_COLORS['background'])
            
            # Volume subplot
            if 'volume' in plot_data.columns:
                volume_colors = ['green' if plot_data.iloc[i]['close'] >= plot_data.iloc[i]['open'] 
                               else 'red' for i in range(len(plot_data))]
                ax2.bar(range(len(plot_data)), plot_data['volume'], color=volume_colors, alpha=0.7)
                ax2.set_ylabel('Volume', color=CHART_COLORS['text'], fontsize=10)
                ax2.set_facecolor(CHART_COLORS['background'])
                ax2.grid(True, alpha=0.3, color=CHART_COLORS['grid'])
            
            # Format and save
            plt.tight_layout()
            filename = f"fibonacci_618_setup_{setup.symbol}_{setup.timeframe}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            plt.savefig(filename, facecolor=CHART_COLORS['background'], bbox_inches='tight', dpi=DPI)
            plt.close()
            
            logger.info(f"Professional chart saved as {filename}")
            return filename
            
        except Exception as e:
            logger.error(f"Error generating professional chart: {e}")
            plt.close('all')  # Clean up any open figures
            return None
    
    def scan_multiple_symbols(self, symbols: List[str], timeframes: List[str], 
                            min_confluence: int = 2) -> List[FibonacciSetup]:
        """
        Scan multiple symbols and timeframes for Fibonacci setups
        """
        valid_setups = []
        
        for symbol in symbols:
            for timeframe in timeframes:
                try:
                    logger.info(f"Scanning {symbol} on {timeframe}...")
                    setup = self.detect_618_retracement(symbol, timeframe, min_confluence)
                    
                    if setup:
                        valid_setups.append(setup)
                        logger.info(f"✅ Found setup: {symbol} {timeframe} {setup.setup_type}")
                    
                    # Small delay to avoid rate limiting
                    import time
                    time.sleep(0.5)
                    
                except Exception as e:
                    logger.error(f"Error scanning {symbol} {timeframe}: {e}")
                    continue
        
        # Sort by confidence and risk/reward ratio
        valid_setups.sort(key=lambda x: (x.confidence == 'HIGH', x.confluences, x.risk_reward_ratio), reverse=True)
        
        logger.info(f"Scan complete. Found {len(valid_setups)} valid setups.")
        return valid_setups
    
    def generate_trading_report(self, setups: List[FibonacciSetup]) -> str:
        """
        Generate a comprehensive trading report
        """
        if not setups:
            return "No valid Fibonacci setups found."
        
        report = "🔥 FIBONACCI 61.8% TRADING SETUPS REPORT 🔥\n"
        report += "=" * 50 + "\n\n"
        
        for i, setup in enumerate(setups, 1):
            report += f"#{i} {setup.symbol} ({setup.timeframe}) - {setup.setup_type}\n"
            report += f"Confidence: {setup.confidence} | Confluences: {setup.confluences}\n"
            report += f"Current Price: ${setup.current_price:.4f}\n"
            report += f"61.8% Level: ${setup.fibonacci_levels[0.618]:.4f}\n"
            report += f"Entry: ${setup.trading_levels['entry']:.4f}\n"
            report += f"TP1: ${setup.trading_levels['tp1']:.4f} (R/R: {setup.trading_levels['risk_reward_1']:.2f})\n"
            report += f"TP2: ${setup.trading_levels['tp2']:.4f} (R/R: {setup.trading_levels['risk_reward_2']:.2f})\n"
            report += f"Stop Loss: ${setup.trading_levels['sl']:.4f}\n"
            report += f"Risk: ${setup.trading_levels['risk_amount']:.4f} USDT\n"
            report += "-" * 40 + "\n"
        
        return report

# Example usage and testing
if __name__ == "__main__":
    # Initialize the detector
    detector = FibonacciDetector()
    
    # Test with a single symbol
    symbol = "BTCUSDT"
    timeframe = "4h"
    
    logger.info(f"Testing Fibonacci detection for {symbol} on {timeframe}")
    
    # Detect setup
    setup = detector.detect_618_retracement(symbol, timeframe, min_confluence=2)
    
    if setup:
        # Generate chart
        data = detector.get_binance_data(symbol, timeframe)
        chart_file = detector.generate_professional_chart(setup, data)
        
        # Generate report
        report = detector.generate_trading_report([setup])
        print(report)
        
        if chart_file:
            print(f"Chart saved: {chart_file}")
    else:
        print(f"No valid setup found for {symbol} {timeframe}")
    
    # Example: Scan multiple symbols
    """
    symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "DOTUSDT"]
    timeframes = ["1h", "4h", "1d"]
    
    setups = detector.scan_multiple_symbols(symbols, timeframes, min_confluence=2)
    report = detector.generate_trading_report(setups)
    print(report)
    """
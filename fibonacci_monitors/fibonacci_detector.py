import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import requests
import json
from typing import Tuple, Optional, Dict, List
import logging
from config import *
from position_manager import PositionManager

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FibonacciDetector:
    def __init__(self, position_manager: Optional[PositionManager] = None):
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
        # Try multiple data sources for reliability
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
            
            # Verify data quality
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
            # Map Binance intervals to CoinGecko format
            interval_map = {
                '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
                '1h': 'hourly', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h',
                '12h': '12h', '1d': 'daily', '3d': '3d', '1w': 'weekly', '1M': 'monthly'
            }
            
            # Get coin ID from symbol
            coin_id = symbol.replace('USDT', '').lower()
            
            url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/ohlc"
            params = {
                'vs_currency': 'usd',
                'days': '30'  # Get 30 days of data
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Convert to DataFrame
            df = pd.DataFrame(data, columns=['timestamp', 'open', 'high', 'low', 'close'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df['volume'] = 0  # CoinGecko doesn't provide volume in this endpoint
            
            for col in ['open', 'high', 'low', 'close']:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            
            df.set_index('timestamp', inplace=True)
            
            # Resample to match the requested interval
            if interval in ['1h', '4h', '1d']:
                if interval == '1h':
                    df = df.resample('1H').agg({
                        'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'
                    })
                elif interval == '4h':
                    df = df.resample('4H').agg({
                        'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'
                    })
                elif interval == '1d':
                    df = df.resample('D').agg({
                        'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'
                    })
            
            # Take the last 'limit' candles
            df = df.tail(limit)
            
            logger.info(f"Fetched {len(df)} candles from CoinGecko for {symbol} {interval}")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching data from CoinGecko: {e}")
            return pd.DataFrame()
    
    def detect_swing_points(self, data: pd.DataFrame, lookback: int = 20) -> Tuple[float, float]:
        """
        Detect swing high and swing low using professional standards
        Based on the article's approach for identifying pivot points
        """
        if len(data) < lookback:
            return None, None
        
        # Get recent data for analysis
        recent_data = data.tail(lookback)
        
        # Find swing high (pivot high)
        swing_high = recent_data['high'].max()
        swing_high_idx = recent_data['high'].idxmax()
        
        # Find swing low (pivot low) 
        swing_low = recent_data['low'].min()
        swing_low_idx = recent_data['low'].idxmax()
        
        # Professional validation: Ensure proper swing point formation
        # Swing high should have lower highs on both sides
        # Swing low should have higher lows on both sides
        
        # Get data around swing high
        high_window = 5  # Check 5 candles on each side
        high_start = max(0, swing_high_idx - high_window)
        high_end = min(len(data), swing_high_idx + high_window + 1)
        high_data = data.iloc[high_start:high_end]
        
        # Get data around swing low
        low_start = max(0, swing_low_idx - high_window)
        low_end = min(len(data), swing_low_idx + high_window + 1)
        low_data = data.iloc[low_start:low_end]
        
        # Validate swing high: should be the highest point in its window
        if swing_high != high_data['high'].max():
            return None, None
        
        # Validate swing low: should be the lowest point in its window
        if swing_low != low_data['low'].min():
            return None, None
        
        # Professional check: Ensure minimum distance between swing points
        price_range = abs(swing_high - swing_low)
        min_range_percent = 0.5  # Minimum 0.5% range for valid swing
        
        if price_range / swing_low < min_range_percent / 100:
            return None, None
        
        return swing_high, swing_low
    
    def identify_trend(self, data: pd.DataFrame, lookback: int = 30) -> str:
        """
        Identify market trend using professional standards
        Returns: 'UPTREND', 'DOWNTREND', 'SIDEWAYS'
        """
        if len(data) < lookback:
            return 'SIDEWAYS'
        
        recent_data = data.tail(lookback)
        
        # Calculate higher highs and higher lows for uptrend
        highs = recent_data['high'].values
        lows = recent_data['low'].values
        
        # Check for higher highs and higher lows (uptrend)
        higher_highs = 0
        higher_lows = 0
        
        for i in range(1, len(highs)):
            if highs[i] > highs[i-1]:
                higher_highs += 1
            if lows[i] > lows[i-1]:
                higher_lows += 1
        
        # Check for lower highs and lower lows (downtrend)
        lower_highs = 0
        lower_lows = 0
        
        for i in range(1, len(highs)):
            if highs[i] < highs[i-1]:
                lower_highs += 1
            if lows[i] < lows[i-1]:
                lower_lows += 1
        
        # Determine trend based on majority
        uptrend_score = higher_highs + higher_lows
        downtrend_score = lower_highs + lower_lows
        
        if uptrend_score > downtrend_score and uptrend_score > len(highs) * 0.6:
            return 'UPTREND'
        elif downtrend_score > uptrend_score and downtrend_score > len(highs) * 0.6:
            return 'DOWNTREND'
        else:
            return 'SIDEWAYS'
    
    def calculate_fibonacci_levels(self, swing_high: float, swing_low: float, trend: str = "UP") -> Dict[float, float]:
        """
        Calculate Fibonacci retracement levels using professional formula
        Based on the article's calculation method
        
        Args:
            swing_high: The swing high price
            swing_low: The swing low price  
            trend: "UP" for uptrend (LONG setup), "DOWN" for downtrend (SHORT setup)
        """
        price_range = swing_high - swing_low
        
        if trend == "DOWN":
            # SHORT setup: Price retraced from swing high DOWN TO swing low
            # For SHORT: We want to sell at resistance levels (retracement down from high)
            # 0% = Swing High (resistance), 100% = Swing Low (support)
            fib_levels = {
                0.0: swing_high,      # 0% - Swing High (resistance)
                0.236: swing_high - (0.236 * price_range),  # 23.6%
                0.382: swing_high - (0.382 * price_range),  # 38.2%
                0.5: swing_high - (0.5 * price_range),      # 50%
                0.618: swing_high - (0.618 * price_range),  # 61.8% - Golden Ratio
                0.786: swing_high - (0.786 * price_range),  # 78.6%
                1.0: swing_low       # 100% - Swing Low (support)
            }
        else:
            # LONG setup: Price retraced from swing low UP TO swing high
            # For LONG: We want to buy at support levels (retracement up from low)
            # 0% = Swing Low (support), 100% = Swing High (resistance)
            fib_levels = {
                0.0: swing_low,       # 0% - Swing Low (support)
                0.236: swing_low + (0.236 * price_range),  # 23.6%
                0.382: swing_low + (0.382 * price_range),  # 38.2%
                0.5: swing_low + (0.5 * price_range),      # 50%
                0.618: swing_low + (0.618 * price_range),  # 61.8% - Golden Ratio
                0.786: swing_low + (0.786 * price_range),  # 78.6%
                1.0: swing_high      # 100% - Swing High (resistance)
            }
        
        return fib_levels
    
    def detect_618_retracement(self, symbol: str, timeframe: str, margin: float = 0.1) -> Optional[Dict]:
        """
        Detect 61.8% Fibonacci retracement with professional validation
        Focus specifically on the Golden Ratio (61.8%) as requested
        """
        try:
            # Get market data
            data = self.get_binance_data(symbol, timeframe) # Changed to get_binance_data
            if data is None or len(data) < 30:
                return None
            
            # Detect swing points and determine trend
            swing_high, swing_low = self.detect_swing_points(data)
            if swing_high is None or swing_low is None:
                return None
            
            # Determine trend based on swing point order
            # Find the indices of the detected swing points
            swing_high_idx = None
            swing_low_idx = None
            
            # Find the indices of the swing points in the data
            for i, (timestamp, row) in enumerate(data.iterrows()):
                if abs(row['high'] - swing_high) < 0.01:  # Allow small tolerance
                    swing_high_idx = i
                if abs(row['low'] - swing_low) < 0.01:  # Allow small tolerance
                    swing_low_idx = i
                if swing_high_idx is not None and swing_low_idx is not None:
                    break
            
            # If we couldn't find exact matches, use the detected swing points
            if swing_high_idx is None or swing_low_idx is None:
                # Use the lookback period to determine trend
                lookback_data = data.tail(30)  # Use last 30 candles
                swing_high_idx = lookback_data['high'].idxmax()
                swing_low_idx = lookback_data['low'].idxmin()
                swing_high_idx = data.index.get_loc(swing_high_idx)
                swing_low_idx = data.index.get_loc(swing_low_idx)
            
            if swing_high_idx < swing_low_idx:
                trend = "DOWN"  # Downtrend: High -> Low
            else:
                trend = "UP"    # Uptrend: Low -> High
            
            # Calculate Fibonacci levels with correct trend direction
            fib_levels = self.calculate_fibonacci_levels(swing_high, swing_low, trend)
            
            # Get current price
            current_price = data['close'].iloc[-1]
            
            # Focus on 61.8% level (Golden Ratio)
            fib_618 = fib_levels[0.618]
            
            # Check if price is near 61.8% level (within margin)
            price_range = abs(swing_high - swing_low)
            margin_amount = price_range * margin
            
            # Professional validation: Price should be within margin of 61.8% level
            if abs(current_price - fib_618) > margin_amount:
                return None
            
            # Additional professional checks
            # 1. Ensure minimum move size (as per article)
            move_percent = abs(swing_high - swing_low) / swing_low * 100
            min_move = 0.5 if timeframe == '1m' else 1.0 if timeframe == '5m' else 1.5
            
            if move_percent < min_move:
                return None
            
            # 2. Check trend alignment (61.8% works best in trending markets)
            if trend == 'SIDEWAYS':
                # Still allow but with lower confidence
                pass
            
            # 3. Professional confirmation: Check if price action supports the level
            # Look for candlestick patterns or volume confirmation near the level
            recent_candles = data.tail(5)
            price_near_level = any(
                abs(candle['close'] - fib_618) < margin_amount 
                for _, candle in recent_candles.iterrows()
            )
            
            if not price_near_level:
                return None
            
            # Determine setup type based on trend and price position
            if trend == 'DOWN' and current_price >= fib_618:
                setup_type = 'SHORT'  # Looking for rejection from 61.8% resistance (above 61.8%)
            elif trend == 'UP' and current_price <= fib_618:
                setup_type = 'LONG'  # Looking for bounce from 61.8% support (below 61.8%)
            else:
                setup_type = 'SHORT' if current_price >= fib_618 else 'LONG'
            
            # Calculate trading levels with professional risk management
            trading_levels = self.calculate_trading_levels(fib_levels, current_price, symbol, setup_type)
            
            # Professional validation: Ensure reasonable risk/reward
            risk = abs(trading_levels['entry'] - trading_levels['sl'])
            reward = abs(trading_levels['tp1'] - trading_levels['entry'])
            risk_reward_ratio = reward / risk if risk > 0 else 0
            
            # Minimum 1:1.5 risk/reward ratio (professional standard)
            if risk_reward_ratio < 1.5:
                return None
            
            # Add risk_reward_ratio to trading_levels
            trading_levels['risk_reward_ratio'] = risk_reward_ratio
            
            return {
                'symbol': symbol,
                'timeframe': timeframe,
                'current_price': current_price,
                'swing_high': swing_high,
                'swing_low': swing_low,
                'trend': trend,
                'setup_type': setup_type,
                'fibonacci_levels': fib_levels,
                'trading_levels': trading_levels,
                'move_percent': move_percent,
                'confidence': 'HIGH' if trend != 'SIDEWAYS' else 'MEDIUM'
            }
            
        except Exception as e:
            logger.error(f"Error detecting 61.8% retracement for {symbol}: {e}")
            return None
    
    def check_618_retracement(self, current_price: float, fib_levels: Dict[float, float]) -> bool:
        """Check if current price is at the 0.618 Fibonacci level"""
        target_level = fib_levels[0.618]
        tolerance = target_level * MARGIN
        
        lower_bound = target_level - tolerance
        upper_bound = target_level + tolerance
        
        is_at_level = lower_bound <= current_price <= upper_bound
        
        if is_at_level:
            logger.info(f"Price ${current_price:.2f} is at 61.8% level ${target_level:.2f} (±${tolerance:.2f})")
        else:
            logger.info(f"Price ${current_price:.2f} not at 61.8% level ${target_level:.2f} (±${tolerance:.2f})")
        
        return is_at_level
    
    def generate_chart(self, df: pd.DataFrame, swing_high_idx: str, swing_low_idx: str, 
                      fib_levels: Dict[float, float], current_price: float, symbol: str, timeframe: str, trend: str = "UP") -> str:
        """Generate a professional chart with Fibonacci levels and annotations"""
        try:
            # Create figure and axis
            fig, ax = plt.subplots(figsize=(CHART_WIDTH, CHART_HEIGHT), dpi=DPI)
            
            # Get the data range for plotting (last 200 candles)
            plot_data = df.tail(200).copy()
            
            # Create candlestick chart
            for i, (timestamp, row) in enumerate(plot_data.iterrows()):
                color = CHART_COLORS['candle_up'] if row['close'] >= row['open'] else CHART_COLORS['candle_down']
                
                # Draw candlestick body
                body_height = abs(row['close'] - row['open'])
                body_bottom = min(row['open'], row['close'])
                
                ax.bar(i, body_height, bottom=body_bottom, color=color, width=0.8, alpha=0.8)
                
                # Draw wicks
                ax.plot([i, i], [row['low'], row['high']], color=color, linewidth=1)
            
            # Get swing point positions
            swing_high_pos = plot_data.index.get_loc(swing_high_idx) if swing_high_idx in plot_data.index else 0
            swing_low_pos = plot_data.index.get_loc(swing_low_idx) if swing_low_idx in plot_data.index else len(plot_data) - 1
            
            # Draw the main Fibonacci trend line
            # For SHORT setups (DOWN trend): 0% = Swing High, 100% = Swing Low
            # For LONG setups (UP trend): 0% = Swing Low, 100% = Swing High
            if trend == "DOWN":
                swing_high_price = fib_levels[0.0]  # 0% = Swing High for SHORT
                swing_low_price = fib_levels[1.0]   # 100% = Swing Low for SHORT
            else:
                swing_high_price = fib_levels[1.0]  # 100% = Swing High for LONG
                swing_low_price = fib_levels[0.0]   # 0% = Swing Low for LONG
            
            ax.plot([swing_low_pos, swing_high_pos], [swing_low_price, swing_high_price], 
                   color=CHART_COLORS['fibonacci_line'], linestyle='-', linewidth=3, alpha=0.8, label='Trend Line')
            
            # Draw horizontal Fibonacci level lines with annotations
            # Sort levels based on trend to ensure correct visual order
            if trend == "DOWN":
                # For SHORT setup: display levels in descending order (100% to 0%)
                sorted_levels = sorted(fib_levels.items(), key=lambda x: x[0], reverse=True)
            else:
                # For LONG setup: display levels in ascending order (0% to 100%)
                sorted_levels = sorted(fib_levels.items(), key=lambda x: x[0], reverse=False)
            
            for level, price in sorted_levels:
                color = CHART_COLORS['fibonacci_levels'][level]
                label = f"{FIBONACCI_LEVELS[level]}: ${price:.2f}"
                
                # Draw the horizontal line
                ax.axhline(y=price, color=color, linestyle='--', linewidth=2, alpha=0.8, label=label)
                
                # Add colored background band for each level
                ax.axhspan(price * 0.999, price * 1.001, alpha=0.1, color=color)
                
                # Add text annotation on the right side
                ax.text(len(plot_data) + 2, price, f"{FIBONACCI_LEVELS[level]}", 
                       color=color, fontsize=10, fontweight='bold', verticalalignment='center')
            
            # Mark current price with a prominent line
            current_pos = len(plot_data) - 1
            ax.axhline(y=current_price, color='yellow', linestyle='-', linewidth=3, alpha=0.9, label=f'Current Price (${current_price:.2f})')
            
            # Add arrow pointing to current price
            ax.annotate('Current Price', xy=(current_pos, current_price), xytext=(current_pos - 20, current_price * 1.02),
                       arrowprops=dict(arrowstyle='->', color='yellow', lw=2), color='yellow', fontsize=12, fontweight='bold')
            
            # Mark swing points with circles
            ax.plot(swing_high_pos, swing_high_price, 'o', color='red', markersize=10, label=f'Swing High (${swing_high_price:.2f})')
            ax.plot(swing_low_pos, swing_low_price, 'o', color='green', markersize=10, label=f'Swing Low (${swing_low_price:.2f})')
            
            # Add text annotations for swing points
            ax.annotate(f'High\n${swing_high_price:.2f}', xy=(swing_high_pos, swing_high_price), 
                       xytext=(swing_high_pos + 5, swing_high_price * 1.01),
                       arrowprops=dict(arrowstyle='->', color='red', lw=1), color='red', fontsize=10)
            
            ax.annotate(f'Low\n${swing_low_price:.2f}', xy=(swing_low_pos, swing_low_price), 
                       xytext=(swing_low_pos + 5, swing_low_price * 0.99),
                       arrowprops=dict(arrowstyle='->', color='green', lw=1), color='green', fontsize=10)
            
            # Highlight the 61.8% level specifically
            fib_618 = fib_levels[0.618]
            ax.axhline(y=fib_618, color='#42a5f5', linestyle='-', linewidth=4, alpha=0.9, label=f'61.8% Level (${fib_618:.2f})')
            
            # Add special annotation for 61.8% level
            ax.annotate('61.8% RETRACEMENT', xy=(current_pos, fib_618), xytext=(current_pos - 30, fib_618 * 1.02),
                       arrowprops=dict(arrowstyle='->', color='#42a5f5', lw=2), 
                       color='#42a5f5', fontsize=14, fontweight='bold',
                       bbox=dict(boxstyle="round,pad=0.3", facecolor='#42a5f5', alpha=0.3))
            
            # Customize chart
            ax.set_title(f'{symbol} Fibonacci Retracement - {timeframe}\nCurrent Price: ${current_price:.2f}', 
                        color=CHART_COLORS['text'], fontsize=16, fontweight='bold', pad=20)
            ax.set_xlabel('Time', color=CHART_COLORS['text'], fontsize=12)
            ax.set_ylabel('Price (USDT)', color=CHART_COLORS['text'], fontsize=12)
            
            # Format x-axis with time labels
            step = max(1, len(plot_data) // 8)
            ax.set_xticks(range(0, len(plot_data), step))
            ax.set_xticklabels([plot_data.index[i].strftime('%H:%M\n%m/%d') for i in range(0, len(plot_data), step)], 
                              rotation=45, color=CHART_COLORS['text'], fontsize=10)
            
            # Add legend outside the plot
            ax.legend(loc='center left', bbox_to_anchor=(1, 0.5), fontsize=10, framealpha=0.8)
            
            # Add grid
            ax.grid(True, alpha=0.3, color=CHART_COLORS['grid'])
            
            # Set background color
            ax.set_facecolor(CHART_COLORS['background'])
            
            # Adjust layout to prevent text cutoff
            plt.tight_layout()
            
            # Save chart with high quality
            filename = f"fibonacci_chart_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            plt.savefig(filename, facecolor=CHART_COLORS['background'], bbox_inches='tight', dpi=DPI)
            plt.close()
            
            logger.info(f"Chart saved as {filename}")
            return filename
            
        except Exception as e:
            logger.error(f"Error generating chart: {e}")
            return None
    
    def calculate_trading_levels(self, fib_levels: Dict[float, float], current_price: float, symbol: str, setup_type: str = None) -> Dict[str, float]:
        """Calculate suggested entry, take profit, and stop loss levels"""
        # Use provided setup_type or determine based on price position relative to 61.8%
        if setup_type is None:
            fib_618 = fib_levels[0.618]
            setup_type = "SHORT" if current_price >= fib_618 else "LONG"
        
        # Calculate trading levels based on setup type
        if setup_type == "LONG":
            # LONG setup: Buy near 61.8% support level, looking for bounce up
            entry = current_price
            tp1 = fib_levels[0.5]    # 50% retracement
            tp2 = fib_levels[0.382]  # 38.2% retracement  
            tp3 = fib_levels[0.236]  # 23.6% retracement
            sl = fib_levels[0.786]   # Stop loss below 78.6% level
        else:
            # SHORT setup: Sell near 61.8% resistance level, looking for rejection down
            entry = current_price
            tp1 = fib_levels[0.786]  # 78.6% retracement
            tp2 = fib_levels[1.0]    # 100% retracement (swing low)
            # Extension beyond swing low (161.8% of the move)
            total_move = abs(fib_levels[0.0] - fib_levels[1.0])
            extension = fib_levels[1.0] - (total_move * 0.618)
            tp3 = extension
            sl = fib_levels[0.5]     # Stop loss at 50% level
        
        return {
            'entry': entry,
            'tp1': tp1,
            'tp2': tp2,
            'tp3': tp3,
            'sl': sl,
            'setup_type': setup_type
        }
    
    def detect_fibonacci_setup(self, symbol: str, timeframe: str) -> Optional[Dict]:
        """
        Detect Fibonacci 61.8% retracement setup using professional standards
        Focus specifically on the Golden Ratio as requested
        """
        try:
            # Use the new professional 61.8% detection method
            result = self.detect_618_retracement(symbol, timeframe)
            
            if result is None:
                return None
            
            # Generate chart for visualization
            # Extract required parameters from result
            df = self.get_binance_data(symbol, timeframe, 500)
            if df.empty:
                logger.error(f"Failed to fetch data for chart generation")
                return None
            
            # Get swing point indices from the data
            swing_high_idx = df['high'].idxmax()
            swing_low_idx = df['low'].idxmin()
            
            chart_filename = self.generate_chart(
                df, swing_high_idx, swing_low_idx, 
                result['fibonacci_levels'], result['current_price'], 
                symbol, timeframe, result['trend']
            )
            
            if chart_filename:
                result['chart_filename'] = chart_filename
            
            logger.info(f"✅ Professional 61.8% Fibonacci setup detected for {symbol} on {timeframe}")
            logger.info(f"   Trend: {result['trend']}")
            logger.info(f"   Setup Type: {result['trading_levels']['setup_type']}")
            logger.info(f"   Move: {result['move_percent']:.2f}%")
            logger.info(f"   R:R Ratio: {result['trading_levels']['risk_reward_ratio']:.2f}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error in Fibonacci setup detection for {symbol}: {e}")
            return None
    
    def run_detection(self) -> Optional[Dict]:
        """Main detection logic using professional 61.8% Fibonacci standards"""
        try:
            # Use the new professional detection method
            result = self.detect_fibonacci_setup(self.symbol, self.timeframe)
            
            if result is None:
                return None
            
            # Add monitor information
            result['monitor_name'] = f"{self.symbol}-{self.timeframe}-Professional"
            result['monitor_config'] = {
                'margin': 0.1,
                'min_move': 0.5,
                'lookback': 20
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error in main detection for {self.symbol}: {e}")
            return None
    
    def run_detection_with_params(self, symbol: str, timeframe: str, margin: float, 
                                 min_move_percent: float, swing_lookback: int) -> Optional[Dict]:
        """Run detection with custom parameters instead of global config"""
        try:
            # Fetch data
            df = self.get_binance_data(symbol, timeframe, 500)
            if df.empty:
                logger.error(f"Failed to fetch data for {symbol}")
                return None
            
            # Detect swing points with custom lookback
            swing_high_idx, swing_low_idx, trend = self.detect_swing_points_with_params(df, swing_lookback, min_move_percent)
            if swing_high_idx is None or swing_low_idx is None or trend is None:
                logger.info(f"No valid swing points detected for {symbol}")
                return None
            
            # Get swing prices
            swing_high_price = df.loc[swing_high_idx, 'high']
            swing_low_price = df.loc[swing_low_idx, 'low']
            current_price = df['close'].iloc[-1]
            
            # Calculate Fibonacci levels with correct trend direction
            fib_levels = self.calculate_fibonacci_levels(swing_high_price, swing_low_price, trend)
            
            # Check for 0.618 retracement with custom margin
            if not self.check_618_retracement_with_params(current_price, fib_levels, margin):
                logger.info(f"Price ({current_price:.2f}) not at 0.618 level ({fib_levels[0.618]:.2f}) for {symbol}")
                return None
            
            # Generate chart
            chart_filename = self.generate_chart(df, swing_high_idx, swing_low_idx, fib_levels, current_price, symbol, timeframe, trend)
            if not chart_filename:
                logger.error("Failed to generate chart")
                return None
            
            # Calculate trading levels
            trading_levels = self.calculate_trading_levels(fib_levels, current_price, symbol)
            
            # Determine setup type based on trend
            setup_type = "SHORT" if trend == "DOWN" else "LONG"
            
            # Prepare result
            result = {
                'symbol': symbol,
                'timeframe': timeframe,
                'current_price': current_price,
                'swing_high': swing_high_price,
                'swing_low': swing_low_price,
                'trend': trend,
                'setup_type': setup_type,
                'fibonacci_levels': fib_levels,
                'trading_levels': trading_levels,
                'chart_filename': chart_filename,
                'timestamp': datetime.now()
            }
            
            logger.info(f"Fibonacci 0.618 retracement detected for {symbol}")
            return result
            
        except Exception as e:
            logger.error(f"Error in detection for {symbol}: {e}")
            return None
    
    def detect_swing_points_with_params(self, df: pd.DataFrame, lookback: int, min_move_percent: float) -> Tuple[Optional[int], Optional[int], Optional[str]]:
        """Detect swing high and swing low points with custom parameters"""
        if len(df) < lookback:
            return None, None, None
        
        # Get the most recent data
        recent_data = df.tail(lookback).copy()
        current_price = recent_data['close'].iloc[-1]
        
        # Find the highest high and lowest low in the lookback period
        swing_high_idx = recent_data['high'].idxmax()
        swing_low_idx = recent_data['low'].idxmin()
        swing_high_price = recent_data.loc[swing_high_idx, 'high']
        swing_low_price = recent_data.loc[swing_low_idx, 'low']
        
        # Determine trend direction based on the main move direction
        # For Fibonacci retracements, we need to identify the primary trend
        # and then look for retracements against that trend
        
        # Calculate the price difference to determine the main move direction
        price_difference = swing_high_price - swing_low_price
        
        if price_difference > 0:
            # Main move is UP (Swing Low to Swing High)
            # This creates a LONG setup opportunity (retracement down from high)
            trend = "UP"
            # For LONG setups: 0% = Swing Low, 100% = Swing High
            # Retracement goes from Swing High back down to 61.8% level
        else:
            # Main move is DOWN (Swing High to Swing Low) 
            # This creates a SHORT setup opportunity (retracement up from low)
            trend = "DOWN"
            # For SHORT setups: 0% = Swing High, 100% = Swing Low
            # Retracement goes from Swing Low back up to 61.8% level
        
        # CRITICAL: Check if the Fibonacci pattern is still valid
        if not self._is_pattern_valid(df, swing_high_idx, swing_low_idx, swing_high_price, swing_low_price, current_price):
            logger.info("Fibonacci pattern has been broken - invalid setup")
            return None, None, None
        
        # Calculate the move percentage
        move_percent = abs(swing_high_price - swing_low_price) / swing_low_price * 100
        
        # Check if the move is significant enough
        if move_percent < min_move_percent * 100:
            logger.info(f"Move percentage ({move_percent:.2f}%) below minimum threshold ({min_move_percent * 100:.2f}%)")
            return None, None, None
        
        logger.info(f"Detected {trend} trend: Swing High ${swing_high_price:.2f} at {swing_high_idx}, Swing Low ${swing_low_price:.2f} at {swing_low_idx}, Move: {move_percent:.2f}%")
        
        return swing_high_idx, swing_low_idx, trend
    
    def _is_pattern_valid(self, df: pd.DataFrame, swing_high_idx, swing_low_idx, swing_high_price: float, swing_low_price: float, current_price: float) -> bool:
        """Check if the Fibonacci pattern is still valid (not broken)"""
        try:
            # Get the indices as integers for proper comparison
            if isinstance(swing_high_idx, str):
                swing_high_idx = df.index.get_loc(swing_high_idx)
            if isinstance(swing_low_idx, str):
                swing_low_idx = df.index.get_loc(swing_low_idx)
            
            # Determine pattern validity based on the main move direction
            price_difference = swing_high_price - swing_low_price
            
            if price_difference > 0:
                # UP trend (LONG setup): Check if price has broken above the swing high
                if current_price > swing_high_price:
                    logger.info(f"Pattern broken: Price ${current_price:.2f} above swing high ${swing_high_price:.2f}")
                    return False
            else:
                # DOWN trend (SHORT setup): Check if price has broken below the swing low
                if current_price < swing_low_price:
                    logger.info(f"Pattern broken: Price ${current_price:.2f} below swing low ${swing_low_price:.2f}")
                    return False
            
            logger.info("Fibonacci pattern is still valid")
            return True
            
        except Exception as e:
            logger.error(f"Error checking pattern validity: {e}")
            return False
    
    def check_618_retracement_with_params(self, current_price: float, fib_levels: Dict[float, float], margin: float) -> bool:
        """Check if current price is at the 0.618 Fibonacci level with custom margin"""
        target_level = fib_levels[0.618]
        tolerance = target_level * margin
        
        lower_bound = target_level - tolerance
        upper_bound = target_level + tolerance
        
        is_at_level = lower_bound <= current_price <= upper_bound
        
        if is_at_level:
            logger.info(f"Price ${current_price:.2f} is at 61.8% level ${target_level:.2f} (±${tolerance:.2f})")
        else:
            logger.info(f"Price ${current_price:.2f} not at 61.8% level ${target_level:.2f} (±${tolerance:.2f})")
        
        return is_at_level 
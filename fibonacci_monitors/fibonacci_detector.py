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
    
    def detect_swing_points(self, df: pd.DataFrame, lookback: int = 50) -> Tuple[Optional[int], Optional[int]]:
        """
        Detect meaningful swing high and swing low points using proper methodology
        
        For Fibonacci retracements:
        - We need a significant move from swing low to swing high (uptrend)
        - Or from swing high to swing low (downtrend)
        - The swing points should be clearly defined peaks/troughs
        """
        if len(df) < lookback:
            return None, None
        
        # Get the most recent data
        recent_data = df.tail(lookback).copy()
        
        # Find the highest high and lowest low in the lookback period
        swing_high_idx = recent_data['high'].idxmax()
        swing_low_idx = recent_data['low'].idxmin()
        swing_high_price = recent_data.loc[swing_high_idx, 'high']
        swing_low_price = recent_data.loc[swing_low_idx, 'low']
        
        # Determine trend direction based on which came first
        if swing_high_idx < swing_low_idx:
            # Downtrend: High -> Low (price moved from high to low)
            trend = "DOWN"
            # For downtrend, the swing high is the starting point (0%), swing low is the ending point (100%)
            # But we need to find the most recent swing high before the swing low
            before_low = recent_data.loc[:swing_low_idx]
            if not before_low.empty:
                swing_high_idx = before_low['high'].idxmax()
                swing_high_price = recent_data.loc[swing_high_idx, 'high']
        else:
            # Uptrend: Low -> High (price moved from low to high)
            trend = "UP"
            # For uptrend, the swing low is the starting point (0%), swing high is the ending point (100%)
            # But we need to find the most recent swing low before the swing high
            before_high = recent_data.loc[:swing_high_idx]
            if not before_high.empty:
                swing_low_idx = before_high['low'].idxmin()
                swing_low_price = recent_data.loc[swing_low_idx, 'low']
        
        # Calculate the move percentage
        move_percent = abs(swing_high_price - swing_low_price) / swing_low_price * 100
        
        # Check if the move is significant enough
        if move_percent < MIN_MOVE_PERCENT * 100:
            logger.info(f"Move percentage ({move_percent:.2f}%) below minimum threshold ({MIN_MOVE_PERCENT * 100:.2f}%)")
            return None, None
        
        logger.info(f"Detected {trend} trend: Swing High ${swing_high_price:.2f} at {swing_high_idx}, Swing Low ${swing_low_price:.2f} at {swing_low_idx}, Move: {move_percent:.2f}%")
        
        return swing_high_idx, swing_low_idx
    
    def calculate_fibonacci_levels(self, swing_high: float, swing_low: float) -> Dict[float, float]:
        """
        Calculate Fibonacci retracement levels using proper methodology
        
        IMPORTANT: The 0% level is ALWAYS the starting point of the move (where the trend began)
        and the 100% level is ALWAYS the ending point of the move (where the trend ended).
        
        For any trend (up or down):
        - 0% = Starting point of the move
        - 100% = Ending point of the move
        - Retracement levels are calculated from the ending point back toward the starting point
        """
        # Always calculate from the starting point (0%) to the ending point (100%)
        # The starting point is where the move began, the ending point is where it ended
        starting_point = min(swing_high, swing_low)  # The lower of the two
        ending_point = max(swing_high, swing_low)    # The higher of the two
        total_move = ending_point - starting_point
        
        levels = {
            0.0: starting_point,     # 0% = Starting point (where move began)
            0.236: ending_point - (total_move * 0.236),  # 23.6% retracement
            0.382: ending_point - (total_move * 0.382),  # 38.2% retracement
            0.5: ending_point - (total_move * 0.5),      # 50% retracement
            0.618: ending_point - (total_move * 0.618),  # 61.8% retracement
            0.786: ending_point - (total_move * 0.786),  # 78.6% retracement
            1.0: ending_point       # 100% = Ending point (where move ended)
        }
        
        # Determine trend direction for logging
        trend = "UP" if swing_high > swing_low else "DOWN"
        logger.info(f"Calculated Fibonacci levels for {trend} trend:")
        for level, price in levels.items():
            logger.info(f"  {FIBONACCI_LEVELS[level]}: ${price:.2f}")
        
        return levels
    
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
                      fib_levels: Dict[float, float], current_price: float, symbol: str, timeframe: str) -> str:
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
            swing_high_price = fib_levels[1.0] if fib_levels[1.0] > fib_levels[0.0] else fib_levels[0.0]
            swing_low_price = fib_levels[0.0] if fib_levels[0.0] < fib_levels[1.0] else fib_levels[1.0]
            
            ax.plot([swing_low_pos, swing_high_pos], [swing_low_price, swing_high_price], 
                   color=CHART_COLORS['fibonacci_line'], linestyle='-', linewidth=3, alpha=0.8, label='Trend Line')
            
            # Draw horizontal Fibonacci level lines with annotations
            for level, price in fib_levels.items():
                color = CHART_COLORS['fibonacci_levels'][level]
                label = f"{FIBONACCI_LEVELS[level]} (${price:.2f})"
                
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
    
    def calculate_trading_levels(self, fib_levels: Dict[float, float], current_price: float, symbol: str) -> Dict[str, float]:
        """Calculate suggested entry, take profit, and stop loss levels"""
        # Determine setup type based on trend direction
        swing_high = fib_levels[1.0] if fib_levels[1.0] > fib_levels[0.0] else fib_levels[0.0]
        swing_low = fib_levels[0.0] if fib_levels[0.0] < fib_levels[1.0] else fib_levels[1.0]
        
        # If current price is near 61.8% level, it's a potential reversal setup
        fib_618 = fib_levels[0.618]
        
        # Determine if this is a LONG or SHORT setup
        if current_price <= fib_618:
            # LONG setup: Price at 61.8% support level, looking for bounce up
            setup_type = "LONG"
            entry = current_price
            tp1 = fib_levels[0.5]    # 50% retracement
            tp2 = fib_levels[0.382]  # 38.2% retracement  
            tp3 = fib_levels[0.236]  # 23.6% retracement
            sl = fib_levels[0.786]   # Stop loss below 78.6% level
        else:
            # SHORT setup: Price at 61.8% resistance level, looking for rejection down
            setup_type = "SHORT"
            entry = current_price
            tp1 = fib_levels[0.786]  # 78.6% retracement
            tp2 = fib_levels[0.0]    # 100% retracement (swing low)
            # Extension beyond swing low (161.8% of the move)
            total_move = abs(swing_high - swing_low)
            extension = swing_low - (total_move * 0.618)
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
    
    def run_detection(self) -> Optional[Dict]:
        """Main detection logic"""
        try:
            # Fetch data
            df = self.get_binance_data(SYMBOL, TIMEFRAME, 500)
            if df.empty:
                logger.error("Failed to fetch data")
                return None
            
            # Detect swing points
            swing_high_idx, swing_low_idx = self.detect_swing_points(df, SWING_LOOKBACK)
            if swing_high_idx is None or swing_low_idx is None:
                logger.info("No valid swing points detected")
                return None
            
            # Get swing prices
            swing_high_price = df.loc[swing_high_idx, 'high']
            swing_low_price = df.loc[swing_low_idx, 'low']
            current_price = df['close'].iloc[-1]
            
            # Calculate Fibonacci levels
            fib_levels = self.calculate_fibonacci_levels(swing_high_price, swing_low_price)
            
            # Check for 0.618 retracement
            if not self.check_618_retracement(current_price, fib_levels):
                logger.info(f"Price ({current_price:.2f}) not at 0.618 level ({fib_levels[0.618]:.2f})")
                return None
            
            # Generate chart
            chart_filename = self.generate_chart(df, swing_high_idx, swing_low_idx, fib_levels, current_price, SYMBOL, TIMEFRAME)
            if not chart_filename:
                logger.error("Failed to generate chart")
                return None
            
            # Calculate trading levels
            trading_levels = self.calculate_trading_levels(fib_levels, current_price, SYMBOL)
            
            # Prepare result
            result = {
                'symbol': SYMBOL,
                'timeframe': TIMEFRAME,
                'current_price': current_price,
                'swing_high': swing_high_price,
                'swing_low': swing_low_price,
                'fibonacci_levels': fib_levels,
                'trading_levels': trading_levels,
                'chart_filename': chart_filename,
                'timestamp': datetime.now()
            }
            
            logger.info(f"Fibonacci 0.618 retracement detected for {SYMBOL}")
            return result
            
        except Exception as e:
            logger.error(f"Error in detection: {e}")
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
            swing_high_idx, swing_low_idx = self.detect_swing_points_with_params(df, swing_lookback, min_move_percent)
            if swing_high_idx is None or swing_low_idx is None:
                logger.info(f"No valid swing points detected for {symbol}")
                return None
            
            # Get swing prices
            swing_high_price = df.loc[swing_high_idx, 'high']
            swing_low_price = df.loc[swing_low_idx, 'low']
            current_price = df['close'].iloc[-1]
            
            # Calculate Fibonacci levels
            fib_levels = self.calculate_fibonacci_levels(swing_high_price, swing_low_price)
            
            # Check for 0.618 retracement with custom margin
            if not self.check_618_retracement_with_params(current_price, fib_levels, margin):
                logger.info(f"Price ({current_price:.2f}) not at 0.618 level ({fib_levels[0.618]:.2f}) for {symbol}")
                return None
            
            # Generate chart
            chart_filename = self.generate_chart(df, swing_high_idx, swing_low_idx, fib_levels, current_price, symbol, timeframe)
            if not chart_filename:
                logger.error("Failed to generate chart")
                return None
            
            # Calculate trading levels
            trading_levels = self.calculate_trading_levels(fib_levels, current_price, symbol)
            
            # Prepare result
            result = {
                'symbol': symbol,
                'timeframe': timeframe,
                'current_price': current_price,
                'swing_high': swing_high_price,
                'swing_low': swing_low_price,
                'fibonacci_levels': fib_levels,
                'trading_levels': trading_levels,
                'chart_filename': chart_filename,
                'timestamp': datetime.now()
            }
            
            # Open position if position manager is available
            if self.position_manager:
                position_id = self.position_manager.open_position(result)
                if position_id:
                    result['position_id'] = position_id
                    logger.info(f"Position opened: {position_id}")
            
            logger.info(f"Fibonacci 0.618 retracement detected for {symbol}")
            return result
            
        except Exception as e:
            logger.error(f"Error in detection for {symbol}: {e}")
            return None
    
    def detect_swing_points_with_params(self, df: pd.DataFrame, lookback: int, min_move_percent: float) -> Tuple[Optional[int], Optional[int]]:
        """Detect swing high and swing low points with custom parameters"""
        if len(df) < lookback:
            return None, None
        
        # Get the most recent data
        recent_data = df.tail(lookback).copy()
        
        # Find the highest high and lowest low in the lookback period
        swing_high_idx = recent_data['high'].idxmax()
        swing_low_idx = recent_data['low'].idxmin()
        swing_high_price = recent_data.loc[swing_high_idx, 'high']
        swing_low_price = recent_data.loc[swing_low_idx, 'low']
        
        # Determine trend direction based on which came first
        if swing_high_idx < swing_low_idx:
            # Downtrend: High -> Low
            trend = "DOWN"
            # For downtrend, we calculate retracements from swing low back up
            # The swing high becomes our "100%" level, swing low becomes "0%"
            # But we need to find the most recent swing high before the swing low
            before_low = recent_data.loc[:swing_low_idx]
            if not before_low.empty:
                swing_high_idx = before_low['high'].idxmax()
                swing_high_price = recent_data.loc[swing_high_idx, 'high']
        else:
            # Uptrend: Low -> High
            trend = "UP"
            # For uptrend, we calculate retracements from swing high back down
            # The swing low becomes our "0%" level, swing high becomes "100%"
            # But we need to find the most recent swing low before the swing high
            before_high = recent_data.loc[:swing_high_idx]
            if not before_high.empty:
                swing_low_idx = before_high['low'].idxmin()
                swing_low_price = recent_data.loc[swing_low_idx, 'low']
        
        # Calculate the move percentage
        move_percent = abs(swing_high_price - swing_low_price) / swing_low_price * 100
        
        # Check if the move is significant enough
        if move_percent < min_move_percent * 100:
            logger.info(f"Move percentage ({move_percent:.2f}%) below minimum threshold ({min_move_percent * 100:.2f}%)")
            return None, None
        
        logger.info(f"Detected {trend} trend: Swing High ${swing_high_price:.2f} at {swing_high_idx}, Swing Low ${swing_low_price:.2f} at {swing_low_idx}, Move: {move_percent:.2f}%")
        
        return swing_high_idx, swing_low_idx
    
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
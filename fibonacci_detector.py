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

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FibonacciDetector:
    def __init__(self):
        self.last_alert_time = None
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
        """Fetch candlestick data from Binance API"""
        try:
            url = "https://api.binance.com/api/v3/klines"
            params = {
                'symbol': symbol,
                'interval': interval,
                'limit': limit
            }
            
            response = requests.get(url, params=params)
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
            return df
            
        except Exception as e:
            logger.error(f"Error fetching data from Binance: {e}")
            return pd.DataFrame()
    
    def detect_swing_points(self, df: pd.DataFrame, lookback: int = 50) -> Tuple[Optional[int], Optional[int]]:
        """Detect swing high and swing low points"""
        if len(df) < lookback:
            return None, None
        
        # Get the most recent data
        recent_data = df.tail(lookback).copy()
        
        # Find swing high (highest point in the lookback period)
        swing_high_idx = recent_data['high'].idxmax()
        swing_high_price = recent_data.loc[swing_high_idx, 'high']
        
        # Find swing low (lowest point in the lookback period)
        swing_low_idx = recent_data['low'].idxmin()
        swing_low_price = recent_data.loc[swing_low_idx, 'low']
        
        # Ensure swing high comes before swing low for downtrend
        if swing_high_idx > swing_low_idx:
            # Look for the most recent swing high before the swing low
            before_low = recent_data.loc[:swing_low_idx]
            if not before_low.empty:
                swing_high_idx = before_low['high'].idxmax()
                swing_high_price = recent_data.loc[swing_high_idx, 'high']
        
        # Calculate the move percentage
        move_percent = abs(swing_high_price - swing_low_price) / swing_low_price
        
        # Check if the move is significant enough
        if move_percent < MIN_MOVE_PERCENT:
            logger.info(f"Move percentage ({move_percent:.2%}) below minimum threshold ({MIN_MOVE_PERCENT:.2%})")
            return None, None
        
        return swing_high_idx, swing_low_idx
    
    def calculate_fibonacci_levels(self, swing_high: float, swing_low: float) -> Dict[float, float]:
        """Calculate Fibonacci retracement levels"""
        diff = swing_high - swing_low
        levels = {}
        
        for fib_level in FIBONACCI_LEVELS.keys():
            if fib_level == 0.0:
                levels[fib_level] = swing_low
            elif fib_level == 1.0:
                levels[fib_level] = swing_high
            else:
                levels[fib_level] = swing_high - (diff * fib_level)
        
        return levels
    
    def check_618_retracement(self, current_price: float, fib_levels: Dict[float, float]) -> bool:
        """Check if current price is at the 0.618 Fibonacci level"""
        target_level = fib_levels[0.618]
        tolerance = target_level * MARGIN
        
        lower_bound = target_level - tolerance
        upper_bound = target_level + tolerance
        
        return lower_bound <= current_price <= upper_bound
    
    def generate_chart(self, df: pd.DataFrame, swing_high_idx: str, swing_low_idx: str, 
                      fib_levels: Dict[float, float], current_price: float) -> str:
        """Generate a chart with Fibonacci levels and save as image"""
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
            
            # Draw Fibonacci levels
            swing_high_price = fib_levels[1.0]
            swing_low_price = fib_levels[0.0]
            
            # Draw diagonal line from swing high to swing low
            swing_high_pos = plot_data.index.get_loc(swing_high_idx) if swing_high_idx in plot_data.index else 0
            swing_low_pos = plot_data.index.get_loc(swing_low_idx) if swing_low_idx in plot_data.index else len(plot_data) - 1
            
            ax.plot([swing_high_pos, swing_low_pos], [swing_high_price, swing_low_price], 
                   color=CHART_COLORS['fibonacci_line'], linestyle='--', linewidth=2, alpha=0.7)
            
            # Draw horizontal Fibonacci level lines
            for level, price in fib_levels.items():
                color = CHART_COLORS['fibonacci_levels'][level]
                label = f"{FIBONACCI_LEVELS[level]} ({price:.2f})"
                
                ax.axhline(y=price, color=color, linestyle='-', linewidth=2, alpha=0.8, label=label)
                
                # Add colored background band for each level
                ax.axhspan(price * 0.999, price * 1.001, alpha=0.1, color=color)
            
            # Mark current price
            current_pos = len(plot_data) - 1
            ax.axhline(y=current_price, color='yellow', linestyle=':', linewidth=2, alpha=0.8, label=f'Current Price ({current_price:.2f})')
            
            # Customize chart
            ax.set_title(f'{SYMBOL} Fibonacci Retracement - {TIMEFRAME}', 
                        color=CHART_COLORS['text'], fontsize=14, fontweight='bold')
            ax.set_xlabel('Time', color=CHART_COLORS['text'])
            ax.set_ylabel('Price (USDT)', color=CHART_COLORS['text'])
            
            # Format x-axis
            ax.set_xticks(range(0, len(plot_data), len(plot_data) // 10))
            ax.set_xticklabels([plot_data.index[i].strftime('%H:%M') for i in range(0, len(plot_data), len(plot_data) // 10)], 
                              rotation=45, color=CHART_COLORS['text'])
            
            # Add legend
            ax.legend(loc='upper left', bbox_to_anchor=(1, 1), fontsize=10)
            
            # Add grid
            ax.grid(True, alpha=0.3, color=CHART_COLORS['grid'])
            
            # Set background color
            ax.set_facecolor(CHART_COLORS['background'])
            
            # Adjust layout
            plt.tight_layout()
            
            # Save chart
            filename = f"fibonacci_chart_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            plt.savefig(filename, facecolor=CHART_COLORS['background'], bbox_inches='tight', dpi=DPI)
            plt.close()
            
            return filename
            
        except Exception as e:
            logger.error(f"Error generating chart: {e}")
            return None
    
    def calculate_trading_levels(self, fib_levels: Dict[float, float], current_price: float) -> Dict[str, float]:
        """Calculate suggested entry, take profit, and stop loss levels"""
        entry = current_price
        target_level = fib_levels[0.618]
        
        # Calculate levels based on the setup
        if current_price <= target_level:  # Price is at or below 0.618 level
            # Long setup
            entry = current_price
            tp1 = fib_levels[0.5]  # 50% retracement
            tp2 = fib_levels[0.382]  # 38.2% retracement
            tp3 = fib_levels[0.236]  # 23.6% retracement
            sl = fib_levels[0.786]  # Stop loss below 78.6% level
        else:
            # Short setup (if price is above 0.618)
            entry = current_price
            tp1 = fib_levels[0.786]  # 78.6% retracement
            tp2 = fib_levels[1.0]  # 100% retracement
            tp3 = fib_levels[1.0] + (fib_levels[1.0] - fib_levels[0.786])  # Extension
            sl = fib_levels[0.5]  # Stop loss at 50% level
        
        return {
            'entry': entry,
            'tp1': tp1,
            'tp2': tp2,
            'tp3': tp3,
            'sl': sl
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
            chart_filename = self.generate_chart(df, swing_high_idx, swing_low_idx, fib_levels, current_price)
            if not chart_filename:
                logger.error("Failed to generate chart")
                return None
            
            # Calculate trading levels
            trading_levels = self.calculate_trading_levels(fib_levels, current_price)
            
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
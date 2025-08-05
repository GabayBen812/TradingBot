#!/usr/bin/env python3
"""
Strategy Detector - Multi-Strategy Trading Bot

This module detects various trading strategies including:
- Support/Resistance breaks
- Moving Average crossovers
- RSI divergences
- MACD crossovers
- Bollinger Band squeezes
- Volume spikes
- Pattern recognition (Head & Shoulders, Double tops/bottoms)
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import requests
import json
from typing import Dict, List, Optional, Tuple
import logging
from dataclasses import dataclass

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class StrategyConfig:
    """Configuration for a trading strategy"""
    name: str
    symbol: str
    timeframe: str
    enabled: bool = True
    parameters: Dict = None

class StrategyDetector:
    """Main strategy detection class"""
    
    def __init__(self):
        self.setup_matplotlib()
    
    def setup_matplotlib(self):
        """Configure matplotlib for dark theme"""
        plt.style.use('dark_background')
        plt.rcParams['figure.facecolor'] = '#1a1a1a'
        plt.rcParams['axes.facecolor'] = '#1a1a1a'
        plt.rcParams['text.color'] = '#ffffff'
    
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
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate technical indicators"""
        df = df.copy()
        
        # Moving Averages
        df['sma_20'] = df['close'].rolling(window=20).mean()
        df['sma_50'] = df['close'].rolling(window=50).mean()
        df['ema_12'] = df['close'].ewm(span=12).mean()
        df['ema_26'] = df['close'].ewm(span=26).mean()
        
        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # MACD
        df['macd'] = df['ema_12'] - df['ema_26']
        df['macd_signal'] = df['macd'].ewm(span=9).mean()
        df['macd_histogram'] = df['macd'] - df['macd_signal']
        
        # Bollinger Bands
        df['bb_middle'] = df['close'].rolling(window=20).mean()
        bb_std = df['close'].rolling(window=20).std()
        df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
        df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
        
        # Volume indicators
        df['volume_sma'] = df['volume'].rolling(window=20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_sma']
        
        return df
    
    def detect_support_resistance_break(self, df: pd.DataFrame) -> Optional[Dict]:
        """Detect support/resistance breaks"""
        try:
            if len(df) < 50:
                return None
            
            current_price = df['close'].iloc[-1]
            current_volume = df['volume'].iloc[-1]
            avg_volume = df['volume'].rolling(window=20).mean().iloc[-1]
            
            # Find recent support and resistance levels
            recent_highs = df['high'].tail(20).nlargest(3)
            recent_lows = df['low'].tail(20).nsmallest(3)
            
            resistance_level = recent_highs.mean()
            support_level = recent_lows.mean()
            
            # Check for breaks
            break_up = current_price > resistance_level * 1.001  # 0.1% above resistance
            break_down = current_price < support_level * 0.999   # 0.1% below support
            
            if break_up and current_volume > avg_volume * 1.5:
                return {
                    'strategy': 'Support/Resistance Break',
                    'type': 'BULLISH',
                    'signal': 'Resistance Break',
                    'price': current_price,
                    'level': resistance_level,
                    'volume_ratio': current_volume / avg_volume,
                    'confidence': 'HIGH' if current_volume > avg_volume * 2 else 'MEDIUM'
                }
            elif break_down and current_volume > avg_volume * 1.5:
                return {
                    'strategy': 'Support/Resistance Break',
                    'type': 'BEARISH',
                    'signal': 'Support Break',
                    'price': current_price,
                    'level': support_level,
                    'volume_ratio': current_volume / avg_volume,
                    'confidence': 'HIGH' if current_volume > avg_volume * 2 else 'MEDIUM'
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in support/resistance detection: {e}")
            return None
    
    def detect_ma_crossover(self, df: pd.DataFrame) -> Optional[Dict]:
        """Detect moving average crossovers"""
        try:
            if len(df) < 50:
                return None
            
            current_price = df['close'].iloc[-1]
            sma_20 = df['sma_20'].iloc[-1]
            sma_50 = df['sma_50'].iloc[-1]
            ema_12 = df['ema_12'].iloc[-1]
            ema_26 = df['ema_26'].iloc[-1]
            
            # Previous values
            sma_20_prev = df['sma_20'].iloc[-2]
            sma_50_prev = df['sma_50'].iloc[-2]
            ema_12_prev = df['ema_12'].iloc[-2]
            ema_26_prev = df['ema_26'].iloc[-2]
            
            # Check for crossovers
            sma_bullish = sma_20 > sma_50 and sma_20_prev <= sma_50_prev
            sma_bearish = sma_20 < sma_50 and sma_20_prev >= sma_50_prev
            ema_bullish = ema_12 > ema_26 and ema_12_prev <= ema_26_prev
            ema_bearish = ema_12 < ema_26 and ema_12_prev >= ema_26_prev
            
            if sma_bullish or ema_bullish:
                return {
                    'strategy': 'Moving Average Crossover',
                    'type': 'BULLISH',
                    'signal': 'Golden Cross',
                    'price': current_price,
                    'sma_cross': sma_bullish,
                    'ema_cross': ema_bullish,
                    'confidence': 'HIGH' if sma_bullish and ema_bullish else 'MEDIUM'
                }
            elif sma_bearish or ema_bearish:
                return {
                    'strategy': 'Moving Average Crossover',
                    'type': 'BEARISH',
                    'signal': 'Death Cross',
                    'price': current_price,
                    'sma_cross': sma_bearish,
                    'ema_cross': ema_bearish,
                    'confidence': 'HIGH' if sma_bearish and ema_bearish else 'MEDIUM'
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in MA crossover detection: {e}")
            return None
    
    def detect_rsi_divergence(self, df: pd.DataFrame) -> Optional[Dict]:
        """Detect RSI divergences"""
        try:
            if len(df) < 30:
                return None
            
            # Get recent price and RSI data
            recent_prices = df['close'].tail(20)
            recent_rsi = df['rsi'].tail(20)
            
            # Find peaks and troughs
            price_peaks = self._find_peaks(recent_prices.values)
            rsi_peaks = self._find_peaks(recent_rsi.values)
            
            if len(price_peaks) >= 2 and len(rsi_peaks) >= 2:
                # Check for bearish divergence (price higher, RSI lower)
                if (recent_prices.iloc[price_peaks[-1]] > recent_prices.iloc[price_peaks[-2]] and
                    recent_rsi.iloc[rsi_peaks[-1]] < recent_rsi.iloc[rsi_peaks[-2]]):
                    return {
                        'strategy': 'RSI Divergence',
                        'type': 'BEARISH',
                        'signal': 'Bearish Divergence',
                        'price': df['close'].iloc[-1],
                        'rsi': df['rsi'].iloc[-1],
                        'confidence': 'HIGH'
                    }
                
                # Check for bullish divergence (price lower, RSI higher)
                if (recent_prices.iloc[price_peaks[-1]] < recent_prices.iloc[price_peaks[-2]] and
                    recent_rsi.iloc[rsi_peaks[-1]] > recent_rsi.iloc[rsi_peaks[-2]]):
                    return {
                        'strategy': 'RSI Divergence',
                        'type': 'BULLISH',
                        'signal': 'Bullish Divergence',
                        'price': df['close'].iloc[-1],
                        'rsi': df['rsi'].iloc[-1],
                        'confidence': 'HIGH'
                    }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in RSI divergence detection: {e}")
            return None
    
    def detect_macd_crossover(self, df: pd.DataFrame) -> Optional[Dict]:
        """Detect MACD crossovers"""
        try:
            if len(df) < 30:
                return None
            
            current_macd = df['macd'].iloc[-1]
            current_signal = df['macd_signal'].iloc[-1]
            prev_macd = df['macd'].iloc[-2]
            prev_signal = df['macd_signal'].iloc[-2]
            
            # Check for crossovers
            bullish_cross = current_macd > current_signal and prev_macd <= prev_signal
            bearish_cross = current_macd < current_signal and prev_macd >= prev_signal
            
            if bullish_cross:
                return {
                    'strategy': 'MACD Crossover',
                    'type': 'BULLISH',
                    'signal': 'MACD Bullish Cross',
                    'price': df['close'].iloc[-1],
                    'macd': current_macd,
                    'signal_line': current_signal,
                    'confidence': 'HIGH' if abs(current_macd - current_signal) > 0.1 else 'MEDIUM'
                }
            elif bearish_cross:
                return {
                    'strategy': 'MACD Crossover',
                    'type': 'BEARISH',
                    'signal': 'MACD Bearish Cross',
                    'price': df['close'].iloc[-1],
                    'macd': current_macd,
                    'signal_line': current_signal,
                    'confidence': 'HIGH' if abs(current_macd - current_signal) > 0.1 else 'MEDIUM'
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in MACD crossover detection: {e}")
            return None
    
    def detect_bollinger_squeeze(self, df: pd.DataFrame) -> Optional[Dict]:
        """Detect Bollinger Band squeezes"""
        try:
            if len(df) < 20:
                return None
            
            current_price = df['close'].iloc[-1]
            bb_upper = df['bb_upper'].iloc[-1]
            bb_lower = df['bb_lower'].iloc[-1]
            bb_middle = df['bb_middle'].iloc[-1]
            
            # Calculate bandwidth
            bandwidth = (bb_upper - bb_lower) / bb_middle
            
            # Check if bands are squeezing (low bandwidth)
            is_squeeze = bandwidth < 0.05  # 5% bandwidth threshold
            
            # Check for breakout
            breakout_up = current_price > bb_upper
            breakout_down = current_price < bb_lower
            
            if is_squeeze:
                return {
                    'strategy': 'Bollinger Band Squeeze',
                    'type': 'NEUTRAL',
                    'signal': 'Squeeze Detected',
                    'price': current_price,
                    'bandwidth': bandwidth,
                    'upper_band': bb_upper,
                    'lower_band': bb_lower,
                    'confidence': 'HIGH' if bandwidth < 0.03 else 'MEDIUM'
                }
            elif breakout_up:
                return {
                    'strategy': 'Bollinger Band Breakout',
                    'type': 'BULLISH',
                    'signal': 'Upper Band Breakout',
                    'price': current_price,
                    'bandwidth': bandwidth,
                    'upper_band': bb_upper,
                    'confidence': 'HIGH'
                }
            elif breakout_down:
                return {
                    'strategy': 'Bollinger Band Breakout',
                    'type': 'BEARISH',
                    'signal': 'Lower Band Breakout',
                    'price': current_price,
                    'bandwidth': bandwidth,
                    'lower_band': bb_lower,
                    'confidence': 'HIGH'
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in Bollinger Band detection: {e}")
            return None
    
    def _find_peaks(self, data: np.ndarray, window: int = 3) -> List[int]:
        """Find peaks in data"""
        peaks = []
        for i in range(window, len(data) - window):
            if all(data[i] >= data[i-j] for j in range(1, window+1)) and \
               all(data[i] >= data[i+j] for j in range(1, window+1)):
                peaks.append(i)
        return peaks
    
    def detect_strat_strategy(self, df: pd.DataFrame) -> Optional[Dict]:
        """Detect Rob Smith's 'strat' strategy patterns"""
        try:
            if len(df) < 50:
                return None
            
            current_price = df['close'].iloc[-1]
            current_volume = df['volume'].iloc[-1]
            avg_volume = df['volume'].rolling(window=20).mean().iloc[-1]
            
            # Get recent price action
            recent_high = df['high'].tail(10).max()
            recent_low = df['low'].tail(10).min()
            price_range = recent_high - recent_low
            
            # Strat Strategy Components:
            # 1. Support/Resistance Level Break
            # 2. Volume Confirmation
            # 3. Trend Direction
            # 4. Risk/Reward Setup
            
            signals = []
            
            # Check for resistance break with volume
            if (current_price > recent_high * 0.995 and  # Price near recent high
                current_volume > avg_volume * 1.5 and     # Volume confirmation
                df['close'].iloc[-1] > df['close'].iloc[-2]):  # Price increasing
                
                signals.append({
                    'strategy': 'STRAT_BULLISH_BREAKOUT',
                    'type': 'BULLISH',
                    'confidence': 'HIGH' if current_volume > avg_volume * 2 else 'MEDIUM',
                    'price': current_price,
                    'volume_ratio': current_volume / avg_volume,
                    'breakout_level': recent_high,
                    'description': f"Bullish breakout above resistance {recent_high:.2f} with volume confirmation"
                })
            
            # Check for support break with volume
            elif (current_price < recent_low * 1.005 and  # Price near recent low
                  current_volume > avg_volume * 1.5 and     # Volume confirmation
                  df['close'].iloc[-1] < df['close'].iloc[-2]):  # Price decreasing
                
                signals.append({
                    'strategy': 'STRAT_BEARISH_BREAKOUT',
                    'type': 'BEARISH',
                    'confidence': 'HIGH' if current_volume > avg_volume * 2 else 'MEDIUM',
                    'price': current_price,
                    'volume_ratio': current_volume / avg_volume,
                    'breakout_level': recent_low,
                    'description': f"Bearish breakdown below support {recent_low:.2f} with volume confirmation"
                })
            
            # Check for pullback to support/resistance
            elif (abs(current_price - recent_high) / price_range < 0.1 or  # Near resistance
                  abs(current_price - recent_low) / price_range < 0.1):     # Near support
                
                if current_volume > avg_volume * 1.3:  # Volume spike
                    signal_type = 'STRAT_SUPPORT_BOUNCE' if current_price > recent_low else 'STRAT_RESISTANCE_REJECTION'
                    direction = 'BULLISH' if current_price > recent_low else 'BEARISH'
                    
                    signals.append({
                        'strategy': signal_type,
                        'type': direction,
                        'confidence': 'MEDIUM',
                        'price': current_price,
                        'volume_ratio': current_volume / avg_volume,
                        'level': recent_low if current_price > recent_low else recent_high,
                        'description': f"{direction.lower()} reaction at key level with volume"
                    })
            
            # Check for trend continuation
            if len(signals) > 0:
                # Add trend analysis
                sma_20 = df['sma_20'].iloc[-1]
                sma_50 = df['sma_50'].iloc[-1]
                
                if current_price > sma_20 > sma_50:
                    signals[-1]['trend'] = 'UPTREND'
                    signals[-1]['confidence'] = 'HIGH'
                elif current_price < sma_20 < sma_50:
                    signals[-1]['trend'] = 'DOWNTREND'
                    signals[-1]['confidence'] = 'HIGH'
                else:
                    signals[-1]['trend'] = 'SIDEWAYS'
            
            return signals[0] if signals else None
            
        except Exception as e:
            logger.error(f"Error in strat strategy detection: {e}")
            return None

    def run_strategy_detection(self, symbol: str, timeframe: str) -> List[Dict]:
        """Run all strategy detections"""
        try:
            # Fetch data
            df = self.get_binance_data(symbol, timeframe, 100)
            if df.empty:
                logger.error(f"Failed to fetch data for {symbol}")
                return []
            
            # Calculate indicators
            df = self.calculate_indicators(df)
            
            # Run all strategy detections
            signals = []
            
            # Support/Resistance breaks
            signal = self.detect_support_resistance_break(df)
            if signal:
                signals.append(signal)
            
            # MA crossovers
            signal = self.detect_ma_crossover(df)
            if signal:
                signals.append(signal)
            
            # RSI divergences
            signal = self.detect_rsi_divergence(df)
            if signal:
                signals.append(signal)
            
            # MACD crossovers
            signal = self.detect_macd_crossover(df)
            if signal:
                signals.append(signal)
            
            # Bollinger Band squeezes
            signal = self.detect_bollinger_squeeze(df)
            if signal:
                signals.append(signal)
            
            # Strat Strategy (Rob Smith)
            signal = self.detect_strat_strategy(df)
            if signal:
                signals.append(signal)
            
            return signals
            
        except Exception as e:
            logger.error(f"Error in strategy detection for {symbol}: {e}")
            return []

if __name__ == "__main__":
    # Test the strategy detector
    detector = StrategyDetector()
    signals = detector.run_strategy_detection("SOLUSDT", "1h")
    
    print(f"Found {len(signals)} signals:")
    for signal in signals:
        print(f"- {signal['strategy']}: {signal['signal']} ({signal['type']})") 
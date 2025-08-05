#!/usr/bin/env python3
"""
Test Script for Strat Strategy (Rob Smith)

This script tests the strat strategy implementation to ensure it's working correctly.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from strategy_detector import StrategyDetector
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_strat_strategy():
    """Test the strat strategy detection"""
    print("🧪 Testing Strat Strategy (Rob Smith) Implementation")
    print("=" * 60)
    
    detector = StrategyDetector()
    
    # Test symbols and timeframes
    test_configs = [
        ("SOLUSDT", "1h"),
        ("BTCUSDT", "1h"),
        ("ETHUSDT", "1h"),
        ("SOLUSDT", "4h"),
        ("BTCUSDT", "4h")
    ]
    
    for symbol, timeframe in test_configs:
        print(f"\n🔍 Testing {symbol} on {timeframe} timeframe...")
        
        try:
            # Fetch data
            df = detector.get_binance_data(symbol, timeframe, 100)
            if df.empty:
                print(f"❌ Failed to fetch data for {symbol}")
                continue
            
            print(f"✅ Data fetched: {len(df)} candles")
            
            # Calculate indicators
            df = detector.calculate_indicators(df)
            print(f"✅ Indicators calculated")
            
            # Test strat strategy specifically
            strat_signal = detector.detect_strat_strategy(df)
            
            if strat_signal:
                print(f"🚨 STRAT STRATEGY SIGNAL DETECTED!")
                print(f"   Strategy: {strat_signal['strategy']}")
                print(f"   Type: {strat_signal['type']}")
                print(f"   Confidence: {strat_signal['confidence']}")
                print(f"   Price: ${strat_signal['price']:.2f}")
                print(f"   Volume Ratio: {strat_signal['volume_ratio']:.2f}x")
                if 'trend' in strat_signal:
                    print(f"   Trend: {strat_signal['trend']}")
                print(f"   Description: {strat_signal['description']}")
            else:
                print(f"ℹ️  No strat strategy signal detected")
            
            # Test all strategies
            all_signals = detector.run_strategy_detection(symbol, timeframe)
            strat_signals = [s for s in all_signals if 'STRAT_' in s.get('strategy', '')]
            
            print(f"📊 Total signals: {len(all_signals)}")
            print(f"📊 Strat signals: {len(strat_signals)}")
            
        except Exception as e:
            print(f"❌ Error testing {symbol}: {e}")
    
    print("\n" + "=" * 60)
    print("✅ Strat Strategy Testing Complete!")

if __name__ == "__main__":
    test_strat_strategy() 
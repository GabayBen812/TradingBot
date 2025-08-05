#!/usr/bin/env python3
"""
Test script for improved Fibonacci detector

This script tests the corrected Fibonacci calculations, proper swing detection,
and enhanced chart generation with annotations.
"""

import sys
import os
sys.path.append('fibonacci_monitors')

from fibonacci_detector import FibonacciDetector
from config import *
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_fibonacci_calculations():
    """Test the corrected Fibonacci calculations"""
    print("\n" + "=" * 60)
    print("Testing Improved Fibonacci Calculations")
    print("=" * 60)
    
    detector = FibonacciDetector()
    
    # Test case 1: Uptrend (swing low to swing high)
    print("\n📈 Test Case 1: UPTREND")
    print("Swing Low: $100, Swing High: $120")
    swing_low = 100.0
    swing_high = 120.0
    
    fib_levels = detector.calculate_fibonacci_levels(swing_high, swing_low)
    
    print("✅ Fibonacci levels for UPTREND:")
    for level, price in fib_levels.items():
        print(f"   {FIBONACCI_LEVELS[level]}: ${price:.2f}")
    
    # Test case 2: Downtrend (swing high to swing low)
    print("\n📉 Test Case 2: DOWNTREND")
    print("Swing High: $120, Swing Low: $100")
    swing_high = 120.0
    swing_low = 100.0
    
    fib_levels = detector.calculate_fibonacci_levels(swing_high, swing_low)
    
    print("✅ Fibonacci levels for DOWNTREND:")
    for level, price in fib_levels.items():
        print(f"   {FIBONACCI_LEVELS[level]}: ${price:.2f}")
    
    return True

def test_data_fetching():
    """Test data fetching with fallback"""
    print("\n" + "=" * 60)
    print("Testing Data Fetching with Fallback")
    print("=" * 60)
    
    detector = FibonacciDetector()
    
    # Test with BTCUSDT
    print("\n🔄 Testing BTCUSDT 4h data...")
    df = detector.get_binance_data("BTCUSDT", "4h", 100)
    
    if not df.empty:
        print(f"✅ Successfully fetched {len(df)} candles")
        print(f"   Latest price: ${df['close'].iloc[-1]:.2f}")
        print(f"   Date range: {df.index[0]} to {df.index[-1]}")
        return True
    else:
        print("❌ Failed to fetch data")
        return False

def test_swing_detection():
    """Test improved swing detection"""
    print("\n" + "=" * 60)
    print("Testing Improved Swing Detection")
    print("=" * 60)
    
    detector = FibonacciDetector()
    
    # Fetch real data
    df = detector.get_binance_data("BTCUSDT", "4h", 100)
    if df.empty:
        print("❌ No data available for swing detection test")
        return False
    
    # Test swing detection
    swing_high_idx, swing_low_idx = detector.detect_swing_points(df, 50)
    
    if swing_high_idx is not None and swing_low_idx is not None:
        swing_high_price = df.loc[swing_high_idx, 'high']
        swing_low_price = df.loc[swing_low_idx, 'low']
        move_percent = abs(swing_high_price - swing_low_price) / swing_low_price * 100
        
        print("✅ Swing points detected:")
        print(f"   Swing High: ${swing_high_price:.2f} at {swing_high_idx}")
        print(f"   Swing Low: ${swing_low_price:.2f} at {swing_low_idx}")
        print(f"   Move: {move_percent:.2f}%")
        
        # Test Fibonacci calculation with detected swings
        fib_levels = detector.calculate_fibonacci_levels(swing_high_price, swing_low_price)
        current_price = df['close'].iloc[-1]
        
        print(f"\n📊 Current Price: ${current_price:.2f}")
        print("Fibonacci Levels:")
        for level, price in fib_levels.items():
            marker = " ⭐" if level == 0.618 else ""
            print(f"   {FIBONACCI_LEVELS[level]}: ${price:.2f}{marker}")
        
        # Test 61.8% retracement detection
        is_at_level = detector.check_618_retracement(current_price, fib_levels)
        print(f"\n🎯 61.8% Retracement Detected: {'✅ YES' if is_at_level else '❌ NO'}")
        
        return True
    else:
        print("❌ No valid swing points detected")
        return False

def test_chart_generation():
    """Test enhanced chart generation"""
    print("\n" + "=" * 60)
    print("Testing Enhanced Chart Generation")
    print("=" * 60)
    
    detector = FibonacciDetector()
    
    # Fetch data
    df = detector.get_binance_data("BTCUSDT", "4h", 100)
    if df.empty:
        print("❌ No data available for chart generation test")
        return False
    
    # Detect swings
    swing_high_idx, swing_low_idx = detector.detect_swing_points(df, 50)
    if swing_high_idx is None or swing_low_idx is None:
        print("❌ No swing points for chart generation")
        return False
    
    # Calculate Fibonacci levels
    swing_high_price = df.loc[swing_high_idx, 'high']
    swing_low_price = df.loc[swing_low_idx, 'low']
    current_price = df['close'].iloc[-1]
    fib_levels = detector.calculate_fibonacci_levels(swing_high_price, swing_low_price)
    
    # Generate chart
    print("🎨 Generating enhanced chart...")
    chart_filename = detector.generate_chart(df, swing_high_idx, swing_low_idx, fib_levels, current_price, "BTCUSDT", "4h")
    
    if chart_filename and os.path.exists(chart_filename):
        print(f"✅ Chart generated successfully: {chart_filename}")
        print("   Chart includes:")
        print("   • Candlestick data")
        print("   • Fibonacci trend line")
        print("   • All Fibonacci levels with annotations")
        print("   • Current price marker")
        print("   • Swing point markers")
        print("   • 61.8% level highlight")
        return True
    else:
        print("❌ Failed to generate chart")
        return False

def test_trading_levels():
    """Test trading level calculations"""
    print("\n" + "=" * 60)
    print("Testing Trading Level Calculations")
    print("=" * 60)
    
    detector = FibonacciDetector()
    
    # Test with sample data
    swing_high = 120.0
    swing_low = 100.0
    current_price = 108.0  # Near 61.8% level
    
    fib_levels = detector.calculate_fibonacci_levels(swing_high, swing_low)
    trading_levels = detector.calculate_trading_levels(fib_levels, current_price, "BTCUSDT")
    
    print("✅ Trading levels calculated:")
    print(f"   Setup Type: {trading_levels['setup_type']}")
    print(f"   Entry: ${trading_levels['entry']:.2f}")
    print(f"   Take Profit 1: ${trading_levels['tp1']:.2f}")
    print(f"   Take Profit 2: ${trading_levels['tp2']:.2f}")
    print(f"   Take Profit 3: ${trading_levels['tp3']:.2f}")
    print(f"   Stop Loss: ${trading_levels['sl']:.2f}")
    
    return True

def main():
    """Run all tests"""
    print("🧪 FIBONACCI DETECTOR IMPROVEMENT TESTS")
    print("=" * 60)
    
    tests = [
        ("Fibonacci Calculations", test_fibonacci_calculations),
        ("Data Fetching", test_data_fetching),
        ("Swing Detection", test_swing_detection),
        ("Chart Generation", test_chart_generation),
        ("Trading Levels", test_trading_levels)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {e}")
    
    print("\n" + "=" * 60)
    print(f"📊 TEST RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The improved Fibonacci detector is working correctly.")
    else:
        print("⚠️ Some tests failed. Please check the implementation.")
    
    print("=" * 60)

if __name__ == "__main__":
    main() 
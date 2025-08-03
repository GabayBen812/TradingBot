#!/usr/bin/env python3
"""
Test script for Fibonacci Retracement Detection Bot

This script tests individual components of the bot without running the full monitoring loop.
Useful for debugging and verifying functionality.
"""

import logging
from datetime import datetime
from fibonacci_detector import FibonacciDetector
from discord_notifier import DiscordNotifier
from config import *

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_data_fetching():
    """Test data fetching from Binance"""
    print("=" * 50)
    print("Testing Data Fetching...")
    print("=" * 50)
    
    detector = FibonacciDetector()
    df = detector.get_binance_data(SYMBOL, TIMEFRAME, 100)
    
    if not df.empty:
        print(f"✅ Successfully fetched {len(df)} candles for {SYMBOL}")
        print(f"Latest price: ${df['close'].iloc[-1]:.2f}")
        print(f"Data range: {df.index[0]} to {df.index[-1]}")
        return True
    else:
        print("❌ Failed to fetch data")
        return False

def test_swing_detection():
    """Test swing point detection"""
    print("\n" + "=" * 50)
    print("Testing Swing Detection...")
    print("=" * 50)
    
    detector = FibonacciDetector()
    df = detector.get_binance_data(SYMBOL, TIMEFRAME, 200)
    
    if df.empty:
        print("❌ No data available for swing detection test")
        return False
    
    swing_high_idx, swing_low_idx = detector.detect_swing_points(df, SWING_LOOKBACK)
    
    if swing_high_idx and swing_low_idx:
        swing_high_price = df.loc[swing_high_idx, 'high']
        swing_low_price = df.loc[swing_low_idx, 'low']
        move_percent = abs(swing_high_price - swing_low_price) / swing_low_price * 100
        
        print(f"✅ Swing points detected:")
        print(f"   Swing High: ${swing_high_price:.2f} at {swing_high_idx}")
        print(f"   Swing Low: ${swing_low_price:.2f} at {swing_low_idx}")
        print(f"   Move: {move_percent:.2f}%")
        return True
    else:
        print("❌ No valid swing points detected")
        return False

def test_fibonacci_calculation():
    """Test Fibonacci level calculations"""
    print("\n" + "=" * 50)
    print("Testing Fibonacci Calculations...")
    print("=" * 50)
    
    detector = FibonacciDetector()
    swing_high = 100.0
    swing_low = 80.0
    
    fib_levels = detector.calculate_fibonacci_levels(swing_high, swing_low)
    
    print("✅ Fibonacci levels calculated:")
    for level, price in fib_levels.items():
        print(f"   {FIBONACCI_LEVELS[level]}: ${price:.2f}")
    
    return True

def test_chart_generation():
    """Test chart generation"""
    print("\n" + "=" * 50)
    print("Testing Chart Generation...")
    print("=" * 50)
    
    detector = FibonacciDetector()
    df = detector.get_binance_data(SYMBOL, TIMEFRAME, 200)
    
    if df.empty:
        print("❌ No data available for chart generation test")
        return False
    
    # Create dummy Fibonacci levels for testing
    swing_high = df['high'].max()
    swing_low = df['low'].min()
    fib_levels = detector.calculate_fibonacci_levels(swing_high, swing_low)
    current_price = df['close'].iloc[-1]
    
    # Generate test chart
    chart_filename = detector.generate_chart(
        df, 
        df.index[0], 
        df.index[-1], 
        fib_levels, 
        current_price
    )
    
    if chart_filename:
        print(f"✅ Chart generated successfully: {chart_filename}")
        return True
    else:
        print("❌ Failed to generate chart")
        return False

def test_discord_notification():
    """Test Discord notification"""
    print("\n" + "=" * 50)
    print("Testing Discord Notification...")
    print("=" * 50)
    
    if not DISCORD_WEBHOOK_URL:
        print("❌ Discord webhook URL not configured")
        return False
    
    notifier = DiscordNotifier()
    
    # Send test message
    if notifier.send_test_message():
        print("✅ Discord test message sent successfully")
        return True
    else:
        print("❌ Failed to send Discord test message")
        return False

def test_full_detection():
    """Test full detection process"""
    print("\n" + "=" * 50)
    print("Testing Full Detection Process...")
    print("=" * 50)
    
    detector = FibonacciDetector()
    result = detector.run_detection()
    
    if result:
        print("✅ Full detection completed successfully")
        print(f"   Symbol: {result['symbol']}")
        print(f"   Current Price: ${result['current_price']:.2f}")
        print(f"   Swing High: ${result['swing_high']:.2f}")
        print(f"   Swing Low: ${result['swing_low']:.2f}")
        print(f"   Chart: {result['chart_filename']}")
        return True
    else:
        print("ℹ️ No Fibonacci 0.618 retracement detected (this is normal)")
        return True

def main():
    """Run all tests"""
    print("🧪 FIBONACCI BOT TEST SUITE")
    print("=" * 60)
    
    tests = [
        ("Data Fetching", test_data_fetching),
        ("Swing Detection", test_swing_detection),
        ("Fibonacci Calculation", test_fibonacci_calculation),
        ("Chart Generation", test_chart_generation),
        ("Discord Notification", test_discord_notification),
        ("Full Detection", test_full_detection)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"❌ {test_name} failed with error: {e}")
    
    print("\n" + "=" * 60)
    print(f"TEST RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Bot is ready to run.")
    else:
        print("⚠️ Some tests failed. Please check the configuration.")
    
    print("=" * 60)

if __name__ == "__main__":
    main() 
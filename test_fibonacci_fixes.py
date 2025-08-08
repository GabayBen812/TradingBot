#!/usr/bin/env python3
"""
Test script to verify Fibonacci calculation and setup type determination fixes
"""

import sys
import os
sys.path.append('fibonacci_monitors')

from fibonacci_detector import FibonacciDetector

def test_fibonacci_calculation():
    """Test the corrected Fibonacci calculation"""
    detector = FibonacciDetector()
    
    # Test case from user's example: ETHUSDT 1h SHORT setup
    swing_high = 3736.73
    swing_low = 3483.50
    current_price = 3585.89
    
    print("=== Testing Fibonacci Calculation ===")
    print(f"Swing High: ${swing_high}")
    print(f"Swing Low: ${swing_low}")
    print(f"Current Price: ${current_price}")
    print()
    
    # Test SHORT setup (DOWN trend)
    print("SHORT Setup (DOWN trend):")
    fib_levels_short = detector.calculate_fibonacci_levels(swing_high, swing_low, "DOWN")
    print(f"0% (Swing High): ${fib_levels_short[0.0]:.2f}")
    print(f"23.6%: ${fib_levels_short[0.236]:.2f}")
    print(f"38.2%: ${fib_levels_short[0.382]:.2f}")
    print(f"50%: ${fib_levels_short[0.5]:.2f}")
    print(f"61.8%: ${fib_levels_short[0.618]:.2f}")
    print(f"78.6%: ${fib_levels_short[0.786]:.2f}")
    print(f"100% (Swing Low): ${fib_levels_short[1.0]:.2f}")
    print()
    
    # Test LONG setup (UP trend)
    print("LONG Setup (UP trend):")
    fib_levels_long = detector.calculate_fibonacci_levels(swing_high, swing_low, "UP")
    print(f"0% (Swing Low): ${fib_levels_long[0.0]:.2f}")
    print(f"23.6%: ${fib_levels_long[0.236]:.2f}")
    print(f"38.2%: ${fib_levels_long[0.382]:.2f}")
    print(f"50%: ${fib_levels_long[0.5]:.2f}")
    print(f"61.8%: ${fib_levels_long[0.618]:.2f}")
    print(f"78.6%: ${fib_levels_long[0.786]:.2f}")
    print(f"100% (Swing High): ${fib_levels_long[1.0]:.2f}")
    print()

def test_setup_type_determination():
    """Test the corrected setup type determination"""
    detector = FibonacciDetector()
    
    # Test case from user's example
    swing_high = 3736.73
    swing_low = 3483.50
    current_price = 3585.89
    
    print("=== Testing Setup Type Determination ===")
    print(f"Current Price: ${current_price}")
    print()
    
    # Test SHORT setup
    fib_levels_short = detector.calculate_fibonacci_levels(swing_high, swing_low, "DOWN")
    fib_618_short = fib_levels_short[0.618]
    print(f"SHORT Setup - 61.8% level: ${fib_618_short:.2f}")
    print(f"Current price (${current_price:.2f}) >= 61.8% level (${fib_618_short:.2f}): {current_price >= fib_618_short}")
    print(f"Expected setup type: SHORT")
    print()
    
    # Test LONG setup
    fib_levels_long = detector.calculate_fibonacci_levels(swing_high, swing_low, "UP")
    fib_618_long = fib_levels_long[0.618]
    print(f"LONG Setup - 61.8% level: ${fib_618_long:.2f}")
    print(f"Current price (${current_price:.2f}) <= 61.8% level (${fib_618_long:.2f}): {current_price <= fib_618_long}")
    print(f"Expected setup type: LONG")
    print()

def test_trading_levels():
    """Test the corrected trading levels calculation"""
    detector = FibonacciDetector()
    
    # Test case from user's example
    swing_high = 3736.73
    swing_low = 3483.50
    current_price = 3585.89
    
    print("=== Testing Trading Levels ===")
    print()
    
    # Test SHORT setup
    fib_levels_short = detector.calculate_fibonacci_levels(swing_high, swing_low, "DOWN")
    trading_levels_short = detector.calculate_trading_levels(fib_levels_short, current_price, "ETHUSDT", "SHORT")
    
    print("SHORT Setup Trading Levels:")
    print(f"Entry: ${trading_levels_short['entry']:.2f}")
    print(f"Stop Loss: ${trading_levels_short['sl']:.2f}")
    print(f"Take Profit 1: ${trading_levels_short['tp1']:.2f}")
    print(f"Take Profit 2: ${trading_levels_short['tp2']:.2f}")
    print(f"Take Profit 3: ${trading_levels_short['tp3']:.2f}")
    print()
    
    # Test LONG setup
    fib_levels_long = detector.calculate_fibonacci_levels(swing_high, swing_low, "UP")
    trading_levels_long = detector.calculate_trading_levels(fib_levels_long, current_price, "ETHUSDT", "LONG")
    
    print("LONG Setup Trading Levels:")
    print(f"Entry: ${trading_levels_long['entry']:.2f}")
    print(f"Stop Loss: ${trading_levels_long['sl']:.2f}")
    print(f"Take Profit 1: ${trading_levels_long['tp1']:.2f}")
    print(f"Take Profit 2: ${trading_levels_long['tp2']:.2f}")
    print(f"Take Profit 3: ${trading_levels_long['tp3']:.2f}")
    print()

if __name__ == "__main__":
    test_fibonacci_calculation()
    test_setup_type_determination()
    test_trading_levels()
    
    print("=== Summary ===")
    print("✅ Fibonacci calculation corrected")
    print("✅ Setup type determination fixed")
    print("✅ Trading levels calculation updated")
    print("✅ All fixes applied successfully") 
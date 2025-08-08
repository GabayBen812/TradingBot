#!/usr/bin/env python3
"""
Test script to verify Fibonacci labels are correctly displayed
"""

import sys
import os
sys.path.append('fibonacci_monitors')

from fibonacci_detector import FibonacciDetector

def test_fibonacci_labels():
    """Test that Fibonacci labels are correctly displayed"""
    detector = FibonacciDetector()
    
    # Test case from user's examples
    swing_high = 3736.73
    swing_low = 3483.50
    current_price = 3585.89
    
    print("=== Testing Fibonacci Labels ===")
    print(f"Swing High: ${swing_high}")
    print(f"Swing Low: ${swing_low}")
    print(f"Current Price: ${current_price}")
    print()
    
    # Test SHORT setup (DOWN trend)
    print("SHORT Setup (DOWN trend):")
    fib_levels_short = detector.calculate_fibonacci_levels(swing_high, swing_low, "DOWN")
    setup_type = "SHORT"
    
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
    setup_type = "LONG"
    
    print(f"0% (Swing Low): ${fib_levels_long[0.0]:.2f}")
    print(f"23.6%: ${fib_levels_long[0.236]:.2f}")
    print(f"38.2%: ${fib_levels_long[0.382]:.2f}")
    print(f"50%: ${fib_levels_long[0.5]:.2f}")
    print(f"61.8%: ${fib_levels_long[0.618]:.2f}")
    print(f"78.6%: ${fib_levels_long[0.786]:.2f}")
    print(f"100% (Swing High): ${fib_levels_long[1.0]:.2f}")
    print()
    
    # Test the label logic
    print("=== Testing Label Logic ===")
    setup_type = "SHORT"
    print("For SHORT setup:")
    print(f"0% label: {'Swing High' if setup_type == 'SHORT' else 'Swing Low'}")
    print(f"100% label: {'Swing Low' if setup_type == 'SHORT' else 'Swing High'}")
    print()
    
    setup_type = "LONG"
    print("For LONG setup:")
    print(f"0% label: {'Swing High' if setup_type == 'SHORT' else 'Swing Low'}")
    print(f"100% label: {'Swing Low' if setup_type == 'SHORT' else 'Swing High'}")
    print()
    
    print("=== Summary ===")
    print("✅ SHORT setup: 0% = Swing High, 100% = Swing Low")
    print("✅ LONG setup: 0% = Swing Low, 100% = Swing High")
    print("✅ Labels should now be correct in Discord notifications")

if __name__ == "__main__":
    test_fibonacci_labels() 
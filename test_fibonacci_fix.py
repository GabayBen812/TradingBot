#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fibonacci_monitors'))

from fibonacci_monitors.fibonacci_detector import FibonacciDetector

def test_fibonacci_calculation():
    """Test the corrected Fibonacci calculation for SHORT setups"""
    
    # Create detector
    detector = FibonacciDetector()
    
    # Test case from user's example
    swing_high = 115096.73
    swing_low = 112650.00
    current_price = 113752.01
    
    print("=== Testing Fibonacci Calculation Fix ===")
    print(f"Swing High: ${swing_high:.2f}")
    print(f"Swing Low: ${swing_low:.2f}")
    print(f"Current Price: ${current_price:.2f}")
    print()
    
    # Test SHORT setup (DOWN trend)
    print("SHORT Setup (DOWN trend):")
    fib_levels_short = detector.calculate_fibonacci_levels(swing_high, swing_low, "DOWN")
    
    print("Fibonacci Levels:")
    for level, price in sorted(fib_levels_short.items()):
        level_name = f"{level*100:.0f}%" if level != 0.0 and level != 1.0 else f"{level*100:.0f}%"
        print(f"  {level_name}: ${price:.2f}")
    
    print()
    print(f"0.618 Level: ${fib_levels_short[0.618]:.2f}")
    print(f"User expected: ~$114,170")
    print(f"Difference: ${fib_levels_short[0.618] - 114170:.2f}")
    print()
    
    # Test LONG setup (UP trend)
    print("LONG Setup (UP trend):")
    fib_levels_long = detector.calculate_fibonacci_levels(swing_high, swing_low, "UP")
    
    print("Fibonacci Levels:")
    for level, price in sorted(fib_levels_long.items()):
        level_name = f"{level*100:.0f}%" if level != 0.0 and level != 1.0 else f"{level*100:.0f}%"
        print(f"  {level_name}: ${price:.2f}")
    
    print()
    print(f"0.618 Level: ${fib_levels_long[0.618]:.2f}")
    print()
    
    # Verify the fix
    expected_618_short = 112650.00 + (0.618 * (115096.73 - 112650.00))
    print(f"Expected 0.618 for SHORT: ${expected_618_short:.2f}")
    print(f"Calculated 0.618 for SHORT: ${fib_levels_short[0.618]:.2f}")
    print(f"Match: {abs(fib_levels_short[0.618] - expected_618_short) < 0.01}")
    
    # Check if current price is near 0.618 for SHORT
    margin = 0.1  # 10% margin
    price_range = swing_high - swing_low
    margin_amount = price_range * margin
    
    is_near_618 = abs(current_price - fib_levels_short[0.618]) <= margin_amount
    print(f"Current price near 0.618 for SHORT: {is_near_618}")
    print(f"Distance from 0.618: ${abs(current_price - fib_levels_short[0.618]):.2f}")
    print(f"Margin: ${margin_amount:.2f}")

if __name__ == "__main__":
    test_fibonacci_calculation() 
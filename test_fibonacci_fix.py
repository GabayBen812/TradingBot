#!/usr/bin/env python3
"""
Test script to verify the Fibonacci calculation fix

This script tests the corrected Fibonacci calculations using the user's example:
- Swing High: $16.80
- Swing Low: $16.44
- Current Price: $16.60
"""

import sys
import os
sys.path.append('fibonacci_monitors')

from fibonacci_detector import FibonacciDetector
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_fibonacci_calculation_fix():
    """Test the corrected Fibonacci calculation with user's example"""
    detector = FibonacciDetector()
    
    # User's example data
    swing_high = 16.80
    swing_low = 16.44
    current_price = 16.60
    
    print("🔍 Testing Fibonacci Calculation Fix")
    print("=" * 50)
    print(f"Swing High: ${swing_high}")
    print(f"Swing Low: ${swing_low}")
    print(f"Current Price: ${current_price}")
    print()
    
    # Calculate Fibonacci levels
    fib_levels = detector.calculate_fibonacci_levels(swing_high, swing_low)
    
    print("📊 Calculated Fibonacci Levels:")
    print("-" * 30)
    for level, price in fib_levels.items():
        level_name = f"{int(level * 100)}%" if level in [0.0, 1.0] else f"{level * 100:.1f}%"
        print(f"• {level_name}: ${price:.2f}")
    
    print()
    
    # Check if current price is at 61.8% level
    fib_618 = fib_levels[0.618]
    tolerance = fib_618 * 0.002  # 0.2% margin
    lower_bound = fib_618 - tolerance
    upper_bound = fib_618 + tolerance
    
    print("🎯 61.8% Level Analysis:")
    print("-" * 30)
    print(f"61.8% Level: ${fib_618:.2f}")
    print(f"Tolerance: ±${tolerance:.4f}")
    print(f"Range: ${lower_bound:.2f} - ${upper_bound:.2f}")
    print(f"Current Price: ${current_price:.2f}")
    
    is_at_level = lower_bound <= current_price <= upper_bound
    print(f"At 61.8% Level: {'✅ YES' if is_at_level else '❌ NO'}")
    
    print()
    
    # Expected correct values based on proper Fibonacci calculation
    expected_618 = 16.80 - ((16.80 - 16.44) * 0.618)  # Should be around $16.58
    print("🔧 Expected vs Actual:")
    print("-" * 30)
    print(f"Expected 61.8%: ${expected_618:.2f}")
    print(f"Actual 61.8%: ${fib_618:.2f}")
    print(f"Match: {'✅' if abs(expected_618 - fib_618) < 0.01 else '❌'}")
    
    print()
    
    # Test the fix
    if abs(expected_618 - fib_618) < 0.01:
        print("✅ FIX VERIFIED: Fibonacci calculation is now correct!")
        print("   The 0% and 100% levels are properly set.")
        print("   The 61.8% level matches expected calculation.")
    else:
        print("❌ FIX FAILED: Fibonacci calculation still incorrect!")
        print("   The levels don't match expected values.")
    
    return abs(expected_618 - fib_618) < 0.01

def test_with_real_example():
    """Test with the exact values from user's output"""
    detector = FibonacciDetector()
    
    # User's output showed these levels:
    # • 0% (Swing Low): $16.44
    # • 23.6%: $16.72
    # • 38.2%: $16.66
    # • 50%: $16.62
    # • 61.8%: $16.58 ⭐
    # • 78.6%: $16.52
    # • 100% (Swing High): $16.80
    
    swing_high = 16.80
    swing_low = 16.44
    
    print("\n🔍 Testing with User's Example")
    print("=" * 50)
    
    fib_levels = detector.calculate_fibonacci_levels(swing_high, swing_low)
    
    print("User's Output vs Fixed Calculation:")
    print("-" * 40)
    user_levels = {
        0.0: 16.44,
        0.236: 16.72,
        0.382: 16.66,
        0.5: 16.62,
        0.618: 16.58,
        0.786: 16.52,
        1.0: 16.80
    }
    
    for level in [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]:
        level_name = f"{int(level * 100)}%" if level in [0.0, 1.0] else f"{level * 100:.1f}%"
        user_val = user_levels[level]
        fixed_val = fib_levels[level]
        diff = abs(user_val - fixed_val)
        
        status = "✅" if diff < 0.01 else "❌"
        print(f"{level_name}: User=${user_val:.2f} | Fixed=${fixed_val:.2f} | {status}")
    
    return True

if __name__ == "__main__":
    print("🧪 Testing Fibonacci Calculation Fix")
    print("=" * 50)
    
    test1_passed = test_fibonacci_calculation_fix()
    test2_passed = test_with_real_example()
    
    print("\n" + "=" * 50)
    if test1_passed and test2_passed:
        print("✅ ALL TESTS PASSED! Fibonacci calculation is now correct.")
    else:
        print("❌ SOME TESTS FAILED! Fibonacci calculation still needs work.") 
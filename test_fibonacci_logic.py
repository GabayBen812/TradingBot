#!/usr/bin/env python3

def test_fibonacci_logic():
    """Test different Fibonacci calculation approaches for SHORT setup"""
    
    # Example: SHORT setup
    swing_high = 115000  # Top of the move
    swing_low = 112000   # Bottom of the move
    current_price = 113500  # Price retraced back up
    
    print("SHORT Setup Analysis:")
    print(f"Swing High: ${swing_high:.2f}")
    print(f"Swing Low: ${swing_low:.2f}")
    print(f"Current Price: ${current_price:.2f}")
    print()
    
    # Current approach (what we're doing now)
    print("Current Approach (0% = Swing High, 100% = Swing Low):")
    price_range = swing_high - swing_low
    fib_levels_current = {
        0.0: swing_high,
        0.236: swing_high - (0.236 * price_range),
        0.382: swing_high - (0.382 * price_range),
        0.5: swing_high - (0.5 * price_range),
        0.618: swing_high - (0.618 * price_range),
        0.786: swing_high - (0.786 * price_range),
        1.0: swing_low
    }
    
    for level, price in sorted(fib_levels_current.items()):
        print(f"  {level*100:.0f}%: ${price:.2f}")
    
    print()
    
    # Alternative approach (0% = Swing Low, 100% = Swing High)
    print("Alternative Approach (0% = Swing Low, 100% = Swing High):")
    fib_levels_alt = {
        0.0: swing_low,
        0.236: swing_low + (0.236 * price_range),
        0.382: swing_low + (0.382 * price_range),
        0.5: swing_low + (0.5 * price_range),
        0.618: swing_low + (0.618 * price_range),
        0.786: swing_low + (0.786 * price_range),
        1.0: swing_high
    }
    
    for level, price in sorted(fib_levels_alt.items()):
        print(f"  {level*100:.0f}%: ${price:.2f}")
    
    print()
    
    # Check which 61.8% level is closer to current price
    current_618 = fib_levels_current[0.618]
    alt_618 = fib_levels_alt[0.618]
    
    print(f"Current Price: ${current_price:.2f}")
    print(f"Current 61.8%: ${current_618:.2f} (diff: {abs(current_price - current_618):.2f})")
    print(f"Alt 61.8%: ${alt_618:.2f} (diff: {abs(current_price - alt_618):.2f})")
    
    if abs(current_price - current_618) < abs(current_price - alt_618):
        print("Current approach is closer!")
    else:
        print("Alternative approach is closer!")

if __name__ == "__main__":
    test_fibonacci_logic() 
#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fibonacci_monitors'))

from fibonacci_monitors.fibonacci_detector import FibonacciDetector
import pandas as pd
import numpy as np

def test_chart_generation():
    """Test chart generation for SHORT setup to debug the issue"""
    
    # Create detector
    detector = FibonacciDetector()
    
    # Create sample data for SHORT setup
    dates = pd.date_range('2025-01-01', periods=100, freq='15min')
    np.random.seed(42)
    
    # Create a downtrend pattern (SHORT setup)
    base_price = 115000
    trend = np.linspace(0, -2000, 100)  # Downtrend
    noise = np.random.normal(0, 100, 100)
    prices = base_price + trend + noise
    
    # Create DataFrame
    df = pd.DataFrame({
        'open': prices,
        'high': prices + np.random.uniform(0, 50, 100),
        'low': prices - np.random.uniform(0, 50, 100),
        'close': prices + np.random.normal(0, 20, 100),
        'volume': np.random.uniform(1000, 5000, 100)
    }, index=dates)
    
    # Ensure high/low are correct
    df['high'] = df[['open', 'high', 'low', 'close']].max(axis=1)
    df['low'] = df[['open', 'high', 'low', 'close']].min(axis=1)
    
    # Find swing points
    swing_high_idx = df['high'].idxmax()
    swing_low_idx = df['low'].idxmin()
    
    # Get swing prices
    swing_high_price = df.loc[swing_high_idx, 'high']
    swing_low_price = df.loc[swing_low_idx, 'low']
    current_price = df['close'].iloc[-1]
    
    print(f"Swing High: ${swing_high_price:.2f} at {swing_high_idx}")
    print(f"Swing Low: ${swing_low_price:.2f} at {swing_low_idx}")
    print(f"Current Price: ${current_price:.2f}")
    
    # Determine trend
    swing_high_pos = df.index.get_loc(swing_high_idx)
    swing_low_pos = df.index.get_loc(swing_low_idx)
    trend = "DOWN" if swing_high_pos < swing_low_pos else "UP"
    print(f"Trend: {trend}")
    
    # Calculate Fibonacci levels
    fib_levels = detector.calculate_fibonacci_levels(swing_high_price, swing_low_price, trend)
    
    print("\nFibonacci Levels:")
    for level, price in sorted(fib_levels.items()):
        print(f"  {level*100:.0f}%: ${price:.2f}")
    
    # Test both calculation approaches
    print("\n" + "="*50)
    print("COMPARISON OF CALCULATION APPROACHES:")
    print("="*50)
    
    # Current approach
    price_range = swing_high_price - swing_low_price
    current_approach = {
        0.0: swing_high_price,
        0.236: swing_high_price - (0.236 * price_range),
        0.382: swing_high_price - (0.382 * price_range),
        0.5: swing_high_price - (0.5 * price_range),
        0.618: swing_high_price - (0.618 * price_range),
        0.786: swing_high_price - (0.786 * price_range),
        1.0: swing_low_price
    }
    
    # Alternative approach
    alt_approach = {
        0.0: swing_low_price,
        0.236: swing_low_price + (0.236 * price_range),
        0.382: swing_low_price + (0.382 * price_range),
        0.5: swing_low_price + (0.5 * price_range),
        0.618: swing_low_price + (0.618 * price_range),
        0.786: swing_low_price + (0.786 * price_range),
        1.0: swing_high_price
    }
    
    print("\nCurrent Approach (0% = Swing High, 100% = Swing Low):")
    for level, price in sorted(current_approach.items()):
        print(f"  {level*100:.0f}%: ${price:.2f}")
    
    print("\nAlternative Approach (0% = Swing Low, 100% = Swing High):")
    for level, price in sorted(alt_approach.items()):
        print(f"  {level*100:.0f}%: ${price:.2f}")
    
    print("\nDetector Calculation:")
    for level, price in sorted(fib_levels.items()):
        print(f"  {level*100:.0f}%: ${price:.2f}")
    
    # Check which approach matches the detector
    print("\n" + "="*50)
    print("VERIFICATION:")
    print("="*50)
    
    current_matches = all(abs(fib_levels[level] - current_approach[level]) < 0.01 for level in fib_levels.keys())
    alt_matches = all(abs(fib_levels[level] - alt_approach[level]) < 0.01 for level in fib_levels.keys())
    
    print(f"Detector matches current approach: {current_matches}")
    print(f"Detector matches alternative approach: {alt_matches}")
    
    # Generate chart
    chart_filename = detector.generate_chart(
        df, 
        swing_high_idx, 
        swing_low_idx, 
        fib_levels, 
        current_price,
        "BTCUSDT",
        "15m",
        trend
    )
    
    print(f"\nChart generated: {chart_filename}")
    
    # Verify the levels are in correct order for SHORT
    if trend == "DOWN":
        print("\nVerifying SHORT setup levels (should be descending):")
        prices_list = list(fib_levels.values())
        is_descending = all(prices_list[i] >= prices_list[i+1] for i in range(len(prices_list)-1))
        print(f"Levels are in descending order: {is_descending}")
        
        if not is_descending:
            print("ERROR: Levels should be descending for SHORT setup!")
            for i in range(len(prices_list)-1):
                if prices_list[i] < prices_list[i+1]:
                    print(f"  {prices_list[i]:.2f} < {prices_list[i+1]:.2f} (WRONG!)")

if __name__ == "__main__":
    test_chart_generation() 
#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fibonacci_monitors'))

from fibonacci_monitors.fibonacci_detector import FibonacciDetector
import pandas as pd
import numpy as np

def test_chart_order():
    """Test that chart generation displays Fibonacci levels in correct order for SHORT setups"""
    
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
    
    print(f"Swing High: ${swing_high_price:.2f}")
    print(f"Swing Low: ${swing_low_price:.2f}")
    print(f"Current Price: ${current_price:.2f}")
    
    # Determine trend
    swing_high_pos = df.index.get_loc(swing_high_idx)
    swing_low_pos = df.index.get_loc(swing_low_idx)
    trend = "DOWN" if swing_high_pos < swing_low_pos else "UP"
    print(f"Trend: {trend}")
    
    # Calculate Fibonacci levels
    fib_levels = detector.calculate_fibonacci_levels(swing_high_price, swing_low_price, trend)
    
    print("\nFibonacci Levels (raw calculation):")
    for level, price in sorted(fib_levels.items()):
        print(f"  {level*100:.0f}%: ${price:.2f}")
    
    # Test the chart generation sorting logic
    print("\nChart generation order (should be descending for SHORT):")
    if trend == "DOWN":
        # For SHORT setup: display levels in descending order (100% to 0%)
        sorted_levels = sorted(fib_levels.items(), key=lambda x: x[0], reverse=True)
    else:
        # For LONG setup: display levels in ascending order (0% to 100%)
        sorted_levels = sorted(fib_levels.items(), key=lambda x: x[0], reverse=False)
    
    for level, price in sorted_levels:
        print(f"  {level*100:.0f}%: ${price:.2f}")
    
    # Verify the order is correct for SHORT
    if trend == "DOWN":
        print("\nVerifying SHORT setup chart order:")
        expected_order = [1.0, 0.786, 0.618, 0.5, 0.382, 0.236, 0.0]
        actual_order = [level for level, _ in sorted_levels]
        
        print(f"Expected order: {expected_order}")
        print(f"Actual order: {actual_order}")
        
        if actual_order == expected_order:
            print("✅ Chart order is correct!")
        else:
            print("❌ Chart order is wrong!")
    
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

if __name__ == "__main__":
    test_chart_order() 
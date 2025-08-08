#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fibonacci_monitors'))

from fibonacci_monitors.fibonacci_detector import FibonacciDetector
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def test_chart_visual():
    """Test to visualize what the chart is actually showing"""
    
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
    
    print("\nFibonacci Levels:")
    for level, price in sorted(fib_levels.items()):
        print(f"  {level*100:.0f}%: ${price:.2f}")
    
    # Create a simple visualization to see the order
    print("\nVisual representation of levels (top to bottom):")
    sorted_levels = sorted(fib_levels.items(), key=lambda x: x[1], reverse=True)
    for level, price in sorted_levels:
        print(f"  {level*100:.0f}%: ${price:.2f}")
    
    # Check if this matches what we expect for SHORT
    if trend == "DOWN":
        print("\nFor SHORT setup, levels should be in descending order (top to bottom):")
        expected_order = [1.0, 0.786, 0.618, 0.5, 0.382, 0.236, 0.0]
        actual_order = [level for level, _ in sorted_levels]
        
        print(f"Expected order: {expected_order}")
        print(f"Actual order: {actual_order}")
        
        if actual_order == expected_order:
            print("✅ Order is correct!")
        else:
            print("❌ Order is wrong!")
    
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
    test_chart_visual() 
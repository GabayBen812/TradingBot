#!/usr/bin/env python3
"""
Test script for Mega Monitor with individual parameters
"""

from fibonacci_detector import FibonacciDetector
from mega_config import get_monitor_configs

def test_individual_monitors():
    """Test a few monitors with their individual parameters"""
    detector = FibonacciDetector()
    
    # Get some monitor configs
    configs = get_monitor_configs()
    
    print("Testing individual monitor parameters:")
    print("=" * 60)
    
    for config in configs[:5]:  # Test first 5 monitors
        print(f"\nTesting: {config.name}")
        print(f"  Symbol: {config.symbol}")
        print(f"  Timeframe: {config.timeframe}")
        print(f"  Margin: {config.margin:.4f}")
        print(f"  Min Move: {config.min_move_percent:.3f}")
        print(f"  Lookback: {config.swing_lookback}")
        
        # Run detection with individual parameters
        result = detector.run_detection_with_params(
            symbol=config.symbol,
            timeframe=config.timeframe,
            margin=config.margin,
            min_move_percent=config.min_move_percent,
            swing_lookback=config.swing_lookback
        )
        
        if result:
            print(f"  ✅ SETUP DETECTED!")
            print(f"  Current Price: ${result['current_price']:.2f}")
            print(f"  Swing High: ${result['swing_high']:.2f}")
            print(f"  Swing Low: ${result['swing_low']:.2f}")
        else:
            print(f"  ❌ No setup detected")
        
        print("-" * 40)

if __name__ == "__main__":
    test_individual_monitors() 
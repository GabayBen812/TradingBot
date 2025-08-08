#!/usr/bin/env python3
"""
Test to verify broken pattern detection works correctly
"""

import sys
import os
sys.path.append('fibonacci_monitors')

from fibonacci_detector import FibonacciDetector
import pandas as pd
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_broken_pattern_scenario():
    """Test the specific scenario where a pattern gets broken"""
    detector = FibonacciDetector()
    
    print("🧪 Testing Broken Pattern Scenario")
    print("=" * 50)
    
    # Create data similar to the user's charts
    dates = pd.date_range(start='2025-08-01', periods=25, freq='h')
    
    # Create a downtrend that gets broken
    data = pd.DataFrame({
        'open': [100] * 25,
        'high': [100] * 25,
        'low': [100] * 25,
        'close': [100] * 25,
        'volume': [1000] * 25
    }, index=dates)
    
    # Downtrend: 100 -> 90
    data.loc[dates[0:10], 'high'] = 100
    data.loc[dates[0:10], 'low'] = 100
    data.loc[dates[0:10], 'close'] = 100
    data.loc[dates[0:10], 'open'] = 100
    
    data.loc[dates[10:15], 'high'] = 95
    data.loc[dates[10:15], 'low'] = 90
    data.loc[dates[10:15], 'close'] = 90
    data.loc[dates[10:15], 'open'] = 95
    
    # Retracement to 61.8% level (around 93.8)
    data.loc[dates[15:20], 'high'] = 95
    data.loc[dates[15:20], 'low'] = 93
    data.loc[dates[15:20], 'close'] = 94  # Near 61.8% level
    data.loc[dates[15:20], 'open'] = 93
    
    # Pattern gets broken - price moves above swing high
    data.loc[dates[20:], 'high'] = 101
    data.loc[dates[20:], 'low'] = 100
    data.loc[dates[20:], 'close'] = 101  # Above original swing high
    data.loc[dates[20:], 'open'] = 100
    
    print("Testing scenario where price breaks above swing high...")
    print(f"Original swing high: $100.00")
    print(f"Current price: ${data['close'].iloc[-1]:.2f}")
    print(f"Recent high: ${data['high'].tail(5).max():.2f}")
    print(f"Pattern should be broken: {data['high'].tail(5).max() > 100}")
    
    swing_high_idx, swing_low_idx = detector.detect_swing_points(data, 25)
    
    if swing_high_idx is None and swing_low_idx is None:
        print("✅ Pattern correctly rejected when broken")
        return True
    else:
        print("❌ Pattern incorrectly accepted when broken")
        print(f"Detected swing high: ${data.loc[swing_high_idx, 'high']:.2f}")
        print(f"Detected swing low: ${data.loc[swing_low_idx, 'low']:.2f}")
        return False

def test_valid_pattern_scenario():
    """Test a valid pattern that should be detected"""
    detector = FibonacciDetector()
    
    print("\n🧪 Testing Valid Pattern Scenario")
    print("=" * 50)
    
    # Create a valid downtrend
    dates = pd.date_range(start='2025-08-01', periods=25, freq='h')
    
    data = pd.DataFrame({
        'open': [100] * 25,
        'high': [100] * 25,
        'low': [100] * 25,
        'close': [100] * 25,
        'volume': [1000] * 25
    }, index=dates)
    
    # Downtrend: 100 -> 90
    data.loc[dates[0:10], 'high'] = 100
    data.loc[dates[0:10], 'low'] = 100
    data.loc[dates[0:10], 'close'] = 100
    data.loc[dates[0:10], 'open'] = 100
    
    data.loc[dates[10:15], 'high'] = 95
    data.loc[dates[10:15], 'low'] = 90
    data.loc[dates[10:15], 'close'] = 90
    data.loc[dates[10:15], 'open'] = 95
    
    # Retracement to 61.8% level (around 93.8)
    data.loc[dates[15:], 'high'] = 95
    data.loc[dates[15:], 'low'] = 93
    data.loc[dates[15:], 'close'] = 94  # Near 61.8% level
    data.loc[dates[15:], 'open'] = 93
    
    print("Testing valid downtrend pattern...")
    print(f"Original swing high: $100.00")
    print(f"Current price: ${data['close'].iloc[-1]:.2f}")
    print(f"Recent high: ${data['high'].tail(5).max():.2f}")
    print(f"Pattern should be valid: {data['high'].tail(5).max() <= 100}")
    
    swing_high_idx, swing_low_idx = detector.detect_swing_points(data, 25)
    
    if swing_high_idx is not None and swing_low_idx is not None:
        print("✅ Valid pattern correctly detected")
        return True
    else:
        print("❌ Valid pattern incorrectly rejected")
        return False

if __name__ == "__main__":
    print("🧪 Testing Pattern Validation Fix")
    print("=" * 50)
    
    test1_passed = test_broken_pattern_scenario()
    test2_passed = test_valid_pattern_scenario()
    
    print("\n" + "=" * 50)
    if test1_passed and test2_passed:
        print("✅ PATTERN VALIDATION FIX WORKS!")
        print("   The monitor will now correctly reject broken patterns.")
        print("   No more false alerts from invalid setups.")
    else:
        print("❌ PATTERN VALIDATION FIX NEEDS WORK!")
        print("   The pattern validation still has issues.") 
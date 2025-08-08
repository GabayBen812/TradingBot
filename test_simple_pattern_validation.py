#!/usr/bin/env python3
"""
Simple test for pattern validation
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

def test_broken_pattern_detection():
    """Test that broken patterns are correctly detected"""
    detector = FibonacciDetector()
    
    print("🧪 Testing Broken Pattern Detection")
    print("=" * 50)
    
    # Create a simple downtrend that gets broken
    dates = pd.date_range(start='2025-08-01', periods=20, freq='h')
    
    # Create data: downtrend from 100 to 90, then retracement to 95, then break above 100
    data = pd.DataFrame({
        'open': [100] * 20,
        'high': [100] * 20,
        'low': [100] * 20,
        'close': [100] * 20,
        'volume': [1000] * 20
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
    data.loc[dates[15:19], 'high'] = 95
    data.loc[dates[15:19], 'low'] = 93
    data.loc[dates[15:19], 'close'] = 94  # Near 61.8% level
    data.loc[dates[15:19], 'open'] = 93
    
    # Pattern gets broken - price moves above swing high
    data.loc[dates[19], 'high'] = 101
    data.loc[dates[19], 'low'] = 100
    data.loc[dates[19], 'close'] = 101  # Above original swing high
    data.loc[dates[19], 'open'] = 100
    
    print("Testing scenario where price breaks above swing high...")
    print(f"Current price: ${data['close'].iloc[-1]:.2f}")
    print(f"Swing high: $100.00")
    print(f"Pattern should be broken: {data['close'].iloc[-1] > 100}")
    
    swing_high_idx, swing_low_idx = detector.detect_swing_points(data, 20)
    
    if swing_high_idx is None and swing_low_idx is None:
        print("✅ Pattern correctly rejected when broken")
        return True
    else:
        print("❌ Pattern incorrectly accepted when broken")
        return False

def test_valid_pattern_detection():
    """Test that valid patterns are correctly detected"""
    detector = FibonacciDetector()
    
    print("\n🧪 Testing Valid Pattern Detection")
    print("=" * 50)
    
    # Create a simple valid downtrend
    dates = pd.date_range(start='2025-08-01', periods=20, freq='h')
    
    data = pd.DataFrame({
        'open': [100] * 20,
        'high': [100] * 20,
        'low': [100] * 20,
        'close': [100] * 20,
        'volume': [1000] * 20
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
    print(f"Current price: ${data['close'].iloc[-1]:.2f}")
    print(f"Swing high: $100.00")
    print(f"Pattern should be valid: {data['close'].iloc[-1] <= 100}")
    
    swing_high_idx, swing_low_idx = detector.detect_swing_points(data, 20)
    
    if swing_high_idx is not None and swing_low_idx is not None:
        print("✅ Valid pattern correctly detected")
        return True
    else:
        print("❌ Valid pattern incorrectly rejected")
        return False

if __name__ == "__main__":
    print("🧪 Testing Pattern Validation")
    print("=" * 50)
    
    test1_passed = test_broken_pattern_detection()
    test2_passed = test_valid_pattern_detection()
    
    print("\n" + "=" * 50)
    if test1_passed and test2_passed:
        print("✅ PATTERN VALIDATION TESTS PASSED!")
        print("   The monitor will now correctly reject broken patterns.")
        print("   No more false alerts from invalid setups.")
    else:
        print("❌ SOME PATTERN VALIDATION TESTS FAILED!")
        print("   The pattern validation needs more work.") 
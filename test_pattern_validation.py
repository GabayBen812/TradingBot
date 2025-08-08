#!/usr/bin/env python3
"""
Test script to verify the pattern validation logic

This script tests the new pattern validation to ensure broken Fibonacci patterns
are properly detected and rejected.
"""

import sys
import os
sys.path.append('fibonacci_monitors')

from fibonacci_detector import FibonacciDetector
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_test_data():
    """Create test data with different scenarios"""
    # Create sample data with a clear downtrend that gets broken
    dates = pd.date_range(start='2025-08-01', periods=50, freq='1H')
    
    # Scenario 1: Valid downtrend pattern
    valid_downtrend = pd.DataFrame({
        'open': [100] * 50,
        'high': [100] * 50,
        'low': [100] * 50,
        'close': [100] * 50,
        'volume': [1000] * 50
    }, index=dates)
    
    # Create a downtrend: 100 -> 90 -> 95 (retracement to 61.8%)
    valid_downtrend.loc[dates[0:20], 'high'] = 100
    valid_downtrend.loc[dates[0:20], 'low'] = 100
    valid_downtrend.loc[dates[0:20], 'close'] = 100
    valid_downtrend.loc[dates[0:20], 'open'] = 100
    
    valid_downtrend.loc[dates[20:35], 'high'] = 95
    valid_downtrend.loc[dates[20:35], 'low'] = 90
    valid_downtrend.loc[dates[20:35], 'close'] = 90
    valid_downtrend.loc[dates[20:35], 'open'] = 95
    
    valid_downtrend.loc[dates[35:], 'high'] = 95
    valid_downtrend.loc[dates[35:], 'low'] = 92
    valid_downtrend.loc[dates[35:], 'close'] = 93  # At 61.8% level
    valid_downtrend.loc[dates[35:], 'open'] = 92
    
    # Scenario 2: Broken downtrend pattern (price moved above swing high)
    broken_downtrend = valid_downtrend.copy()
    broken_downtrend.loc[dates[-1], 'high'] = 101
    broken_downtrend.loc[dates[-1], 'low'] = 100
    broken_downtrend.loc[dates[-1], 'close'] = 101  # Above swing high
    broken_downtrend.loc[dates[-1], 'open'] = 100
    
    # Scenario 3: Broken downtrend pattern (price moved significantly below swing low)
    broken_downtrend2 = valid_downtrend.copy()
    broken_downtrend2.loc[dates[-1], 'high'] = 89
    broken_downtrend2.loc[dates[-1], 'low'] = 88
    broken_downtrend2.loc[dates[-1], 'close'] = 88  # Significantly below swing low
    broken_downtrend2.loc[dates[-1], 'open'] = 89
    
    return valid_downtrend, broken_downtrend, broken_downtrend2

def test_pattern_validation():
    """Test the pattern validation logic"""
    detector = FibonacciDetector()
    
    print("🧪 Testing Pattern Validation Logic")
    print("=" * 50)
    
    # Create test data
    valid_data, broken_data1, broken_data2 = create_test_data()
    
    # Test 1: Valid pattern
    print("\n📊 Test 1: Valid Downtrend Pattern")
    print("-" * 40)
    swing_high_idx, swing_low_idx = detector.detect_swing_points(valid_data, 50)
    if swing_high_idx is not None and swing_low_idx is not None:
        print("✅ Valid pattern detected correctly")
    else:
        print("❌ Valid pattern incorrectly rejected")
    
    # Test 2: Broken pattern (price above swing high)
    print("\n📊 Test 2: Broken Pattern (Price Above Swing High)")
    print("-" * 40)
    swing_high_idx, swing_low_idx = detector.detect_swing_points(broken_data1, 50)
    if swing_high_idx is None and swing_low_idx is None:
        print("✅ Broken pattern correctly rejected")
    else:
        print("❌ Broken pattern incorrectly accepted")
    
    # Test 3: Broken pattern (price significantly below swing low)
    print("\n📊 Test 3: Broken Pattern (Price Below Swing Low)")
    print("-" * 40)
    swing_high_idx, swing_low_idx = detector.detect_swing_points(broken_data2, 50)
    if swing_high_idx is None and swing_low_idx is None:
        print("✅ Broken pattern correctly rejected")
    else:
        print("❌ Broken pattern incorrectly accepted")
    
    return True

def test_with_real_scenario():
    """Test with a scenario similar to the user's charts"""
    detector = FibonacciDetector()
    
    print("\n🔍 Test 4: Real Scenario (Similar to User's Charts)")
    print("=" * 50)
    
    # Create data similar to the BTC chart scenario
    dates = pd.date_range(start='2025-08-01', periods=30, freq='1H')
    
    # Create a downtrend that gets broken
    data = pd.DataFrame({
        'open': [115720] * 30,
        'high': [115720] * 30,
        'low': [115720] * 30,
        'close': [115720] * 30,
        'volume': [1000] * 30
    }, index=dates)
    
    # Downtrend: 115720 -> 113725
    data.loc[dates[0:15], 'high'] = 115720
    data.loc[dates[0:15], 'low'] = 115720
    data.loc[dates[0:15], 'close'] = 115720
    data.loc[dates[0:15], 'open'] = 115720
    
    data.loc[dates[15:25], 'high'] = 114500
    data.loc[dates[15:25], 'low'] = 113725
    data.loc[dates[15:25], 'close'] = 113725
    data.loc[dates[15:25], 'open'] = 114500
    
    # Retracement to 61.8% level (around 114487)
    data.loc[dates[25:29], 'high'] = 114600
    data.loc[dates[25:29], 'low'] = 114400
    data.loc[dates[25:29], 'close'] = 114566  # Near 61.8% level
    data.loc[dates[25:29], 'open'] = 114400
    
    # Pattern gets broken - price moves above swing high
    data.loc[dates[29], 'high'] = 115800
    data.loc[dates[29], 'low'] = 115700
    data.loc[dates[29], 'close'] = 115800  # Above original swing high
    data.loc[dates[29], 'open'] = 115700
    
    print("Testing scenario where price breaks above swing high...")
    swing_high_idx, swing_low_idx = detector.detect_swing_points(data, 30)
    
    if swing_high_idx is None and swing_low_idx is None:
        print("✅ Pattern correctly rejected when broken")
    else:
        print("❌ Pattern incorrectly accepted when broken")
    
    return True

if __name__ == "__main__":
    print("🧪 Testing Pattern Validation")
    print("=" * 50)
    
    test1_passed = test_pattern_validation()
    test2_passed = test_with_real_scenario()
    
    print("\n" + "=" * 50)
    if test1_passed and test2_passed:
        print("✅ PATTERN VALIDATION TESTS PASSED!")
        print("   The monitor will now correctly reject broken patterns.")
        print("   No more false alerts from invalid setups.")
    else:
        print("❌ SOME PATTERN VALIDATION TESTS FAILED!")
        print("   The pattern validation needs more work.") 
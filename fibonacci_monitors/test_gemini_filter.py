#!/usr/bin/env python3
"""
Test script for Gemini Setup Filter
This script demonstrates how the AI quality filter works
"""

import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from gemini_filter import GeminiSetupFilter

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_sample_setup(symbol: str, timeframe: str, setup_type: str = "LONG") -> dict:
    """Create a sample setup for testing"""
    
    # Sample data based on your Discord notifications
    if symbol == "BTCUSDT":
        swing_high = 114972.00
        swing_low = 113500.01
        current_price = 114151.68
    elif symbol == "ETHUSDT":
        swing_high = 3694.06
        swing_low = 3601.53
        current_price = 3632.59
    elif symbol == "DOTUSDT":
        swing_high = 3.71
        swing_low = 3.63
        current_price = 3.66
    else:
        # Generic sample
        swing_high = 100.0
        swing_low = 95.0
        current_price = 98.0
    
    # Calculate Fibonacci levels
    move = swing_high - swing_low
    fib_levels = {
        0.0: swing_low,
        0.236: swing_low + move * 0.236,
        0.382: swing_low + move * 0.382,
        0.5: swing_low + move * 0.5,
        0.618: swing_low + move * 0.618,
        0.786: swing_low + move * 0.786,
        1.0: swing_high
    }
    
    # Calculate trading levels
    if setup_type == "LONG":
        tp1 = fib_levels[0.5]
        tp2 = fib_levels[0.382]
        tp3 = fib_levels[0.236]
        sl = fib_levels[0.786]
    else:  # SHORT
        tp1 = fib_levels[0.786]
        tp2 = fib_levels[1.0]
        tp3 = swing_low + move * 1.618  # Extended target
        sl = fib_levels[0.5]
    
    return {
        'symbol': symbol,
        'timeframe': timeframe,
        'current_price': current_price,
        'swing_high': swing_high,
        'swing_low': swing_low,
        'fibonacci_levels': fib_levels,
        'trading_levels': {
            'setup_type': setup_type,
            'tp1': tp1,
            'tp2': tp2,
            'tp3': tp3,
            'sl': sl
        },
        'monitor_name': f"{symbol}-{timeframe}-Standard",
        'monitor_config': {
            'margin': 0.1,
            'min_move': 1.2,
            'lookback': 30
        }
    }

def test_gemini_filter():
    """Test the Gemini filter with sample setups"""
    
    print("🤖 Testing Gemini Setup Filter")
    print("=" * 50)
    
    # Initialize the filter
    filter = GeminiSetupFilter()
    
    if not filter.api_key:
        print("⚠️  No Gemini API key found. Using basic quality check.")
        print("   To enable AI analysis, set GEMINI_API_KEY in your .env file")
        print("   Get your API key from: https://makersuite.google.com/app/apikey")
        print()
    
    # Test different setups
    test_setups = [
        ("BTCUSDT", "5m", "SHORT"),
        ("ETHUSDT", "15m", "LONG"),
        ("DOTUSDT", "5m", "LONG"),
        ("ADAUSDT", "4h", "LONG"),
        ("AVAXUSDT", "5m", "LONG")
    ]
    
    for symbol, timeframe, setup_type in test_setups:
        print(f"\n🔍 Testing {symbol} {timeframe} {setup_type} setup:")
        print("-" * 40)
        
        # Create sample setup
        setup = create_sample_setup(symbol, timeframe, setup_type)
        
        # Analyze setup quality
        quality_analysis = filter.analyze_setup_quality(setup)
        
        # Display results
        status = "✅ HIGH QUALITY" if quality_analysis['is_high_quality'] else "❌ LOW QUALITY"
        confidence = quality_analysis['confidence_score']
        
        print(f"Status: {status}")
        print(f"Confidence: {confidence:.1%}")
        print(f"Reasoning: {quality_analysis['reasoning']}")
        
        if quality_analysis['strength_factors']:
            print(f"Strengths: {', '.join(quality_analysis['strength_factors'])}")
        
        if quality_analysis['risk_factors']:
            print(f"Risks: {', '.join(quality_analysis['risk_factors'])}")
        
        # Test notification decision
        should_notify = filter.should_send_notification(setup)
        print(f"Notification: {'✅ SEND' if should_notify else '❌ SKIP'}")
    
    print("\n" + "=" * 50)
    print("✅ Gemini filter test completed!")

def test_quality_summary():
    """Test the quality summary feature"""
    
    print("\n📊 Testing Quality Summary")
    print("=" * 30)
    
    filter = GeminiSetupFilter()
    setup = create_sample_setup("BTCUSDT", "5m", "SHORT")
    
    summary = filter.get_quality_summary(setup)
    print(summary)

if __name__ == "__main__":
    # Load environment variables
    load_dotenv()
    
    try:
        test_gemini_filter()
        test_quality_summary()
        
    except Exception as e:
        logger.error(f"Error during testing: {e}")
        print(f"❌ Test failed: {e}") 
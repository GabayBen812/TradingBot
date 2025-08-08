#!/usr/bin/env python3
"""
Test script to verify Discord notifications are working
"""

import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from discord_notifier import DiscordNotifier

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_test_setup():
    """Create a test setup for notification testing"""
    return {
        'symbol': 'BTCUSDT',
        'timeframe': '5m',
        'current_price': 114151.68,
        'swing_high': 114972.00,
        'swing_low': 113500.01,
        'fibonacci_levels': {
            0.0: 113500.01,
            0.236: 114624.61,
            0.382: 114409.70,
            0.5: 114236.01,
            0.618: 114062.31,
            0.786: 113815.02,
            1.0: 114972.00
        },
        'trading_levels': {
            'setup_type': 'SHORT',
            'tp1': 113815.02,
            'tp2': 113500.01,
            'tp3': 112590.32,
            'sl': 114236.01
        },
        'monitor_name': 'BTC-5M-Standard',
        'monitor_config': {
            'margin': 0.1,
            'min_move': 1.2,
            'lookback': 30
        }
    }

def test_notification():
    """Test Discord notification"""
    print("🧪 Testing Discord Notifications")
    print("=" * 40)
    
    # Load environment variables
    load_dotenv()
    
    # Create notifier
    notifier = DiscordNotifier()
    
    if not notifier.webhook_url:
        print("❌ No Discord webhook URL configured")
        print("   Please set DISCORD_WEBHOOK_URL in your .env file")
        return False
    
    # Create test setup
    test_setup = create_test_setup()
    
    print(f"📤 Sending test notification for {test_setup['symbol']}...")
    
    # Send notification
    success = notifier.send_alert(test_setup)
    
    if success:
        print("✅ Test notification sent successfully!")
        print("   Check your Discord channel for the message")
        return True
    else:
        print("❌ Failed to send test notification")
        return False

def test_ai_filter():
    """Test AI filter functionality"""
    print("\n🤖 Testing AI Filter")
    print("=" * 30)
    
    from gemini_filter import GeminiSetupFilter
    
    filter = GeminiSetupFilter()
    test_setup = create_test_setup()
    
    print("Analyzing setup quality...")
    quality = filter.analyze_setup_quality(test_setup)
    
    print(f"High Quality: {quality['is_high_quality']}")
    print(f"Confidence: {quality['confidence_score']:.1%}")
    print(f"Reasoning: {quality['reasoning']}")
    
    should_send = filter.should_send_notification(test_setup)
    print(f"Should Send: {'✅ YES' if should_send else '❌ NO'}")
    
    return should_send

if __name__ == "__main__":
    print("🚀 Discord Notification Test")
    print("=" * 50)
    
    # Test basic notification
    notification_success = test_notification()
    
    # Test AI filter
    filter_success = test_ai_filter()
    
    print("\n" + "=" * 50)
    if notification_success:
        print("✅ Notification system working!")
    else:
        print("❌ Notification system needs fixing")
    
    if filter_success:
        print("✅ AI filter would allow this setup")
    else:
        print("❌ AI filter would block this setup") 
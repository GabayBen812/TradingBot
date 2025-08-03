import requests
import json
from datetime import datetime
from typing import Dict, Optional
import logging
from config import *

logger = logging.getLogger(__name__)

class DiscordNotifier:
    def __init__(self):
        self.webhook_url = DISCORD_WEBHOOK_URL
        self.username = DISCORD_USERNAME
        self.avatar_url = DISCORD_AVATAR_URL
    
    def send_alert(self, detection_result: Dict) -> bool:
        """Send Discord alert with Fibonacci setup information"""
        try:
            if not self.webhook_url:
                logger.error("Discord webhook URL not configured")
                return False
            
            # Prepare the message
            message = self._create_message(detection_result)
            
            # Prepare files
            files = []
            if detection_result.get('chart_filename'):
                try:
                    with open(detection_result['chart_filename'], 'rb') as f:
                        files.append(('file', (detection_result['chart_filename'], f.read(), 'image/png')))
                except Exception as e:
                    logger.error(f"Error reading chart file: {e}")
            
            # Send webhook
            payload = {
                'username': self.username,
                'avatar_url': self.avatar_url,
                'content': message
            }
            
            response = requests.post(
                self.webhook_url,
                data={'payload_json': json.dumps(payload)},
                files=files
            )
            
            if response.status_code == 204:
                logger.info("Discord alert sent successfully")
                return True
            else:
                logger.error(f"Failed to send Discord alert: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending Discord alert: {e}")
            return False
    
    def _create_message(self, result: Dict) -> str:
        """Create formatted Discord message"""
        symbol = result['symbol']
        timeframe = result['timeframe']
        current_price = result['current_price']
        swing_high = result['swing_high']
        swing_low = result['swing_low']
        fib_levels = result['fibonacci_levels']
        trading_levels = result['trading_levels']
        
        # Calculate move percentage
        move_percent = abs(swing_high - swing_low) / swing_low * 100
        
        # Determine setup type
        setup_type = "LONG" if current_price <= fib_levels[0.618] else "SHORT"
        
        message = f"""
🚨 **FIBONACCI 0.618 RETRACEMENT DETECTED** 🚨

**Symbol:** {symbol}
**Timeframe:** {timeframe}
**Setup Type:** {setup_type}
**Current Price:** ${current_price:.2f}

**📊 Swing Analysis:**
• Swing High: ${swing_high:.2f}
• Swing Low: ${swing_low:.2f}
• Total Move: {move_percent:.2f}%

**📈 Fibonacci Levels:**
• 0% (Swing Low): ${fib_levels[0.0]:.2f}
• 23.6%: ${fib_levels[0.236]:.2f}
• 38.2%: ${fib_levels[0.382]:.2f}
• **50%: ${fib_levels[0.5]:.2f}**
• **61.8%: ${fib_levels[0.618]:.2f}** ⭐
• 78.6%: ${fib_levels[0.786]:.2f}
• 100% (Swing High): ${fib_levels[1.0]:.2f}

**💰 Trading Levels:**
• Entry: ${trading_levels['entry']:.2f}
• Take Profit 1: ${trading_levels['tp1']:.2f}
• Take Profit 2: ${trading_levels['tp2']:.2f}
• Take Profit 3: ${trading_levels['tp3']:.2f}
• Stop Loss: ${trading_levels['sl']:.2f}

**📋 Setup Explanation:**
The price has retraced to the 61.8% Fibonacci level, which is a key support/resistance level. This level often acts as a reversal point in technical analysis.

**⚠️ Risk Management:**
• Always use proper position sizing
• Set stop loss to limit potential losses
• Consider market conditions and overall trend
• This is not financial advice - trade at your own risk

**⏰ Detected at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC
"""
        
        return message.strip()
    
    def send_test_message(self) -> bool:
        """Send a test message to verify Discord webhook is working"""
        try:
            if not self.webhook_url:
                logger.error("Discord webhook URL not configured")
                return False
            
            test_message = """
🧪 **FIBONACCI BOT TEST MESSAGE** 🧪

This is a test message to verify that the Discord webhook is working correctly.

**Bot Status:** ✅ Online
**Symbol:** SOLUSDT
**Timeframe:** 1h
**Detection Active:** Yes

If you received this message, the bot is properly configured and ready to send Fibonacci retracement alerts!
"""
            
            payload = {
                'username': self.username,
                'avatar_url': self.avatar_url,
                'content': test_message.strip()
            }
            
            response = requests.post(
                self.webhook_url,
                json=payload
            )
            
            if response.status_code == 204:
                logger.info("Discord test message sent successfully")
                return True
            else:
                logger.error(f"Failed to send Discord test message: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending Discord test message: {e}")
            return False 
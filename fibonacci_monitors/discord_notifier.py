import requests
import json
from datetime import datetime
from typing import Dict, Optional
import logging
from config import *
from gemini_filter import GeminiSetupFilter

logger = logging.getLogger(__name__)

class DiscordNotifier:
    def __init__(self):
        self.webhook_url = DISCORD_WEBHOOK_URL
        self.username = DISCORD_USERNAME
        self.avatar_url = DISCORD_AVATAR_URL
        self.gemini_filter = GeminiSetupFilter()
        # RE-ENABLE AI FILTER - NOW PROPERLY TRAINED FOR FIBONACCI TRADING
        self.use_ai_filter = True  # Set to True to use AI filter
    
    def send_alert(self, detection_result: Dict) -> bool:
        """Send Discord alert with Fibonacci setup information (with quality filtering)"""
        try:
            if not self.webhook_url:
                logger.error("Discord webhook URL not configured")
                return False
            
            # Check if this setup passes quality filter (TEMPORARILY DISABLED)
            if self.use_ai_filter and not self.gemini_filter.should_send_notification(detection_result):
                logger.info(f"Setup for {detection_result['symbol']} filtered out by quality check")
                return False
            
            # Prepare the message with quality analysis
            if self.use_ai_filter:
                message = self._create_message_with_quality(detection_result)
            else:
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
    
    def _labels_from_fib(self, fib_levels: Dict[float, float], swing_high: float, swing_low: float) -> Dict[str, str]:
        """Determine correct labels for 0%/100% based on actual prices, not setup type."""
        zero_is_high = abs(fib_levels[0.0] - swing_high) <= abs(fib_levels[0.0] - swing_low)
        hundred_is_low = abs(fib_levels[1.0] - swing_low) <= abs(fib_levels[1.0] - swing_high)
        return {
            'zero': 'Swing High' if zero_is_high else 'Swing Low',
            'hundred': 'Swing Low' if hundred_is_low else 'Swing High'
        }
    
    def _create_message_with_quality(self, result: Dict) -> str:
        """Create formatted Discord message with quality analysis"""
        symbol = result['symbol']
        timeframe = result['timeframe']
        current_price = result['current_price']
        swing_high = result['swing_high']
        swing_low = result['swing_low']
        fib_levels = result['fibonacci_levels']
        trading_levels = result['trading_levels']
        
        # Get monitor info if available (from mega monitor)
        monitor_name = result.get('monitor_name', 'Standard Monitor')
        monitor_config = result.get('monitor_config', {})
        
        # Calculate move percentage
        move_percent = abs(swing_high - swing_low) / swing_low * 100
        
        # Get setup type from trading levels
        setup_type = trading_levels.get('setup_type', "LONG" if current_price <= fib_levels[0.618] else "SHORT")
        
        # Get quality analysis
        quality_analysis = self.gemini_filter.analyze_setup_quality(result)
        
        # Create monitor-specific header with quality indicator
        if monitor_name != 'Standard Monitor':
            header = f"🚨 **AI-VERIFIED HIGH QUALITY FIBONACCI SETUP** 🚨\n\n**Monitor:** {monitor_name}"
        else:
            header = "🚨 **AI-VERIFIED HIGH QUALITY FIBONACCI SETUP** 🚨"
        
        # Add quality badge
        confidence = quality_analysis['confidence_score']
        quality_badge = "🟢 EXCELLENT" if confidence >= 0.9 else "🟡 GOOD" if confidence >= 0.7 else "🟠 FAIR"

        labels = self._labels_from_fib(fib_levels, swing_high, swing_low)
        
        message = f"""
{header}

**Symbol:** {symbol}
**Timeframe:** {timeframe}
**Setup Type:** {setup_type}
**Current Price:** ${current_price:.2f}
**Quality:** {quality_badge} ({confidence:.1%})

**📊 Swing Analysis:**
• Swing High: ${swing_high:.2f}
• Swing Low: ${swing_low:.2f}
• Total Move: {move_percent:.2f}%

**📈 Fibonacci Levels:**
• 0% ({labels['zero']}): ${fib_levels[0.0]:.2f}
• 23.6%: ${fib_levels[0.236]:.2f}
• 38.2%: ${fib_levels[0.382]:.2f}
• 50%: ${fib_levels[0.5]:.2f}
• 61.8%: ${fib_levels[0.618]:.2f} ⭐
• 78.6%: ${fib_levels[0.786]:.2f}
• 100% ({labels['hundred']}): ${fib_levels[1.0]:.2f}

**💰 Trading Levels:**
• Entry: ${current_price:.2f}
• Take Profit 1: ${trading_levels.get('tp1', 0):.2f}
• Take Profit 2: ${trading_levels.get('tp2', 0):.2f}
• Take Profit 3: ${trading_levels.get('tp3', 0):.2f}
• Stop Loss: ${trading_levels.get('sl', 0):.2f}

**🤖 AI Analysis:**
• **Reasoning:** {quality_analysis['reasoning'][:200]}...
• **Recommendation:** {quality_analysis['recommendation']}
• **Position Size:** {quality_analysis.get('position_size', 'MEDIUM')}
• **Risk Level:** {quality_analysis.get('risk_level', 'MEDIUM')}
"""

        # Add strength factors if any (shortened)
        if quality_analysis['strength_factors']:
            message += f"\n**✅ Strengths:**\n"
            for factor in quality_analysis['strength_factors'][:3]:  # Limit to 3
                message += f"• {factor}\n"
        
        # Add risk factors if any (shortened)
        if quality_analysis['risk_factors']:
            message += f"\n**⚠️ Risk Factors:**\n"
            for factor in quality_analysis['risk_factors'][:2]:  # Limit to 2
                message += f"• {factor}\n"

        message += f"""
**📋 Setup Explanation:**
The price has retraced to the 61.8% Fibonacci level (${fib_levels[0.618]:.2f}), which is acting as {'support' if setup_type == 'LONG' else 'resistance'}. This is a potential {setup_type} setup looking for a {'bounce/reversal' if setup_type == 'LONG' else 'rejection/breakdown'} to the {'upside' if setup_type == 'LONG' else 'downside'}.

**🎯 Professional Trading Tips:**
• **Position Sizing:** Use {quality_analysis.get('position_size', 'MEDIUM').lower()} position size
• **Risk Management:** Set stop loss at ${trading_levels.get('sl', 0):.2f}
• **Psychology:** Stay disciplined, avoid FOMO
• **Monitoring:** Watch for breakout/breakdown confirmation

**⚠️ Risk Management:**
• Always use proper position sizing
• Set stop loss to limit potential losses
• Consider market conditions and overall trend
• This is not financial advice - trade at your own risk

**⏰ Detected at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC
"""
        
        return message
    
    def _create_message(self, result: Dict) -> str:
        """Create formatted Discord message (legacy method)"""
        symbol = result['symbol']
        timeframe = result['timeframe']
        current_price = result['current_price']
        swing_high = result['swing_high']
        swing_low = result['swing_low']
        fib_levels = result['fibonacci_levels']
        trading_levels = result['trading_levels']
        setup_type = trading_levels.get('setup_type', 'LONG' if current_price <= fib_levels[0.618] else 'SHORT')

        labels = self._labels_from_fib(fib_levels, swing_high, swing_low)
        
        message = f"""
🚨 **FIBONACCI SETUP DETECTED!** 🚨

**Symbol:** {symbol}
**Timeframe:** {timeframe}
**Setup Type:** {setup_type}
**Current Price:** ${current_price:.2f}

**📈 Fibonacci Levels:**
• 0% ({labels['zero']}): ${fib_levels[0.0]:.2f}
• 23.6%: ${fib_levels[0.236]:.2f}
• 38.2%: ${fib_levels[0.382]:.2f}
• 50%: ${fib_levels[0.5]:.2f}
• 61.8%: ${fib_levels[0.618]:.2f}
• 78.6%: ${fib_levels[0.786]:.2f}
• 100% ({labels['hundred']}): ${fib_levels[1.0]:.2f}

**💰 Trading Levels:**
• Entry: ${current_price:.2f}
• TP1: ${trading_levels['tp1']:.2f}
• TP2: ${trading_levels['tp2']:.2f}
• TP3: ${trading_levels['tp3']:.2f}
• SL: ${trading_levels['sl']:.2f}
"""
        return message
    
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
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
    
    def send_strategy_alert(self, strategy_signal: Dict) -> bool:
        """Send Discord alert with strategy signal information"""
        try:
            if not self.webhook_url:
                logger.error("Discord webhook URL not configured")
                return False
            
            # Prepare the message
            message = self._create_strategy_message(strategy_signal)
            
            # Send webhook
            payload = {
                'username': 'Strategy Monitor',
                'avatar_url': self.avatar_url,
                'content': message
            }
            
            response = requests.post(
                self.webhook_url,
                json=payload
            )
            
            if response.status_code == 204:
                logger.info("Strategy Discord alert sent successfully")
                return True
            else:
                logger.error(f"Failed to send strategy Discord alert: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending strategy Discord alert: {e}")
            return False
    
    def _create_message(self, result: Dict) -> str:
        """Create formatted Discord message for Fibonacci alerts"""
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
        
        # Determine setup type
        setup_type = "LONG" if current_price <= fib_levels[0.618] else "SHORT"
        
        # Create monitor-specific header
        if monitor_name != 'Standard Monitor':
            header = f"🚨 **FIBONACCI 0.618 RETRACEMENT DETECTED** 🚨\n\n**Monitor:** {monitor_name}"
        else:
            header = "🚨 **FIBONACCI 0.618 RETRACEMENT DETECTED** 🚨"
        
        message = f"""
{header}

**Symbol:** {symbol}
**Timeframe:** {timeframe}
**Setup Type:** {setup_type}
**Current Price:** ${current_price:.2f}

**📊 Swing Analysis:**
• Swing High: ${swing_high:.2f}
• Swing Low: ${swing_low:.2f}
• Total Move: {move_percent:.2f}%

**📈 Fibonacci Levels:**
• 0% ({'Swing High' if setup_type == 'SHORT' else 'Swing Low'}): ${fib_levels[0.0]:.2f}
• 23.6%: ${fib_levels[0.236]:.2f}
• 38.2%: ${fib_levels[0.382]:.2f}
• 50%: ${fib_levels[0.5]:.2f}
• 61.8%: ${fib_levels[0.618]:.2f} ⭐
• 78.6%: ${fib_levels[0.786]:.2f}
• 100% ({'Swing Low' if setup_type == 'SHORT' else 'Swing High'}): ${fib_levels[1.0]:.2f}

**💰 Trading Levels:**
• Entry: ${trading_levels['entry']:.2f}
• Take Profit 1: ${trading_levels['tp1']:.2f}
• Take Profit 2: ${trading_levels['tp2']:.2f}
• Take Profit 3: ${trading_levels['tp3']:.2f}
• Stop Loss: ${trading_levels['sl']:.2f}
"""
        
        # Add monitor configuration details if available
        if monitor_config:
            margin = monitor_config.get('margin', 0)
            min_move = monitor_config.get('min_move', 0)
            lookback = monitor_config.get('lookback', 0)
            
            message += f"""
**⚙️ Monitor Configuration:**
• Margin: {margin:.1%}
• Min Move: {min_move:.1%}
• Lookback: {lookback} candles
"""
        
        message += f"""
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
    
    def _create_strategy_message(self, signal: Dict) -> str:
        """Create formatted Discord message for strategy alerts"""
        strategy = signal['strategy']
        signal_type = signal['type']
        signal_name = signal['signal']
        price = signal['price']
        confidence = signal['confidence']
        symbol = signal['symbol']
        timeframe = signal['timeframe']
        monitor_name = signal.get('monitor_name', 'Strategy Monitor')
        
        # Create emoji based on signal type
        if signal_type == 'BULLISH':
            emoji = "🟢"
        elif signal_type == 'BEARISH':
            emoji = "🔴"
        else:
            emoji = "🟡"
        
        message = f"""
{emoji} **STRATEGY SIGNAL DETECTED** {emoji}

**Monitor:** {monitor_name}
**Strategy:** {strategy}
**Signal:** {signal_name}
**Type:** {signal_type}
**Confidence:** {confidence}

**📊 Signal Details:**
• Symbol: {symbol}
• Timeframe: {timeframe}
• Current Price: ${price:.2f}
"""
        
        # Add strategy-specific details
        if strategy == 'Support/Resistance Break':
            level = signal.get('level', 0)
            volume_ratio = signal.get('volume_ratio', 0)
            message += f"""
• Break Level: ${level:.2f}
• Volume Ratio: {volume_ratio:.2f}x
"""
        elif strategy == 'Moving Average Crossover':
            sma_cross = signal.get('sma_cross', False)
            ema_cross = signal.get('ema_cross', False)
            message += f"""
• SMA Crossover: {'Yes' if sma_cross else 'No'}
• EMA Crossover: {'Yes' if ema_cross else 'No'}
"""
        elif strategy == 'RSI Divergence':
            rsi = signal.get('rsi', 0)
            message += f"""
• Current RSI: {rsi:.2f}
"""
        elif strategy == 'MACD Crossover':
            macd = signal.get('macd', 0)
            signal_line = signal.get('signal_line', 0)
            message += f"""
• MACD: {macd:.4f}
• Signal Line: {signal_line:.4f}
"""
        elif strategy == 'Bollinger Band Squeeze':
            bandwidth = signal.get('bandwidth', 0)
            upper_band = signal.get('upper_band', 0)
            lower_band = signal.get('lower_band', 0)
            message += f"""
• Bandwidth: {bandwidth:.3f}
• Upper Band: ${upper_band:.2f}
• Lower Band: ${lower_band:.2f}
"""
        elif 'STRAT_' in strategy:
            # Strat Strategy (Rob Smith) details
            volume_ratio = signal.get('volume_ratio', 0)
            trend = signal.get('trend', 'UNKNOWN')
            
            if 'BREAKOUT' in strategy:
                breakout_level = signal.get('breakout_level', 0)
                message += f"""
• Breakout Level: ${breakout_level:.2f}
• Volume Ratio: {volume_ratio:.2f}x
• Trend: {trend}
"""
            elif 'BOUNCE' in strategy or 'REJECTION' in strategy:
                level = signal.get('level', 0)
                message += f"""
• Key Level: ${level:.2f}
• Volume Ratio: {volume_ratio:.2f}x
• Trend: {trend}
"""
        
        message += f"""
**📋 Strategy Explanation:**
This signal indicates a potential trading opportunity based on technical analysis. Always confirm with additional indicators and market context.

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
🧪 **TRADING BOT TEST MESSAGE** 🧪

This is a test message to verify that the Discord webhook is working correctly.

**Bot Status:** ✅ Online
**Symbol:** SOLUSDT
**Timeframe:** 1h
**Detection Active:** Yes

If you received this message, the bot is properly configured and ready to send alerts!
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
#!/usr/bin/env python3
"""
Fibonacci Retracement Detection Bot for Solana (SOL)

This script monitors the SOL/USDT chart from Binance and sends Discord alerts
when a Fibonacci 0.618 retracement setup is detected.

Features:
- Real-time price monitoring
- Automatic swing high/low detection
- Fibonacci level calculations
- Chart generation with visual indicators
- Discord notifications with trading levels
- Configurable parameters
"""

import time
import schedule
import logging
from datetime import datetime, timedelta
from typing import Optional
import os
import sys

from fibonacci_detector import FibonacciDetector
from discord_notifier import DiscordNotifier
from config import *

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('fibonacci_bot.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class FibonacciBot:
    def __init__(self):
        self.detector = FibonacciDetector()
        self.notifier = DiscordNotifier()
        self.last_alert_time = None
        self.alert_cooldown = timedelta(minutes=30)  # Prevent spam alerts
        
        logger.info("Fibonacci Bot initialized")
        logger.info(f"Monitoring: {SYMBOL} on {TIMEFRAME} timeframe")
        logger.info(f"Check interval: {CHECK_INTERVAL_MINUTES} minutes")
        logger.info(f"Margin tolerance: {MARGIN:.2%}")
        logger.info(f"Minimum move: {MIN_MOVE_PERCENT:.2%}")
    
    def check_setup(self) -> None:
        """Main detection and alert function"""
        try:
            logger.info(f"Checking for Fibonacci 0.618 retracement on {SYMBOL}...")
            
            # Run detection
            result = self.detector.run_detection()
            
            if result is None:
                logger.info("No Fibonacci 0.618 retracement detected")
                return
            
            # Check if we should send an alert (avoid spam)
            current_time = datetime.now()
            if (self.last_alert_time is None or 
                current_time - self.last_alert_time > self.alert_cooldown):
                
                logger.info(f"Fibonacci 0.618 retracement detected! Sending alert...")
                
                # Send Discord alert
                if self.notifier.send_alert(result):
                    self.last_alert_time = current_time
                    logger.info("Alert sent successfully")
                    
                    # Clean up chart file after sending
                    try:
                        if result.get('chart_filename') and os.path.exists(result['chart_filename']):
                            os.remove(result['chart_filename'])
                            logger.info(f"Cleaned up chart file: {result['chart_filename']}")
                    except Exception as e:
                        logger.error(f"Error cleaning up chart file: {e}")
                else:
                    logger.error("Failed to send Discord alert")
            else:
                logger.info("Alert suppressed due to cooldown period")
                
        except Exception as e:
            logger.error(f"Error in check_setup: {e}")
    
    def send_test_alert(self) -> None:
        """Send a test alert to verify Discord webhook is working"""
        logger.info("Sending test Discord alert...")
        if self.notifier.send_test_message():
            logger.info("Test alert sent successfully")
        else:
            logger.error("Failed to send test alert")
    
    def run(self) -> None:
        """Main bot loop"""
        logger.info("Starting Fibonacci Bot...")
        
        # Send initial test message
        self.send_test_alert()
        
        # Schedule the detection job
        schedule.every(CHECK_INTERVAL_MINUTES).minutes.do(self.check_setup)
        
        logger.info(f"Bot scheduled to run every {CHECK_INTERVAL_MINUTES} minutes")
        logger.info("Press Ctrl+C to stop the bot")
        
        try:
            while True:
                schedule.run_pending()
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Bot stopped by user")
        except Exception as e:
            logger.error(f"Unexpected error in main loop: {e}")

def main():
    """Main entry point"""
    print("=" * 60)
    print("🚀 FIBONACCI RETRACEMENT DETECTION BOT")
    print("=" * 60)
    print(f"Symbol: {SYMBOL}")
    print(f"Timeframe: {TIMEFRAME}")
    print(f"Check Interval: {CHECK_INTERVAL_MINUTES} minutes")
    print(f"Margin Tolerance: {MARGIN:.2%}")
    print(f"Minimum Move: {MIN_MOVE_PERCENT:.2%}")
    print("=" * 60)
    
    # Check configuration
    if not DISCORD_WEBHOOK_URL:
        print("❌ ERROR: Discord webhook URL not configured!")
        print("Please set the DISCORD_WEBHOOK_URL environment variable or add it to .env file")
        return
    
    # Create and run bot
    bot = FibonacciBot()
    bot.run()

if __name__ == "__main__":
    main() 
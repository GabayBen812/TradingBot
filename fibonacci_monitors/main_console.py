#!/usr/bin/env python3
"""
Fibonacci Retracement Detection Bot - Console Version

This version runs without Discord webhook requirement and shows results in console.
"""

import time
import schedule
import logging
from datetime import datetime, timedelta
from typing import Optional
import os
import sys

from fibonacci_detector import FibonacciDetector
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

class FibonacciBotConsole:
    def __init__(self):
        self.detector = FibonacciDetector()
        self.last_alert_time = None
        self.alert_cooldown = timedelta(minutes=30)  # Prevent spam alerts
        
        logger.info("Fibonacci Bot (Console) initialized")
        logger.info(f"Monitoring: {SYMBOL} on {TIMEFRAME} timeframe")
        logger.info(f"Check interval: {CHECK_INTERVAL_MINUTES} minutes")
        logger.info(f"Margin tolerance: {MARGIN:.2%}")
        logger.info(f"Minimum move: {MIN_MOVE_PERCENT:.2%}")
    
    def check_setup(self) -> None:
        """Main detection and console output function"""
        try:
            logger.info(f"Checking for Fibonacci 0.618 retracement on {SYMBOL}...")
            
            # Run detection
            result = self.detector.run_detection()
            
            if result is None:
                logger.info("No Fibonacci 0.618 retracement detected")
                return
            
            # Check if we should show alert (avoid spam)
            current_time = datetime.now()
            if (self.last_alert_time is None or 
                current_time - self.last_alert_time > self.alert_cooldown):
                
                logger.info("=" * 60)
                logger.info("🚨 FIBONACCI 0.618 RETRACEMENT DETECTED! 🚨")
                logger.info("=" * 60)
                
                # Display results
                self._display_results(result)
                
                self.last_alert_time = current_time
                logger.info("Alert logged successfully")
                
                # Clean up chart file after displaying
                try:
                    if result.get('chart_filename') and os.path.exists(result['chart_filename']):
                        logger.info(f"Chart saved as: {result['chart_filename']}")
                except Exception as e:
                    logger.error(f"Error with chart file: {e}")
            else:
                logger.info("Alert suppressed due to cooldown period")
                
        except Exception as e:
            logger.error(f"Error in check_setup: {e}")
    
    def _display_results(self, result: dict) -> None:
        """Display detection results in console"""
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
        
        print(f"\n📊 SETUP ANALYSIS:")
        print(f"Symbol: {symbol}")
        print(f"Timeframe: {timeframe}")
        print(f"Setup Type: {setup_type}")
        print(f"Current Price: ${current_price:.2f}")
        
        print(f"\n📈 SWING ANALYSIS:")
        print(f"Swing High: ${swing_high:.2f}")
        print(f"Swing Low: ${swing_low:.2f}")
        print(f"Total Move: {move_percent:.2f}%")
        
        print(f"\n📊 FIBONACCI LEVELS:")
        for level, price in fib_levels.items():
            marker = " ⭐" if level == 0.618 else ""
            print(f"{FIBONACCI_LEVELS[level]}: ${price:.2f}{marker}")
        
        print(f"\n💰 TRADING LEVELS:")
        print(f"Entry: ${trading_levels['entry']:.2f}")
        print(f"Take Profit 1: ${trading_levels['tp1']:.2f}")
        print(f"Take Profit 2: ${trading_levels['tp2']:.2f}")
        print(f"Take Profit 3: ${trading_levels['tp3']:.2f}")
        print(f"Stop Loss: ${trading_levels['sl']:.2f}")
        
        print(f"\n⚠️  RISK MANAGEMENT:")
        print("• Always use proper position sizing")
        print("• Set stop loss to limit potential losses")
        print("• Consider market conditions and overall trend")
        print("• This is not financial advice - trade at your own risk")
        
        print(f"\n⏰ Detected at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print("=" * 60)
    
    def run(self) -> None:
        """Main bot loop"""
        logger.info("Starting Fibonacci Bot (Console)...")
        
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
    print("🚀 FIBONACCI RETRACEMENT DETECTION BOT (CONSOLE)")
    print("=" * 60)
    print(f"Symbol: {SYMBOL}")
    print(f"Timeframe: {TIMEFRAME}")
    print(f"Check Interval: {CHECK_INTERVAL_MINUTES} minutes")
    print(f"Margin Tolerance: {MARGIN:.2%}")
    print(f"Minimum Move: {MIN_MOVE_PERCENT:.2%}")
    print("=" * 60)
    print("📊 Using public Binance API data (no API keys required)")
    print("📈 Monitoring for Fibonacci 0.618 retracement setups")
    print("📋 Results will be displayed in console and saved to log")
    print("=" * 60)
    
    # Create and run bot
    bot = FibonacciBotConsole()
    bot.run()

if __name__ == "__main__":
    main() 
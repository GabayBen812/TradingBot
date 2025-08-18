#!/usr/bin/env python3
"""
Mega Fibonacci Monitor - Multi-Configuration Trading Bot

This script runs multiple Fibonacci detectors simultaneously with different configurations:
- Multiple symbols (SOL, BTC, ETH, etc.)
- Multiple timeframes (1h, 4h, 1d, etc.)
- Multiple detection parameters (margins, lookback periods)
- All sending alerts to the same Discord webhook
"""

import time
import schedule
import logging
import threading
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import os
import sys
from dataclasses import dataclass

from fibonacci_detector import FibonacciDetector
from discord_notifier import DiscordNotifier
from config import DISCORD_WEBHOOK_URL, DISCORD_AVATAR_URL
from mega_config import get_monitor_configs, MonitorConfig

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('mega_monitor.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)



class SingleMonitor:
    """Individual monitor instance"""
    def __init__(self, config: MonitorConfig, notifier: DiscordNotifier):
        self.config = config
        self.notifier = notifier
        self.detector = FibonacciDetector()
        self.last_alert_time = None
        self.alert_cooldown = timedelta(minutes=30)
        
        logger.info(f"Monitor '{config.name}' initialized: {config.symbol} {config.timeframe}")
    
    def check_setup(self) -> None:
        """Check for Fibonacci setup with this monitor's configuration"""
        try:
            logger.info(f"[{self.config.name}] Checking {self.config.symbol} on {self.config.timeframe}...")
            
            # Run detection with monitor-specific parameters
            result = self.detector.run_detection_with_params(
                symbol=self.config.symbol,
                timeframe=self.config.timeframe,
                margin=self.config.margin,
                min_move_percent=self.config.min_move_percent,
                swing_lookback=self.config.swing_lookback
            )
            
            if result is None:
                logger.info(f"[{self.config.name}] No setup detected")
                return
            
            # Check cooldown
            current_time = datetime.now()
            if (self.last_alert_time is None or 
                current_time - self.last_alert_time > self.alert_cooldown):
                
                logger.info(f"[{self.config.name}] 🚨 FIBONACCI SETUP DETECTED!")
                
                # Add monitor info to result
                result['monitor_name'] = self.config.name
                result['monitor_config'] = {
                    'margin': self.config.margin,
                    'min_move': self.config.min_move_percent,
                    'lookback': self.config.swing_lookback
                }
                
                # Send Discord alert
                if self.notifier.send_alert(result):
                    self.last_alert_time = current_time
                    logger.info(f"[{self.config.name}] Alert sent successfully")
                else:
                    logger.error(f"[{self.config.name}] Failed to send alert")
            else:
                logger.info(f"[{self.config.name}] Alert suppressed (cooldown)")
                
        except Exception as e:
            logger.error(f"[{self.config.name}] Error in check_setup: {e}")

class MegaMonitor:
    """Main class that manages multiple monitor instances"""
    
    def __init__(self):
        self.notifier = DiscordNotifier()
        self.monitors: List[SingleMonitor] = []
        self.monitor_configs = self._create_monitor_configs()
        self._initialize_monitors()
        
        logger.info(f"Mega Monitor initialized with {len(self.monitors)} monitors")
    
    def _create_monitor_configs(self) -> List[MonitorConfig]:
        """Create configurations for all monitor instances"""
        return get_monitor_configs()
    
    def _initialize_monitors(self) -> None:
        """Initialize all monitor instances"""
        for config in self.monitor_configs:
            if config.enabled:
                monitor = SingleMonitor(config, self.notifier)
                self.monitors.append(monitor)
    
    def _schedule_monitor(self, monitor: SingleMonitor) -> None:
        """Schedule a single monitor to run at its specified interval"""
        schedule.every(monitor.config.check_interval_minutes).minutes.do(monitor.check_setup)
        logger.info(f"Scheduled '{monitor.config.name}' every {monitor.config.check_interval_minutes} minutes")
    
    def send_startup_message(self) -> None:
        """Send startup message to Discord"""
        if not DISCORD_WEBHOOK_URL:
            logger.warning("Discord webhook not configured - alerts will be console only")
            return
        
        message = f"""
🚀 **MEGA FIBONACCI MONITOR STARTED** 🚀

**Active Monitors:** {len(self.monitors)}

**📊 Monitor Summary:**
"""
        
        # Group monitors by symbol
        by_symbol = {}
        for monitor in self.monitors:
            symbol = monitor.config.symbol
            if symbol not in by_symbol:
                by_symbol[symbol] = []
            by_symbol[symbol].append(monitor)
        
        for symbol, monitors in by_symbol.items():
            message += f"\n**{symbol}:** {len(monitors)} monitors"
            for monitor in monitors:
                message += f"\n• {monitor.config.name} ({monitor.config.timeframe})"
        
        message += f"""

**⚙️ Configuration:**
• Margin Range: 0.1% - 0.5%
• Timeframes: 1h, 4h, 1d
• Check Intervals: 3-30 minutes
• Symbols: SOL, BTC, ETH, ADA, DOT

**📈 Monitoring Active:**
All monitors are now running and will send alerts when Fibonacci 0.618 retracements are detected.

**⏰ Started at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC
"""
        
        try:
            payload = {
                'username': 'Mega Fibonacci Monitor',
                'avatar_url': DISCORD_AVATAR_URL,
                'content': message.strip()
            }
            
            response = requests.post(DISCORD_WEBHOOK_URL, json=payload)
            if response.status_code == 204:
                logger.info("Startup message sent to Discord")
            else:
                logger.error(f"Failed to send startup message: {response.status_code}")
        except Exception as e:
            logger.error(f"Error sending startup message: {e}")
    
    def run(self) -> None:
        """Run the mega monitor"""
        logger.info("Starting Mega Fibonacci Monitor...")
        
        # Schedule all monitors
        for monitor in self.monitors:
            self._schedule_monitor(monitor)
        
        # Send startup message
        self.send_startup_message()
        
        logger.info(f"All {len(self.monitors)} monitors scheduled and running")
        logger.info("Press Ctrl+C to stop the mega monitor")
        
        try:
            while True:
                schedule.run_pending()
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Mega Monitor stopped by user")
        except Exception as e:
            logger.error(f"Unexpected error in mega monitor: {e}")

def main():
    """Main entry point"""
    print("=" * 80)
    print("🚀 MEGA FIBONACCI MONITOR - MULTI-CONFIGURATION TRADING BOT")
    print("=" * 80)
    print("📊 Monitoring multiple symbols, timeframes, and detection parameters")
    print("📈 All alerts sent to the same Discord webhook")
    print("⚙️ Configurable margins, lookback periods, and check intervals")
    print("=" * 80)
    
    # Check Discord webhook
    if not DISCORD_WEBHOOK_URL:
        print("⚠️  WARNING: Discord webhook not configured!")
        print("   Alerts will be console-only. Set DISCORD_WEBHOOK_URL in .env file")
        print("=" * 80)
    
    # Create and run mega monitor
    mega_monitor = MegaMonitor()
    mega_monitor.run()

if __name__ == "__main__":
    main() 
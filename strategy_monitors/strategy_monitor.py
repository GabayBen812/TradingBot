#!/usr/bin/env python3
"""
Strategy Monitor - Multi-Strategy Trading Bot

This script runs multiple strategy detectors simultaneously:
- Support/Resistance breaks
- Moving Average crossovers
- RSI divergences
- MACD crossovers
- Bollinger Band squeezes
- All sending alerts to Discord webhook
"""

import time
import schedule
import logging
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import os
import sys

from strategy_detector import StrategyDetector, StrategyConfig
from discord_notifier import DiscordNotifier
from config import *

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('strategy_monitor.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class SingleStrategyMonitor:
    """Individual strategy monitor instance"""
    def __init__(self, config: StrategyConfig, notifier: DiscordNotifier):
        self.config = config
        self.notifier = notifier
        self.detector = StrategyDetector()
        self.last_alert_time = None
        self.alert_cooldown = timedelta(minutes=30)
        
        logger.info(f"Strategy Monitor '{config.name}' initialized: {config.symbol} {config.timeframe}")
    
    def check_strategies(self) -> None:
        """Check for strategy setups with this monitor's configuration"""
        try:
            logger.info(f"[{self.config.name}] Checking strategies for {self.config.symbol} on {self.config.timeframe}...")
            
            # Run strategy detection
            signals = self.detector.run_strategy_detection(self.config.symbol, self.config.timeframe)
            
            if not signals:
                logger.info(f"[{self.config.name}] No strategy signals detected")
                return
            
            # Check cooldown
            current_time = datetime.now()
            if (self.last_alert_time is None or 
                current_time - self.last_alert_time > self.alert_cooldown):
                
                logger.info(f"[{self.config.name}] 🚨 STRATEGY SIGNALS DETECTED!")
                
                # Send alerts for each signal
                for signal in signals:
                    # Add monitor info to signal
                    signal['monitor_name'] = self.config.name
                    signal['symbol'] = self.config.symbol
                    signal['timeframe'] = self.config.timeframe
                    signal['timestamp'] = datetime.now()
                    
                    # Send Discord alert
                    if self.notifier.send_strategy_alert(signal):
                        logger.info(f"[{self.config.name}] Strategy alert sent: {signal['strategy']}")
                    else:
                        logger.error(f"[{self.config.name}] Failed to send strategy alert")
                
                self.last_alert_time = current_time
            else:
                logger.info(f"[{self.config.name}] Alerts suppressed (cooldown)")
                
        except Exception as e:
            logger.error(f"[{self.config.name}] Error in strategy check: {e}")

class StrategyMonitor:
    """Main class that manages multiple strategy monitors"""
    
    def __init__(self):
        self.notifier = DiscordNotifier()
        self.monitors: List[SingleStrategyMonitor] = []
        self.strategy_configs = self._create_strategy_configs()
        self._initialize_monitors()
        
        logger.info(f"Strategy Monitor initialized with {len(self.monitors)} monitors")
    
    def _create_strategy_configs(self) -> List[StrategyConfig]:
        """Create configurations for all strategy monitors"""
        configs = []
        
        # SOL Strategy monitors
        configs.extend([
            StrategyConfig(
                name="SOL-1H-Strategies",
                symbol="SOLUSDT",
                timeframe="1h",
                enabled=True
            ),
            StrategyConfig(
                name="SOL-4H-Strategies",
                symbol="SOLUSDT",
                timeframe="4h",
                enabled=True
            ),
            StrategyConfig(
                name="SOL-1D-Strategies",
                symbol="SOLUSDT",
                timeframe="1d",
                enabled=True
            )
        ])
        
        # BTC Strategy monitors
        configs.extend([
            StrategyConfig(
                name="BTC-1H-Strategies",
                symbol="BTCUSDT",
                timeframe="1h",
                enabled=True
            ),
            StrategyConfig(
                name="BTC-4H-Strategies",
                symbol="BTCUSDT",
                timeframe="4h",
                enabled=True
            )
        ])
        
        # ETH Strategy monitors
        configs.extend([
            StrategyConfig(
                name="ETH-1H-Strategies",
                symbol="ETHUSDT",
                timeframe="1h",
                enabled=True
            ),
            StrategyConfig(
                name="ETH-4H-Strategies",
                symbol="ETHUSDT",
                timeframe="4h",
                enabled=True
            )
        ])
        
        # ADA Strategy monitors
        configs.extend([
            StrategyConfig(
                name="ADA-1H-Strategies",
                symbol="ADAUSDT",
                timeframe="1h",
                enabled=True
            ),
            StrategyConfig(
                name="ADA-4H-Strategies",
                symbol="ADAUSDT",
                timeframe="4h",
                enabled=True
            )
        ])
        
        # DOT Strategy monitors
        configs.extend([
            StrategyConfig(
                name="DOT-1H-Strategies",
                symbol="DOTUSDT",
                timeframe="1h",
                enabled=True
            ),
            StrategyConfig(
                name="DOT-4H-Strategies",
                symbol="DOTUSDT",
                timeframe="4h",
                enabled=True
            )
        ])
        
        # Strat Strategy (Rob Smith) monitors - dedicated monitors for strat strategy
        configs.extend([
            StrategyConfig(
                name="SOL-STRAT-1H",
                symbol="SOLUSDT",
                timeframe="1h",
                enabled=True
            ),
            StrategyConfig(
                name="SOL-STRAT-4H",
                symbol="SOLUSDT",
                timeframe="4h",
                enabled=True
            ),
            StrategyConfig(
                name="BTC-STRAT-1H",
                symbol="BTCUSDT",
                timeframe="1h",
                enabled=True
            ),
            StrategyConfig(
                name="BTC-STRAT-4H",
                symbol="BTCUSDT",
                timeframe="4h",
                enabled=True
            ),
            StrategyConfig(
                name="ETH-STRAT-1H",
                symbol="ETHUSDT",
                timeframe="1h",
                enabled=True
            ),
            StrategyConfig(
                name="ETH-STRAT-4H",
                symbol="ETHUSDT",
                timeframe="4h",
                enabled=True
            )
        ])
        
        return configs
    
    def _initialize_monitors(self) -> None:
        """Initialize all strategy monitors"""
        for config in self.strategy_configs:
            if config.enabled:
                monitor = SingleStrategyMonitor(config, self.notifier)
                self.monitors.append(monitor)
    
    def _schedule_monitor(self, monitor: SingleStrategyMonitor) -> None:
        """Schedule a single monitor to run"""
        # Schedule to run every 5 minutes
        schedule.every(5).minutes.do(monitor.check_strategies)
        logger.info(f"Scheduled '{monitor.config.name}' every 5 minutes")
    
    def send_startup_message(self) -> None:
        """Send startup message to Discord"""
        if not DISCORD_WEBHOOK_URL:
            logger.warning("Discord webhook not configured - alerts will be console only")
            return
        
        message = f"""
🚀 **STRATEGY MONITOR STARTED** 🚀

**Active Strategy Monitors:** {len(self.monitors)}

**📊 Strategy Types:**
• Support/Resistance Breaks
• Moving Average Crossovers
• RSI Divergences
• MACD Crossovers
• Bollinger Band Squeezes

**📈 Monitoring Active:**
All strategy monitors are now running and will send alerts when trading setups are detected.

**⏰ Started at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC
"""
        
        try:
            payload = {
                'username': 'Strategy Monitor',
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
        """Run the strategy monitor"""
        logger.info("Starting Strategy Monitor...")
        
        # Schedule all monitors
        for monitor in self.monitors:
            self._schedule_monitor(monitor)
        
        # Send startup message
        self.send_startup_message()
        
        logger.info(f"All {len(self.monitors)} strategy monitors scheduled and running")
        logger.info("Press Ctrl+C to stop the strategy monitor")
        
        try:
            while True:
                schedule.run_pending()
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Strategy Monitor stopped by user")
        except Exception as e:
            logger.error(f"Unexpected error in strategy monitor: {e}")

def main():
    """Main entry point"""
    print("=" * 80)
    print("🚀 STRATEGY MONITOR - MULTI-STRATEGY TRADING BOT")
    print("=" * 80)
    print("📊 Monitoring multiple trading strategies")
    print("📈 All alerts sent to the same Discord webhook")
    print("⚙️ Support/Resistance, MA Crossovers, RSI, MACD, Bollinger Bands")
    print("=" * 80)
    
    # Check Discord webhook
    if not DISCORD_WEBHOOK_URL:
        print("⚠️  WARNING: Discord webhook not configured!")
        print("   Alerts will be console-only. Set DISCORD_WEBHOOK_URL in .env file")
        print("=" * 80)
    
    # Create and run strategy monitor
    strategy_monitor = StrategyMonitor()
    strategy_monitor.run()

if __name__ == "__main__":
    main() 
#!/usr/bin/env python3
"""
Enhanced Mega Fibonacci Monitor with Position Management

This script runs multiple Fibonacci detectors with advanced position tracking:
- Detects Fibonacci setups
- Opens positions when setups are found
- Monitors entry prices for position activation
- Tracks live positions for TP/SL hits
- Provides comprehensive trade recaps
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
from position_manager import PositionManager
from config import *
from mega_config import get_monitor_configs, MonitorConfig

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('enhanced_mega_monitor.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Position management webhook URL
POSITIONS_WEBHOOK_URL = "https://discord.com/api/webhooks/1402103211325788160/2Hntjkfg8noz7Pr5Kjcv0regcyaa5ocwttNYz8KR03a89SppPzk7spVTUes9gKPev1Dm"

class EnhancedSingleMonitor:
    """Individual monitor instance with position management"""
    def __init__(self, config: MonitorConfig, notifier: DiscordNotifier, position_manager: PositionManager):
        self.config = config
        self.notifier = notifier
        self.position_manager = position_manager
        self.detector = FibonacciDetector(position_manager)
        self.last_alert_time = None
        self.alert_cooldown = timedelta(minutes=30)
        
        logger.info(f"Enhanced Monitor '{config.name}' initialized: {config.symbol} {config.timeframe}")
    
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
                    
                    # Open position after successful notification
                    if self.position_manager:
                        position_id = self.position_manager.open_position(result)
                        if position_id:
                            result['position_id'] = position_id
                            logger.info(f"[{self.config.name}] Position opened: {position_id}")
                            
                            # STRATEGY: Activate position immediately (at end of candle)
                            self.position_manager.activate_position(position_id)
                            logger.info(f"[{self.config.name}] Position activated immediately: {position_id}")
                        else:
                            logger.error(f"[{self.config.name}] Failed to open position")
                else:
                    logger.error(f"[{self.config.name}] Failed to send alert")
            else:
                logger.info(f"[{self.config.name}] Alert suppressed (cooldown)")
                
        except Exception as e:
            logger.error(f"[{self.config.name}] Error in check_setup: {e}")
    
    def check_entry_prices(self) -> None:
        """Check if pending positions should be activated (entry price hit)"""
        try:
            # Get current price
            df = self.detector.get_binance_data(self.config.symbol, self.config.timeframe, 10)
            if df.empty:
                return
            
            current_price = df['close'].iloc[-1]
            
            # Check pending positions for this symbol
            pending_positions = self.position_manager.get_pending_positions()
            symbol_pending = [pos for pos in pending_positions if pos.symbol == self.config.symbol]
            
            for position in symbol_pending:
                # Check if current price is near entry price (within 0.1%)
                entry_tolerance = position.entry_price * 0.001
                if abs(current_price - position.entry_price) <= entry_tolerance:
                    logger.info(f"[{self.config.name}] Entry price hit for {position.id}: ${position.entry_price:.2f}")
                    self.position_manager.activate_position(position.id)
                    
        except Exception as e:
            logger.error(f"[{self.config.name}] Error checking entry prices: {e}")
    
    def monitor_active_positions(self) -> None:
        """Monitor active positions for TP/SL hits"""
        try:
            # Get current price
            df = self.detector.get_binance_data(self.config.symbol, self.config.timeframe, 10)
            if df.empty:
                return
            
            current_price = df['close'].iloc[-1]
            
            # Check active positions for this symbol
            active_positions = self.position_manager.get_active_positions()
            symbol_active = [pos for pos in active_positions if pos.symbol == self.config.symbol]
            
            for position in symbol_active:
                # Check if position should be closed
                exit_reason = self.position_manager.check_position_status(position.id, current_price)
                if exit_reason:
                    logger.info(f"[{self.config.name}] Position {position.id} closed: {exit_reason.value}")
                    self.position_manager.close_position(position.id, current_price, exit_reason)
                    
        except Exception as e:
            logger.error(f"[{self.config.name}] Error monitoring positions: {e}")

class EnhancedMegaMonitor:
    """Main class that manages multiple enhanced monitor instances"""
    
    def __init__(self):
        self.notifier = DiscordNotifier()
        self.position_manager = PositionManager(POSITIONS_WEBHOOK_URL)
        self.monitors: List[EnhancedSingleMonitor] = []
        self.monitor_configs = self._create_monitor_configs()
        self._initialize_monitors()
        
        logger.info(f"Enhanced Mega Monitor initialized with {len(self.monitors)} monitors")
    
    def _create_monitor_configs(self) -> List[MonitorConfig]:
        """Create configurations for all monitor instances"""
        return get_monitor_configs()
    
    def _initialize_monitors(self) -> None:
        """Initialize all monitor instances"""
        for config in self.monitor_configs:
            if config.enabled:
                monitor = EnhancedSingleMonitor(config, self.notifier, self.position_manager)
                self.monitors.append(monitor)
    
    def _schedule_monitor(self, monitor: EnhancedSingleMonitor) -> None:
        """Schedule a single monitor to run at its specified interval"""
        # Schedule setup detection
        schedule.every(monitor.config.check_interval_minutes).minutes.do(monitor.check_setup)
        logger.info(f"Scheduled '{monitor.config.name}' setup detection every {monitor.config.check_interval_minutes} minutes")
        
        # Schedule entry price checking (every 1 minute)
        schedule.every(1).minutes.do(monitor.check_entry_prices)
        logger.info(f"Scheduled '{monitor.config.name}' entry price checking every 1 minute")
        
        # Schedule position monitoring (every 30 seconds)
        schedule.every(30).seconds.do(monitor.monitor_active_positions)
        logger.info(f"Scheduled '{monitor.config.name}' position monitoring every 30 seconds")
    
    def send_startup_message(self) -> None:
        """Send startup message to Discord"""
        if not DISCORD_WEBHOOK_URL:
            logger.warning("Discord webhook not configured - alerts will be console only")
            return
        
        message = f"""
🚀 **ENHANCED MEGA FIBONACCI MONITOR STARTED** 🚀

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

**🎯 Position Management:**
• Automatic position opening on Fibonacci setups
• Entry price monitoring for position activation
• Live TP/SL monitoring
• Comprehensive trade recaps with P&L

**📈 Monitoring Active:**
All monitors are now running and will send alerts when Fibonacci 0.618 retracements are detected.

**⏰ Started at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC
"""
        
        try:
            payload = {
                'username': 'Enhanced Mega Fibonacci Monitor',
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
    
    def send_position_stats(self) -> None:
        """Send periodic position statistics"""
        try:
            stats = self.position_manager.get_position_stats()
            
            message = f"""
📊 **POSITION STATISTICS** 📊

**Overall Performance:**
• Total Trades: {stats['total_trades']}
• Win Rate: {stats['win_rate']:.1f}% ({stats['win_count']}W/{stats['loss_count']}L)
• Total R: {stats['total_r']:.2f}R
• Average R: {stats['avg_r']:.2f}R per trade

**Current Status:**
• Active Positions: {stats['active_positions']}
• Pending Positions: {stats['pending_positions']}

**📈 Performance Summary:**
"""
            
            if stats['total_trades'] > 0:
                if stats['win_rate'] >= 50:
                    message += "✅ **PROFITABLE SYSTEM** - Win rate above 50%"
                else:
                    message += "⚠️ **SYSTEM NEEDS IMPROVEMENT** - Win rate below 50%"
                
                if stats['avg_r'] > 0:
                    message += f"\n✅ **POSITIVE EXPECTANCY** - Average {stats['avg_r']:.2f}R per trade"
                else:
                    message += f"\n❌ **NEGATIVE EXPECTANCY** - Average {stats['avg_r']:.2f}R per trade"
            else:
                message += "📋 **NO TRADES YET** - Waiting for first setup"
            
            message += f"\n\n**⏰ Updated at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC"
            
            payload = {
                'username': 'Position Manager',
                'avatar_url': 'https://cdn.discordapp.com/attachments/123456789/123456789/stats.png',
                'content': message.strip()
            }
            
            response = requests.post(POSITIONS_WEBHOOK_URL, json=payload)
            if response.status_code == 204:
                logger.info("Position statistics sent to Discord")
            else:
                logger.error(f"Failed to send position statistics: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error sending position statistics: {e}")
    
    def run(self) -> None:
        """Run the enhanced mega monitor"""
        logger.info("Starting Enhanced Mega Fibonacci Monitor...")
        
        # Schedule all monitors
        for monitor in self.monitors:
            self._schedule_monitor(monitor)
        
        # Schedule position statistics (every hour)
        schedule.every(1).hours.do(self.send_position_stats)
        logger.info("Scheduled position statistics every 1 hour")
        
        # Send startup message
        self.send_startup_message()
        
        logger.info(f"All {len(self.monitors)} monitors scheduled and running")
        logger.info("Press Ctrl+C to stop the enhanced mega monitor")
        
        try:
            while True:
                schedule.run_pending()
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Enhanced Mega Monitor stopped by user")
        except Exception as e:
            logger.error(f"Unexpected error in enhanced mega monitor: {e}")

def main():
    """Main entry point"""
    print("=" * 80)
    print("🚀 ENHANCED MEGA FIBONACCI MONITOR - POSITION MANAGEMENT")
    print("=" * 80)
    print("📊 Monitoring multiple symbols, timeframes, and detection parameters")
    print("📈 All alerts sent to the same Discord webhook")
    print("🎯 Advanced position management with live monitoring")
    print("💰 Comprehensive trade recaps with P&L tracking")
    print("=" * 80)
    
    # Check Discord webhook
    if not DISCORD_WEBHOOK_URL:
        print("⚠️  WARNING: Discord webhook not configured!")
        print("   Alerts will be console-only. Set DISCORD_WEBHOOK_URL in .env file")
        print("=" * 80)
    
    # Check positions webhook
    if not POSITIONS_WEBHOOK_URL:
        print("⚠️  WARNING: Positions webhook not configured!")
        print("   Position alerts will be console-only.")
        print("=" * 80)
    
    # Create and run enhanced mega monitor
    enhanced_mega_monitor = EnhancedMegaMonitor()
    enhanced_mega_monitor.run()

if __name__ == "__main__":
    main() 
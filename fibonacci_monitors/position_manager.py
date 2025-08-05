#!/usr/bin/env python3
"""
Position Manager - Advanced Trading Position Tracking

This module manages live trading positions, monitors TP/SL hits,
and provides comprehensive trade recaps with P&L calculations.
"""

import time
import schedule
import logging
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import pandas as pd

logger = logging.getLogger(__name__)

class PositionStatus(Enum):
    PENDING = "PENDING"      # Setup detected, waiting for entry
    ACTIVE = "ACTIVE"        # Position opened, monitoring
    CLOSED = "CLOSED"        # Position closed (TP/SL hit)
    CANCELLED = "CANCELLED"  # Setup invalidated

class ExitReason(Enum):
    TP1_HIT = "TP1_HIT"
    TP2_HIT = "TP2_HIT"
    TP3_HIT = "TP3_HIT"
    SL_HIT = "SL_HIT"
    MANUAL = "MANUAL"

@dataclass
class Position:
    """Represents a trading position"""
    id: str
    symbol: str
    timeframe: str
    setup_type: str  # LONG or SHORT
    entry_price: float
    tp1: float
    tp2: float
    tp3: float
    sl: float
    position_size: float = 1.0  # Risk units (R)
    status: PositionStatus = PositionStatus.PENDING
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[ExitReason] = None
    pnl: Optional[float] = None
    r_multiple: Optional[float] = None
    setup_monitor: str = ""
    fib_level: float = 0.618

class PositionManager:
    """Manages live trading positions and provides comprehensive tracking"""
    
    def __init__(self, positions_webhook_url: str):
        self.positions_webhook_url = positions_webhook_url
        self.positions: Dict[str, Position] = {}
        self.total_r = 0.0  # Total R multiple across all trades
        self.win_count = 0
        self.loss_count = 0
        self.total_trades = 0
        
        logger.info("Position Manager initialized")
    
    def create_position_id(self, symbol: str, timeframe: str, setup_type: str) -> str:
        """Create unique position ID"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return f"{symbol}_{timeframe}_{setup_type}_{timestamp}"
    
    def open_position(self, detection_result: Dict) -> str:
        """Open a new position based on Fibonacci setup"""
        try:
            # Extract data from detection result
            symbol = detection_result['symbol']
            timeframe = detection_result['timeframe']
            current_price = detection_result['current_price']
            trading_levels = detection_result['trading_levels']
            fib_levels = detection_result['fibonacci_levels']
            monitor_name = detection_result.get('monitor_name', 'Unknown')
            
            # Determine setup type
            setup_type = "LONG" if current_price <= fib_levels[0.618] else "SHORT"
            
            # Create position ID
            position_id = self.create_position_id(symbol, timeframe, setup_type)
            
            # Create position object
            position = Position(
                id=position_id,
                symbol=symbol,
                timeframe=timeframe,
                setup_type=setup_type,
                entry_price=trading_levels['entry'],
                tp1=trading_levels['tp1'],
                tp2=trading_levels['tp2'],
                tp3=trading_levels['tp3'],
                sl=trading_levels['sl'],
                setup_monitor=monitor_name,
                fib_level=fib_levels[0.618]
            )
            
            # Store position
            self.positions[position_id] = position
            
            # Send position opened alert
            self.send_position_opened_alert(position, detection_result)
            
            logger.info(f"Position opened: {position_id} - {symbol} {setup_type}")
            return position_id
            
        except Exception as e:
            logger.error(f"Error opening position: {e}")
            return None
    
    def check_position_status(self, position_id: str, current_price: float) -> Optional[ExitReason]:
        """Check if position should be closed based on current price"""
        position = self.positions.get(position_id)
        if not position or position.status != PositionStatus.ACTIVE:
            return None
        
        if position.setup_type == "LONG":
            # Check for TP hits (price moving up)
            if current_price >= position.tp3:
                return ExitReason.TP3_HIT
            elif current_price >= position.tp2:
                return ExitReason.TP2_HIT
            elif current_price >= position.tp1:
                return ExitReason.TP1_HIT
            # Check for SL hit (price moving down)
            elif current_price <= position.sl:
                return ExitReason.SL_HIT
        else:  # SHORT
            # Check for TP hits (price moving down)
            if current_price <= position.tp3:
                return ExitReason.TP3_HIT
            elif current_price <= position.tp2:
                return ExitReason.TP2_HIT
            elif current_price <= position.tp1:
                return ExitReason.TP1_HIT
            # Check for SL hit (price moving up)
            elif current_price >= position.sl:
                return ExitReason.SL_HIT
        
        return None
    
    def close_position(self, position_id: str, exit_price: float, exit_reason: ExitReason) -> bool:
        """Close a position and calculate P&L"""
        try:
            position = self.positions.get(position_id)
            if not position:
                logger.error(f"Position {position_id} not found")
                return False
            
            # Update position
            position.status = PositionStatus.CLOSED
            position.exit_time = datetime.now()
            position.exit_price = exit_price
            position.exit_reason = exit_reason
            
            # Calculate P&L and R multiple
            if position.setup_type == "LONG":
                pnl = (exit_price - position.entry_price) / position.entry_price
                r_risk = (position.entry_price - position.sl) / position.entry_price
            else:  # SHORT
                pnl = (position.entry_price - exit_price) / position.entry_price
                r_risk = (position.sl - position.entry_price) / position.entry_price
            
            position.pnl = pnl
            position.r_multiple = pnl / r_risk if r_risk > 0 else 0
            
            # Update statistics
            self.total_r += position.r_multiple
            self.total_trades += 1
            
            if position.r_multiple > 0:
                self.win_count += 1
            else:
                self.loss_count += 1
            
            # Send position closed alert
            self.send_position_closed_alert(position)
            
            logger.info(f"Position closed: {position_id} - P&L: {pnl:.2%}, R: {position.r_multiple:.2f}")
            return True
            
        except Exception as e:
            logger.error(f"Error closing position {position_id}: {e}")
            return False
    
    def activate_position(self, position_id: str) -> bool:
        """Activate a pending position (when entry price is hit)"""
        try:
            position = self.positions.get(position_id)
            if not position or position.status != PositionStatus.PENDING:
                return False
            
            position.status = PositionStatus.ACTIVE
            position.entry_time = datetime.now()
            
            # Send position activated alert
            self.send_position_activated_alert(position)
            
            logger.info(f"Position activated: {position_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error activating position {position_id}: {e}")
            return False
    
    def send_position_opened_alert(self, position: Position, detection_result: Dict) -> bool:
        """Send alert when position is opened"""
        try:
            message = f"""
🚨 **POSITION OPENED** 🚨

**Position ID:** {position.id}
**Symbol:** {position.symbol}
**Timeframe:** {position.timeframe}
**Setup Type:** {position.setup_type}
**Monitor:** {position.setup_monitor}

**📊 Entry Details:**
• Entry Price: ${position.entry_price:.2f}
• Fibonacci Level: {position.fib_level:.1%}
• Current Price: ${detection_result['current_price']:.2f}

**💰 Trading Levels:**
• TP1: ${position.tp1:.2f}
• TP2: ${position.tp2:.2f}
• TP3: ${position.tp3:.2f}
• SL: ${position.sl:.2f}

**📋 Strategy:**
Waiting for next candle to touch entry price at ${position.entry_price:.2f}

**⏰ Opened at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC
"""
            
            payload = {
                'username': 'Position Manager',
                'avatar_url': 'https://cdn.discordapp.com/attachments/123456789/123456789/position.png',
                'content': message.strip()
            }
            
            response = requests.post(self.positions_webhook_url, json=payload)
            return response.status_code == 204
            
        except Exception as e:
            logger.error(f"Error sending position opened alert: {e}")
            return False
    
    def send_position_activated_alert(self, position: Position) -> bool:
        """Send alert when position is activated (entry price hit)"""
        try:
            message = f"""
✅ **POSITION ACTIVATED** ✅

**Position ID:** {position.id}
**Symbol:** {position.symbol}
**Setup Type:** {position.setup_type}

**📈 Entry Confirmed:**
• Entry Price: ${position.entry_price:.2f}
• Entry Time: {position.entry_time.strftime('%Y-%m-%d %H:%M:%S')} UTC

**🎯 Now Monitoring:**
• TP1: ${position.tp1:.2f}
• TP2: ${position.tp2:.2f}
• TP3: ${position.tp3:.2f}
• SL: ${position.sl:.2f}

Position is now live and being monitored for TP/SL hits!
"""
            
            payload = {
                'username': 'Position Manager',
                'avatar_url': 'https://cdn.discordapp.com/attachments/123456789/123456789/position.png',
                'content': message.strip()
            }
            
            response = requests.post(self.positions_webhook_url, json=payload)
            return response.status_code == 204
            
        except Exception as e:
            logger.error(f"Error sending position activated alert: {e}")
            return False
    
    def send_position_closed_alert(self, position: Position) -> bool:
        """Send alert when position is closed"""
        try:
            # Determine exit type
            exit_type = "🎯 TAKE PROFIT" if position.exit_reason.value.startswith("TP") else "🛑 STOP LOSS"
            exit_emoji = "✅" if position.r_multiple > 0 else "❌"
            
            message = f"""
{exit_emoji} **POSITION CLOSED** {exit_emoji}

**Position ID:** {position.id}
**Symbol:** {position.symbol}
**Setup Type:** {position.setup_type}
**Exit Type:** {exit_type}

**📊 Trade Summary:**
• Entry Price: ${position.entry_price:.2f}
• Exit Price: ${position.exit_price:.2f}
• Exit Reason: {position.exit_reason.value}
• P&L: {position.pnl:.2%}
• R Multiple: {position.r_multiple:.2f}R

**⏰ Trade Duration:**
• Entry: {position.entry_time.strftime('%Y-%m-%d %H:%M:%S')} UTC
• Exit: {position.exit_time.strftime('%Y-%m-%d %H:%M:%S')} UTC
• Duration: {position.exit_time - position.entry_time}

**📈 Overall Statistics:**
• Total Trades: {self.total_trades}
• Win Rate: {(self.win_count/self.total_trades*100):.1f}% ({self.win_count}W/{self.loss_count}L)
• Total R: {self.total_r:.2f}R
• Average R: {(self.total_r/self.total_trades):.2f}R per trade
"""
            
            payload = {
                'username': 'Position Manager',
                'avatar_url': 'https://cdn.discordapp.com/attachments/123456789/123456789/position.png',
                'content': message.strip()
            }
            
            response = requests.post(self.positions_webhook_url, json=payload)
            return response.status_code == 204
            
        except Exception as e:
            logger.error(f"Error sending position closed alert: {e}")
            return False
    
    def get_active_positions(self) -> List[Position]:
        """Get all active positions"""
        return [pos for pos in self.positions.values() if pos.status == PositionStatus.ACTIVE]
    
    def get_pending_positions(self) -> List[Position]:
        """Get all pending positions"""
        return [pos for pos in self.positions.values() if pos.status == PositionStatus.PENDING]
    
    def get_position_stats(self) -> Dict:
        """Get comprehensive position statistics"""
        return {
            'total_trades': self.total_trades,
            'win_count': self.win_count,
            'loss_count': self.loss_count,
            'win_rate': (self.win_count/self.total_trades*100) if self.total_trades > 0 else 0,
            'total_r': self.total_r,
            'avg_r': (self.total_r/self.total_trades) if self.total_trades > 0 else 0,
            'active_positions': len(self.get_active_positions()),
            'pending_positions': len(self.get_pending_positions())
        } 
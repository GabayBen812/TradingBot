#!/usr/bin/env python3
"""
Advanced Trade Journaling System
Based on professional trading psychology and performance metrics
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import os
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

@dataclass
class TradeEntry:
    """Structured trade entry with professional metrics"""
    # Basic Trade Info
    trade_id: str
    symbol: str
    timeframe: str
    setup_type: str  # LONG/SHORT
    entry_time: str
    exit_time: Optional[str] = None
    
    # Price Levels
    entry_price: float = 0.0
    exit_price: Optional[float] = None
    stop_loss: float = 0.0
    take_profit_1: float = 0.0
    take_profit_2: float = 0.0
    take_profit_3: float = 0.0
    
    # Fibonacci Analysis
    swing_high: float = 0.0
    swing_low: float = 0.0
    fib_level: float = 0.0  # Which Fibonacci level (0.618, 0.5, etc.)
    
    # Position Management
    position_size: str = "MEDIUM"  # SMALL/MEDIUM/LARGE
    risk_level: str = "MEDIUM"  # LOW/MEDIUM/HIGH
    risk_amount: float = 0.0  # Amount risked
    
    # Performance Metrics
    pnl: Optional[float] = None
    pnl_percent: Optional[float] = None
    r_multiple: Optional[float] = None
    max_drawdown: Optional[float] = None
    
    # AI Analysis
    ai_confidence: float = 0.0
    ai_recommendation: str = ""
    ai_reasoning: str = ""
    
    # Psychology & Notes
    emotional_state: str = "CALM"  # CALM/EXCITED/FEARFUL/OVERCONFIDENT
    trade_plan_followed: bool = True
    notes: str = ""
    lessons_learned: str = ""
    
    # Risk Management
    risk_reward_ratio: float = 0.0
    position_size_percent: float = 0.0  # % of account
    
    # Market Context
    market_condition: str = "NEUTRAL"  # BULLISH/BEARISH/NEUTRAL
    volatility_level: str = "NORMAL"  # LOW/NORMAL/HIGH
    news_impact: str = "NONE"  # NONE/LOW/MEDIUM/HIGH

class AdvancedTradeJournal:
    """Professional trade journaling system with psychology and performance tracking"""
    
    def __init__(self, journal_file: str = "trade_journal.json"):
        self.journal_file = journal_file
        self.trades = self.load_journal()
    
    def load_journal(self) -> List[Dict]:
        """Load existing trade journal"""
        try:
            if os.path.exists(self.journal_file):
                with open(self.journal_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Error loading trade journal: {e}")
        return []
    
    def save_journal(self):
        """Save trade journal to file"""
        try:
            with open(self.journal_file, 'w') as f:
                json.dump(self.trades, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving trade journal: {e}")
    
    def add_trade(self, trade: TradeEntry):
        """Add a new trade to the journal"""
        trade_dict = asdict(trade)
        self.trades.append(trade_dict)
        self.save_journal()
        logger.info(f"Added trade {trade.trade_id} to journal")
    
    def update_trade_exit(self, trade_id: str, exit_price: float, pnl: float):
        """Update trade with exit information"""
        for trade in self.trades:
            if trade['trade_id'] == trade_id:
                trade['exit_price'] = exit_price
                trade['pnl'] = pnl
                trade['exit_time'] = datetime.now().isoformat()
                
                # Calculate additional metrics
                if trade['entry_price'] > 0:
                    trade['pnl_percent'] = (pnl / trade['entry_price']) * 100
                    trade['r_multiple'] = pnl / trade['risk_amount'] if trade['risk_amount'] > 0 else 0
                
                self.save_journal()
                logger.info(f"Updated trade {trade_id} with exit data")
                return True
        return False
    
    def get_performance_metrics(self, days: int = 30) -> Dict:
        """Calculate comprehensive performance metrics"""
        cutoff_date = datetime.now() - timedelta(days=days)
        recent_trades = [
            t for t in self.trades 
            if datetime.fromisoformat(t.get('entry_time', '2000-01-01')) > cutoff_date
        ]
        
        if not recent_trades:
            return {"error": f"No trades in last {days} days"}
        
        # Basic metrics
        total_trades = len(recent_trades)
        winning_trades = [t for t in recent_trades if t.get('pnl', 0) > 0]
        losing_trades = [t for t in recent_trades if t.get('pnl', 0) < 0]
        
        win_rate = len(winning_trades) / total_trades if total_trades > 0 else 0
        total_pnl = sum(t.get('pnl', 0) for t in recent_trades)
        avg_pnl = total_pnl / total_trades if total_trades > 0 else 0
        
        # Advanced metrics
        avg_win = sum(t.get('pnl', 0) for t in winning_trades) / len(winning_trades) if winning_trades else 0
        avg_loss = sum(t.get('pnl', 0) for t in losing_trades) / len(losing_trades) if losing_trades else 0
        profit_factor = abs(avg_win / avg_loss) if avg_loss != 0 else float('inf')
        
        # R-multiple analysis
        r_multiples = [t.get('r_multiple', 0) for t in recent_trades if t.get('r_multiple')]
        avg_r_multiple = sum(r_multiples) / len(r_multiples) if r_multiples else 0
        
        # Psychology analysis
        emotional_states = {}
        for trade in recent_trades:
            state = trade.get('emotional_state', 'UNKNOWN')
            emotional_states[state] = emotional_states.get(state, 0) + 1
        
        # AI performance analysis
        ai_high_confidence = [t for t in recent_trades if t.get('ai_confidence', 0) >= 0.8]
        ai_high_confidence_win_rate = len([t for t in ai_high_confidence if t.get('pnl', 0) > 0]) / len(ai_high_confidence) if ai_high_confidence else 0
        
        return {
            'period_days': days,
            'total_trades': total_trades,
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'win_rate': win_rate,
            'total_pnl': total_pnl,
            'avg_pnl': avg_pnl,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'profit_factor': profit_factor,
            'avg_r_multiple': avg_r_multiple,
            'emotional_states': emotional_states,
            'ai_high_confidence_trades': len(ai_high_confidence),
            'ai_high_confidence_win_rate': ai_high_confidence_win_rate
        }
    
    def get_psychological_insights(self) -> List[str]:
        """Analyze trading psychology patterns"""
        insights = []
        
        # Emotional state analysis
        emotional_states = {}
        for trade in self.trades:
            state = trade.get('emotional_state', 'UNKNOWN')
            emotional_states[state] = emotional_states.get(state, 0) + 1
        
        if emotional_states.get('EXCITED', 0) > len(self.trades) * 0.3:
            insights.append("⚠️ High excitement levels detected - risk of overtrading")
        
        if emotional_states.get('FEARFUL', 0) > len(self.trades) * 0.3:
            insights.append("⚠️ High fear levels detected - may be missing opportunities")
        
        if emotional_states.get('OVERCONFIDENT', 0) > len(self.trades) * 0.2:
            insights.append("⚠️ Overconfidence detected - risk of poor risk management")
        
        # Plan following analysis
        plan_followed = [t for t in self.trades if t.get('trade_plan_followed', True)]
        plan_follow_rate = len(plan_followed) / len(self.trades) if self.trades else 0
        
        if plan_follow_rate < 0.8:
            insights.append("⚠️ Low plan following rate - need better discipline")
        
        return insights
    
    def get_improvement_suggestions(self) -> List[str]:
        """Get actionable improvement suggestions"""
        metrics = self.get_performance_metrics(30)
        suggestions = []
        
        if metrics.get('error'):
            return ["No recent trades for analysis"]
        
        # Win rate suggestions
        win_rate = metrics['win_rate']
        if win_rate < 0.4:
            suggestions.append("🔴 Win rate below 40% - Consider tightening entry criteria")
        elif win_rate < 0.5:
            suggestions.append("🟡 Win rate below 50% - Review risk management")
        elif win_rate < 0.6:
            suggestions.append("🟢 Good win rate - Focus on improving R-multiple")
        else:
            suggestions.append("🟢 Excellent win rate - Maintain current approach")
        
        # Profit factor suggestions
        profit_factor = metrics['profit_factor']
        if profit_factor < 1.5:
            suggestions.append("🔴 Low profit factor - Improve risk/reward ratios")
        elif profit_factor < 2.0:
            suggestions.append("🟡 Moderate profit factor - Look for better setups")
        else:
            suggestions.append("🟢 Excellent profit factor - Strong edge")
        
        # R-multiple suggestions
        avg_r = metrics['avg_r_multiple']
        if avg_r < 0.5:
            suggestions.append("🔴 Low R-multiple - Consider wider take profits")
        elif avg_r < 1.0:
            suggestions.append("🟡 Moderate R-multiple - Look for better risk/reward")
        else:
            suggestions.append("🟢 Good R-multiple - Strong performance")
        
        # AI confidence suggestions
        ai_win_rate = metrics['ai_high_confidence_win_rate']
        if ai_win_rate < 0.6:
            suggestions.append("🔴 AI high-confidence trades underperforming - Review AI criteria")
        else:
            suggestions.append("🟢 AI high-confidence trades performing well")
        
        return suggestions
    
    def generate_journal_report(self) -> str:
        """Generate comprehensive trading journal report"""
        metrics = self.get_performance_metrics(30)
        insights = self.get_psychological_insights()
        suggestions = self.get_improvement_suggestions()
        
        report = f"""
📊 **TRADING PERFORMANCE REPORT** 📊
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

**📈 PERFORMANCE METRICS (Last 30 Days):**
• Total Trades: {metrics.get('total_trades', 0)}
• Win Rate: {metrics.get('win_rate', 0):.1%}
• Total P&L: ${metrics.get('total_pnl', 0):.2f}
• Average P&L: ${metrics.get('avg_pnl', 0):.2f}
• Profit Factor: {metrics.get('profit_factor', 0):.2f}
• Average R-Multiple: {metrics.get('avg_r_multiple', 0):.2f}

**🤖 AI PERFORMANCE:**
• High-Confidence Trades: {metrics.get('ai_high_confidence_trades', 0)}
• AI Win Rate: {metrics.get('ai_high_confidence_win_rate', 0):.1%}

**🧠 PSYCHOLOGICAL INSIGHTS:**
"""
        
        for insight in insights:
            report += f"• {insight}\n"
        
        report += f"""
**🎯 IMPROVEMENT SUGGESTIONS:**
"""
        
        for suggestion in suggestions:
            report += f"• {suggestion}\n"
        
        return report

def create_trade_from_setup(setup_data: Dict, ai_analysis: Dict) -> TradeEntry:
    """Create a trade entry from a detected setup"""
    trade_id = f"{setup_data['symbol']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    return TradeEntry(
        trade_id=trade_id,
        symbol=setup_data['symbol'],
        timeframe=setup_data['timeframe'],
        setup_type=setup_data['trading_levels'].get('setup_type', 'LONG'),
        entry_time=datetime.now().isoformat(),
        entry_price=setup_data['current_price'],
        stop_loss=setup_data['trading_levels'].get('sl', 0),
        take_profit_1=setup_data['trading_levels'].get('tp1', 0),
        take_profit_2=setup_data['trading_levels'].get('tp2', 0),
        take_profit_3=setup_data['trading_levels'].get('tp3', 0),
        swing_high=setup_data['swing_high'],
        swing_low=setup_data['swing_low'],
        fib_level=0.618,  # Default to 61.8%
        position_size=ai_analysis.get('position_size', 'MEDIUM'),
        risk_level=ai_analysis.get('risk_level', 'MEDIUM'),
        ai_confidence=ai_analysis.get('confidence_score', 0),
        ai_recommendation=ai_analysis.get('recommendation', ''),
        ai_reasoning=ai_analysis.get('reasoning', ''),
        emotional_state='CALM',  # Default - should be updated by trader
        risk_reward_ratio=abs(setup_data['trading_levels'].get('tp1', 0) - setup_data['current_price']) / abs(setup_data['current_price'] - setup_data['trading_levels'].get('sl', 0))
    )

if __name__ == "__main__":
    # Test the trade journal
    journal = AdvancedTradeJournal()
    report = journal.generate_journal_report()
    print(report) 
#!/usr/bin/env python3
"""
Trade Analyzer for Fibonacci Bot
Analyzes trade patterns to improve win rate and R-multiple
"""

import json
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)

class TradeAnalyzer:
    def __init__(self):
        self.trades_file = "trade_history.json"
        self.trades = self.load_trades()
    
    def load_trades(self) -> List[Dict]:
        """Load trade history from file"""
        try:
            if os.path.exists(self.trades_file):
                with open(self.trades_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Error loading trades: {e}")
        return []
    
    def save_trades(self):
        """Save trade history to file"""
        try:
            with open(self.trades_file, 'w') as f:
                json.dump(self.trades, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving trades: {e}")
    
    def add_trade(self, trade_data: Dict):
        """Add a new trade to the history"""
        trade_data['timestamp'] = datetime.now().isoformat()
        self.trades.append(trade_data)
        self.save_trades()
    
    def analyze_performance(self) -> Dict:
        """Analyze overall trading performance"""
        if not self.trades:
            return {"error": "No trades found"}
        
        total_trades = len(self.trades)
        winning_trades = [t for t in self.trades if t.get('pnl', 0) > 0]
        losing_trades = [t for t in self.trades if t.get('pnl', 0) < 0]
        
        win_rate = len(winning_trades) / total_trades if total_trades > 0 else 0
        total_r = sum(t.get('r_multiple', 0) for t in self.trades)
        avg_r = total_r / total_trades if total_trades > 0 else 0
        
        # Analyze by symbol
        symbol_stats = {}
        for trade in self.trades:
            symbol = trade.get('symbol', 'Unknown')
            if symbol not in symbol_stats:
                symbol_stats[symbol] = {'trades': 0, 'wins': 0, 'total_r': 0}
            
            symbol_stats[symbol]['trades'] += 1
            if trade.get('pnl', 0) > 0:
                symbol_stats[symbol]['wins'] += 1
            symbol_stats[symbol]['total_r'] += trade.get('r_multiple', 0)
        
        # Analyze by timeframe
        timeframe_stats = {}
        for trade in self.trades:
            timeframe = trade.get('timeframe', 'Unknown')
            if timeframe not in timeframe_stats:
                timeframe_stats[timeframe] = {'trades': 0, 'wins': 0, 'total_r': 0}
            
            timeframe_stats[timeframe]['trades'] += 1
            if trade.get('pnl', 0) > 0:
                timeframe_stats[timeframe]['wins'] += 1
            timeframe_stats[timeframe]['total_r'] += trade.get('r_multiple', 0)
        
        return {
            'total_trades': total_trades,
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'win_rate': win_rate,
            'total_r': total_r,
            'avg_r': avg_r,
            'symbol_stats': symbol_stats,
            'timeframe_stats': timeframe_stats
        }
    
    def get_improvement_suggestions(self) -> List[str]:
        """Get suggestions to improve win rate and R-multiple"""
        analysis = self.analyze_performance()
        suggestions = []
        
        if analysis.get('error'):
            return ["No trade data available for analysis"]
        
        win_rate = analysis['win_rate']
        avg_r = analysis['avg_r']
        
        # Win rate suggestions
        if win_rate < 0.5:
            suggestions.append("🔴 Win rate below 50% - Consider tightening entry criteria")
        elif win_rate < 0.6:
            suggestions.append("🟡 Win rate below 60% - Look for better entry timing")
        else:
            suggestions.append("🟢 Good win rate - Focus on improving R-multiple")
        
        # R-multiple suggestions
        if avg_r < 0.1:
            suggestions.append("🔴 Low R-multiple - Consider wider take profits or tighter stops")
        elif avg_r < 0.5:
            suggestions.append("🟡 Moderate R-multiple - Look for better risk/reward setups")
        else:
            suggestions.append("🟢 Good R-multiple - Maintain current approach")
        
        # Symbol-specific suggestions
        symbol_stats = analysis.get('symbol_stats', {})
        for symbol, stats in symbol_stats.items():
            symbol_win_rate = stats['wins'] / stats['trades'] if stats['trades'] > 0 else 0
            if symbol_win_rate < 0.4:
                suggestions.append(f"🔴 {symbol} performing poorly - Consider removing or adjusting")
        
        # Timeframe-specific suggestions
        timeframe_stats = analysis.get('timeframe_stats', {})
        for timeframe, stats in timeframe_stats.items():
            tf_win_rate = stats['wins'] / stats['trades'] if stats['trades'] > 0 else 0
            if tf_win_rate < 0.4:
                suggestions.append(f"🔴 {timeframe} timeframe struggling - Review strategy")
        
        return suggestions
    
    def analyze_recent_trades(self, days: int = 7) -> Dict:
        """Analyze recent trades for patterns"""
        cutoff_date = datetime.now() - timedelta(days=days)
        recent_trades = [
            t for t in self.trades 
            if datetime.fromisoformat(t.get('timestamp', '2000-01-01')) > cutoff_date
        ]
        
        if not recent_trades:
            return {"error": f"No trades in last {days} days"}
        
        # Analyze patterns
        patterns = {
            'most_profitable_symbol': max(recent_trades, key=lambda x: x.get('pnl', 0))['symbol'],
            'most_profitable_timeframe': max(recent_trades, key=lambda x: x.get('pnl', 0))['timeframe'],
            'best_r_multiple': max(recent_trades, key=lambda x: x.get('r_multiple', 0)),
            'worst_performing': min(recent_trades, key=lambda x: x.get('pnl', 0))
        }
        
        return {
            'recent_trades_count': len(recent_trades),
            'patterns': patterns,
            'recent_trades': recent_trades
        }
    
    def get_optimal_settings(self) -> Dict:
        """Suggest optimal settings based on performance analysis"""
        analysis = self.analyze_performance()
        suggestions = {}
        
        # Find best performing symbols
        symbol_stats = analysis.get('symbol_stats', {})
        if symbol_stats:
            best_symbols = sorted(
                symbol_stats.items(), 
                key=lambda x: x[1]['wins'] / x[1]['trades'] if x[1]['trades'] > 0 else 0,
                reverse=True
            )[:3]
            suggestions['focus_symbols'] = [symbol for symbol, _ in best_symbols]
        
        # Find best performing timeframes
        timeframe_stats = analysis.get('timeframe_stats', {})
        if timeframe_stats:
            best_timeframes = sorted(
                timeframe_stats.items(),
                key=lambda x: x[1]['wins'] / x[1]['trades'] if x[1]['trades'] > 0 else 0,
                reverse=True
            )[:3]
            suggestions['focus_timeframes'] = [tf for tf, _ in best_timeframes]
        
        return suggestions

def analyze_current_performance():
    """Quick analysis of current performance"""
    analyzer = TradeAnalyzer()
    analysis = analyzer.analyze_performance()
    
    if analysis.get('error'):
        print("❌ No trade data available")
        return
    
    print("📊 TRADING PERFORMANCE ANALYSIS")
    print("=" * 50)
    print(f"Total Trades: {analysis['total_trades']}")
    print(f"Win Rate: {analysis['win_rate']:.1%}")
    print(f"Total R: {analysis['total_r']:.2f}")
    print(f"Average R: {analysis['avg_r']:.2f}")
    
    print("\n🎯 IMPROVEMENT SUGGESTIONS:")
    suggestions = analyzer.get_improvement_suggestions()
    for suggestion in suggestions:
        print(f"• {suggestion}")
    
    print("\n📈 RECENT PATTERNS (Last 7 days):")
    recent = analyzer.analyze_recent_trades(7)
    if not recent.get('error'):
        patterns = recent['patterns']
        print(f"• Most Profitable Symbol: {patterns['most_profitable_symbol']}")
        print(f"• Most Profitable Timeframe: {patterns['most_profitable_timeframe']}")
        print(f"• Best R-Multiple: {patterns['best_r_multiple']['r_multiple']:.2f}R on {patterns['best_r_multiple']['symbol']}")
    
    print("\n⚙️ OPTIMAL SETTINGS:")
    optimal = analyzer.get_optimal_settings()
    if optimal.get('focus_symbols'):
        print(f"• Focus on: {', '.join(optimal['focus_symbols'])}")
    if optimal.get('focus_timeframes'):
        print(f"• Best timeframes: {', '.join(optimal['focus_timeframes'])}")

if __name__ == "__main__":
    analyze_current_performance() 
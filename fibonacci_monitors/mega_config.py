#!/usr/bin/env python3
"""
Mega Monitor Configuration

This file contains all the monitor configurations for the Mega Fibonacci Monitor.
You can easily add, remove, or modify monitors here.
"""

from dataclasses import dataclass
from typing import List

@dataclass
class MonitorConfig:
    """Configuration for a single monitor instance"""
    name: str
    symbol: str
    timeframe: str
    margin: float
    min_move_percent: float
    swing_lookback: int
    check_interval_minutes: int
    enabled: bool = True

def get_monitor_configs() -> List[MonitorConfig]:
    """Get all monitor configurations"""
    configs = []
    
    # ===== SHORT-TERM MONITORS (1m, 5m, 15m) =====
    # These are for frequent testing and quick opportunities
    
    # SOL Short-term monitors
    configs.extend([
        MonitorConfig(
            name="SOL-1M-Quick",
            symbol="SOLUSDT",
            timeframe="1m",
            margin=0.001,  # Very tight margin
            min_move_percent=0.01,  # Small moves
            swing_lookback=20,  # Short lookback
            check_interval_minutes=1  # Check every minute
        ),
        MonitorConfig(
            name="SOL-5M-Standard",
            symbol="SOLUSDT",
            timeframe="5m",
            margin=0.0015,
            min_move_percent=0.015,
            swing_lookback=30,
            check_interval_minutes=2
        ),
        MonitorConfig(
            name="SOL-15M-Standard",
            symbol="SOLUSDT",
            timeframe="15m",
            margin=0.002,
            min_move_percent=0.02,
            swing_lookback=40,
            check_interval_minutes=3
        ),
        MonitorConfig(
            name="SOL-1M-Sensitive",
            symbol="SOLUSDT",
            timeframe="1m",
            margin=0.0005,  # Ultra-tight margin
            min_move_percent=0.008,  # Very small moves
            swing_lookback=15,
            check_interval_minutes=1
        )
    ])
    
    # BTC Short-term monitors
    configs.extend([
        MonitorConfig(
            name="BTC-1M-Quick",
            symbol="BTCUSDT",
            timeframe="1m",
            margin=0.0008,
            min_move_percent=0.008,
            swing_lookback=20,
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="BTC-5M-Standard",
            symbol="BTCUSDT",
            timeframe="5m",
            margin=0.001,
            min_move_percent=0.012,
            swing_lookback=30,
            check_interval_minutes=2
        ),
        MonitorConfig(
            name="BTC-15M-Standard",
            symbol="BTCUSDT",
            timeframe="15m",
            margin=0.0015,
            min_move_percent=0.015,
            swing_lookback=40,
            check_interval_minutes=3
        )
    ])
    
    # ETH Short-term monitors
    configs.extend([
        MonitorConfig(
            name="ETH-1M-Quick",
            symbol="ETHUSDT",
            timeframe="1m",
            margin=0.001,
            min_move_percent=0.01,
            swing_lookback=20,
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="ETH-5M-Standard",
            symbol="ETHUSDT",
            timeframe="5m",
            margin=0.0015,
            min_move_percent=0.015,
            swing_lookback=30,
            check_interval_minutes=2
        ),
        MonitorConfig(
            name="ETH-15M-Standard",
            symbol="ETHUSDT",
            timeframe="15m",
            margin=0.002,
            min_move_percent=0.02,
            swing_lookback=40,
            check_interval_minutes=3
        )
    ])
    
    # ADA Short-term monitors (more volatile)
    configs.extend([
        MonitorConfig(
            name="ADA-1M-Quick",
            symbol="ADAUSDT",
            timeframe="1m",
            margin=0.002,
            min_move_percent=0.015,
            swing_lookback=20,
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="ADA-5M-Standard",
            symbol="ADAUSDT",
            timeframe="5m",
            margin=0.0025,
            min_move_percent=0.02,
            swing_lookback=30,
            check_interval_minutes=2
        )
    ])
    
    # DOT Short-term monitors
    configs.extend([
        MonitorConfig(
            name="DOT-1M-Quick",
            symbol="DOTUSDT",
            timeframe="1m",
            margin=0.002,
            min_move_percent=0.015,
            swing_lookback=20,
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="DOT-5M-Standard",
            symbol="DOTUSDT",
            timeframe="5m",
            margin=0.0025,
            min_move_percent=0.02,
            swing_lookback=30,
            check_interval_minutes=2
        )
    ])
    
    # MATIC Short-term monitors
    configs.extend([
        MonitorConfig(
            name="MATIC-1M-Quick",
            symbol="MATICUSDT",
            timeframe="1m",
            margin=0.002,
            min_move_percent=0.015,
            swing_lookback=20,
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="MATIC-5M-Standard",
            symbol="MATICUSDT",
            timeframe="5m",
            margin=0.0025,
            min_move_percent=0.02,
            swing_lookback=30,
            check_interval_minutes=2
        )
    ])
    
    # AVAX Short-term monitors
    configs.extend([
        MonitorConfig(
            name="AVAX-1M-Quick",
            symbol="AVAXUSDT",
            timeframe="1m",
            margin=0.0015,
            min_move_percent=0.012,
            swing_lookback=20,
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="AVAX-5M-Standard",
            symbol="AVAXUSDT",
            timeframe="5m",
            margin=0.002,
            min_move_percent=0.015,
            swing_lookback=30,
            check_interval_minutes=2
        )
    ])
    
    # LINK Short-term monitors
    configs.extend([
        MonitorConfig(
            name="LINK-1M-Quick",
            symbol="LINKUSDT",
            timeframe="1m",
            margin=0.0015,
            min_move_percent=0.012,
            swing_lookback=20,
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="LINK-5M-Standard",
            symbol="LINKUSDT",
            timeframe="5m",
            margin=0.002,
            min_move_percent=0.015,
            swing_lookback=30,
            check_interval_minutes=2
        )
    ])
    
    # ===== MEDIUM-TERM MONITORS (1h, 4h) =====
    # These are for more reliable setups
    
    # SOL Medium-term monitors
    configs.extend([
        MonitorConfig(
            name="SOL-1H-Standard",
            symbol="SOLUSDT",
            timeframe="1h",
            margin=0.002,
            min_move_percent=0.03,
            swing_lookback=50,
            check_interval_minutes=5
        ),
        MonitorConfig(
            name="SOL-4H-Standard",
            symbol="SOLUSDT",
            timeframe="4h",
            margin=0.002,
            min_move_percent=0.03,
            swing_lookback=50,
            check_interval_minutes=15
        ),
        MonitorConfig(
            name="SOL-1H-Sensitive",
            symbol="SOLUSDT",
            timeframe="1h",
            margin=0.001,  # Tighter margin
            min_move_percent=0.02,  # Lower minimum move
            swing_lookback=30,  # Shorter lookback
            check_interval_minutes=3
        ),
        MonitorConfig(
            name="SOL-1H-Conservative",
            symbol="SOLUSDT",
            timeframe="1h",
            margin=0.005,  # Wider margin
            min_move_percent=0.05,  # Higher minimum move
            swing_lookback=100,  # Longer lookback
            check_interval_minutes=10
        )
    ])
    
    # BTC Medium-term monitors
    configs.extend([
        MonitorConfig(
            name="BTC-1H-Standard",
            symbol="BTCUSDT",
            timeframe="1h",
            margin=0.002,
            min_move_percent=0.02,
            swing_lookback=50,
            check_interval_minutes=5
        ),
        MonitorConfig(
            name="BTC-4H-Standard",
            symbol="BTCUSDT",
            timeframe="4h",
            margin=0.002,
            min_move_percent=0.03,
            swing_lookback=50,
            check_interval_minutes=15
        ),
        MonitorConfig(
            name="BTC-1H-Sensitive",
            symbol="BTCUSDT",
            timeframe="1h",
            margin=0.001,
            min_move_percent=0.015,
            swing_lookback=30,
            check_interval_minutes=3
        )
    ])
    
    # ETH Medium-term monitors
    configs.extend([
        MonitorConfig(
            name="ETH-1H-Standard",
            symbol="ETHUSDT",
            timeframe="1h",
            margin=0.002,
            min_move_percent=0.025,
            swing_lookback=50,
            check_interval_minutes=5
        ),
        MonitorConfig(
            name="ETH-4H-Standard",
            symbol="ETHUSDT",
            timeframe="4h",
            margin=0.002,
            min_move_percent=0.035,
            swing_lookback=50,
            check_interval_minutes=15
        )
    ])
    
    # ADA Medium-term monitors
    configs.extend([
        MonitorConfig(
            name="ADA-1H-Standard",
            symbol="ADAUSDT",
            timeframe="1h",
            margin=0.003,
            min_move_percent=0.04,
            swing_lookback=50,
            check_interval_minutes=5
        ),
        MonitorConfig(
            name="ADA-4H-Standard",
            symbol="ADAUSDT",
            timeframe="4h",
            margin=0.003,
            min_move_percent=0.05,
            swing_lookback=50,
            check_interval_minutes=15
        )
    ])
    
    # DOT Medium-term monitors
    configs.extend([
        MonitorConfig(
            name="DOT-1H-Standard",
            symbol="DOTUSDT",
            timeframe="1h",
            margin=0.003,
            min_move_percent=0.04,
            swing_lookback=50,
            check_interval_minutes=5
        ),
        MonitorConfig(
            name="DOT-4H-Standard",
            symbol="DOTUSDT",
            timeframe="4h",
            margin=0.003,
            min_move_percent=0.05,
            swing_lookback=50,
            check_interval_minutes=15
        )
    ])
    
    # MATIC Medium-term monitors
    configs.extend([
        MonitorConfig(
            name="MATIC-1H-Standard",
            symbol="MATICUSDT",
            timeframe="1h",
            margin=0.003,
            min_move_percent=0.04,
            swing_lookback=50,
            check_interval_minutes=5
        ),
        MonitorConfig(
            name="MATIC-4H-Standard",
            symbol="MATICUSDT",
            timeframe="4h",
            margin=0.003,
            min_move_percent=0.05,
            swing_lookback=50,
            check_interval_minutes=15
        )
    ])
    
    # AVAX Medium-term monitors
    configs.extend([
        MonitorConfig(
            name="AVAX-1H-Standard",
            symbol="AVAXUSDT",
            timeframe="1h",
            margin=0.002,
            min_move_percent=0.03,
            swing_lookback=50,
            check_interval_minutes=5
        ),
        MonitorConfig(
            name="AVAX-4H-Standard",
            symbol="AVAXUSDT",
            timeframe="4h",
            margin=0.002,
            min_move_percent=0.04,
            swing_lookback=50,
            check_interval_minutes=15
        )
    ])
    
    # LINK Medium-term monitors
    configs.extend([
        MonitorConfig(
            name="LINK-1H-Standard",
            symbol="LINKUSDT",
            timeframe="1h",
            margin=0.002,
            min_move_percent=0.03,
            swing_lookback=50,
            check_interval_minutes=5
        ),
        MonitorConfig(
            name="LINK-4H-Standard",
            symbol="LINKUSDT",
            timeframe="4h",
            margin=0.002,
            min_move_percent=0.04,
            swing_lookback=50,
            check_interval_minutes=15
        )
    ])
    
    # ===== LONG-TERM MONITORS (1d) =====
    # These are for major trend setups
    
    configs.extend([
        MonitorConfig(
            name="SOL-1D-Standard",
            symbol="SOLUSDT",
            timeframe="1d",
            margin=0.002,
            min_move_percent=0.05,
            swing_lookback=30,
            check_interval_minutes=30
        ),
        MonitorConfig(
            name="BTC-1D-Standard",
            symbol="BTCUSDT",
            timeframe="1d",
            margin=0.002,
            min_move_percent=0.04,
            swing_lookback=30,
            check_interval_minutes=30
        ),
        MonitorConfig(
            name="ETH-1D-Standard",
            symbol="ETHUSDT",
            timeframe="1d",
            margin=0.002,
            min_move_percent=0.045,
            swing_lookback=30,
            check_interval_minutes=30
        )
    ])
    
    return configs

# Example of how to add custom monitors:
def add_custom_monitors() -> List[MonitorConfig]:
    """Add your custom monitor configurations here"""
    custom_configs = []
    
    # Example: Add a custom SOL monitor with different parameters
    # custom_configs.append(MonitorConfig(
    #     name="SOL-1H-Custom",
    #     symbol="SOLUSDT",
    #     timeframe="1h",
    #     margin=0.0015,
    #     min_move_percent=0.025,
    #     swing_lookback=40,
    #     check_interval_minutes=4
    # ))
    
    return custom_configs

# To add your custom monitors, uncomment and modify the above function
# Then add: configs.extend(add_custom_monitors()) to get_monitor_configs() 
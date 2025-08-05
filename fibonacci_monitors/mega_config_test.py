#!/usr/bin/env python3
"""
Test Configuration for Mega Monitor - Ultra-sensitive parameters for testing
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

def get_test_monitor_configs() -> List[MonitorConfig]:
    """Get ultra-sensitive test configurations"""
    configs = []
    
    # Ultra-sensitive SOL monitors for testing
    configs.extend([
        MonitorConfig(
            name="SOL-1M-UltraSensitive",
            symbol="SOLUSDT",
            timeframe="1m",
            margin=0.0001,  # Very tight margin
            min_move_percent=0.001,  # Tiny moves (0.1%)
            swing_lookback=10,  # Very short lookback
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="SOL-5M-UltraSensitive",
            symbol="SOLUSDT",
            timeframe="5m",
            margin=0.0002,
            min_move_percent=0.002,  # 0.2% moves
            swing_lookback=15,
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="SOL-1M-SuperSensitive",
            symbol="SOLUSDT",
            timeframe="1m",
            margin=0.00005,  # Ultra-tight margin
            min_move_percent=0.0005,  # 0.05% moves
            swing_lookback=5,  # Very short lookback
            check_interval_minutes=1
        )
    ])
    
    # Ultra-sensitive BTC monitors
    configs.extend([
        MonitorConfig(
            name="BTC-1M-UltraSensitive",
            symbol="BTCUSDT",
            timeframe="1m",
            margin=0.0001,
            min_move_percent=0.001,
            swing_lookback=10,
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="BTC-5M-UltraSensitive",
            symbol="BTCUSDT",
            timeframe="5m",
            margin=0.0002,
            min_move_percent=0.002,
            swing_lookback=15,
            check_interval_minutes=1
        )
    ])
    
    # Ultra-sensitive ETH monitors
    configs.extend([
        MonitorConfig(
            name="ETH-1M-UltraSensitive",
            symbol="ETHUSDT",
            timeframe="1m",
            margin=0.0001,
            min_move_percent=0.001,
            swing_lookback=10,
            check_interval_minutes=1
        ),
        MonitorConfig(
            name="ETH-5M-UltraSensitive",
            symbol="ETHUSDT",
            timeframe="5m",
            margin=0.0002,
            min_move_percent=0.002,
            swing_lookback=15,
            check_interval_minutes=1
        )
    ])
    
    return configs 
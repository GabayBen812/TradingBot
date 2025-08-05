# Strategy Monitors

This folder contains the **Multi-Strategy Trading Bot** - a comprehensive system that monitors multiple cryptocurrencies for various technical analysis strategies and patterns.

## 🚀 Features

### **Multi-Strategy Detection System**
- **Support/Resistance breaks** with volume confirmation
- **Moving Average crossovers** (SMA & EMA)
- **RSI divergences** (bullish & bearish)
- **MACD crossovers** with signal line analysis
- **Bollinger Band squeezes** and breakouts
- **Real-time alerts** via Discord webhook

### **Monitoring Capabilities**
- **Multiple cryptocurrencies**: SOL, BTC, ETH, ADA, DOT
- **Multiple timeframes**: 1h, 4h, 1d
- **Individual strategy monitors** for each symbol/timeframe
- **Confidence levels** for each signal
- **Detailed technical analysis** with indicators

## 📁 File Structure

```
strategy_monitors/
├── strategy_monitor.py      # Main strategy monitor
├── strategy_detector.py     # Core strategy detection logic
├── discord_notifier.py      # Discord alert system (enhanced)
├── config.py               # Global configuration
├── requirements.txt        # Python dependencies
├── env_example.txt         # Environment variables template
└── README.md              # This file
```

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up environment variables:**
   ```bash
   cp env_example.txt .env
   # Edit .env file with your Discord webhook URL
   ```

3. **Run the strategy monitor:**
   ```bash
   python strategy_monitor.py
   ```

## 📊 Strategy Types

### **1. Support/Resistance Breaks**
- **Detection**: Price breaks above resistance or below support
- **Confirmation**: Volume spike (1.5x+ average volume)
- **Signal Types**: Bullish (resistance break), Bearish (support break)
- **Confidence**: HIGH when volume > 2x average

### **2. Moving Average Crossovers**
- **SMA Crossovers**: 20-period vs 50-period SMA
- **EMA Crossovers**: 12-period vs 26-period EMA
- **Signal Types**: Golden Cross (bullish), Death Cross (bearish)
- **Confidence**: HIGH when both SMA and EMA cross simultaneously

### **3. RSI Divergences**
- **Bullish Divergence**: Price makes lower low, RSI makes higher low
- **Bearish Divergence**: Price makes higher high, RSI makes lower high
- **Confidence**: HIGH (strong reversal signal)
- **Timeframe**: 14-period RSI

### **4. MACD Crossovers**
- **Bullish Cross**: MACD line crosses above signal line
- **Bearish Cross**: MACD line crosses below signal line
- **Confidence**: HIGH when crossover magnitude > 0.1
- **Parameters**: 12, 26, 9 (standard settings)

### **5. Bollinger Band Analysis**
- **Squeeze Detection**: Bands contract (bandwidth < 5%)
- **Breakout Detection**: Price breaks above upper or below lower band
- **Confidence**: HIGH for breakouts, MEDIUM for squeezes
- **Parameters**: 20-period SMA, 2 standard deviations

### **6. Strat Strategy (Rob Smith)**
- **Bullish Breakout**: Price breaks above resistance with volume confirmation
- **Bearish Breakdown**: Price breaks below support with volume confirmation
- **Support Bounce**: Price bounces off support with volume
- **Resistance Rejection**: Price rejects resistance with volume
- **Confidence**: HIGH when volume > 2x average and trend aligned
- **Key Features**: Volume confirmation, trend analysis, risk/reward setup

## 🎯 Supported Symbols & Timeframes

| Symbol | 1h | 4h | 1d |
|--------|----|----|----|
| SOL    | ✅ | ✅ | ✅ |
| BTC    | ✅ | ✅ | ❌ |
| ETH    | ✅ | ✅ | ❌ |
| ADA    | ✅ | ✅ | ❌ |
| DOT    | ✅ | ✅ | ❌ |

**Total Active Monitors**: 18 strategy monitors (including 6 dedicated Strat Strategy monitors)

## 🔧 Configuration

### **Adding New Strategy Monitors**
Edit `strategy_monitor.py` to add new monitor configurations:

```python
StrategyConfig(
    name="NEW-SYMBOL-1H-Strategies",
    symbol="NEWUSDT",
    timeframe="1h",
    enabled=True
)
```

### **Strategy Parameters**
Each strategy has its own sensitivity settings:

- **Support/Resistance**: 0.1% break threshold, 1.5x volume minimum
- **MA Crossovers**: Standard 20/50 SMA, 12/26 EMA periods
- **RSI**: 14-period, divergence detection with peak analysis
- **MACD**: 12/26/9 standard settings, 0.1 crossover threshold
- **Bollinger Bands**: 20-period, 2 standard deviations, 5% squeeze threshold
- **Strat Strategy**: Volume confirmation (1.5x+), trend analysis, support/resistance levels

## 📈 Alert Information

When a strategy signal is detected, you'll receive:

- **Strategy type and signal name**
- **Signal direction** (BULLISH/BEARISH/NEUTRAL)
- **Confidence level** (HIGH/MEDIUM)
- **Symbol and timeframe**
- **Current price**
- **Strategy-specific details** (levels, indicators, etc.)
- **Risk management warnings**

## 🧪 Testing

### **Test Strategy Detection**
```bash
python strategy_detector.py
```

### **Test Individual Strategies**
```python
from strategy_detector import StrategyDetector

detector = StrategyDetector()
signals = detector.run_strategy_detection("SOLUSDT", "1h")

for signal in signals:
    print(f"{signal['strategy']}: {signal['signal']} ({signal['type']})")
```

### **Test Discord Alerts**
```python
from discord_notifier import DiscordNotifier

notifier = DiscordNotifier()
notifier.send_test_message()
```

## 📊 Performance

- **12 strategy monitors** running simultaneously
- **Real-time data** from Binance API
- **Multiple strategy detection** in parallel
- **Discord webhook integration** for instant alerts
- **Cooldown system** to prevent spam (30 minutes)
- **Confidence scoring** for signal quality

## 🔍 Technical Indicators

### **Moving Averages**
- **SMA 20**: Short-term trend
- **SMA 50**: Medium-term trend
- **EMA 12**: Fast exponential average
- **EMA 26**: Slow exponential average

### **RSI (Relative Strength Index)**
- **Period**: 14
- **Overbought**: 70
- **Oversold**: 30
- **Divergence detection**: Peak/trough analysis

### **MACD (Moving Average Convergence Divergence)**
- **Fast EMA**: 12
- **Slow EMA**: 26
- **Signal**: 9-period EMA of MACD
- **Histogram**: MACD - Signal line

### **Bollinger Bands**
- **Period**: 20
- **Standard Deviations**: 2
- **Bandwidth**: (Upper - Lower) / Middle
- **Squeeze threshold**: 5%

## ⚠️ Important Notes

1. **No API keys required** - Uses Binance public endpoints
2. **Discord webhook optional** - Can run without alerts
3. **Multiple strategies** - Each monitor checks all 5 strategy types
4. **Confidence levels** - Higher confidence = stronger signals
5. **Risk management** - Always use proper position sizing
6. **Not financial advice** - Trade at your own risk

## 🚀 Quick Start

1. **Clone and install:**
   ```bash
   cd strategy_monitors
   pip install -r requirements.txt
   ```

2. **Configure Discord (optional):**
   ```bash
   cp env_example.txt .env
   # Add your Discord webhook URL to .env
   ```

3. **Run the strategy monitor:**
   ```bash
   python strategy_monitor.py
   ```

4. **Monitor the logs** and wait for strategy signals!

## 📝 Logs

- **strategy_monitor.log**: Main application logs
- **Console output**: Real-time monitoring status
- **Discord alerts**: Detailed strategy notifications

The system will automatically detect various trading strategies and send comprehensive alerts with technical analysis details.

## 🎯 Strategy Examples

### **Support/Resistance Break**
```
🟢 STRATEGY SIGNAL DETECTED 🟢
Strategy: Support/Resistance Break
Signal: Resistance Break
Type: BULLISH
Confidence: HIGH
Price: $150.25
Break Level: $149.80
Volume Ratio: 2.3x
```

### **MACD Crossover**
```
🟢 STRATEGY SIGNAL DETECTED 🟢
Strategy: MACD Crossover
Signal: MACD Bullish Cross
Type: BULLISH
Confidence: HIGH
Price: $150.25
MACD: 0.0234
Signal Line: 0.0189
```

### **RSI Divergence**
```
🟢 STRATEGY SIGNAL DETECTED 🟢
Strategy: RSI Divergence
Signal: Bullish Divergence
Type: BULLISH
Confidence: HIGH
Price: $150.25
Current RSI: 35.2
```

The strategy monitor provides comprehensive technical analysis across multiple cryptocurrencies and timeframes! 
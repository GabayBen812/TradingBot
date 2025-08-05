# Trading Bot Project

A comprehensive cryptocurrency trading bot system with multiple monitoring strategies and Fibonacci retracement detection.

## 🚀 Project Overview

This project contains two main trading bot systems:

1. **Fibonacci Monitors** - Advanced Fibonacci retracement detection
2. **Strategy Monitors** - Multi-strategy technical analysis system

## 📁 Project Structure

```
TradingBot/
├── fibonacci_monitors/          # Fibonacci retracement system
│   ├── mega_monitor.py         # 42 simultaneous monitors
│   ├── fibonacci_detector.py   # Core Fibonacci logic
│   ├── mega_config.py          # Monitor configurations
│   └── README.md              # Detailed documentation
├── strategy_monitors/           # Multi-strategy system
│   ├── strategy_monitor.py     # Strategy monitoring
│   ├── strategy_detector.py    # 5 strategy types
│   └── README.md              # Detailed documentation
├── config.py                   # Global configuration
├── discord_notifier.py         # Discord alert system
├── requirements.txt            # Python dependencies
├── env_example.txt            # Environment variables
└── README.md                  # This file
```

## 🎯 Features

### **Fibonacci Monitors** (`fibonacci_monitors/`)
- **42 simultaneous monitors** across 8 cryptocurrencies
- **Multiple timeframes**: 1m, 5m, 15m, 1h, 4h, 1d
- **Fibonacci 0.618 retracement detection**
- **Automatic chart generation** with matplotlib
- **Individual sensitivity settings** for each monitor
- **Real-time Discord alerts** with trading levels

### **Strategy Monitors** (`strategy_monitors/`)
- **12 strategy monitors** across 5 cryptocurrencies
- **5 strategy types**: Support/Resistance, MA Crossovers, RSI, MACD, Bollinger Bands
- **Multiple timeframes**: 1h, 4h, 1d
- **Confidence scoring** for signal quality
- **Comprehensive technical analysis** with indicators

## 🛠️ Installation

### **Prerequisites**
- Python 3.8+
- pip package manager

### **Quick Setup**

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd TradingBot
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment (optional):**
   ```bash
   cp env_example.txt .env
   # Edit .env file with your Discord webhook URL
   ```

## 🚀 Quick Start

### **Fibonacci Monitors**
```bash
cd fibonacci_monitors
python mega_monitor.py
```

### **Strategy Monitors**
```bash
cd strategy_monitors
python strategy_monitor.py
```

## 📊 System Comparison

| Feature | Fibonacci Monitors | Strategy Monitors |
|---------|-------------------|-------------------|
| **Monitors** | 42 | 12 |
| **Symbols** | 8 (SOL, BTC, ETH, ADA, DOT, MATIC, AVAX, LINK) | 5 (SOL, BTC, ETH, ADA, DOT) |
| **Timeframes** | 1m, 5m, 15m, 1h, 4h, 1d | 1h, 4h, 1d |
| **Strategy Types** | 1 (Fibonacci 0.618) | 5 (Support/Resistance, MA, RSI, MACD, Bollinger) |
| **Check Intervals** | 1-30 minutes | 5 minutes |
| **Charts** | ✅ Automatic generation | ❌ |
| **Confidence Levels** | ❌ | ✅ HIGH/MEDIUM |

## 🎯 Use Cases

### **Fibonacci Monitors**
- **Short-term trading** with 1m, 5m, 15m timeframes
- **Quick opportunities** with high-frequency monitoring
- **Fibonacci retracement** enthusiasts
- **Chart-based analysis** with visual confirmation

### **Strategy Monitors**
- **Medium-term trading** with 1h, 4h, 1d timeframes
- **Multiple strategy confirmation**
- **Technical analysis** with various indicators
- **Confidence-based filtering**

## 📈 Supported Cryptocurrencies

### **Fibonacci Monitors**
| Symbol | Short-term | Medium-term | Long-term |
|--------|------------|-------------|-----------|
| SOL    | ✅ 1m, 5m, 15m | ✅ 1h, 4h | ✅ 1d |
| BTC    | ✅ 1m, 5m, 15m | ✅ 1h, 4h | ✅ 1d |
| ETH    | ✅ 1m, 5m, 15m | ✅ 1h, 4h | ✅ 1d |
| ADA    | ✅ 1m, 5m | ✅ 1h, 4h | ❌ |
| DOT    | ✅ 1m, 5m | ✅ 1h, 4h | ❌ |
| MATIC  | ✅ 1m, 5m | ✅ 1h, 4h | ❌ |
| AVAX   | ✅ 1m, 5m | ✅ 1h, 4h | ❌ |
| LINK   | ✅ 1m, 5m | ✅ 1h, 4h | ❌ |

### **Strategy Monitors**
| Symbol | 1h | 4h | 1d |
|--------|----|----|----|
| SOL    | ✅ | ✅ | ✅ |
| BTC    | ✅ | ✅ | ❌ |
| ETH    | ✅ | ✅ | ❌ |
| ADA    | ✅ | ✅ | ❌ |
| DOT    | ✅ | ✅ | ❌ |

## 🔧 Configuration

### **Environment Variables**
Create a `.env` file with:
```
DISCORD_WEBHOOK_URL=your_discord_webhook_url
DISCORD_USERNAME=TradingBot
DISCORD_AVATAR_URL=your_avatar_url
```

### **Adding New Monitors**
- **Fibonacci**: Edit `fibonacci_monitors/mega_config.py`
- **Strategy**: Edit `strategy_monitors/strategy_monitor.py`

## 📊 Alert Examples

### **Fibonacci Alert**
```
🚨 FIBONACCI 0.618 RETRACEMENT DETECTED 🚨

Symbol: SOLUSDT
Timeframe: 1h
Setup Type: LONG
Current Price: $150.25

📊 Swing Analysis:
• Swing High: $155.80
• Swing Low: $145.20
• Total Move: 7.30%

📈 Fibonacci Levels:
• 61.8%: $149.45 ⭐

💰 Trading Levels:
• Entry: $149.45
• Take Profit 1: $151.20
• Take Profit 2: $153.00
• Stop Loss: $147.80
```

### **Strategy Alert**
```
🟢 STRATEGY SIGNAL DETECTED 🟢

Strategy: MACD Crossover
Signal: MACD Bullish Cross
Type: BULLISH
Confidence: HIGH

📊 Signal Details:
• Symbol: SOLUSDT
• Timeframe: 1h
• Current Price: $150.25
• MACD: 0.0234
• Signal Line: 0.0189
```

## 🧪 Testing

### **Test Fibonacci Detection**
```bash
cd fibonacci_monitors
python test_mega_monitor.py
```

### **Test Strategy Detection**
```bash
cd strategy_monitors
python strategy_detector.py
```

### **Test Discord Alerts**
```python
from discord_notifier import DiscordNotifier
notifier = DiscordNotifier()
notifier.send_test_message()
```

## 📝 Logs

### **Fibonacci Monitors**
- `fibonacci_monitors/mega_monitor.log`
- Console output with real-time status
- Discord alerts with charts

### **Strategy Monitors**
- `strategy_monitors/strategy_monitor.log`
- Console output with strategy signals
- Discord alerts with technical details

## ⚠️ Important Notes

1. **No API keys required** - Uses Binance public endpoints
2. **Discord webhook optional** - Can run without alerts
3. **Risk management** - Always use proper position sizing
4. **Not financial advice** - Trade at your own risk
5. **Market conditions** - Setups work best in trending markets
6. **Cooldown system** - 30-minute cooldown prevents spam

## 🚀 Performance

### **Fibonacci Monitors**
- **42 monitors** running simultaneously
- **Real-time data** from Binance API
- **Automatic chart generation** with matplotlib
- **Individual parameters** for each monitor

### **Strategy Monitors**
- **12 monitors** running simultaneously
- **5 strategy types** per monitor
- **Confidence scoring** for signal quality
- **Comprehensive technical analysis**

## 📚 Documentation

- **Fibonacci Monitors**: See `fibonacci_monitors/README.md`
- **Strategy Monitors**: See `strategy_monitors/README.md`
- **Configuration**: See `config.py` and `env_example.txt`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for educational purposes. Use at your own risk.

---

**Happy Trading! 🚀📈** 
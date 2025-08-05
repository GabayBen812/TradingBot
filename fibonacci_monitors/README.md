# Fibonacci Monitors

This folder contains the **Fibonacci Retracement Detection System** - a comprehensive trading bot that monitors multiple cryptocurrencies for Fibonacci 0.618 retracement setups.

## 🚀 Features

### **Mega Monitor System**
- **42 simultaneous monitors** across multiple cryptocurrencies
- **Multiple timeframes**: 1m, 5m, 15m, 1h, 4h, 1d
- **Multiple symbols**: SOL, BTC, ETH, ADA, DOT, MATIC, AVAX, LINK
- **Individual parameters**: Each monitor has its own sensitivity settings
- **Real-time alerts**: Discord notifications with detailed charts

### **Detection Capabilities**
- **Fibonacci 0.618 retracement detection**
- **Swing high/low identification**
- **Automatic chart generation**
- **Trading level calculations**
- **Risk management suggestions**

## 📁 File Structure

```
fibonacci_monitors/
├── mega_monitor.py          # Main mega monitor (42 monitors)
├── mega_config.py           # Monitor configurations
├── mega_config_test.py      # Ultra-sensitive test configs
├── fibonacci_detector.py    # Core detection logic
├── discord_notifier.py      # Discord alert system
├── config.py               # Global configuration
├── main.py                 # Original single monitor
├── main_console.py         # Console version
├── test_mega_monitor.py    # Testing script
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

3. **Run the mega monitor:**
   ```bash
   python mega_monitor.py
   ```

## 📊 Monitor Configurations

### **Short-term Monitors (1m, 5m, 15m)**
- **Purpose**: Quick opportunities and testing
- **Check intervals**: 1-3 minutes
- **Sensitivity**: High (0.8% - 2% minimum moves)
- **Lookback**: 15-40 candles

### **Medium-term Monitors (1h, 4h)**
- **Purpose**: Reliable setups
- **Check intervals**: 3-15 minutes
- **Sensitivity**: Medium (2% - 5% minimum moves)
- **Lookback**: 30-100 candles

### **Long-term Monitors (1d)**
- **Purpose**: Major trend setups
- **Check intervals**: 30 minutes
- **Sensitivity**: Conservative (4% - 5% minimum moves)
- **Lookback**: 30 candles

## 🎯 Supported Symbols

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

## 🔧 Configuration

### **Adding New Monitors**
Edit `mega_config.py` to add new monitor configurations:

```python
MonitorConfig(
    name="NEW-SYMBOL-1H-Custom",
    symbol="NEWUSDT",
    timeframe="1h",
    margin=0.002,
    min_move_percent=0.03,
    swing_lookback=50,
    check_interval_minutes=5
)
```

### **Adjusting Sensitivity**
- **margin**: Tolerance for Fibonacci level detection (0.001 = 0.1%)
- **min_move_percent**: Minimum price move required (0.02 = 2%)
- **swing_lookback**: Number of candles to analyze (20-100)
- **check_interval_minutes**: How often to check (1-30 minutes)

## 📈 Alert Information

When a Fibonacci setup is detected, you'll receive:

- **Symbol and timeframe**
- **Current price and setup type**
- **Swing high/low levels**
- **All Fibonacci retracement levels**
- **Trading entry, targets, and stop loss**
- **Monitor configuration details**
- **Professional chart image**

## 🧪 Testing

### **Test Individual Monitors**
```bash
python test_mega_monitor.py
```

### **Test Ultra-sensitive Configurations**
```bash
python mega_config_test.py
```

### **Test Single Detection**
```bash
python -c "from fibonacci_detector import FibonacciDetector; detector = FibonacciDetector(); result = detector.run_detection_with_params('SOLUSDT', '1m', 0.001, 0.01, 20); print('Setup detected!' if result else 'No setup')"
```

## 📊 Performance

- **42 monitors** running simultaneously
- **Real-time data** from Binance API
- **Automatic chart generation** with matplotlib
- **Discord webhook integration** for instant alerts
- **Cooldown system** to prevent spam (30 minutes)

## ⚠️ Important Notes

1. **No API keys required** - Uses Binance public endpoints
2. **Discord webhook optional** - Can run without alerts
3. **Risk management** - Always use proper position sizing
4. **Not financial advice** - Trade at your own risk
5. **Market conditions** - Setups work best in trending markets

## 🚀 Quick Start

1. **Clone and install:**
   ```bash
   cd fibonacci_monitors
   pip install -r requirements.txt
   ```

2. **Configure Discord (optional):**
   ```bash
   cp env_example.txt .env
   # Add your Discord webhook URL to .env
   ```

3. **Run the mega monitor:**
   ```bash
   python mega_monitor.py
   ```

4. **Monitor the logs** and wait for Fibonacci setups!

## 📝 Logs

- **mega_monitor.log**: Main application logs
- **Console output**: Real-time monitoring status
- **Discord alerts**: Detailed setup notifications

The system will automatically detect Fibonacci 0.618 retracements and send comprehensive alerts with trading levels and charts. 
# Quick Start Guide

## 🚀 Get the server running in 5 minutes

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp env.example .env
# Edit .env with your Supabase credentials
```

### 3. Start the server
```bash
# Development mode (with auto-restart)
npm run dev

# OR Production mode
npm start

# OR Use the startup script
npm run start:dev
```

### 4. Test the server
```bash
# Health check
curl http://localhost:3001/health

# Bot status
curl http://localhost:3001/api/v1/bot/status
```

## 🔧 What's included

- **Express.js server** with RESTful API
- **WebSocket support** for real-time updates
- **Bot runtime** with continuous signal scanning
- **Market data service** (Binance integration)
- **Signal engine** (Fibonacci, FVG, Support/Resistance)
- **Order & trade management**
- **Analytics & performance tracking**

## 📡 API Endpoints

- `GET /health` - Server health check
- `GET /api/v1/bot/status` - Bot runtime status
- `GET /api/v1/signals` - Get trading signals
- `GET /api/v1/orders` - Get pending orders
- `GET /api/v1/trades` - Get trades
- `GET /api/v1/analytics/performance` - Performance metrics

## 🌐 WebSocket

Connect to `ws://localhost:3001` for real-time updates:
- New signals
- Order updates
- Trade updates
- Bot status changes

## 📊 Bot Modes

- **Supervised**: Manual approval required
- **Strict**: High-quality auto-execution
- **Explore**: Broader auto-execution for data collection

## 🚨 Troubleshooting

### Port already in use
```bash
# Change PORT in .env or kill the process
lsof -ti:3001 | xargs kill -9
```

### Missing dependencies
```bash
npm install
```

### Environment not set
```bash
cp env.example .env
# Edit .env with your values
```

## 🔗 Next Steps

1. **Connect to Supabase** - Update `.env` with your credentials
2. **Configure bot settings** - Adjust risk, scan intervals, etc.
3. **Test signal detection** - Monitor logs for detected setups
4. **Integrate with client** - Update your React app to use the API

## 📝 Logs

Check `logs/` directory for detailed server logs:
- `combined.log` - All logs
- `error.log` - Error logs only

## 🆘 Need Help?

- Check the logs in `logs/` directory
- Verify your `.env` configuration
- Ensure all dependencies are installed
- Check that port 3001 is available

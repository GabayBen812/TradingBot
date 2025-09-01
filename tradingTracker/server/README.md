# Trading Bot Server

Express.js server for the trading bot backend with real-time WebSocket support.

## Features

- **Continuous Bot Runtime**: 24/7 signal scanning and trade management
- **Real-time Updates**: WebSocket connections for live data
- **RESTful API**: Complete CRUD operations for signals, orders, and trades
- **Automated Execution**: Auto-execution based on signal quality and mode
- **Risk Management**: Position sizing and trade monitoring
- **Performance Metrics**: Real-time statistics and analytics

## Architecture

```
server/
├── src/
│   ├── index.js              # Main server entry point
│   ├── services/             # Core business logic
│   │   ├── botRuntime.js     # Main bot runtime
│   │   ├── signalEngine.js   # Signal detection
│   │   ├── orderManager.js   # Order management
│   │   ├── tradeManager.js   # Trade management
│   │   └── marketDataService.js # Market data
│   ├── routes/               # API endpoints
│   ├── websocket/            # WebSocket handling
│   └── utils/                # Utilities
├── package.json
└── .env.example
```

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project
- Binance API keys (optional)

## Installation

1. **Clone and navigate to server directory**
   ```bash
   cd tradingTracker/server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Create logs directory**
   ```bash
   mkdir logs
   ```

## Configuration

Edit `.env` file with your settings:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Bot Configuration
BOT_SCAN_INTERVAL=300000
BOT_MAX_CONCURRENT_TRADES=5
BOT_RISK_PER_TRADE=100
BOT_INITIAL_CAPITAL=5000

# Security
JWT_SECRET=your_jwt_secret_key
CORS_ORIGIN=http://localhost:3000
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on port 3001 (or your configured PORT).

## API Endpoints

### Bot Control
- `GET /api/v1/bot/status` - Get bot status and statistics
- `POST /api/v1/bot/start` - Start bot runtime
- `POST /api/v1/bot/stop` - Stop bot runtime
- `GET /api/v1/bot/config` - Get bot configuration
- `PUT /api/v1/bot/config` - Update bot configuration
- `POST /api/v1/bot/scan` - Trigger manual signal scan
- `GET /api/v1/bot/metrics` - Get performance metrics

### Signals
- `GET /api/v1/signals` - Get signals with filters
- `POST /api/v1/signals` - Create new signal
- `PUT /api/v1/signals/:id` - Update signal
- `DELETE /api/v1/signals/:id` - Delete signal

### Orders
- `GET /api/v1/orders` - Get orders with filters
- `POST /api/v1/orders` - Create new order
- `PUT /api/v1/orders/:id` - Update order
- `DELETE /api/v1/orders/:id` - Cancel order

### Trades
- `GET /api/v1/trades` - Get trades with filters
- `POST /api/v1/trades` - Create new trade
- `PUT /api/v1/trades/:id` - Update trade
- `DELETE /api/v1/trades/:id` - Close trade

### Analytics
- `GET /api/v1/analytics/performance` - Get performance analytics
- `GET /api/v1/analytics/symbols` - Get symbol performance
- `GET /api/v1/analytics/hours` - Get hourly performance

## WebSocket API

Connect to `ws://localhost:3001` for real-time updates.

### Subscribe to channels
```json
{
  "type": "subscribe",
  "data": {
    "channels": ["signals", "orders", "trades", "status"]
  }
}
```

### Message types
- `new_signal` - New signal detected
- `order_update` - Order status change
- `trade_update` - Trade status change
- `bot_status` - Bot runtime status

## Bot Modes

### Supervised
- Bot detects signals but requires manual approval
- No automatic trade execution
- Full control over entry/exit

### Strict
- High-quality signals only (confidence ≥ 70%, FIB tag, R:R ≥ 2.0)
- Automatic order placement
- Conservative risk management

### Explore
- Broader signal detection (confidence ≥ 50%, R:R ≥ 1.5)
- Automatic order placement
- Data collection for strategy improvement

## Development

### Project Structure
- **Services**: Core business logic separated by domain
- **Routes**: REST API endpoints with validation
- **WebSocket**: Real-time communication layer
- **Utils**: Shared utilities and helpers

### Adding New Features
1. Create service in `src/services/`
2. Add routes in `src/routes/`
3. Update WebSocket broadcasts if needed
4. Add tests in `tests/` directory

### Logging
Uses Winston for structured logging:
- Console output in development
- File logging in production
- Log levels: error, warn, info, debug

## Deployment

### Railway
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

### Vercel
1. Install Vercel CLI
2. Configure `vercel.json`
3. Deploy with `vercel --prod`

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## Monitoring

### Health Check
- `GET /health` - Basic health status
- `GET /api/v1/bot/status` - Detailed bot status

### Metrics
- Performance analytics
- Trade statistics
- System resource usage

### Alerts
- Failed signal detection
- Order execution errors
- Trade management issues

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Change PORT in .env
   - Kill process using the port

2. **Supabase connection failed**
   - Check credentials in .env
   - Verify network connectivity

3. **WebSocket connection failed**
   - Check CORS settings
   - Verify client connection logic

### Debug Mode
Set `NODE_ENV=development` for verbose logging.

### Logs
Check `logs/` directory for detailed error logs.

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## License

MIT License - see LICENSE file for details.

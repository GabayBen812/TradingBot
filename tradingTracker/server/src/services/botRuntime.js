import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { SignalEngine } from './signalEngine.js';
import { OrderManager } from './orderManager.js';
import { TradeManager } from './tradeManager.js';
import { MarketDataService } from './marketDataService.js';

export class BotRuntime {
  constructor() {
    this.isRunning = false;
    this.signalEngine = new SignalEngine();
    this.orderManager = new OrderManager();
    this.tradeManager = new TradeManager();
    this.marketDataService = new MarketDataService();
    
    // Configuration
    this.config = {
      scanInterval: process.env.BOT_SCAN_INTERVAL || 300000, // 5 minutes
      maxConcurrentTrades: process.env.BOT_MAX_CONCURRENT_TRADES || 5,
      riskPerTrade: process.env.BOT_RISK_PER_TRADE || 100,
      initialCapital: process.env.BOT_INITIAL_CAPITAL || 5000
    };
    
    logger.info('BotRuntime initialized', { config: this.config });
  }

  async start() {
    if (this.isRunning) {
      logger.warn('BotRuntime already running');
      return;
    }

    try {
      logger.info('Starting BotRuntime...');
      
      // Initialize services
      await this.signalEngine.initialize();
      await this.orderManager.initialize();
      await this.tradeManager.initialize();
      await this.marketDataService.initialize();
      
      // Start cron jobs
      this.startCronJobs();
      
      this.isRunning = true;
      logger.info('BotRuntime started successfully');
      
    } catch (error) {
      logger.error('Failed to start BotRuntime', { error: error.message });
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('BotRuntime not running');
      return;
    }

    try {
      logger.info('Stopping BotRuntime...');
      
      // Stop cron jobs
      this.stopCronJobs();
      
      // Cleanup services
      await this.signalEngine.cleanup();
      await this.orderManager.cleanup();
      await this.tradeManager.cleanup();
      await this.marketDataService.cleanup();
      
      this.isRunning = false;
      logger.info('BotRuntime stopped successfully');
      
    } catch (error) {
      logger.error('Failed to stop BotRuntime', { error: error.message });
    }
  }

  startCronJobs() {
    // Signal scanning every 5 minutes
    this.signalScanJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.scanForSignals();
      } catch (error) {
        logger.error('Signal scanning failed', { error: error.message });
      }
    });

    // Order monitoring every minute
    this.orderMonitorJob = cron.schedule('* * * * *', async () => {
      try {
        await this.monitorOrders();
      } catch (error) {
        logger.error('Order monitoring failed', { error: error.message });
      }
    });

    // Trade management every minute
    this.tradeManageJob = cron.schedule('* * * * *', async () => {
      try {
        await this.manageTrades();
      } catch (error) {
        logger.error('Trade management failed', { error: error.message });
      }
    });

    logger.info('Cron jobs started');
  }

  stopCronJobs() {
    if (this.signalScanJob) {
      this.signalScanJob.stop();
      this.signalScanJob = null;
    }
    if (this.orderMonitorJob) {
      this.orderMonitorJob.stop();
      this.orderMonitorJob = null;
    }
    if (this.tradeManageJob) {
      this.tradeManageJob.stop();
      this.tradeManageJob = null;
    }
    
    logger.info('Cron jobs stopped');
  }

  async scanForSignals() {
    try {
      logger.debug('Scanning for new signals...');
      const signals = await this.signalEngine.detectSetups();
      
      if (signals.length > 0) {
        logger.info(`Found ${signals.length} new signals`, { 
          symbols: signals.map(s => s.symbol) 
        });
        
        // Process signals based on mode
        await this.processSignals(signals);
      }
      
    } catch (error) {
      logger.error('Signal scanning failed', { error: error.message });
    }
  }

  async processSignals(signals) {
    for (const signal of signals) {
      try {
        // Check if we should auto-execute based on signal quality
        const shouldAutoExecute = this.shouldAutoExecuteSignal(signal);
        
        if (shouldAutoExecute) {
          await this.autoExecuteSignal(signal);
        } else {
          // For supervised mode, just create the order and wait for manual approval
          await this.signalEngine.storeSignal(signal);
        }
        
      } catch (error) {
        logger.error('Failed to process signal', { 
          symbol: signal.symbol, 
          error: error.message 
        });
      }
    }
  }

  shouldAutoExecuteSignal(signal) {
    // Strict mode: high confidence + FIB + good R:R
    if (signal.mode === 'strict') {
      return signal.confidence >= 70 && 
             signal.tags.includes('FIB') && 
             signal.riskReward >= 2.0;
    }
    
    // Explore mode: moderate confidence + decent R:R
    if (signal.mode === 'explore') {
      return signal.confidence >= 50 && 
             signal.riskReward >= 1.5;
    }
    
    // Supervised mode: never auto-execute
    return false;
  }

  async autoExecuteSignal(signal) {
    try {
      logger.info('Auto-executing signal', { 
        signalId: signal.id, 
        symbol: signal.symbol,
        mode: signal.mode 
      });
      
      // Calculate position size
      const positionSize = this.calculatePositionSize(signal);
      
      // Create pending order
      await this.orderManager.createOrder({
        signalId: signal.id,
        symbol: signal.symbol,
        side: signal.side,
        entry: signal.entry,
        stop: signal.stop,
        take: signal.take,
        size: positionSize,
        mode: signal.mode,
        executor: `bot_${signal.mode}`,
        status: 'PENDING'
      });
      
    } catch (error) {
      logger.error('Failed to auto-execute signal', { 
        signalId: signal.id, 
        error: error.message 
      });
    }
  }

  calculatePositionSize(signal) {
    const riskAmount = this.config.riskPerTrade;
    const riskPerUnit = Math.abs(signal.entry - signal.stop);
    
    if (riskPerUnit <= 0) return 0;
    
    const units = riskAmount / riskPerUnit;
    return Math.round(units * signal.entry);
  }

  async monitorOrders() {
    try {
      const pendingOrders = await this.orderManager.getPendingOrders();
      
      for (const order of pendingOrders) {
        try {
          const currentPrice = await this.marketDataService.getCurrentPrice(order.symbol);
          const shouldFill = this.shouldFillOrder(order, currentPrice);
          
          if (shouldFill) {
            await this.fillOrder(order, currentPrice);
          }
          
          // Check if order expired
          if (this.isOrderExpired(order)) {
            await this.expireOrder(order);
          }
          
        } catch (error) {
          logger.error('Failed to monitor order', { 
            orderId: order.id, 
            error: error.message 
          });
        }
      }
      
    } catch (error) {
      logger.error('Order monitoring failed', { error: error.message });
    }
  }

  shouldFillOrder(order, currentPrice) {
    if (order.side === 'LONG') {
      return currentPrice <= order.entry;
    } else {
      return currentPrice >= order.entry;
    }
  }

  async fillOrder(order, fillPrice) {
    try {
      logger.info('Filling order', { 
        orderId: order.id, 
        symbol: order.symbol,
        fillPrice 
      });
      
      // Create trade
      await this.tradeManager.createTrade({
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        entry: fillPrice,
        stop: order.stop,
        take: order.take,
        size: order.size,
        mode: order.mode,
        executor: order.executor,
        status: 'OPEN'
      });
      
      // Update order status
      await this.orderManager.updateOrderStatus(order.id, 'FILLED', {
        filledAt: new Date(),
        fillPrice
      });
      
    } catch (error) {
      logger.error('Failed to fill order', { 
        orderId: order.id, 
        error: error.message 
      });
    }
  }

  isOrderExpired(order) {
    const ttl = this.getOrderTTL(order.timeframe);
    const createdAt = new Date(order.createdAt);
    const now = new Date();
    
    return (now - createdAt) > ttl;
  }

  getOrderTTL(timeframe) {
    const ttlMap = {
      '5m': 30 * 60 * 1000,    // 30 minutes
      '15m': 2 * 60 * 60 * 1000,   // 2 hours
      '1h': 6 * 60 * 60 * 1000,    // 6 hours
      '4h': 24 * 60 * 60 * 1000    // 24 hours
    };
    
    return ttlMap[timeframe] || 6 * 60 * 60 * 1000; // Default 6 hours
  }

  async expireOrder(order) {
    try {
      logger.info('Expiring order', { 
        orderId: order.id, 
        symbol: order.symbol 
      });
      
      await this.orderManager.updateOrderStatus(order.id, 'EXPIRED', {
        expiredAt: new Date(),
        reason: 'TTL exceeded'
      });
      
    } catch (error) {
      logger.error('Failed to expire order', { 
        orderId: order.id, 
        error: error.message 
      });
    }
  }

  async manageTrades() {
    try {
      const openTrades = await this.tradeManager.getOpenTrades();
      
      for (const trade of openTrades) {
        try {
          const currentPrice = await this.marketDataService.getCurrentPrice(trade.symbol);
          const shouldClose = this.shouldCloseTrade(trade, currentPrice);
          
          if (shouldClose) {
            await this.closeTrade(trade, currentPrice);
          }
          
        } catch (error) {
          logger.error('Failed to manage trade', { 
            tradeId: trade.id, 
            error: error.message 
          });
        }
      }
      
    } catch (error) {
      logger.error('Trade management failed', { error: error.message });
    }
  }

  shouldCloseTrade(trade, currentPrice) {
    // Check stop loss
    if (trade.side === 'LONG' && currentPrice <= trade.stop) {
      return { reason: 'stop_loss', price: trade.stop };
    }
    if (trade.side === 'SHORT' && currentPrice >= trade.stop) {
      return { reason: 'stop_loss', price: trade.stop };
    }
    
    // Check take profit
    if (trade.side === 'LONG' && currentPrice >= trade.take) {
      return { reason: 'take_profit', price: trade.take };
    }
    if (trade.side === 'SHORT' && currentPrice <= trade.take) {
      return { reason: 'take_profit', price: trade.take };
    }
    
    // Check TTL (24 hours for open trades)
    const openedAt = new Date(trade.openedAt);
    const now = new Date();
    const ttl = 24 * 60 * 60 * 1000; // 24 hours
    
    if ((now - openedAt) > ttl) {
      return { reason: 'ttl', price: currentPrice };
    }
    
    return null;
  }

  async closeTrade(trade, closePrice) {
    try {
      const closeReason = this.shouldCloseTrade(trade, closePrice);
      
      logger.info('Closing trade', { 
        tradeId: trade.id, 
        symbol: trade.symbol,
        reason: closeReason.reason,
        closePrice
      });
      
      await this.tradeManager.closeTrade(trade.id, {
        exit: closeReason.price,
        closedAt: new Date(),
        reason: closeReason.reason
      });
      
    } catch (error) {
      logger.error('Failed to close trade', { 
        tradeId: trade.id, 
        error: error.message 
      });
    }
  }

  // Public methods for API access
  async getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      uptime: process.uptime(),
      stats: {
        activeSignals: await this.signalEngine.getActiveSignalsCount(),
        pendingOrders: await this.orderManager.getPendingOrdersCount(),
        openTrades: await this.tradeManager.getOpenTradesCount()
      }
    };
  }

  async getSignals(filters = {}) {
    return await this.signalEngine.getSignals(filters);
  }

  async getOrders(filters = {}) {
    return await this.orderManager.getOrders(filters);
  }

  async getTrades(filters = {}) {
    return await this.tradeManager.getTrades(filters);
  }
}

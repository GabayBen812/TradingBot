import axios from 'axios';
import { logger } from '../utils/logger.js';

export class MarketDataService {
  constructor() {
    this.isInitialized = false;
    this.binanceBaseUrl = 'https://api.binance.com/api/v3';
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    
    logger.info('MarketDataService initialized');
  }

  async initialize() {
    try {
      // Test connection to Binance
      await this.testConnection();
      this.isInitialized = true;
      logger.info('MarketDataService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MarketDataService', { error: error.message });
      throw error;
    }
  }

  async cleanup() {
    try {
      this.cache.clear();
      this.isInitialized = false;
      logger.info('MarketDataService cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup MarketDataService', { error: error.message });
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.binanceBaseUrl}/ping`);
      if (response.status !== 200) {
        throw new Error('Binance API not responding');
      }
      logger.info('Binance API connection test successful');
    } catch (error) {
      logger.error('Binance API connection test failed', { error: error.message });
      throw error;
    }
  }

  async getCurrentPrice(symbol) {
    try {
      const cacheKey = `price_${symbol}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.binanceBaseUrl}/ticker/price`, {
        params: { symbol }
      });

      if (response.status !== 200 || !response.data.price) {
        throw new Error('Invalid response from Binance');
      }

      const price = parseFloat(response.data.price);
      this.setCache(cacheKey, price);
      
      return price;
    } catch (error) {
      logger.error('Failed to get current price', { symbol, error: error.message });
      throw error;
    }
  }

  async getKlines(symbol, interval, limit = 100) {
    try {
      const cacheKey = `klines_${symbol}_${interval}_${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.binanceBaseUrl}/klines`, {
        params: {
          symbol,
          interval,
          limit
        }
      });

      if (response.status !== 200 || !Array.isArray(response.data)) {
        throw new Error('Invalid response from Binance');
      }

      const klines = response.data.map(kline => ({
        time: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        closeTime: kline[6],
        quoteAssetVolume: parseFloat(kline[7]),
        numberOfTrades: parseInt(kline[8]),
        takerBuyBaseAssetVolume: parseFloat(kline[9]),
        takerBuyQuoteAssetVolume: parseFloat(kline[10])
      }));

      this.setCache(cacheKey, klines);
      
      return klines;
    } catch (error) {
      logger.error('Failed to get klines', { symbol, interval, limit, error: error.message });
      throw error;
    }
  }

  async get24hrStats(symbol) {
    try {
      const cacheKey = `stats_${symbol}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.binanceBaseUrl}/ticker/24hr`, {
        params: { symbol }
      });

      if (response.status !== 200 || !response.data) {
        throw new Error('Invalid response from Binance');
      }

      const stats = {
        symbol: response.data.symbol,
        priceChange: parseFloat(response.data.priceChange),
        priceChangePercent: parseFloat(response.data.priceChangePercent),
        weightedAvgPrice: parseFloat(response.data.weightedAvgPrice),
        prevClosePrice: parseFloat(response.data.prevClosePrice),
        lastPrice: parseFloat(response.data.lastPrice),
        lastQty: parseFloat(response.data.lastQty),
        bidPrice: parseFloat(response.data.bidPrice),
        bidQty: parseFloat(response.data.bidQty),
        askPrice: parseFloat(response.data.askPrice),
        askQty: parseFloat(response.data.askQty),
        openPrice: parseFloat(response.data.openPrice),
        highPrice: parseFloat(response.data.highPrice),
        lowPrice: parseFloat(response.data.lowPrice),
        volume: parseFloat(response.data.volume),
        quoteVolume: parseFloat(response.data.quoteVolume),
        openTime: response.data.openTime,
        closeTime: response.data.closeTime,
        count: response.data.count
      };

      this.setCache(cacheKey, stats);
      
      return stats;
    } catch (error) {
      logger.error('Failed to get 24hr stats', { symbol, error: error.message });
      throw error;
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const cacheKey = `orderbook_${symbol}_${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.binanceBaseUrl}/depth`, {
        params: { symbol, limit }
      });

      if (response.status !== 200 || !response.data) {
        throw new Error('Invalid response from Binance');
      }

      const orderBook = {
        lastUpdateId: response.data.lastUpdateId,
        bids: response.data.bids.map(bid => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1])
        })),
        asks: response.data.asks.map(ask => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1])
        }))
      };

      this.setCache(cacheKey, orderBook);
      
      return orderBook;
    } catch (error) {
      logger.error('Failed to get order book', { symbol, limit, error: error.message });
      throw error;
    }
  }

  async getRecentTrades(symbol, limit = 100) {
    try {
      const cacheKey = `trades_${symbol}_${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.binanceBaseUrl}/trades`, {
        params: { symbol, limit }
      });

      if (response.status !== 200 || !Array.isArray(response.data)) {
        throw new Error('Invalid response from Binance');
      }

      const trades = response.data.map(trade => ({
        id: trade.id,
        price: parseFloat(trade.price),
        qty: parseFloat(trade.qty),
        quoteQty: parseFloat(trade.quoteQty),
        time: trade.time,
        isBuyerMaker: trade.isBuyerMaker,
        isBestMatch: trade.isBestMatch
      }));

      this.setCache(cacheKey, trades);
      
      return trades;
    } catch (error) {
      logger.error('Failed to get recent trades', { symbol, limit, error: error.message });
      throw error;
    }
  }

  async getSymbolInfo(symbol) {
    try {
      const cacheKey = `info_${symbol}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const response = await axios.get(`${this.binanceBaseUrl}/exchangeInfo`);
      
      if (response.status !== 200 || !response.data.symbols) {
        throw new Error('Invalid response from Binance');
      }

      const symbolInfo = response.data.symbols.find(s => s.symbol === symbol);
      if (!symbolInfo) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      this.setCache(cacheKey, symbolInfo);
      
      return symbolInfo;
    } catch (error) {
      logger.error('Failed to get symbol info', { symbol, error: error.message });
      throw error;
    }
  }

  // Cache management
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
    logger.info('Market data cache cleared');
  }

  // Utility methods
  async getMultiplePrices(symbols) {
    try {
      const prices = {};
      
      for (const symbol of symbols) {
        try {
          prices[symbol] = await this.getCurrentPrice(symbol);
        } catch (error) {
          logger.warn('Failed to get price for symbol', { symbol, error: error.message });
          prices[symbol] = null;
        }
      }
      
      return prices;
    } catch (error) {
      logger.error('Failed to get multiple prices', { error: error.message });
      throw error;
    }
  }

  async getPriceChange(symbol, hours = 24) {
    try {
      const stats = await this.get24hrStats(symbol);
      return {
        symbol,
        priceChange: stats.priceChange,
        priceChangePercent: stats.priceChangePercent,
        volume: stats.volume,
        high: stats.highPrice,
        low: stats.lowPrice
      };
    } catch (error) {
      logger.error('Failed to get price change', { symbol, hours, error: error.message });
      throw error;
    }
  }

  // Market analysis helpers
  async calculateVolatility(symbol, timeframe = '1h', periods = 24) {
    try {
      const klines = await this.getKlines(symbol, timeframe, periods);
      if (klines.length < 2) return 0;

      const returns = [];
      for (let i = 1; i < klines.length; i++) {
        const return_ = (klines[i].close - klines[i-1].close) / klines[i-1].close;
        returns.push(return_);
      }

      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance);

      return volatility;
    } catch (error) {
      logger.error('Failed to calculate volatility', { symbol, timeframe, periods, error: error.message });
      throw error;
    }
  }

  async calculateATR(symbol, timeframe = '1h', periods = 14) {
    try {
      const klines = await this.getKlines(symbol, timeframe, periods + 1);
      if (klines.length < periods + 1) return 0;

      const trueRanges = [];
      for (let i = 1; i < klines.length; i++) {
        const high = klines[i].high;
        const low = klines[i].low;
        const prevClose = klines[i-1].close;
        
        const tr1 = high - low;
        const tr2 = Math.abs(high - prevClose);
        const tr3 = Math.abs(low - prevClose);
        
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
      }

      const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
      return atr;
    } catch (error) {
      logger.error('Failed to calculate ATR', { symbol, timeframe, periods, error: error.message });
      throw error;
    }
  }
}

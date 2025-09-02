import { logger } from '../utils/logger.js';
import { MarketDataService } from './marketDataService.js';

export class SignalEngine {
  constructor() {
    this.marketDataService = new MarketDataService();
    this.isInitialized = false;
    
    // Configuration
    this.config = {
      symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'HYVEUSDT', 'XAUTUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT', 'BCHUSDT'],
      timeframes: ['5m', '15m', '1h'],
      minConfidence: 40,
      maxSignalsPerSymbol: 3
    };
    
    logger.info('SignalEngine initialized', { config: this.config });
  }

  async initialize() {
    try {
      await this.marketDataService.initialize();
      this.isInitialized = true;
      logger.info('SignalEngine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SignalEngine', { error: error.message });
      throw error;
    }
  }

  async cleanup() {
    try {
      await this.marketDataService.cleanup();
      this.isInitialized = false;
      logger.info('SignalEngine cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup SignalEngine', { error: error.message });
    }
  }

  async detectSetups() {
    if (!this.isInitialized) {
      throw new Error('SignalEngine not initialized');
    }

    const allSignals = [];
    
    for (const symbol of this.config.symbols) {
      try {
        const signals = await this.scanSymbol(symbol);
        allSignals.push(...signals);
      } catch (error) {
        logger.error('Failed to scan symbol', { symbol, error: error.message });
      }
    }

    // Filter and rank signals
    const filteredSignals = this.filterSignals(allSignals);
    const rankedSignals = this.rankSignals(filteredSignals);

    logger.info(`Detected ${rankedSignals.length} signals from ${allSignals.length} candidates`);
    
    return rankedSignals;
  }

  async scanSymbol(symbol) {
    const signals = [];
    
    for (const timeframe of this.config.timeframes) {
      try {
        const signal = await this.analyzeTimeframe(symbol, timeframe);
        if (signal) {
          signals.push(signal);
        }
      } catch (error) {
        logger.error('Failed to analyze timeframe', { symbol, timeframe, error: error.message });
      }
    }

    return signals;
  }

  async analyzeTimeframe(symbol, timeframe) {
    try {
      // Get market data
      const klines = await this.marketDataService.getKlines(symbol, timeframe, 100);
      if (!klines || klines.length < 50) {
        return null;
      }

      // Detect Fibonacci setups
      const fibSignal = this.detectFibonacciSetup(symbol, timeframe, klines);
      if (fibSignal) return fibSignal;

      // Detect FVG setups
      const fvgSignal = this.detectFVGSetup(symbol, timeframe, klines);
      if (fvgSignal) return fvgSignal;

      // Detect support/resistance setups
      const srSignal = this.detectSRSetup(symbol, timeframe, klines);
      if (srSignal) return srSignal;

      return null;

    } catch (error) {
      logger.error('Failed to analyze timeframe', { symbol, timeframe, error: error.message });
      return null;
    }
  }

  detectFibonacciSetup(symbol, timeframe, klines) {
    try {
      // Find swing highs and lows
      const swings = this.findSwings(klines);
      if (swings.length < 2) return null;

      // Look for Fibonacci retracement patterns
      for (let i = 0; i < swings.length - 1; i++) {
        const swing1 = swings[i];
        const swing2 = swings[i + 1];
        
        if (swing1.type === swing2.type) continue; // Need opposite swings
        
        const high = Math.max(swing1.price, swing2.price);
        const low = Math.min(swing1.price, swing2.price);
        const range = high - low;
        
        // Calculate Fibonacci levels
        const fib618 = high - (range * 0.618);
        const fib786 = high - (range * 0.786);
        
        const currentPrice = klines[klines.length - 1].close;
        
        // Check if price is near 61.8% level
        const tolerance = range * 0.01; // 1% tolerance
        if (Math.abs(currentPrice - fib618) <= tolerance) {
          const side = swing1.type === 'high' ? 'SHORT' : 'LONG';
          const entry = currentPrice;
          const stop = fib786;
          const take = side === 'LONG' ? high : low;
          
          const riskReward = Math.abs(take - entry) / Math.abs(entry - stop);
          
          if (riskReward >= 1.5) {
            return {
              id: `fib_${symbol}_${timeframe}_${Date.now()}`,
              symbol,
              timeframe,
              side,
              entry,
              stop,
              take,
              confidence: this.calculateConfidence('FIB', riskReward, timeframe),
              tags: ['FIB'],
              reason: `Fibonacci 61.8% retracement on ${timeframe}`,
              riskReward,
              createdAt: new Date().toISOString(),
              mode: 'supervised' // Default mode
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to detect Fibonacci setup', { symbol, timeframe, error: error.message });
      return null;
    }
  }

  detectFVGSetup(symbol, timeframe, klines) {
    try {
      // Find Fair Value Gaps (FVG)
      const fvgs = this.findFVGs(klines);
      if (fvgs.length === 0) return null;

      const currentPrice = klines[klines.length - 1].close;
      
      // Check if price is near any FVG
      for (const fvg of fvgs) {
        if (fvg.type === 'bullish' && currentPrice >= fvg.low && currentPrice <= fvg.high) {
          const entry = currentPrice;
          const stop = fvg.low;
          const take = entry + (entry - stop) * 2; // 2:1 R:R
          
          const riskReward = Math.abs(take - entry) / Math.abs(entry - stop);
          
          if (riskReward >= 1.5) {
            return {
              id: `fvg_${symbol}_${timeframe}_${Date.now()}`,
              symbol,
              timeframe,
              side: 'LONG',
              entry,
              stop,
              take,
              confidence: this.calculateConfidence('FVG', riskReward, timeframe),
              tags: ['FVG'],
              reason: `Bullish FVG retest on ${timeframe}`,
              riskReward,
              createdAt: new Date().toISOString(),
              mode: 'supervised'
            };
          }
        } else if (fvg.type === 'bearish' && currentPrice <= fvg.high && currentPrice >= fvg.low) {
          const entry = currentPrice;
          const stop = fvg.high;
          const take = entry - (stop - entry) * 2; // 2:1 R:R
          
          const riskReward = Math.abs(take - entry) / Math.abs(entry - stop);
          
          if (riskReward >= 1.5) {
            return {
              id: `fvg_${symbol}_${timeframe}_${Date.now()}`,
              symbol,
              timeframe,
              side: 'SHORT',
              entry,
              stop,
              take,
              confidence: this.calculateConfidence('FVG', riskReward, timeframe),
              tags: ['FVG'],
              reason: `Bearish FVG retest on ${timeframe}`,
              riskReward,
              createdAt: new Date().toISOString(),
              mode: 'supervised'
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to detect FVG setup', { symbol, timeframe, error: error.message });
      return null;
    }
  }

  detectSRSetup(symbol, timeframe, klines) {
    try {
      // Find support and resistance levels
      const levels = this.findSRLevels(klines);
      if (levels.length === 0) return null;

      const currentPrice = klines[klines.length - 1].close;
      
      // Check if price is near any level
      for (const level of levels) {
        const tolerance = level.price * 0.005; // 0.5% tolerance
        
        if (Math.abs(currentPrice - level.price) <= tolerance) {
          const side = level.type === 'support' ? 'LONG' : 'SHORT';
          const entry = currentPrice;
          const stop = side === 'LONG' ? level.price * 0.995 : level.price * 1.005;
          const take = side === 'LONG' ? entry * 1.02 : entry * 0.98; // 2% target
          
          const riskReward = Math.abs(take - entry) / Math.abs(entry - stop);
          
          if (riskReward >= 1.5) {
            return {
              id: `sr_${symbol}_${timeframe}_${Date.now()}`,
              symbol,
              timeframe,
              side,
              entry,
              stop,
              take,
              confidence: this.calculateConfidence('SR', riskReward, timeframe),
              tags: ['SR'],
              reason: `${level.type} level retest on ${timeframe}`,
              riskReward,
              createdAt: new Date().toISOString(),
              mode: 'supervised'
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to detect SR setup', { symbol, timeframe, error: error.message });
      return null;
    }
  }

  findSwings(klines) {
    const swings = [];
    const lookback = 5;
    
    for (let i = lookback; i < klines.length - lookback; i++) {
      const current = klines[i];
      let isHigh = true;
      let isLow = true;
      
      // Check if current is a high
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        if (klines[j].high > current.high) {
          isHigh = false;
          break;
        }
      }
      
      // Check if current is a low
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        if (klines[j].low < current.low) {
          isLow = false;
          break;
        }
      }
      
      if (isHigh) {
        swings.push({ index: i, price: current.high, type: 'high', time: current.time });
      } else if (isLow) {
        swings.push({ index: i, price: current.low, type: 'low', time: current.time });
      }
    }
    
    return swings;
  }

  findFVGs(klines) {
    const fvgs = [];
    
    for (let i = 1; i < klines.length - 1; i++) {
      const prev = klines[i - 1];
      const current = klines[i];
      const next = klines[i + 1];
      
      // Bullish FVG: gap between previous low and current high
      if (current.high > prev.low) {
        fvgs.push({
          type: 'bullish',
          low: prev.low,
          high: current.high,
          time: current.time
        });
      }
      
      // Bearish FVG: gap between previous high and current low
      if (current.low < prev.high) {
        fvgs.push({
          type: 'bearish',
          low: current.low,
          high: prev.high,
          time: current.time
        });
      }
    }
    
    return fvgs;
  }

  findSRLevels(klines) {
    const levels = [];
    const lookback = 10;
    
    for (let i = lookback; i < klines.length - lookback; i++) {
      const current = klines[i];
      
      // Check for resistance
      let resistanceCount = 0;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        if (Math.abs(klines[j].high - current.high) < current.high * 0.01) {
          resistanceCount++;
        }
      }
      
      if (resistanceCount >= 2) {
        levels.push({
          price: current.high,
          type: 'resistance',
          strength: resistanceCount,
          time: current.time
        });
      }
      
      // Check for support
      let supportCount = 0;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        if (Math.abs(klines[j].low - current.low) < current.low * 0.01) {
          supportCount++;
        }
      }
      
      if (supportCount >= 2) {
        levels.push({
          price: current.low,
          type: 'support',
          strength: supportCount,
          time: current.time
        });
      }
    }
    
    return levels;
  }

  calculateConfidence(strategy, riskReward, timeframe) {
    let confidence = 50; // Base confidence
    
    // Strategy bonus
    const strategyBonus = {
      'FIB': 20,
      'FVG': 15,
      'SR': 10
    };
    confidence += strategyBonus[strategy] || 0;
    
    // Risk/Reward bonus
    if (riskReward >= 3) confidence += 20;
    else if (riskReward >= 2) confidence += 15;
    else if (riskReward >= 1.5) confidence += 10;
    
    // Timeframe bonus (higher timeframes = more reliable)
    const timeframeBonus = {
      '1h': 15,
      '15m': 10,
      '5m': 5
    };
    confidence += timeframeBonus[timeframe] || 0;
    
    return Math.min(100, confidence);
  }

  filterSignals(signals) {
    return signals.filter(signal => {
      // Filter by minimum confidence
      if (signal.confidence < this.config.minConfidence) return false;
      
      // Filter by risk/reward
      if (signal.riskReward < 1.5) return false;
      
      return true;
    });
  }

  rankSignals(signals) {
    return signals.sort((a, b) => {
      // Primary sort by confidence
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      
      // Secondary sort by risk/reward
      if (a.riskReward !== b.riskReward) {
        return b.riskReward - a.riskReward;
      }
      
      // Tertiary sort by timeframe (prefer higher timeframes)
      const timeframeOrder = { '1h': 3, '15m': 2, '5m': 1 };
      return timeframeOrder[b.timeframe] - timeframeOrder[a.timeframe];
    });
  }

  async storeSignal(signal) {
    try {
      // Instead of storing signals, create orders directly
      // This eliminates the need for a signals table
      logger.info('Signal detected, creating order directly', { 
        symbol: signal.symbol,
        confidence: signal.confidence 
      });
      
      // Create order directly from signal
      const orderData = {
        symbol: signal.symbol,
        side: signal.side,
        entry: signal.entry,
        stop: signal.stop,
        take: signal.take,
        size: this.calculatePositionSize(signal),
        mode: signal.mode || 'supervised',
        executor: signal.mode === 'supervised' ? 'human' : 
                 signal.mode === 'strict' ? 'bot_strict' : 'bot_explore',
        status: 'PENDING'
      };

      // Import and use OrderManager to create order
      const { OrderManager } = await import('./orderManager.js');
      const orderManager = new OrderManager();
      await orderManager.initialize();
      
      const order = await orderManager.createOrder(orderData);
      
      logger.info('Order created from signal', { 
        orderId: order.id, 
        symbol: order.symbol,
        mode: order.mode 
      });
      
      return order;
    } catch (error) {
      logger.error('Failed to create order from signal', { 
        symbol: signal.symbol, 
        error: error.message 
      });
      throw error;
    }
  }

  async getSignals(filters = {}) {
    try {
      // Live scan across symbols/timeframes
      const symbols = filters.symbol ? [filters.symbol] : this.config.symbols
      const timeframes = filters.timeframe ? [filters.timeframe] : this.config.timeframes
      const minConf = typeof filters.min_conf === 'number' ? filters.min_conf : null

      const out = []
      for (const symbol of symbols) {
        for (const tf of timeframes) {
          const s = await this.analyzeTimeframe(symbol, tf)
          if (!s) continue

          // Ensure basic shape; if analyzeTimeframe returns a partial signal, coerce it
          const orderLike = {
            entry: s.entry,
            stop: s.stop,
            take: s.take,
            mode: filters.mode || 'supervised',
            side: s.side,
            timeframe: tf,
          }
          const confidence = this.calculateOrderConfidence(orderLike)
          const tags = this.extractTagsFromOrder(orderLike)

          const sig = {
            id: `${symbol}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            symbol,
            side: s.side,
            entry: s.entry,
            stop: s.stop,
            take: s.take,
            confidence,
            tags,
            timeframe: tf,
            mode: filters.mode || 'supervised',
            status: 'NEW',
            createdAt: new Date().toISOString(),
            reason: s.reason || tags.join(', ')
          }

          if (minConf != null && (sig.confidence ?? 0) < minConf) continue
          out.push(sig)
        }
      }

      return out
    } catch (error) {
      logger.error('Failed to get signals (live scan)', { error: error.message })
      return []
    }
  }

  calculateOrderConfidence(order) {
    // Calculate confidence based on order parameters
    let confidence = 50; // Base confidence
    
    // Risk/Reward bonus
    const riskReward = Math.abs(order.take - order.entry) / Math.abs(order.entry - order.stop);
    if (riskReward >= 3) confidence += 20;
    else if (riskReward >= 2) confidence += 15;
    else if (riskReward >= 1.5) confidence += 10;
    
    // Mode bonus
    if (order.mode === 'strict') confidence += 10;
    if (order.mode === 'explore') confidence += 5;
    
    return Math.min(100, confidence);
  }

  extractTagsFromOrder(order) {
    // Extract tags based on order characteristics
    const tags = [];
    
    // Add tags based on price levels, patterns, etc.
    if (order.entry > order.stop && order.entry < order.take) {
      tags.push('TREND');
    }
    
    // Add Risk/Reward tags
    const riskReward = Math.abs(order.take - order.entry) / Math.abs(order.entry - order.stop);
    if (riskReward >= 3) {
      tags.push('High R:R');
      tags.push('Premium');
    } else if (riskReward >= 2) {
      tags.push('Good R:R');
    } else if (riskReward >= 1.5) {
      tags.push('Decent R:R');
    }
    
    // Add mode-based tags
    if (order.mode === 'strict') {
      tags.push('Strict');
      tags.push('High Prob');
    } else if (order.mode === 'explore') {
      tags.push('Explore');
      tags.push('Data Collection');
    } else {
      tags.push('Supervised');
    }
    
    // Add side-based tags
    if (order.side === 'LONG') {
      tags.push('Bullish');
    } else {
      tags.push('Bearish');
    }
    
    // Add timeframe tag
    if (order.timeframe) {
      tags.push(order.timeframe);
    }
    
    // If no tags generated, add a default
    if (tags.length === 0) {
      tags.push('Signal');
    }
    
    return tags;
  }

  calculatePositionSize(signal) {
    // Calculate position size based on risk management
    const riskAmount = 100; // $100 risk per trade
    const entryStopDistance = Math.abs(signal.entry - signal.stop);
    const positionSize = riskAmount / entryStopDistance;
    
    return Math.round(positionSize * 1000000) / 1000000; // Round to 6 decimal places
  }

  async getActiveSignalsCount() {
    try {
      const signals = await this.getSignals({ status: 'NEW' });
      return signals.length;
    } catch (error) {
      logger.error('Failed to get active signals count', { error: error.message });
      return 0;
    }
  }
}

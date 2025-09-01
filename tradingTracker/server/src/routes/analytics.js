import { logger } from '../utils/logger.js';

export function setupAnalyticsRoutes(app, botRuntime) {
  // Get overall performance analytics
  app.get('/analytics/performance', async (req, res) => {
    try {
      const { timeframe = '24h' } = req.query;
      
      // Get data from different services
      const [signals, orders, trades] = await Promise.all([
        botRuntime.getSignals({ timeframe }),
        botRuntime.getOrders({ timeframe }),
        botRuntime.getTrades({ timeframe })
      ]);
      
      // Calculate overall metrics
      const totalSignals = signals.length;
      const totalOrders = orders.length;
      const totalTrades = trades.length;
      
      const filledOrders = orders.filter(o => o.status === 'FILLED').length;
      const openTrades = trades.filter(t => t.status === 'OPEN').length;
      const closedTrades = trades.filter(t => t.status === 'CLOSED').length;
      
      const winRate = closedTrades > 0 
        ? (trades.filter(t => t.status === 'CLOSED' && t.realizedR > 0).length / closedTrades) * 100
        : 0;
      
      const avgR = closedTrades > 0
        ? trades.filter(t => t.status === 'CLOSED' && t.realizedR !== null)
            .reduce((sum, t) => sum + (t.realizedR || 0), 0) / closedTrades
        : 0;
      
      const totalR = trades.filter(t => t.status === 'CLOSED' && t.realizedR !== null)
        .reduce((sum, t) => sum + (t.realizedR || 0), 0);
      
      const equity = botRuntime.config.initialCapital + (totalR * botRuntime.config.riskPerTrade);
      
      const analytics = {
        timeframe,
        overview: {
          totalSignals,
          totalOrders,
          totalTrades,
          filledOrders,
          openTrades,
          closedTrades
        },
        performance: {
          winRate: Math.round(winRate * 100) / 100,
          avgR: Math.round(avgR * 100) / 100,
          totalR: Math.round(totalR * 100) / 100,
          equity: Math.round(equity * 100) / 100
        },
        byMode: {},
        bySymbol: {},
        byExecutor: {}
      };
      
      // Calculate metrics by mode
      const modes = ['supervised', 'strict', 'explore'];
      modes.forEach(mode => {
        const modeTrades = trades.filter(t => t.mode === mode && t.status === 'CLOSED');
        if (modeTrades.length > 0) {
          const modeWins = modeTrades.filter(t => t.realizedR > 0).length;
          const modeWinRate = (modeWins / modeTrades.length) * 100;
          const modeAvgR = modeTrades.reduce((sum, t) => sum + (t.realizedR || 0), 0) / modeTrades.length;
          
          analytics.byMode[mode] = {
            totalTrades: modeTrades.length,
            winRate: Math.round(modeWinRate * 100) / 100,
            avgR: Math.round(modeAvgR * 100) / 100
          };
        }
      });
      
      // Calculate metrics by symbol
      const symbols = [...new Set(trades.map(t => t.symbol))];
      symbols.forEach(symbol => {
        const symbolTrades = trades.filter(t => t.symbol === symbol && t.status === 'CLOSED');
        if (symbolTrades.length > 0) {
          const symbolWins = symbolTrades.filter(t => t.realizedR > 0).length;
          const symbolWinRate = (symbolWins / symbolTrades.length) * 100;
          const symbolAvgR = symbolTrades.reduce((sum, t) => sum + (t.realizedR || 0), 0) / symbolTrades.length;
          
          analytics.bySymbol[symbol] = {
            totalTrades: symbolTrades.length,
            winRate: Math.round(symbolWinRate * 100) / 100,
            avgR: Math.round(symbolAvgR * 100) / 100
          };
        }
      });
      
      // Calculate metrics by executor
      const executors = [...new Set(trades.map(t => t.executor))];
      executors.forEach(executor => {
        const executorTrades = trades.filter(t => t.executor === executor && t.status === 'CLOSED');
        if (executorTrades.length > 0) {
          const executorWins = executorTrades.filter(t => t.realizedR > 0).length;
          const executorWinRate = (executorWins / executorTrades.length) * 100;
          const executorAvgR = executorTrades.reduce((sum, t) => sum + (t.realizedR || 0), 0) / executorTrades.length;
          
          analytics.byExecutor[executor] = {
            totalTrades: executorTrades.length,
            winRate: Math.round(executorWinRate * 100) / 100,
            avgR: Math.round(executorAvgR * 100) / 100
          };
        }
      });
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Failed to get performance analytics', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get performance analytics',
        message: error.message 
      });
    }
  });

  // Get symbol performance analytics
  app.get('/analytics/symbols', async (req, res) => {
    try {
      const { timeframe = '24h' } = req.query;
      
      const trades = await botRuntime.getTrades({ timeframe });
      const closedTrades = trades.filter(t => t.status === 'CLOSED');
      
      const symbolAnalytics = {};
      
      // Group trades by symbol
      closedTrades.forEach(trade => {
        if (!symbolAnalytics[trade.symbol]) {
          symbolAnalytics[trade.symbol] = {
            symbol: trade.symbol,
            totalTrades: 0,
            wins: 0,
            losses: 0,
            totalR: 0,
            avgR: 0,
            maxR: -Infinity,
            minR: Infinity,
            byMode: {},
            byExecutor: {}
          };
        }
        
        const analytics = symbolAnalytics[trade.symbol];
        analytics.totalTrades++;
        
        if (trade.realizedR > 0) {
          analytics.wins++;
        } else {
          analytics.losses++;
        }
        
        analytics.totalR += trade.realizedR || 0;
        analytics.maxR = Math.max(analytics.maxR, trade.realizedR || 0);
        analytics.minR = Math.min(analytics.minR, trade.realizedR || 0);
        
        // By mode
        if (!analytics.byMode[trade.mode]) {
          analytics.byMode[trade.mode] = { total: 0, wins: 0, totalR: 0 };
        }
        analytics.byMode[trade.mode].total++;
        if (trade.realizedR > 0) analytics.byMode[trade.mode].wins++;
        analytics.byMode[trade.mode].totalR += trade.realizedR || 0;
        
        // By executor
        if (!analytics.byExecutor[trade.executor]) {
          analytics.byExecutor[trade.executor] = { total: 0, wins: 0, totalR: 0 };
        }
        analytics.byExecutor[trade.executor].total++;
        if (trade.realizedR > 0) analytics.byExecutor[trade.executor].wins++;
        analytics.byExecutor[trade.executor].totalR += trade.realizedR || 0;
      });
      
      // Calculate final metrics
      Object.values(symbolAnalytics).forEach(analytics => {
        analytics.winRate = analytics.totalTrades > 0 ? (analytics.wins / analytics.totalTrades) * 100 : 0;
        analytics.avgR = analytics.totalTrades > 0 ? analytics.totalR / analytics.totalTrades : 0;
        
        // Round values
        analytics.winRate = Math.round(analytics.winRate * 100) / 100;
        analytics.avgR = Math.round(analytics.avgR * 100) / 100;
        analytics.totalR = Math.round(analytics.totalR * 100) / 100;
        analytics.maxR = Math.round(analytics.maxR * 100) / 100;
        analytics.minR = Math.round(analytics.minR * 100) / 100;
        
        // Calculate mode and executor metrics
        Object.values(analytics.byMode).forEach(mode => {
          mode.winRate = mode.total > 0 ? (mode.wins / mode.total) * 100 : 0;
          mode.avgR = mode.total > 0 ? mode.totalR / mode.total : 0;
          mode.winRate = Math.round(mode.winRate * 100) / 100;
          mode.avgR = Math.round(mode.avgR * 100) / 100;
        });
        
        Object.values(analytics.byExecutor).forEach(executor => {
          executor.winRate = executor.total > 0 ? (executor.wins / executor.total) * 100 : 0;
          executor.avgR = executor.total > 0 ? executor.totalR / executor.total : 0;
          executor.winRate = Math.round(executor.winRate * 100) / 100;
          executor.avgR = Math.round(executor.avgR * 100) / 100;
        });
      });
      
      // Convert to array and sort by total R
      const symbolArray = Object.values(symbolAnalytics).sort((a, b) => b.totalR - a.totalR);
      
      res.json({
        success: true,
        data: symbolArray,
        timeframe
      });
    } catch (error) {
      logger.error('Failed to get symbol analytics', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get symbol analytics',
        message: error.message 
      });
    }
  });

  // Get hourly performance analytics
  app.get('/analytics/hours', async (req, res) => {
    try {
      const { timeframe = '24h' } = req.query;
      
      const trades = await botRuntime.getTrades({ timeframe });
      const closedTrades = trades.filter(t => t.status === 'CLOSED');
      
      const hourlyAnalytics = {};
      
      // Initialize all hours
      for (let hour = 0; hour < 24; hour++) {
        hourlyAnalytics[hour] = {
          hour,
          totalTrades: 0,
          wins: 0,
          losses: 0,
          totalR: 0,
          avgR: 0,
          byMode: {},
          bySymbol: {}
        };
      }
      
      // Group trades by hour
      closedTrades.forEach(trade => {
        const openedAt = new Date(trade.openedAt);
        const hour = openedAt.getHours();
        
        const analytics = hourlyAnalytics[hour];
        analytics.totalTrades++;
        
        if (trade.realizedR > 0) {
          analytics.wins++;
        } else {
          analytics.losses++;
        }
        
        analytics.totalR += trade.realizedR || 0;
        
        // By mode
        if (!analytics.byMode[trade.mode]) {
          analytics.byMode[trade.mode] = { total: 0, wins: 0, totalR: 0 };
        }
        analytics.byMode[trade.mode].total++;
        if (trade.realizedR > 0) analytics.byMode[trade.mode].wins++;
        analytics.byMode[trade.mode].totalR += trade.realizedR || 0;
        
        // By symbol
        if (!analytics.bySymbol[trade.symbol]) {
          analytics.bySymbol[trade.symbol] = { total: 0, wins: 0, totalR: 0 };
        }
        analytics.bySymbol[trade.symbol].total++;
        if (trade.realizedR > 0) analytics.bySymbol[trade.symbol].wins++;
        analytics.bySymbol[trade.symbol].totalR += trade.realizedR || 0;
      });
      
      // Calculate final metrics
      Object.values(hourlyAnalytics).forEach(analytics => {
        analytics.winRate = analytics.totalTrades > 0 ? (analytics.wins / analytics.totalTrades) * 100 : 0;
        analytics.avgR = analytics.totalTrades > 0 ? analytics.totalR / analytics.totalTrades : 0;
        
        // Round values
        analytics.winRate = Math.round(analytics.winRate * 100) / 100;
        analytics.avgR = Math.round(analytics.avgR * 100) / 100;
        analytics.totalR = Math.round(analytics.totalR * 100) / 100;
        
        // Calculate mode and symbol metrics
        Object.values(analytics.byMode).forEach(mode => {
          mode.winRate = mode.total > 0 ? (mode.wins / mode.total) * 100 : 0;
          mode.avgR = mode.total > 0 ? mode.totalR / mode.total : 0;
          mode.winRate = Math.round(mode.winRate * 100) / 100;
          mode.avgR = Math.round(mode.avgR * 100) / 100;
        });
        
        Object.values(analytics.bySymbol).forEach(symbol => {
          symbol.winRate = symbol.total > 0 ? (symbol.wins / symbol.total) * 100 : 0;
          symbol.avgR = symbol.total > 0 ? symbol.totalR / symbol.total : 0;
          symbol.winRate = Math.round(symbol.winRate * 100) / 100;
          symbol.avgR = Math.round(symbol.avgR * 100) / 100;
        });
      });
      
      // Convert to array
      const hourlyArray = Object.values(hourlyAnalytics);
      
      res.json({
        success: true,
        data: hourlyArray,
        timeframe
      });
    } catch (error) {
      logger.error('Failed to get hourly analytics', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get hourly analytics',
        message: error.message 
      });
    }
  });

  // Get mode performance analytics
  app.get('/analytics/modes', async (req, res) => {
    try {
      const { timeframe = '24h' } = req.query;
      
      const trades = await botRuntime.getTrades({ timeframe });
      const closedTrades = trades.filter(t => t.status === 'CLOSED');
      
      const modeAnalytics = {};
      
      // Group trades by mode
      closedTrades.forEach(trade => {
        if (!modeAnalytics[trade.mode]) {
          modeAnalytics[trade.mode] = {
            mode: trade.mode,
            totalTrades: 0,
            wins: 0,
            losses: 0,
            totalR: 0,
            avgR: 0,
            bySymbol: {},
            byExecutor: {}
          };
        }
        
        const analytics = modeAnalytics[trade.mode];
        analytics.totalTrades++;
        
        if (trade.realizedR > 0) {
          analytics.wins++;
        } else {
          analytics.losses++;
        }
        
        analytics.totalR += trade.realizedR || 0;
        
        // By symbol
        if (!analytics.bySymbol[trade.symbol]) {
          analytics.bySymbol[trade.symbol] = { total: 0, wins: 0, totalR: 0 };
        }
        analytics.bySymbol[trade.symbol].total++;
        if (trade.realizedR > 0) analytics.bySymbol[trade.symbol].wins++;
        analytics.bySymbol[trade.symbol].totalR += trade.realizedR || 0;
        
        // By executor
        if (!analytics.byExecutor[trade.executor]) {
          analytics.byExecutor[trade.executor] = { total: 0, wins: 0, totalR: 0 };
        }
        analytics.byExecutor[trade.executor].total++;
        if (trade.realizedR > 0) analytics.byExecutor[trade.executor].wins++;
        analytics.byExecutor[trade.executor].totalR += trade.realizedR || 0;
      });
      
      // Calculate final metrics
      Object.values(modeAnalytics).forEach(analytics => {
        analytics.winRate = analytics.totalTrades > 0 ? (analytics.wins / analytics.totalTrades) * 100 : 0;
        analytics.avgR = analytics.totalTrades > 0 ? analytics.totalR / analytics.totalTrades : 0;
        
        // Round values
        analytics.winRate = Math.round(analytics.winRate * 100) / 100;
        analytics.avgR = Math.round(analytics.avgR * 100) / 100;
        analytics.totalR = Math.round(analytics.totalR * 100) / 100;
        
        // Calculate symbol and executor metrics
        Object.values(analytics.bySymbol).forEach(symbol => {
          symbol.winRate = symbol.total > 0 ? (symbol.wins / symbol.total) * 100 : 0;
          symbol.avgR = symbol.total > 0 ? symbol.totalR / symbol.total : 0;
          symbol.winRate = Math.round(symbol.winRate * 100) / 100;
          symbol.avgR = Math.round(symbol.avgR * 100) / 100;
        });
        
        Object.values(analytics.byExecutor).forEach(executor => {
          executor.winRate = executor.total > 0 ? (executor.wins / executor.total) * 100 : 0;
          executor.avgR = executor.total > 0 ? executor.totalR / executor.total : 0;
          executor.winRate = Math.round(executor.winRate * 100) / 100;
          executor.avgR = Math.round(executor.avgR * 100) / 100;
        });
      });
      
      // Convert to array and sort by total R
      const modeArray = Object.values(modeAnalytics).sort((a, b) => b.totalR - a.totalR);
      
      res.json({
        success: true,
        data: modeArray,
        timeframe
      });
    } catch (error) {
      logger.error('Failed to get mode analytics', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get mode analytics',
        message: error.message 
      });
    }
  });

  // Get equity curve data
  app.get('/analytics/equity-curve', async (req, res) => {
    try {
      const { timeframe = '24h' } = req.query;
      
      const trades = await botRuntime.getTrades({ timeframe });
      const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.realizedR !== null);
      
      // Sort trades by close time
      closedTrades.sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt));
      
      const equityCurve = [];
      let runningR = 0;
      let runningEquity = botRuntime.config.initialCapital;
      
      closedTrades.forEach(trade => {
        runningR += trade.realizedR;
        runningEquity = botRuntime.config.initialCapital + (runningR * botRuntime.config.riskPerTrade);
        
        equityCurve.push({
          timestamp: trade.closedAt,
          tradeId: trade.id,
          symbol: trade.symbol,
          realizedR: trade.realizedR,
          runningR: Math.round(runningR * 100) / 100,
          equity: Math.round(runningEquity * 100) / 100
        });
      });
      
      res.json({
        success: true,
        data: equityCurve,
        timeframe,
        initialCapital: botRuntime.config.initialCapital,
        riskPerTrade: botRuntime.config.riskPerTrade
      });
    } catch (error) {
      logger.error('Failed to get equity curve', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get equity curve',
        message: error.message 
      });
    }
  });
}

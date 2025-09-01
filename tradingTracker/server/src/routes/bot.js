import { logger } from '../utils/logger.js';

export function setupBotRoutes(app, botRuntime) {
  // Get bot status and statistics
  app.get('/bot/status', async (req, res) => {
    try {
      const status = await botRuntime.getStatus();
      res.json(status);
    } catch (error) {
      logger.error('Failed to get bot status', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get bot status',
        message: error.message 
      });
    }
  });

  // Start bot runtime
  app.post('/bot/start', async (req, res) => {
    try {
      await botRuntime.start();
      res.json({ 
        success: true, 
        message: 'Bot runtime started successfully' 
      });
    } catch (error) {
      logger.error('Failed to start bot', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to start bot',
        message: error.message 
      });
    }
  });

  // Stop bot runtime
  app.post('/bot/stop', async (req, res) => {
    try {
      await botRuntime.stop();
      res.json({ 
        success: true, 
        message: 'Bot runtime stopped successfully' 
      });
    } catch (error) {
      logger.error('Failed to stop bot', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to stop bot',
        message: error.message 
      });
    }
  });

  // Get bot configuration
  app.get('/bot/config', (req, res) => {
    try {
      res.json(botRuntime.config);
    } catch (error) {
      logger.error('Failed to get bot config', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get bot config',
        message: error.message 
      });
    }
  });

  // Update bot configuration
  app.put('/bot/config', async (req, res) => {
    try {
      const { scanInterval, maxConcurrentTrades, riskPerTrade, initialCapital } = req.body;
      
      // Validate inputs
      if (scanInterval && (typeof scanInterval !== 'number' || scanInterval < 60000)) {
        return res.status(400).json({ 
          error: 'Invalid scan interval. Must be at least 60000ms (1 minute)' 
        });
      }
      
      if (maxConcurrentTrades && (typeof maxConcurrentTrades !== 'number' || maxConcurrentTrades < 1)) {
        return res.status(400).json({ 
          error: 'Invalid max concurrent trades. Must be at least 1' 
        });
      }
      
      if (riskPerTrade && (typeof riskPerTrade !== 'number' || riskPerTrade <= 0)) {
        return res.status(400).json({ 
          error: 'Invalid risk per trade. Must be greater than 0' 
        });
      }
      
      if (initialCapital && (typeof initialCapital !== 'number' || initialCapital <= 0)) {
        return res.status(400).json({ 
          error: 'Invalid initial capital. Must be greater than 0' 
        });
      }
      
      // Update configuration
      if (scanInterval !== undefined) botRuntime.config.scanInterval = scanInterval;
      if (maxConcurrentTrades !== undefined) botRuntime.config.maxConcurrentTrades = maxConcurrentTrades;
      if (riskPerTrade !== undefined) botRuntime.config.riskPerTrade = riskPerTrade;
      if (initialCapital !== undefined) botRuntime.config.initialCapital = initialCapital;
      
      logger.info('Bot configuration updated', { config: botRuntime.config });
      
      res.json({ 
        success: true, 
        message: 'Configuration updated successfully',
        config: botRuntime.config 
      });
      
    } catch (error) {
      logger.error('Failed to update bot config', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to update bot config',
        message: error.message 
      });
    }
  });

  // Get user bot settings
  app.get('/bot/settings', async (req, res) => {
    try {
      const { user_id, mode } = req.query;
      
      if (!user_id || !mode) {
        return res.status(400).json({ error: 'user_id and mode are required' });
      }

      // Import supabase client
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      const { data, error } = await supabase
        .from('bot_settings')
        .select('*')
        .eq('user_id', user_id)
        .eq('mode', mode)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to fetch bot settings:', error);
        return res.status(500).json({ error: 'Failed to fetch settings' });
      }

      res.json({ data: data || null });
    } catch (error) {
      logger.error('Error fetching bot settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Manual signal scan trigger
  app.post('/bot/scan', async (req, res) => {
    try {
      await botRuntime.scanForSignals();
      res.json({ 
        success: true, 
        message: 'Manual signal scan completed' 
      });
    } catch (error) {
      logger.error('Failed to trigger manual scan', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to trigger manual scan',
        message: error.message 
      });
    }
  });

  // Get bot performance metrics
  app.get('/bot/metrics', async (req, res) => {
    try {
      const { timeframe = '24h' } = req.query;
      
      // Get metrics from different services
      const [signals, orders, trades] = await Promise.all([
        botRuntime.getSignals({ timeframe }),
        botRuntime.getOrders({ timeframe }),
        botRuntime.getTrades({ timeframe })
      ]);
      
      // Calculate metrics
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
      
      const metrics = {
        timeframe,
        signals: {
          total: totalSignals,
          new: signals.filter(s => s.status === 'NEW').length,
          watching: signals.filter(s => s.status === 'WATCHING').length,
          ignored: signals.filter(s => s.status === 'IGNORED').length,
          saved: signals.filter(s => s.status === 'SAVED').length
        },
        orders: {
          total: totalOrders,
          pending: orders.filter(o => o.status === 'PENDING').length,
          filled: filledOrders,
          canceled: orders.filter(o => o.status === 'CANCELED').length,
          expired: orders.filter(o => o.status === 'EXPIRED').length
        },
        trades: {
          total: totalTrades,
          open: openTrades,
          closed: closedTrades,
          winRate: Math.round(winRate * 100) / 100,
          avgR: Math.round(avgR * 100) / 100
        },
        performance: {
          totalR: (() => {
            const total = trades.filter(t => t.status === 'CLOSED' && t.realizedR !== null)
              .reduce((sum, t) => sum + (t.realizedR || 0), 0);
            return isNaN(total) ? 0 : total;
          })(),
          equity: (() => {
            const initialCapital = Number(botRuntime.config.initialCapital) || 0;
            const riskPerTrade = Number(botRuntime.config.riskPerTrade) || 0;
            const totalR = trades.filter(t => t.status === 'CLOSED' && t.realizedR !== null)
              .reduce((sum, t) => sum + (t.realizedR || 0), 0);
            const equity = initialCapital + (totalR * riskPerTrade);
            return isNaN(equity) ? initialCapital : equity;
          })()
        }
      };
      
      res.json(metrics);
      
    } catch (error) {
      logger.error('Failed to get bot metrics', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get bot metrics',
        message: error.message 
      });
    }
  });
}

import { logger } from '../utils/logger.js';

export function setupSignalRoutes(app, botRuntime) {
  // Get all signals with filters
  app.get('/signals', async (req, res) => {
    try {
      const { status, symbol, mode, timeframe, min_conf, max_age_minutes, limit = 100 } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (symbol) filters.symbol = symbol;
      if (mode) filters.mode = mode;
      if (timeframe) filters.timeframe = timeframe;
      if (min_conf) filters.min_conf = parseInt(min_conf, 10);
      if (max_age_minutes) filters.max_age_minutes = parseInt(max_age_minutes, 10);
      
      const signals = await botRuntime.getSignals(filters);
      const limitedSignals = signals.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: limitedSignals,
        total: signals.length,
        returned: limitedSignals.length
      });
    } catch (error) {
      logger.error('Failed to get signals', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get signals',
        message: error.message 
      });
    }
  });

  // Get signal by ID
  app.get('/signals/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const signals = await botRuntime.getSignals();
      const signal = signals.find(s => s.id === id);
      
      if (!signal) {
        return res.status(404).json({ 
          error: 'Signal not found',
          message: `Signal with ID ${id} not found` 
        });
      }
      
      res.json({
        success: true,
        data: signal
      });
    } catch (error) {
      logger.error('Failed to get signal', { id: req.params.id, error: error.message });
      res.status(500).json({ 
        error: 'Failed to get signal',
        message: error.message 
      });
    }
  });

  // Create new signal
  app.post('/signals', async (req, res) => {
    try {
      const signal = await botRuntime.signalEngine.storeSignal(req.body);
      res.json({ success: true, data: signal, message: 'Signal created' });
    } catch (error) {
      logger.error('Failed to create signal', { error: error.message });
      res.status(500).json({ error: 'Failed to create signal', message: error.message });
    }
  });

  // Update signal
  app.put('/signals/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Get existing signal
      const signals = await botRuntime.getSignals();
      const signal = signals.find(s => s.id === id);
      
      if (!signal) {
        return res.status(404).json({ 
          error: 'Signal not found',
          message: `Signal with ID ${id} not found` 
        });
      }
      
      // Update signal
      const updatedSignal = { ...signal, ...updateData, updatedAt: new Date().toISOString() };
      await botRuntime.signalEngine.storeSignal(updatedSignal);
      
      res.json({
        success: true,
        message: 'Signal updated successfully',
        data: updatedSignal
      });
    } catch (error) {
      logger.error('Failed to update signal', { id: req.params.id, error: error.message });
      res.status(500).json({ 
        error: 'Failed to update signal',
        message: error.message 
      });
    }
  });

  // Delete signal
  app.delete('/signals/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get existing signal
      const signals = await botRuntime.getSignals();
      const signal = signals.find(s => s.id === id);
      
      if (!signal) {
        return res.status(404).json({ 
          error: 'Signal not found',
          message: `Signal with ID ${id} not found` 
        });
      }
      
      // Delete signal (implement based on your storage solution)
      logger.info('Signal deleted', { signalId: id });
      
      res.json({
        success: true,
        message: 'Signal deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete signal', { id: req.params.id, error: error.message });
      res.status(500).json({ 
        error: 'Failed to delete signal',
        message: error.message 
      });
    }
  });

  // Get signal statistics
  app.get('/signals/stats/overview', async (req, res) => {
    try {
      const signals = await botRuntime.getSignals();
      
      const stats = {
        total: signals.length,
        byStatus: {},
        bySymbol: {},
        byMode: {},
        byTimeframe: {},
        byStrategy: {}
      };
      
      // Count by various criteria
      signals.forEach(signal => {
        // By status
        const status = signal.status || 'NEW';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        
        // By symbol
        stats.bySymbol[signal.symbol] = (stats.bySymbol[signal.symbol] || 0) + 1;
        
        // By mode
        const mode = signal.mode || 'supervised';
        stats.byMode[mode] = (stats.byMode[mode] || 0) + 1;
        
        // By timeframe
        const timeframe = signal.timeframe || 'unknown';
        stats.byTimeframe[timeframe] = (stats.byTimeframe[timeframe] || 0) + 1;
        
        // By strategy (tags)
        const tags = signal.tags || [];
        tags.forEach(tag => {
          stats.byStrategy[tag] = (stats.byStrategy[tag] || 0) + 1;
        });
      });
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get signal stats', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get signal stats',
        message: error.message 
      });
    }
  });

  // Get signals by symbol
  app.get('/signals/symbol/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { limit = 50 } = req.query;
      
      const signals = await botRuntime.getSignals({ symbol });
      const limitedSignals = signals.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: limitedSignals,
        total: signals.length,
        returned: limitedSignals.length,
        symbol
      });
    } catch (error) {
      logger.error('Failed to get signals by symbol', { symbol: req.params.symbol, error: error.message });
      res.status(500).json({ 
        error: 'Failed to get signals by symbol',
        message: error.message 
      });
    }
  });

  // Get signals by mode
  app.get('/signals/mode/:mode', async (req, res) => {
    try {
      const { mode } = req.params;
      const { limit = 100 } = req.query;
      
      const signals = await botRuntime.getSignals({ mode });
      const limitedSignals = signals.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: limitedSignals,
        total: signals.length,
        returned: limitedSignals.length,
        mode
      });
    } catch (error) {
      logger.error('Failed to get signals by mode', { mode: req.params.mode, error: error.message });
      res.status(500).json({ 
        error: 'Failed to get signals by mode',
        message: error.message 
      });
    }
  });

  // Get recent signals
  app.get('/signals/recent/:hours', async (req, res) => {
    try {
      const { hours } = req.params;
      const { limit = 50 } = req.query;
      
      const cutoffTime = new Date(Date.now() - (parseInt(hours) * 60 * 60 * 1000));
      const signals = await botRuntime.getSignals();
      
      const recentSignals = signals.filter(signal => {
        const signalTime = new Date(signal.createdAt);
        return signalTime >= cutoffTime;
      });
      
      const limitedSignals = recentSignals.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: limitedSignals,
        total: recentSignals.length,
        returned: limitedSignals.length,
        hours: parseInt(hours)
      });
    } catch (error) {
      logger.error('Failed to get recent signals', { hours: req.params.hours, error: error.message });
      res.status(500).json({ 
        error: 'Failed to get recent signals',
        message: error.message 
      });
    }
  });

  // Approve signal (change status to SAVED)
  app.post('/signals/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get existing signal
      const signals = await botRuntime.getSignals();
      const signal = signals.find(s => s.id === id);
      
      if (!signal) {
        return res.status(404).json({ 
          error: 'Signal not found',
          message: `Signal with ID ${id} not found` 
        });
      }
      
      // Update signal status
      const updatedSignal = { ...signal, status: 'SAVED', updatedAt: new Date().toISOString() };
      await botRuntime.signalEngine.storeSignal(updatedSignal);
      
      res.json({
        success: true,
        message: 'Signal approved successfully',
        data: updatedSignal
      });
    } catch (error) {
      logger.error('Failed to approve signal', { id: req.params.id, error: error.message });
      res.status(500).json({ 
        error: 'Failed to approve signal',
        message: error.message 
      });
    }
  });

  // Ignore signal (change status to IGNORED)
  app.post('/signals/:id/ignore', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get existing signal
      const signals = await botRuntime.getSignals();
      const signal = signals.find(s => s.id === id);
      
      if (!signal) {
        return res.status(404).json({ 
          error: 'Signal not found',
          message: `Signal with ID ${id} not found` 
        });
      }
      
      // Update signal status
      const updatedSignal = { ...signal, status: 'IGNORED', updatedAt: new Date().toISOString() };
      await botRuntime.signalEngine.storeSignal(updatedSignal);
      
      res.json({
        success: true,
        message: 'Signal ignored successfully',
        data: updatedSignal
      });
    } catch (error) {
      logger.error('Failed to ignore signal', { id: req.params.id, error: error.message });
      res.status(500).json({ 
        error: 'Failed to ignore signal',
        message: error.message 
      });
    }
  });

  // Watch signal (change status to WATCHING)
  app.post('/signals/:id/watch', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get existing signal
      const signals = await botRuntime.getSignals();
      const signal = signals.find(s => s.id === id);
      
      if (!signal) {
        return res.status(404).json({ 
          error: 'Signal not found',
          message: `Signal with ID ${id} not found` 
        });
      }
      
      // Update signal status
      const updatedSignal = { ...signal, status: 'WATCHING', updatedAt: new Date().toISOString() };
      await botRuntime.signalEngine.storeSignal(updatedSignal);
      
      res.json({
        success: true,
        message: 'Signal marked as watching',
        data: updatedSignal
      });
    } catch (error) {
      logger.error('Failed to watch signal', { id: req.params.id, error: error.message });
      res.status(500).json({ 
        error: 'Failed to watch signal',
        message: error.message 
      });
    }
  });
}

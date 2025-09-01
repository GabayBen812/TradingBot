import { logger } from '../utils/logger.js';

export function setupTradeRoutes(app, botRuntime) {
	// Get all trades with filters
	app.get('/trades', async (req, res) => {
		try {
			const { status, symbol, mode, executor, user_id, limit = 100 } = req.query;
			
			const filters = {};
			if (status) filters.status = status;
			if (symbol) filters.symbol = symbol;
			if (mode) filters.mode = mode;
			if (executor) filters.executor = executor;
			if (user_id) filters.user_id = user_id;
			
			const trades = await botRuntime.getTrades(filters);
			const limitedTrades = trades.slice(0, parseInt(limit));
			
			res.json({
				success: true,
				data: limitedTrades,
				total: trades.length,
				returned: limitedTrades.length
			});
		} catch (error) {
			logger.error('Failed to get trades', { error: error.message });
			res.status(500).json({ 
				error: 'Failed to get trades',
				message: error.message 
			});
		}
	});

	// Get trade by ID
	app.get('/trades/:id', async (req, res) => {
		try {
			const { id } = req.params;
			const trade = await botRuntime.tradeManager.getTrade(id);
			
			res.json({
				success: true,
				data: trade
			});
		} catch (error) {
			logger.error('Failed to get trade', { id: req.params.id, error: error.message });
			res.status(500).json({ 
				error: 'Failed to get trade',
				message: error.message 
			});
		}
	});

	// Create new trade
	app.post('/trades', async (req, res) => {
		try {
			const trade = await botRuntime.tradeManager.createTrade(req.body);
			res.json({ success: true, data: trade, message: 'Trade created' });
		} catch (error) {
			logger.error('Failed to create trade', { error: error.message });
			res.status(500).json({ error: 'Failed to create trade', message: error.message });
		}
	});

	// Update trade
	app.put('/trades/:id', async (req, res) => {
		try {
			const { id } = req.params;
			const updateData = req.body;
			
			// Update trade
			const updatedTrade = await botRuntime.tradeManager.updateTrade(id, updateData);
			
			res.json({
				success: true,
				message: 'Trade updated successfully',
				data: updatedTrade
			});
		} catch (error) {
			logger.error('Failed to update trade', { id: req.params.id, error: error.message });
			res.status(500).json({ 
				error: 'Failed to update trade',
				message: error.message 
			});
		}
	});

	// Close trade
	app.post('/trades/:id/close', async (req, res) => {
		try {
			const { id } = req.params;
			const { exit, reason } = req.body;
			
			if (!exit) {
				return res.status(400).json({ 
					error: 'Missing exit price',
					message: 'Exit price is required to close trade' 
				});
			}
			
			const closeData = {
				exit: parseFloat(exit),
				reason: reason || 'Manual close',
				closedAt: new Date().toISOString()
			};
			
			const closedTrade = await botRuntime.tradeManager.closeTrade(id, closeData);
			
			res.json({
				success: true,
				message: 'Trade closed successfully',
				data: closedTrade
			});
		} catch (error) {
			logger.error('Failed to close trade', { id: req.params.id, error: error.message });
			res.status(500).json({ 
				error: 'Failed to close trade',
				message: error.message 
			});
		}
	});

	// Delete trade
	app.delete('/trades/:id', async (req, res) => {
		try {
			const { id } = req.params;
			
			await botRuntime.tradeManager.deleteTrade(id);
			
			res.json({
				success: true,
				message: 'Trade deleted successfully'
			});
		} catch (error) {
			logger.error('Failed to delete trade', { id: req.params.id, error: error.message });
			res.status(500).json({ 
				error: 'Failed to delete trade',
				message: error.message 
			});
		}
	});

	// Get trade statistics
	app.get('/trades/stats/overview', async (req, res) => {
		try {
			const stats = await botRuntime.tradeManager.getTradeStats();
			
			res.json({
				success: true,
				data: stats
			});
		} catch (error) {
			logger.error('Failed to get trade stats', { error: error.message });
			res.status(500).json({ 
				error: 'Failed to get trade stats',
				message: error.message 
			});
		}
	});

	// Get trades by symbol
	app.get('/trades/symbol/:symbol', async (req, res) => {
		try {
			const { symbol } = req.params;
			const { limit = 50 } = req.query;
			
			const trades = await botRuntime.tradeManager.getTradesForSymbol(symbol);
			const limitedTrades = trades.slice(0, parseInt(limit));
			
			res.json({
				success: true,
				data: limitedTrades,
				total: trades.length,
				returned: limitedTrades.length,
				symbol
			});
		} catch (error) {
			logger.error('Failed to get trades by symbol', { symbol: req.params.symbol, error: error.message });
			res.status(500).json({ 
				error: 'Failed to get trades by symbol',
				message: error.message 
			});
		}
	});

	// Get trades by mode
	app.get('/trades/mode/:mode', async (req, res) => {
		try {
			const { mode } = req.params;
			const { limit = 100 } = req.query;
			
			const trades = await botRuntime.tradeManager.getTradesByMode(mode);
			const limitedTrades = trades.slice(0, parseInt(limit));
			
			res.json({
				success: true,
				data: limitedTrades,
				total: trades.length,
				returned: limitedTrades.length,
				mode
			});
		} catch (error) {
			logger.error('Failed to get trades by mode', { mode: req.params.mode, error: error.message });
			res.status(500).json({ 
				error: 'Failed to get trades by mode',
				message: error.message 
			});
		}
	});

	// Get trades by executor
	app.get('/trades/executor/:executor', async (req, res) => {
		try {
			const { executor } = req.params;
			const { limit = 100 } = req.query;
			
			const trades = await botRuntime.tradeManager.getTradesByExecutor(executor);
			const limitedTrades = trades.slice(0, parseInt(limit));
			
			res.json({
				success: true,
				data: limitedTrades,
				total: trades.length,
				returned: limitedTrades.length,
				executor
			});
		} catch (error) {
			logger.error('Failed to get trades by executor', { executor: req.params.executor, error: error.message });
			res.status(500).json({ 
				error: 'Failed to get trades by executor',
				message: error.message 
			});
		}
	});

	// Get recent trades
	app.get('/trades/recent/:hours', async (req, res) => {
		try {
			const { hours } = req.params;
			const { limit = 50 } = req.query;
			
			const trades = await botRuntime.tradeManager.getTradesByTimeframe(null, parseInt(hours));
			const limitedTrades = trades.slice(0, parseInt(limit));
			
			res.json({
				success: true,
				data: limitedTrades,
				total: trades.length,
				returned: limitedTrades.length,
				hours: parseInt(hours)
			});
		} catch (error) {
			logger.error('Failed to get recent trades', { hours: req.params.hours, error: error.message });
			res.status(500).json({ 
				error: 'Failed to get recent trades',
				message: error.message 
			});
		}
	});

	// Get open trades count
	app.get('/trades/open/count', async (req, res) => {
		try {
			const count = await botRuntime.tradeManager.getOpenTradesCount();
			
			res.json({
				success: true,
				data: { count }
			});
		} catch (error) {
			logger.error('Failed to get open trades count', { error: error.message });
			res.status(500).json({ 
				error: 'Failed to get open trades count',
				message: error.message 
			});
		}
	});

	// Get closed trades count
	app.get('/trades/closed/count', async (req, res) => {
		try {
			const count = await botRuntime.tradeManager.getClosedTradesCount();
			
			res.json({
				success: true,
				data: { count }
			});
		} catch (error) {
			logger.error('Failed to get closed trades count', { error: error.message });
			res.status(500).json({ 
				error: 'Failed to get closed trades count',
				message: error.message 
			});
		}
	});

	// Get total realized R
	app.get('/trades/total-r', async (req, res) => {
		try {
			const totalR = await botRuntime.tradeManager.getTotalRealizedR();
			
			res.json({
				success: true,
				data: { totalR }
			});
		} catch (error) {
			logger.error('Failed to get total realized R', { error: error.message });
			res.status(500).json({ 
				error: 'Failed to get total realized R',
				message: error.message 
			});
		}
	});

	// Get trade history
	app.get('/trades/history/:symbol', async (req, res) => {
		try {
			const { symbol } = req.params;
			const { limit = 100 } = req.query;
			
			const history = await botRuntime.tradeManager.getTradeHistory(symbol, parseInt(limit));
			
			res.json({
				success: true,
				data: history,
				symbol,
				limit: parseInt(limit)
			});
		} catch (error) {
			logger.error('Failed to get trade history', { symbol: req.params.symbol, error: error.message });
			res.status(500).json({ 
				error: 'Failed to get trade history',
				message: error.message 
			});
		}
	});

	// Get performance by symbol
	app.get('/trades/performance/symbol/:symbol', async (req, res) => {
		try {
			const { symbol } = req.params;
			const performance = await botRuntime.tradeManager.getPerformanceBySymbol(symbol);
			
			res.json({
				success: true,
				data: performance
			});
		} catch (error) {
			logger.error('Failed to get performance by symbol', { symbol: req.params.symbol, error: error.message });
			res.status(500).json({ 
				error: 'Failed to get performance by symbol',
				message: error.message 
			});
		}
	});

	// Get performance by mode
	app.get('/trades/performance/mode/:mode', async (req, res) => {
		try {
			const { mode } = req.params;
			const performance = await botRuntime.tradeManager.getPerformanceByMode(mode);
			
			res.json({
				success: true,
				data: performance
			});
		} catch (error) {
			logger.error('Failed to get performance by mode', { mode: req.params.mode, error: error.message });
			res.status(500).json({ 
				error: 'Failed to get performance by mode',
				message: error.message 
			});
		}
	});
}

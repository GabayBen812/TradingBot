import { logger } from '../utils/logger.js';

export function setupOrderRoutes(app, botRuntime) {
  // Get all orders with filters
  app.get('/orders', async (req, res) => {
    try {
      const { status, symbol, mode, executor, limit = 100 } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (symbol) filters.symbol = symbol;
      if (mode) filters.mode = mode;
      if (executor) filters.executor = executor;
      
      const orders = await botRuntime.getOrders(filters);
      const limitedOrders = orders.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: limitedOrders,
        total: orders.length,
        returned: limitedOrders.length
      });
    } catch (error) {
      logger.error('Failed to get orders', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get orders',
        message: error.message 
      });
    }
  });

  // Get order by ID
  app.get('/orders/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const order = await botRuntime.orderManager.getOrder(id);
      
      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      logger.error('Failed to get order', { id: req.params.id, error: error.message });
      res.status(500).json({ 
        error: 'Failed to get order',
        message: error.message 
      });
    }
  });

  // Create new order
  app.post('/orders', async (req, res) => {
    try {
      const orderData = req.body;
      
      // Validate required fields
      const requiredFields = ['symbol', 'side', 'entry', 'stop', 'take', 'size'];
      for (const field of requiredFields) {
        if (!orderData[field]) {
          return res.status(400).json({ 
            error: 'Missing required field',
            message: `Field '${field}' is required` 
          });
        }
      }
      
      // Create order
      const order = await botRuntime.orderManager.createOrder(orderData);
      
      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: order
      });
    } catch (error) {
      logger.error('Failed to create order', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to create order',
        message: error.message 
      });
    }
  });

  // Update order
  app.put('/orders/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Get existing order
      const order = await botRuntime.orderManager.getOrder(id);
      
      // Update order
      const updatedOrder = await botRuntime.orderManager.updateOrderStatus(id, order.status, updateData);
      
      res.json({
        success: true,
        message: 'Order updated successfully',
        data: updatedOrder
      });
    } catch (error) {
      logger.error('Failed to update order', { id: req.params.id, error: error.message });
      res.status(500).json({ 
        error: 'Failed to update order',
        message: error.message 
      });
    }
  });

  // Cancel order
  app.post('/orders/:id/cancel', async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const canceledOrder = await botRuntime.orderManager.cancelOrder(id, reason);
      
      res.json({
        success: true,
        message: 'Order canceled successfully',
        data: canceledOrder
      });
    } catch (error) {
      logger.error('Failed to cancel order', { id: req.params.id, error: error.message });
      res.status(500).json({ 
        error: 'Failed to cancel order',
        message: error.message 
      });
    }
  });

  // Delete order
  app.delete('/orders/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      await botRuntime.orderManager.deleteOrder(id);
      
      res.json({
        success: true,
        message: 'Order deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete order', { id: req.params.id, error: error.message });
      res.status(500).json({ 
        error: 'Failed to delete order',
        message: error.message 
      });
    }
  });

  // Get order statistics
  app.get('/orders/stats/overview', async (req, res) => {
    try {
      const stats = await botRuntime.orderManager.getOrderStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get order stats', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get order stats',
        message: error.message 
      });
    }
  });

  // Get orders by symbol
  app.get('/orders/symbol/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { limit = 50 } = req.query;
      
      const orders = await botRuntime.orderManager.getOrdersForSymbol(symbol);
      const limitedOrders = orders.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: limitedOrders,
        total: orders.length,
        returned: limitedOrders.length,
        symbol
      });
    } catch (error) {
      logger.error('Failed to get orders by symbol', { symbol: req.params.symbol, error: error.message });
      res.status(500).json({ 
        error: 'Failed to get orders by symbol',
        message: error.message 
      });
    }
  });

  // Get orders by mode
  app.get('/orders/mode/:mode', async (req, res) => {
    try {
      const { mode } = req.params;
      const { limit = 100 } = req.query;
      
      const orders = await botRuntime.orderManager.getOrdersByMode(mode);
      const limitedOrders = orders.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: limitedOrders,
        total: orders.length,
        returned: limitedOrders.length,
        mode
      });
    } catch (error) {
      logger.error('Failed to get orders by mode', { mode: req.params.mode, error: error.message });
      res.status(500).json({ 
        error: 'Failed to get orders by mode',
        message: error.message 
      });
    }
  });

  // Get orders by executor
  app.get('/orders/executor/:executor', async (req, res) => {
    try {
      const { executor } = req.params;
      const { limit = 100 } = req.query;
      
      const orders = await botRuntime.orderManager.getOrdersByExecutor(executor);
      const limitedOrders = orders.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: limitedOrders,
        total: orders.length,
        returned: limitedOrders.length,
        executor
      });
    } catch (error) {
      logger.error('Failed to get orders by executor', { executor: req.params.executor, error: error.message });
      res.status(500).json({ 
        error: 'Failed to get orders by executor',
        message: error.message 
      });
    }
  });

  // Get recent orders
  app.get('/orders/recent/:hours', async (req, res) => {
    try {
      const { hours } = req.params;
      const { limit = 50 } = req.query;
      
      const orders = await botRuntime.orderManager.getOrdersByTimeframe(null, parseInt(hours));
      const limitedOrders = orders.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: limitedOrders,
        total: orders.length,
        returned: limitedOrders.length,
        hours: parseInt(hours)
      });
    } catch (error) {
      logger.error('Failed to get recent orders', { hours: req.params.hours, error: error.message });
      res.status(500).json({ 
        error: 'Failed to get recent orders',
        message: error.message 
      });
    }
  });

  // Get pending orders count
  app.get('/orders/pending/count', async (req, res) => {
    try {
      const count = await botRuntime.orderManager.getPendingOrdersCount();
      
      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      logger.error('Failed to get pending orders count', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get pending orders count',
        message: error.message 
      });
    }
  });

  // Get open orders count
  app.get('/orders/open/count', async (req, res) => {
    try {
      const count = await botRuntime.orderManager.getOpenOrdersCount();
      
      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      logger.error('Failed to get open orders count', { error: error.message });
      res.status(500).json({ 
        error: 'Failed to get open orders count',
        message: error.message 
      });
    }
  });

  // Get order history
  app.get('/orders/history/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { limit = 100 } = req.query;
      
      const history = await botRuntime.orderManager.getOrderHistory(symbol, parseInt(limit));
      
      res.json({
        success: true,
        data: history,
        symbol,
        limit: parseInt(limit)
      });
    } catch (error) {
      logger.error('Failed to get order history', { symbol: req.params.symbol, error: error.message });
      res.status(500).json({ 
        error: 'Failed to get order history',
        message: error.message 
      });
    }
  });
}

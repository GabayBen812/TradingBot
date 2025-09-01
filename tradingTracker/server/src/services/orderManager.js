import { logger } from '../utils/logger.js';

export class OrderManager {
  constructor() {
    this.isInitialized = false;
    this.orders = new Map(); // In-memory storage for now
    
    logger.info('OrderManager initialized');
  }

  async initialize() {
    try {
      // Load existing orders from database (implement based on your storage solution)
      await this.loadOrders();
      this.isInitialized = true;
      logger.info('OrderManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OrderManager', { error: error.message });
      throw error;
    }
  }

  async cleanup() {
    try {
      // Save orders to database (implement based on your storage solution)
      await this.saveOrders();
      this.isInitialized = false;
      logger.info('OrderManager cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup OrderManager', { error: error.message });
    }
  }

  async createOrder(orderData) {
    try {
      if (!this.isInitialized) {
        throw new Error('OrderManager not initialized');
      }

      const order = {
        symbol: orderData.symbol,
        side: orderData.side,
        entry: orderData.entry,
        stop: orderData.stop,
        take: orderData.take,
        size: orderData.size,
        mode: orderData.mode || 'supervised',
        executor: orderData.executor || 'human',
        status: orderData.status || 'PENDING',
        created_at: new Date().toISOString(),
        ...orderData
      };

      // Also store in memory for quick access
      this.orders.set(order.id, order);
      
      // Save to database using Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      const { data, error } = await supabase
        .from('orders')
        .insert([order])
        .select()
        .single();

      if (error) {
        logger.error('Failed to save order to database', { error: error.message });
        // Don't throw error, just log it - order is still created in memory
      } else {
        logger.info('Order saved to database successfully');
      }
      
      logger.info('Order created', { 
        orderId: order.id, 
        symbol: order.symbol,
        side: order.side,
        status: order.status 
      });
      
      return order;
    } catch (error) {
      logger.error('Failed to create order', { error: error.message });
      throw error;
    }
  }

  async getOrder(orderId) {
    try {
      if (!this.isInitialized) {
        throw new Error('OrderManager not initialized');
      }

      const order = this.orders.get(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      return order;
    } catch (error) {
      logger.error('Failed to get order', { orderId, error: error.message });
      throw error;
    }
  }

  async getOrders(filters = {}) {
    try {
      // Get orders from database using Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.symbol) {
        query = query.eq('symbol', filters.symbol);
      }
      if (filters.mode) {
        query = query.eq('mode', filters.mode);
      }
      if (filters.executor) {
        query = query.eq('executor', filters.executor);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      logger.error('Failed to get orders', { error: error.message });
      return [];
    }
  }

  async getPendingOrders() {
    try {
      return await this.getOrders({ status: 'PENDING' });
    } catch (error) {
      logger.error('Failed to get pending orders', { error: error.message });
      throw error;
    }
  }

  async getPendingOrdersCount() {
    try {
      const pendingOrders = await this.getPendingOrders();
      return pendingOrders.length;
    } catch (error) {
      logger.error('Failed to get pending orders count', { error: error.message });
      return 0;
    }
  }

  async updateOrderStatus(orderId, status, additionalData = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('OrderManager not initialized');
      }

      const order = this.orders.get(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const oldStatus = order.status;
      order.status = status;
      order.updatedAt = new Date().toISOString();

      // Add additional data
      Object.assign(order, additionalData);

      this.orders.set(orderId, order);
      
      logger.info('Order status updated', { 
        orderId, 
        symbol: order.symbol,
        oldStatus, 
        newStatus: status 
      });
      
      return order;
    } catch (error) {
      logger.error('Failed to update order status', { orderId, status, error: error.message });
      throw error;
    }
  }

  async cancelOrder(orderId, reason = 'Manual cancellation') {
    try {
      return await this.updateOrderStatus(orderId, 'CANCELED', {
        canceledAt: new Date().toISOString(),
        cancelReason: reason
      });
    } catch (error) {
      logger.error('Failed to cancel order', { orderId, error: error.message });
      throw error;
    }
  }

  async expireOrder(orderId, reason = 'TTL exceeded') {
    try {
      return await this.updateOrderStatus(orderId, 'EXPIRED', {
        expiredAt: new Date().toISOString(),
        expireReason: reason
      });
    } catch (error) {
      logger.error('Failed to expire order', { orderId, error: error.message });
      throw error;
    }
  }

  async fillOrder(orderId, fillData) {
    try {
      return await this.updateOrderStatus(orderId, 'FILLED', {
        filledAt: new Date().toISOString(),
        fillPrice: fillData.fillPrice,
        fillQuantity: fillData.fillQuantity
      });
    } catch (error) {
      logger.error('Failed to fill order', { orderId, error: error.message });
      throw error;
    }
  }

  async deleteOrder(orderId) {
    try {
      if (!this.isInitialized) {
        throw new Error('OrderManager not initialized');
      }

      const order = this.orders.get(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      this.orders.delete(orderId);
      
      logger.info('Order deleted', { 
        orderId, 
        symbol: order.symbol 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete order', { orderId, error: error.message });
      throw error;
    }
  }

  async getOrderStats(filters = {}) {
    try {
      const orders = await this.getOrders(filters);
      
      const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'PENDING').length,
        filled: orders.filter(o => o.status === 'FILLED').length,
        canceled: orders.filter(o => o.status === 'CANCELED').length,
        expired: orders.filter(o => o.status === 'EXPIRED').length,
        byMode: {},
        byExecutor: {},
        bySymbol: {}
      };

      // Count by mode
      orders.forEach(order => {
        stats.byMode[order.mode] = (stats.byMode[order.mode] || 0) + 1;
        stats.byExecutor[order.executor] = (stats.byExecutor[order.executor] || 0) + 1;
        stats.bySymbol[order.symbol] = (stats.bySymbol[order.symbol] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get order stats', { error: error.message });
      throw error;
    }
  }

  async getOrdersByTimeframe(timeframe, hours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
      const orders = await this.getOrders();
      
      return orders.filter(order => {
        const orderTime = new Date(order.createdAt);
        return orderTime >= cutoffTime;
      });
    } catch (error) {
      logger.error('Failed to get orders by timeframe', { timeframe, hours, error: error.message });
      throw error;
    }
  }

  // Database operations (implement based on your storage solution)
  async loadOrders() {
    try {
      // Load orders from database
      // For now, start with empty orders
      logger.info('Orders loaded from database');
    } catch (error) {
      logger.error('Failed to load orders from database', { error: error.message });
      throw error;
    }
  }

  async saveOrders() {
    try {
      // Save orders to database
      const ordersArray = Array.from(this.orders.values());
      logger.info(`${ordersArray.length} orders saved to database`);
    } catch (error) {
      logger.error('Failed to save orders to database', { error: error.message });
      throw error;
    }
  }

  // Utility methods
  async getOrdersForSymbol(symbol) {
    try {
      return await this.getOrders({ symbol });
    } catch (error) {
      logger.error('Failed to get orders for symbol', { symbol, error: error.message });
      throw error;
    }
  }

  async getOrdersByMode(mode) {
    try {
      return await this.getOrders({ mode });
    } catch (error) {
      logger.error('Failed to get orders by mode', { mode, error: error.message });
      throw error;
    }
  }

  async getOrdersByExecutor(executor) {
    try {
      return await this.getOrders({ executor });
    } catch (error) {
      logger.error('Failed to get orders by executor', { executor, error: error.message });
      throw error;
    }
  }

  async getOpenOrdersCount() {
    try {
      const pendingOrders = await this.getPendingOrders();
      return pendingOrders.length;
    } catch (error) {
      logger.error('Failed to get open orders count', { error: error.message });
      return 0;
    }
  }

  async getOrderHistory(symbol, limit = 100) {
    try {
      const orders = await this.getOrders({ symbol });
      return orders.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get order history', { symbol, limit, error: error.message });
      throw error;
    }
  }
}

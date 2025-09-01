import { logger } from '../utils/logger.js';

// Lazily create a Supabase client that prefers the service role key when available
async function getSupabase() {
	const { createClient } = await import('@supabase/supabase-js');
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
	if (!url || !key) {
		logger.error('Supabase URL or KEY missing in environment. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY.');
	}
	if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
		logger.warn('SUPABASE_SERVICE_ROLE_KEY not set. Falling back to anon key. RLS may return zero rows.');
	}
	return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export class TradeManager {
  constructor() {
    this.trades = new Map(); // In-memory store for active trades
  }

  async initialize() {
    try {
      // Load existing trades from database
      const trades = await this.getTrades();
      for (const trade of trades) {
        if (trade.status === 'OPEN') {
          this.trades.set(trade.id, trade);
        }
      }
      logger.info('TradeManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize TradeManager', { error: error.message });
    }
  }

  async createTrade(tradeData) {
    try {
      const supabase = await getSupabase();

      const trade = {
        id: tradeData.id || `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: tradeData.user_id,
        date: new Date().toISOString(),
        symbol: tradeData.symbol,
        side: tradeData.side,
        entry: tradeData.entry,
        stop: tradeData.stop,
        take: tradeData.take,
        size: tradeData.size,
        mode: tradeData.mode || 'supervised',
        executor: tradeData.executor || 'human'
      };

      const { data, error } = await supabase
        .from('trades')
        .insert([trade])
        .select()
        .single();

      if (error) throw error;

      // Add to in-memory store
      this.trades.set(data.id, data);
      
      logger.info('Trade created successfully', { tradeId: data.id, symbol: data.symbol });
      return data;
    } catch (error) {
      logger.error('Failed to create trade', { error: error.message });
      throw error;
    }
  }

  async updateTrade(id, updateData) {
    try {
      const supabase = await getSupabase();

      const { data, error } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update in-memory store
      if (this.trades.has(id)) {
        this.trades.set(id, { ...this.trades.get(id), ...data });
      }

      logger.info('Trade updated successfully', { tradeId: id });
      return data;
    } catch (error) {
      logger.error('Failed to update trade', { tradeId: id, error: error.message });
      throw error;
    }
  }

  async closeTrade(id, exitPrice, reason = 'Manual close') {
    try {
      const trade = this.trades.get(id);
      if (!trade) {
        throw new Error('Trade not found');
      }

      const updateData = {
        exit: exitPrice,
        closed_at: new Date().toISOString(),
        notes: reason
      };

      const updatedTrade = await this.updateTrade(id, updateData);
      
      // Remove from in-memory store
      this.trades.delete(id);
      
      logger.info('Trade closed successfully', { tradeId: id, exitPrice });
      return updatedTrade;
    } catch (error) {
      logger.error('Failed to close trade', { tradeId: id, error: error.message });
      throw error;
    }
  }

  async getTrades(filters = {}) {
    try {
      const supabase = await getSupabase();

      // Add debugging
      logger.info('Getting trades with filters:', filters);

      // Select all columns; safer across schema changes
      let query = supabase
        .from('trades')
        .select('*')
        .order('date', { ascending: false });

      // Apply safe filters
      if (filters.symbol) {
        query = query.eq('symbol', filters.symbol);
      }
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      // Add debugging
      logger.info('Trades query result:', { 
        dataCount: data?.length || 0, 
        error: error?.message || null,
        filters 
      });

      if (error) {
        logger.error('Failed to get trades:', error.message);
        return [];
      }
      
      // Transform to expected BotTrade format; use fields if present
      let mapped = (data || []).map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        entry: trade.entry,
        exit: trade.exit ?? null,
        stop: trade.stop ?? null,
        take: trade.take ?? null,
        pnl: trade.pnl ?? null,
        confidence: trade.confidence ?? trade.conf ?? null,
        conf: trade.conf ?? trade.confidence ?? null,
        opened_at: trade.opened_at ?? trade.date,
        closed_at: trade.closed_at ?? null,
        notes: trade.notes ?? trade.reason ?? null,
        mode: trade.mode || 'supervised',
        executor: trade.executor || 'human',
        status: trade.status || (trade.exit != null ? 'CLOSED' : 'OPEN')
      }));

      // Apply mode/status filtering after mapping
      if (filters.mode) {
        mapped = mapped.filter(m => (m.mode || 'supervised') === filters.mode);
      }
      if (filters.status) {
        mapped = mapped.filter(m => m.status === filters.status);
      }

      return mapped;
    } catch (error) {
      logger.error('Failed to get trades', { error: error.message });
      return [];
    }
  }

  async getTrade(id) {
    try {
      const supabase = await getSupabase();

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to get trade', { tradeId: id, error: error.message });
      return null;
    }
  }

  async getOpenTrades() {
    try {
      return await this.getTrades({ status: 'OPEN' });
    } catch (error) {
      logger.error('Failed to get open trades', { error: error.message });
      return [];
    }
  }

  async getOpenTradesCount() {
    try {
      const openTrades = await this.getOpenTrades();
      return openTrades.length;
    } catch (error) {
      logger.error('Failed to get open trades count', { error: error.message });
      return 0;
    }
  }

  async getClosedTrades() {
    try {
      return await this.getTrades({ status: 'CLOSED' });
    } catch (error) {
      logger.error('Failed to get closed trades', { error: error.message });
      return [];
    }
  }

  async getClosedTradesCount() {
    try {
      const closedTrades = await this.getClosedTrades();
      return closedTrades.length;
    } catch (error) {
      logger.error('Failed to get closed trades count', { error: error.message });
      return 0;
    }
  }

  async getTradesBySymbol(symbol) {
    try {
      return await this.getTrades({ symbol });
    } catch (error) {
      logger.error('Failed to get trades by symbol', { symbol, error: error.message });
      return [];
    }
  }

  async getTradesByMode(mode) {
    try {
      return await this.getTrades({ mode });
    } catch (error) {
      logger.error('Failed to get trades by mode', { mode, error: error.message });
      return [];
    }
  }

  async getTradesByExecutor(executor) {
    try {
      return await this.getTrades({ executor });
    } catch (error) {
      logger.error('Failed to get trades by executor', { executor, error: error.message });
      return [];
    }
  }

  async getTradeStats(filters = {}) {
    try {
      const trades = await this.getTrades(filters);
      
      let totalTrades = 0;
      let winningTrades = 0;
      let totalPnL = 0;
      let openTrades = 0;

      for (const trade of trades) {
        if (trade.status === 'OPEN') {
          openTrades++;
        } else {
          totalTrades++;
          if (trade.pnl && trade.pnl > 0) {
            winningTrades++;
          }
          totalPnL += trade.pnl || 0;
        }
      }

      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const avgPnL = totalTrades > 0 ? totalPnL / totalTrades : 0;

      return {
        totalTrades,
        winningTrades,
        winRate,
        totalPnL,
        avgPnL,
        openTrades
      };
    } catch (error) {
      logger.error('Failed to get trade stats', { error: error.message });
      return {
        totalTrades: 0,
        winningTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgPnL: 0,
        openTrades: 0
      };
    }
  }

  async cleanup() {
    this.trades.clear();
    logger.info('TradeManager cleaned up successfully');
  }
}

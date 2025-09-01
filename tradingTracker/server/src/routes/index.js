import express from 'express';
import { setupBotRoutes } from './bot.js';
import { setupSignalRoutes } from './signals.js';
import { setupOrderRoutes } from './orders.js';
import { setupTradeRoutes } from './trades.js';
import { setupAnalyticsRoutes } from './analytics.js';

export function setupRoutes(app, botRuntime) {
  // Create a router for API v1
  const apiV1Router = express.Router();
  
  // Setup individual route modules on the API router
  setupBotRoutes(apiV1Router, botRuntime);
  setupSignalRoutes(apiV1Router, botRuntime);
  setupOrderRoutes(apiV1Router, botRuntime);
  setupTradeRoutes(apiV1Router, botRuntime);
  setupAnalyticsRoutes(apiV1Router, botRuntime);
  
  // Mount the API router under /api/v1
  app.use('/api/v1', (req, res, next) => {
    req.apiVersion = 'v1';
    next();
  }, apiV1Router);

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ 
      error: 'API endpoint not found',
      path: req.path,
      method: req.method
    });
  });
}

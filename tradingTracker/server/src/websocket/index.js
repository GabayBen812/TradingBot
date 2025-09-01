import { logger } from '../utils/logger.js';

export function setupWebSocket(wss) {
  logger.info('Setting up WebSocket server');

  wss.on('connection', (ws, req) => {
    const clientId = req.headers['x-client-id'] || `client_${Date.now()}`;
    const clientInfo = {
      id: clientId,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date()
    };

    logger.info('WebSocket client connected', clientInfo);

    // Store client info on the connection
    ws.clientInfo = clientInfo;

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to trading bot server',
      clientId,
      timestamp: new Date().toISOString()
    }));

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleWebSocketMessage(ws, message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { 
          clientId, 
          error: error.message,
          data: data.toString() 
        });
        
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString()
        }));
      }
    });

    // Handle client disconnect
    ws.on('close', (code, reason) => {
      logger.info('WebSocket client disconnected', { 
        clientId, 
        code, 
        reason: reason.toString(),
        duration: Date.now() - clientInfo.connectedAt.getTime()
      });
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { 
        clientId, 
        error: error.message 
      });
    });

    // Set up ping/pong for connection health
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });

  // Heartbeat to detect stale connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        logger.info('Terminating stale WebSocket connection', { 
          clientId: ws.clientInfo?.id 
        });
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // Every 30 seconds

  // Cleanup on server shutdown
  wss.on('close', () => {
    clearInterval(interval);
  });

  // Broadcast function for sending messages to all connected clients
  wss.broadcast = function(message) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          logger.error('Failed to send message to client', { 
            clientId: client.clientInfo?.id, 
            error: error.message 
          });
        }
      }
    });
  };

  // Broadcast to specific client
  wss.broadcastToClient = function(clientId, message) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.clientInfo?.id === clientId) {
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          logger.error('Failed to send message to specific client', { 
            clientId, 
            error: error.message 
          });
        }
      }
    });
  };

  logger.info('WebSocket server setup complete');
}

function handleWebSocketMessage(ws, message) {
  const { type, data } = message;
  const clientId = ws.clientInfo?.id;

  logger.debug('Received WebSocket message', { 
    clientId, 
    type, 
    dataSize: JSON.stringify(data).length 
  });

  switch (type) {
    case 'ping':
      ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
      }));
      break;

    case 'subscribe':
      handleSubscription(ws, data);
      break;

    case 'unsubscribe':
      handleUnsubscription(ws, data);
      break;

    case 'get_status':
      // This would typically fetch from bot runtime
      ws.send(JSON.stringify({
        type: 'status',
        data: {
          connected: true,
          timestamp: new Date().toISOString()
        }
      }));
      break;

    default:
      logger.warn('Unknown WebSocket message type', { 
        clientId, 
        type 
      });
      
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${type}`,
        timestamp: new Date().toISOString()
      }));
  }
}

function handleSubscription(ws, data) {
  const { channels = [] } = data;
  const clientId = ws.clientInfo?.id;

  if (!Array.isArray(channels)) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Channels must be an array',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Store subscribed channels for this client
  ws.subscribedChannels = channels;

  logger.info('Client subscribed to channels', { 
    clientId, 
    channels 
  });

  ws.send(JSON.stringify({
    type: 'subscribed',
    channels,
    timestamp: new Date().toISOString()
  }));
}

function handleUnsubscription(ws, data) {
  const { channels = [] } = data;
  const clientId = ws.clientInfo?.id;

  if (!Array.isArray(channels)) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Channels must be an array',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Remove unsubscribed channels
  if (ws.subscribedChannels) {
    ws.subscribedChannels = ws.subscribedChannels.filter(
      channel => !channels.includes(channel)
    );
  }

  logger.info('Client unsubscribed from channels', { 
    clientId, 
    channels 
  });

  ws.send(JSON.stringify({
    type: 'unsubscribed',
    channels,
    timestamp: new Date().toISOString()
  }));
}

// Export broadcast functions for use in other modules
export function broadcastSignal(signal) {
  if (global.wss) {
    global.wss.broadcast({
      type: 'new_signal',
      data: signal,
      timestamp: new Date().toISOString()
    });
  }
}

export function broadcastOrderUpdate(order) {
  if (global.wss) {
    global.wss.broadcast({
      type: 'order_update',
      data: order,
      timestamp: new Date().toISOString()
  });
  }
}

export function broadcastTradeUpdate(trade) {
  if (global.wss) {
    global.wss.broadcast({
      type: 'trade_update',
      data: trade,
      timestamp: new Date().toISOString()
    });
  }
}

export function broadcastBotStatus(status) {
  if (global.wss) {
    global.wss.broadcast({
      type: 'bot_status',
      data: status,
      timestamp: new Date().toISOString()
    });
  }
}

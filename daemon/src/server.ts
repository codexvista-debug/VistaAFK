import { WebSocketServer, WebSocket } from 'ws';
import { BotManager } from './botManager.js';
import { ClientMessage, ServerMessage } from './types.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const SECRET = process.env.VISTAAFK_SECRET || '';

const wss = new WebSocketServer({ port: PORT });
console.log(`[VistaAFK Daemon] WebSocket server listening on ws://localhost:${PORT}`);

const clients = new Set<WebSocket>();

function broadcast(msg: ServerMessage) {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

const botManager = new BotManager({
  onTelemetryUpdate: (telemetry) => {
    broadcast({ type: 'TELEMETRY_UPDATE', payload: telemetry });
  },
  onChatMessage: (chat) => {
    broadcast({ type: 'CHAT_MESSAGE', payload: chat });
  },
  onNotification: (level, message, botId) => {
    broadcast({ type: 'NOTIFICATION', payload: { level, message, botId } });
  },
  onConfigAdded: (config) => {
    broadcast({ type: 'BOT_CONFIG_ADDED', payload: config });
  },
  onConfigUpdated: (config) => {
    broadcast({ type: 'BOT_CONFIG_UPDATED', payload: config });
  },
  onConfigRemoved: (botId) => {
    broadcast({ type: 'BOT_CONFIG_REMOVED', payload: { botId } });
  },
});

wss.on('connection', (ws) => {
  clients.add(ws);
  let authenticated = !SECRET; // If no secret configured, allow right away

  ws.on('message', (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString());

      if (msg.type === 'AUTH') {
        if (!SECRET || msg.payload.token === SECRET) {
          authenticated = true;
          ws.send(JSON.stringify({ type: 'AUTH_SUCCESS' } as ServerMessage));
          sendInitialState(ws);
        } else {
          ws.send(JSON.stringify({ type: 'AUTH_FAILED', payload: { reason: 'Invalid secret token' } } as ServerMessage));
        }
        return;
      }

      if (!authenticated) {
        ws.send(JSON.stringify({ type: 'AUTH_FAILED', payload: { reason: 'Unauthorized. Please authenticate.' } } as ServerMessage));
        return;
      }

      switch (msg.type) {
        case 'GET_STATE':
          sendInitialState(ws);
          break;
        case 'ADD_BOT':
          botManager.addBot(msg.payload);
          break;
        case 'UPDATE_BOT':
          botManager.updateBot(msg.payload);
          break;
        case 'REMOVE_BOT':
          botManager.removeBot(msg.payload.botId);
          break;
        case 'START_BOT':
          botManager.startBot(msg.payload.botId);
          break;
        case 'STOP_BOT':
          botManager.stopBot(msg.payload.botId);
          break;
        case 'START_ALL':
          botManager.startAll();
          break;
        case 'STOP_ALL':
          botManager.stopAll();
          break;
        case 'SEND_CHAT':
          botManager.sendChat(msg.payload.botId, msg.payload.message);
          break;
      }
    } catch (err: any) {
      console.error('[VistaAFK Daemon] Error processing message:', err.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });

  if (authenticated) {
    sendInitialState(ws);
  }
});

function sendInitialState(ws: WebSocket) {
  if (ws.readyState === WebSocket.OPEN) {
    const payload = {
      configs: botManager.getAllConfigs(),
      telemetry: botManager.getAllTelemetry(),
    };
    ws.send(JSON.stringify({ type: 'INIT_STATE', payload } as ServerMessage));
  }
}

process.on('SIGINT', () => {
  console.log('\n[VistaAFK Daemon] Stopping all bots and shutting down gracefully...');
  botManager.stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  botManager.stopAll();
  process.exit(0);
});

import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { BotManager } from './botManager.js';
import { ClientMessage, ServerMessage } from './types.js';
import { discoverMicrosoftProfiles } from './accountDiscovery.js';

export const DAEMON_VERSION = 'v1.2.3';

const PORT = parseInt(process.env.PORT || '8080', 10);
const SECRET = process.env.VISTAAFK_SECRET || '';

const HOST = process.env.HOST || '0.0.0.0';

// Cloud Account Linking & Tunnel Auto-discovery
function getAuthCredentials(): { username: string; password?: string; cloudUrl?: string } | null {
  const paths = [
    path.resolve(process.cwd(), 'user_auth.json'),
    path.resolve(process.cwd(), '..', 'user_auth.json'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.username && parsed.password) {
          return parsed;
        }
      } catch (e) {}
    }
  }
  return null;
}

function getDetectedTunnelUrl(): string | null {
  const logPaths = [
    path.resolve(process.cwd(), 'cloudflared.log'),
    path.resolve(process.cwd(), '..', 'cloudflared.log'),
    path.resolve(process.env.HOME || '', 'cloudflared.log'),
  ];
  for (const lp of logPaths) {
    if (fs.existsSync(lp)) {
      try {
        const content = fs.readFileSync(lp, 'utf8');
        const matches = content.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
        if (matches && matches.length > 0) {
          const last = matches[matches.length - 1];
          return 'wss://' + last.replace('https://', '');
        }
      } catch (e) {}
    }
  }
  return null;
}

const wss = new WebSocketServer({ port: PORT, host: HOST });
console.log(`\n=============================================`);
console.log(`   🟢 VistaAFK Daemon ${DAEMON_VERSION}`);
console.log(`   🚀 WebSocket: ws://${HOST}:${PORT}`);
console.log(`=============================================\n`);

const clients = new Set<WebSocket>();

function broadcast(msg: ServerMessage) {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// 15-second keepalive ping to maintain uninterrupted connection across Wi-Fi and mobile
setInterval(() => {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.ping();
      } catch (e) {}
    }
  }
}, 15000);

const botManager = new BotManager({
  onTelemetryUpdate: (telemetry) => {
    broadcast({ type: 'TELEMETRY_UPDATE', payload: telemetry });
  },
  onChatMessage: (chat) => {
    broadcast({ type: 'CHAT_MESSAGE', payload: chat });
  },
  onActivityLog: (log) => {
    broadcast({ type: 'ACTIVITY_LOG', payload: log });
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
        case 'MOVE_BOT':
          botManager.moveBot(msg.payload.botId, msg.payload.control, msg.payload.state);
          break;
        case 'TOGGLE_PATROL':
          botManager.togglePatrol(msg.payload.botId, msg.payload.enabled);
          break;
        case 'LOOK_AT':
          botManager.lookAt(msg.payload.botId, msg.payload.yaw, msg.payload.pitch);
          break;
        case 'MOVE_INVENTORY_ITEM':
          botManager.moveSlotItem(msg.payload.botId, msg.payload.sourceSlot, msg.payload.targetSlot);
          break;
        case 'SET_QUICK_BAR_SLOT':
          botManager.setQuickBarSlot(msg.payload.botId, msg.payload.slot);
          break;
        case 'DISCOVER_MICROSOFT_ACCOUNT': {
          const reqEmail = (msg as any).payload?.email;
          const reqEdition = (msg as any).payload?.editionFilter || 'both';
          discoverMicrosoftProfiles(
            path.resolve(process.cwd(), 'tokens'),
            (codeData) => {
              ws.send(JSON.stringify({
                type: 'MICROSOFT_DEVICE_CODE',
                payload: codeData,
              } as ServerMessage));
            },
            reqEmail,
            reqEdition
          ).then((profiles) => {
            ws.send(JSON.stringify({
              type: 'MICROSOFT_PROFILES_DISCOVERED',
              payload: profiles,
            } as ServerMessage));
          }).catch((err) => {
            ws.send(JSON.stringify({
              type: 'MICROSOFT_DISCOVERY_ERROR',
              payload: { message: err?.message || 'Failed to authenticate Microsoft account' },
            } as ServerMessage));
          });
          break;
        }
        case 'LINK_ACCOUNT': {
          const { username, password, cloudUrl } = (msg as any).payload || {};
          if (username && password) {
            const authPath = path.resolve(process.cwd(), 'user_auth.json');
            fs.writeFileSync(authPath, JSON.stringify({ username, password, cloudUrl: cloudUrl || 'https://vista-afk.vercel.app' }, null, 2), 'utf8');
            console.log(`[Cloud Sync] 🔐 Linked daemon to VistaAFK user "${username}"`);
            sendCloudHeartbeat();
            ws.send(JSON.stringify({
              type: 'NOTIFICATION',
              payload: { level: 'success', message: `Daemon successfully linked to user "${username}"` },
            } as ServerMessage));
          }
          break;
        }
      }
    } catch (err: any) {
      console.error('[VistaAFK Daemon] Error processing message:', err.message);
    }
  });

  console.log('[VistaAFK Daemon] Dashboard client connected!');

  ws.on('error', (err) => {
    console.error('[VistaAFK Daemon] Client WebSocket error:', err.message);
  });

  ws.on('close', (code, reason) => {
    clients.delete(ws);
    console.log(`[VistaAFK Daemon] Dashboard client disconnected (code: ${code}, reason: "${reason.toString()}")`);
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
      activityLogs: botManager.getAllActivityLogs(),
    };
    ws.send(JSON.stringify({ type: 'INIT_STATE', payload } as ServerMessage));
  }
}

async function sendCloudHeartbeat() {
  const creds = getAuthCredentials();
  if (!creds || !creds.username || !creds.password) return;

  const detectedTunnel = getDetectedTunnelUrl();
  const tunnelUrl = process.env.DAEMON_PUBLIC_URL || detectedTunnel || `ws://localhost:${PORT}`;
  const cloudUrl = creds.cloudUrl || process.env.VISTAAFK_CLOUD_URL || 'https://vista-afk.vercel.app';

  try {
    const res = await fetch(`${cloudUrl}/api/daemon/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: creds.username,
        password: creds.password,
        daemonUrl: tunnelUrl,
        secretToken: SECRET,
        bots: botManager.getAllConfigs(),
      }),
    });

    if (res.ok) {
      console.log(`[Cloud Sync] ☁️ Heartbeat synced with VistaAFK user "${creds.username}" (URL: ${tunnelUrl})`);
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn(`[Cloud Sync] ⚠️ Cloud heartbeat warning: ${err.error || res.statusText}`);
    }
  } catch (err: any) {
    // Retry quietly on network blips
  }
}

// Start cloud heartbeat routine
setTimeout(sendCloudHeartbeat, 2500);
setInterval(sendCloudHeartbeat, 25000);

process.on('SIGINT', () => {
  console.log('\n[VistaAFK Daemon] Stopping all bots and shutting down gracefully...');
  botManager.stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  botManager.stopAll();
  process.exit(0);
});

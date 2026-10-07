"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAEMON_VERSION = void 0;
const path_1 = __importDefault(require("path"));
const ws_1 = require("ws");
const botManager_js_1 = require("./botManager.js");
const accountDiscovery_js_1 = require("./accountDiscovery.js");
exports.DAEMON_VERSION = 'v1.2.1';
const PORT = parseInt(process.env.PORT || '8080', 10);
const SECRET = process.env.VISTAAFK_SECRET || '';
const HOST = process.env.HOST || '0.0.0.0';
const wss = new ws_1.WebSocketServer({ port: PORT, host: HOST });
console.log(`\n=============================================`);
console.log(`   🟢 VistaAFK Daemon ${exports.DAEMON_VERSION}`);
console.log(`   🚀 WebSocket: ws://${HOST}:${PORT}`);
console.log(`=============================================\n`);
const clients = new Set();
function broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const client of clients) {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(data);
        }
    }
}
// 15-second keepalive ping to maintain uninterrupted connection across Wi-Fi and mobile
setInterval(() => {
    for (const client of clients) {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            try {
                client.ping();
            }
            catch (e) { }
        }
    }
}, 15000);
const botManager = new botManager_js_1.BotManager({
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
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'AUTH') {
                if (!SECRET || msg.payload.token === SECRET) {
                    authenticated = true;
                    ws.send(JSON.stringify({ type: 'AUTH_SUCCESS' }));
                    sendInitialState(ws);
                }
                else {
                    ws.send(JSON.stringify({ type: 'AUTH_FAILED', payload: { reason: 'Invalid secret token' } }));
                }
                return;
            }
            if (!authenticated) {
                ws.send(JSON.stringify({ type: 'AUTH_FAILED', payload: { reason: 'Unauthorized. Please authenticate.' } }));
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
                    const reqEmail = msg.payload?.email;
                    (0, accountDiscovery_js_1.discoverMicrosoftProfiles)(path_1.default.resolve(process.cwd(), 'tokens'), (codeData) => {
                        ws.send(JSON.stringify({
                            type: 'MICROSOFT_DEVICE_CODE',
                            payload: codeData,
                        }));
                    }, reqEmail).then((profiles) => {
                        ws.send(JSON.stringify({
                            type: 'MICROSOFT_PROFILES_DISCOVERED',
                            payload: profiles,
                        }));
                    }).catch((err) => {
                        ws.send(JSON.stringify({
                            type: 'MICROSOFT_DISCOVERY_ERROR',
                            payload: { message: err?.message || 'Failed to authenticate Microsoft account' },
                        }));
                    });
                    break;
                }
            }
        }
        catch (err) {
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
function sendInitialState(ws) {
    if (ws.readyState === ws_1.WebSocket.OPEN) {
        const payload = {
            configs: botManager.getAllConfigs(),
            telemetry: botManager.getAllTelemetry(),
            activityLogs: botManager.getAllActivityLogs(),
        };
        ws.send(JSON.stringify({ type: 'INIT_STATE', payload }));
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

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAEMON_VERSION = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ws_1 = require("ws");
const botManager_js_1 = require("./botManager.js");
const accountDiscovery_js_1 = require("./accountDiscovery.js");
exports.DAEMON_VERSION = 'v1.2.3';
const PORT = parseInt(process.env.PORT || '8080', 10);
const SECRET = process.env.VISTAAFK_SECRET || '';
const HOST = process.env.HOST || '0.0.0.0';
// Cloud Account Linking & Tunnel Auto-discovery
function getAuthCredentials() {
    const paths = [
        path_1.default.resolve(process.cwd(), 'user_auth.json'),
        path_1.default.resolve(process.cwd(), '..', 'user_auth.json'),
    ];
    for (const p of paths) {
        if (fs_1.default.existsSync(p)) {
            try {
                const raw = fs_1.default.readFileSync(p, 'utf8');
                const parsed = JSON.parse(raw);
                if (parsed.username && (parsed.password || parsed.token)) {
                    return parsed;
                }
            }
            catch (e) { }
        }
    }
    return null;
}
function getDetectedTunnelUrl() {
    const logPaths = [
        path_1.default.resolve(process.cwd(), 'cloudflared.log'),
        path_1.default.resolve(process.cwd(), '..', 'cloudflared.log'),
        path_1.default.resolve(process.env.HOME || '', 'cloudflared.log'),
    ];
    for (const lp of logPaths) {
        if (fs_1.default.existsSync(lp)) {
            try {
                const content = fs_1.default.readFileSync(lp, 'utf8');
                const matches = content.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
                if (matches && matches.length > 0) {
                    const last = matches[matches.length - 1];
                    return 'wss://' + last.replace('https://', '');
                }
            }
            catch (e) { }
        }
    }
    return null;
}
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
const initialCreds = getAuthCredentials();
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
}, initialCreds?.username);
let activeDiscoveryCode = null;
let lastDiscoveredProfiles = null;
let lastDiscoveryTimestamp = 0;
wss.on('connection', (ws) => {
    clients.add(ws);
    let authenticated = !SECRET; // If no secret configured, allow right away
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'AUTH') {
                if (!SECRET || msg.payload.token === SECRET) {
                    authenticated = true;
                    if (msg.payload.username && !getAuthCredentials()?.username) {
                        botManager.setUser(msg.payload.username);
                    }
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
                case 'PING':
                    try {
                        ws.send(JSON.stringify({ type: 'PONG' }));
                    }
                    catch (e) { }
                    break;
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
                    const reqEdition = msg.payload?.editionFilter || 'both';
                    const tokenFolder = botManager.getTokenFolder();
                    console.log(`[VistaAFK Discovery] Initiating discovery with tokenFolder: ${tokenFolder} (for user: ${botManager.getCurrentUser() || 'default'})`);
                    (0, accountDiscovery_js_1.discoverMicrosoftProfiles)(tokenFolder, (codeData) => {
                        activeDiscoveryCode = codeData;
                        broadcast({
                            type: 'MICROSOFT_DEVICE_CODE',
                            payload: codeData,
                        });
                    }, reqEmail, reqEdition).then((profiles) => {
                        activeDiscoveryCode = null;
                        if (!profiles.java && !profiles.bedrock) {
                            const errMsg = `No Minecraft profile found on Microsoft account ${reqEmail || ''}. Please ensure Minecraft is purchased or set up on this account.`;
                            console.warn(`[VistaAFK Discovery] ${errMsg}`);
                            broadcast({
                                type: 'MICROSOFT_DISCOVERY_ERROR',
                                payload: { message: errMsg },
                            });
                        }
                        else {
                            lastDiscoveredProfiles = profiles;
                            lastDiscoveryTimestamp = Date.now();
                            console.log(`[VistaAFK Discovery] Profiles discovered:`, JSON.stringify(profiles));
                            broadcast({
                                type: 'MICROSOFT_PROFILES_DISCOVERED',
                                payload: profiles,
                            });
                        }
                    }).catch((err) => {
                        activeDiscoveryCode = null;
                        const errMsg = err?.message || 'Failed to authenticate Microsoft account';
                        console.error(`[VistaAFK Discovery] Error:`, errMsg);
                        broadcast({
                            type: 'MICROSOFT_DISCOVERY_ERROR',
                            payload: { message: errMsg },
                        });
                    });
                    break;
                }
                case 'LINK_ACCOUNT': {
                    const { username, password, token, cloudUrl } = msg.payload || {};
                    if (username && (password || token)) {
                        const authPath = path_1.default.resolve(process.cwd(), 'user_auth.json');
                        fs_1.default.writeFileSync(authPath, JSON.stringify({
                            username,
                            password,
                            token: token || password,
                            cloudUrl: cloudUrl || 'https://afkvista.vercel.app'
                        }, null, 2), 'utf8');
                        console.log(`[Cloud Sync] 🔐 Linked daemon to VistaAFK user "${username}"`);
                        botManager.setUser(username);
                        sendCloudHeartbeat();
                        broadcast({
                            type: 'NOTIFICATION',
                            payload: { level: 'success', message: `Daemon successfully linked to user "${username}"` },
                        });
                    }
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
        // Deliver active device code or freshly discovered profile to reconnected clients
        if (activeDiscoveryCode) {
            ws.send(JSON.stringify({
                type: 'MICROSOFT_DEVICE_CODE',
                payload: activeDiscoveryCode,
            }));
        }
        else if (lastDiscoveredProfiles && (Date.now() - lastDiscoveryTimestamp < 120000)) {
            ws.send(JSON.stringify({
                type: 'MICROSOFT_PROFILES_DISCOVERED',
                payload: lastDiscoveredProfiles,
            }));
            // Clear after sending once to prevent loop on reconnect
            lastDiscoveredProfiles = null;
        }
    }
}
async function sendCloudHeartbeat() {
    const creds = getAuthCredentials();
    if (!creds || !creds.username || (!creds.password && !creds.token))
        return;
    const detectedTunnel = getDetectedTunnelUrl();
    const tunnelUrl = process.env.DAEMON_PUBLIC_URL || detectedTunnel || `ws://localhost:${PORT}`;
    const cloudUrl = creds.cloudUrl || process.env.VISTAAFK_CLOUD_URL || 'https://afkvista.vercel.app';
    try {
        const res = await fetch(`${cloudUrl}/api/daemon/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: creds.username,
                password: creds.password,
                token: creds.token,
                daemonUrl: tunnelUrl,
                secretToken: SECRET,
                bots: botManager.getAllConfigs(),
            }),
        });
        if (res.ok) {
            console.log(`[Cloud Sync] ☁️ Heartbeat synced with VistaAFK user "${creds.username}" (URL: ${tunnelUrl})`);
        }
        else {
            const err = await res.json().catch(() => ({}));
            console.warn(`[Cloud Sync] ⚠️ Cloud heartbeat warning: ${err.error || res.statusText}`);
        }
    }
    catch (err) {
        // Retry quietly on network blips
    }
}
// Start cloud heartbeat routine: rapid initial pulses to capture freshly started tunnels immediately
setTimeout(sendCloudHeartbeat, 1500);
setTimeout(sendCloudHeartbeat, 4000);
setTimeout(sendCloudHeartbeat, 8000);
setInterval(sendCloudHeartbeat, 18000);
process.on('SIGINT', () => {
    console.log('\n[VistaAFK Daemon] Stopping all bots and shutting down gracefully...');
    botManager.stopAll();
    process.exit(0);
});
process.on('SIGTERM', () => {
    botManager.stopAll();
    process.exit(0);
});
// Resilient crash prevention on mobile & termux background execution
process.on('uncaughtException', (err) => {
    console.error('[VistaAFK Daemon] ⚠️ Caught uncaught exception (kept daemon running):', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[VistaAFK Daemon] ⚠️ Caught unhandled rejection (kept daemon running):', reason);
});

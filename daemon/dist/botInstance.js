"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotInstance = void 0;
const mineflayer_1 = __importDefault(require("mineflayer"));
const socks_proxy_agent_1 = require("socks-proxy-agent");
const path_1 = __importDefault(require("path"));
function romanNumeral(num) {
    const romanMap = [
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    let result = '';
    let n = num;
    for (const [val, str] of romanMap) {
        while (n >= val) {
            result += str;
            n -= val;
        }
    }
    return result || String(num);
}
function formatEnchantName(rawId, lvl) {
    const cleanId = String(rawId || '').replace(/^minecraft:/, '');
    const title = cleanId
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    if (lvl > 1) {
        return `${title} ${romanNumeral(lvl)}`;
    }
    // Single-level max enchants like Mending, Infinity, Silk Touch, Flame
    if (['mending', 'flame', 'infinity', 'silk_touch', 'aqua_affinity', 'channeling', 'multishot', 'curse_of_binding', 'curse_of_vanishing'].includes(cleanId)) {
        return title;
    }
    return `${title} I`;
}
function cleanMinecraftJsonText(raw) {
    if (!raw)
        return '';
    if (typeof raw === 'string') {
        if (raw.startsWith('{') || raw.startsWith('[')) {
            try {
                const parsed = JSON.parse(raw);
                return cleanMinecraftJsonText(parsed);
            }
            catch (e) { }
        }
        return raw.replace(/§[0-9a-fk-or]/gi, '').trim();
    }
    if (typeof raw === 'object') {
        let out = '';
        if (raw.text)
            out += raw.text;
        if (Array.isArray(raw.extra)) {
            for (const ex of raw.extra) {
                out += cleanMinecraftJsonText(ex);
            }
        }
        if (raw.value) {
            if (typeof raw.value === 'string')
                out += raw.value;
            else if (Array.isArray(raw.value))
                out += raw.value.map(cleanMinecraftJsonText).join(' ');
        }
        return out.replace(/§[0-9a-fk-or]/gi, '').trim();
    }
    return String(raw).replace(/§[0-9a-fk-or]/gi, '').trim();
}
function parseMinecraftChat(raw) {
    if (!raw)
        return 'Unknown reason';
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parseMinecraftChat(parsed);
        }
        catch {
            return raw;
        }
    }
    // Check NBT compound format
    if (raw.type === 'compound' && raw.value) {
        let text = '';
        if (raw.value.text?.value)
            text += raw.value.text.value;
        if (raw.value.extra?.value?.value) {
            const extraList = raw.value.extra.value.value;
            for (const item of extraList) {
                if (Array.isArray(item)) {
                    for (const sub of item) {
                        if (sub.text?.value)
                            text += sub.text.value;
                    }
                }
                else if (item.text?.value) {
                    text += item.text.value;
                }
            }
        }
        return text.replace(/\n+/g, ' ').trim() || JSON.stringify(raw);
    }
    // Standard Mojang Chat component or extra array
    if (raw.text !== undefined || raw.extra) {
        let text = raw.text || '';
        if (Array.isArray(raw.extra)) {
            for (const part of raw.extra) {
                if (typeof part === 'string') {
                    text += part;
                }
                else if (part && typeof part === 'object') {
                    text += part.text || '';
                }
            }
        }
        if (text.trim()) {
            return text.replace(/\n+/g, ' ').trim();
        }
    }
    return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
}
class BotInstance {
    config;
    bot = null;
    callbacks;
    isManuallyStopped = false;
    reconnectTimeout = null;
    antiAfkInterval = null;
    telemetryInterval = null;
    connectStartTime = 0;
    currentStatus = 'offline';
    statusMessage = 'Offline';
    authCodeInfo;
    reconnectAttempts = 0;
    patrolInterval = null;
    isPatrolling = false;
    farmingInterval = null;
    lastSwordEquipCheck = 0;
    recurringCommandInterval = null;
    spawnCommandTimeout = null;
    lastChatText = '';
    lastChatTimestamp = 0;
    lastAntiAfkLogTime = 0;
    isEatingFood = false;
    customMaxHealth = 0;
    recordedMaxHealth = 0;
    bedrockClient = null;
    constructor(config, callbacks) {
        this.config = config;
        this.callbacks = callbacks;
    }
    emitActivity(type, message) {
        if (this.callbacks.onActivityLog) {
            this.callbacks.onActivityLog({
                id: Math.random().toString(36).substring(2, 9),
                botId: this.config.id,
                timestamp: Date.now(),
                type,
                message,
            });
        }
    }
    formatUptime(seconds) {
        if (!seconds || seconds <= 0)
            return '0s';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0)
            return `${hrs}h ${mins}m ${secs}s`;
        if (mins > 0)
            return `${mins}m ${secs}s`;
        return `${secs}s`;
    }
    getSessionUptime() {
        const sec = this.connectStartTime ? Math.floor((Date.now() - this.connectStartTime) / 1000) : 0;
        return this.formatUptime(sec);
    }
    updateConfig(newConfig) {
        this.config = newConfig;
        if (this.bot && this.currentStatus === 'online') {
            this.setupAntiAfk();
            this.setupAutoCommands();
            this.setupFarming();
        }
    }
    start() {
        if (this.bot || this.bedrockClient) {
            this.callbacks.onNotification('info', `Bot ${this.config.name} is already starting or running.`, this.config.id);
            return;
        }
        const isBedrock = this.config.edition === 'bedrock' || this.config.port === 19132;
        if (isBedrock) {
            if (this.config.edition !== 'bedrock') {
                this.config.edition = 'bedrock';
            }
            this.startBedrock();
            return;
        }
        this.isManuallyStopped = false;
        this.clearTimers();
        this.updateStatus('connecting', 'Connecting to Minecraft server...');
        this.emitActivity('connect', `Connecting to ${this.config.host}:${this.config.port || 25565}...`);
        const tokenFolder = path_1.default.resolve(process.cwd(), 'tokens');
        const options = {
            host: this.config.host,
            port: this.config.port || 25565,
            username: this.config.name,
            auth: this.config.authType === 'microsoft' ? 'microsoft' : 'offline',
            profilesFolder: tokenFolder,
            version: this.config.version || undefined,
            hideErrors: true,
            onMsaCode: (data) => {
                this.authCodeInfo = {
                    userCode: data.user_code,
                    verificationUri: data.verification_uri,
                    expiresIn: data.expires_in,
                };
                this.updateStatus('authenticating', `Device Code: ${data.user_code}`);
                this.emitActivity('status', `Microsoft Auth Required: Visit ${data.verification_uri} (Code: ${data.user_code})`);
                this.callbacks.onNotification('warn', `Microsoft Auth required for ${this.config.name}: Visit ${data.verification_uri} and enter code ${data.user_code}`, this.config.id);
            },
        };
        // Proxy support if configured
        if (this.config.proxyUrl) {
            try {
                const agent = new socks_proxy_agent_1.SocksProxyAgent(this.config.proxyUrl);
                options.agent = agent;
            }
            catch (err) {
                this.callbacks.onNotification('error', `Invalid proxy URL for ${this.config.name}: ${err.message}`, this.config.id);
            }
        }
        try {
            this.bot = mineflayer_1.default.createBot(options);
            this.bindBotEvents();
        }
        catch (err) {
            this.updateStatus('error', err.message || 'Initialization failed');
            this.handleReconnect();
        }
    }
    async startBedrock() {
        this.isManuallyStopped = false;
        this.clearTimers();
        this.updateStatus('connecting', 'Connecting to Bedrock server...');
        const port = this.config.port || 19132;
        this.emitActivity('connect', `Connecting to Bedrock server ${this.config.host}:${port}...`);
        const tokenFolder = path_1.default.resolve(process.cwd(), 'tokens');
        try {
            let bedrock = null;
            let importErr = null;
            try {
                // @ts-ignore
                bedrock = await import('bedrock-protocol');
            }
            catch (err) {
                importErr = err;
                try {
                    bedrock = (eval('require'))('bedrock-protocol');
                }
                catch (e) {
                    importErr = e;
                }
            }
            if (!bedrock) {
                const reason = importErr?.message || String(importErr || 'Not found');
                this.updateStatus('error', 'Bedrock module not installed');
                this.emitActivity('status', `⚠️ Bedrock package missing (${reason}). Run: cd ~/VistaAFK/daemon && npm install bedrock-protocol --no-optional`);
                this.callbacks.onNotification('error', `[${this.config.name}] Bedrock package missing: ${reason}`, this.config.id);
                return;
            }
            // Patch Geyser 26.x protocol aliases so servers reporting 26.30-26.60 map to protocol 2193, and 2193 maps to 1.26.51
            try {
                // @ts-ignore
                const Options = bedrock.Options || (await import('bedrock-protocol/src/options.js'));
                if (Options?.Versions) {
                    for (let i = 20; i <= 60; i++) {
                        Options.Versions[`26.${i}`] = 2193;
                        Options.Versions[`1.26.${i}`] = 2193;
                    }
                    Options.Versions['2193'] = '1.26.51';
                    Options.Versions[2193] = '1.26.51';
                }
            }
            catch (e) { }
            // Auto-detect target version: if FreshSMP or not set, use 1.26.51 (protocol 2193)
            let targetVersion = this.config.version?.trim();
            if (!targetVersion || targetVersion === '' || targetVersion.startsWith('26.')) {
                targetVersion = '1.26.51';
            }
            const client = bedrock.createClient({
                host: this.config.host,
                port,
                username: this.config.name,
                offline: this.config.authType === 'offline',
                profilesFolder: tokenFolder,
                version: targetVersion,
                raknetBackend: 'jsp-raknet',
                onMsaCode: (data) => {
                    const userCode = data.user_code || data.userCode;
                    const verificationUri = userCode ? `https://www.microsoft.com/link?otc=${encodeURIComponent(userCode)}` : (data.verification_uri || 'https://microsoft.com/link');
                    this.authCodeInfo = {
                        userCode,
                        verificationUri,
                        expiresIn: data.expires_in || data.expiresIn || 900,
                    };
                    this.updateStatus('authenticating', `Device Code: ${userCode}`);
                    this.emitActivity('status', `🔑 Microsoft Auth Required for Bedrock: Visit ${verificationUri} (Code: ${userCode})`);
                    this.callbacks.onNotification('warn', `Microsoft Auth required for Bedrock ${this.config.name}: Visit ${verificationUri} and enter code ${userCode}`, this.config.id);
                    this.emitTelemetry();
                },
            });
            this.bedrockClient = client;
            client.on('join', () => {
                this.reconnectAttempts = 0;
                this.connectStartTime = Date.now();
                this.updateStatus('online', 'Connected (Bedrock)');
                this.emitActivity('connect', `🎮 Successfully joined Bedrock server ${this.config.host}:${port}`);
                this.emitTelemetry();
            });
            client.on('spawn', () => {
                this.updateStatus('online', 'Spawned in world (Bedrock)');
                this.emitActivity('spawn', '🌍 Spawned into Bedrock world');
                this.setupTelemetryLoop();
                this.emitTelemetry();
            });
            client.on('text', (packet) => {
                const msg = packet.message || packet.source_name ? `${packet.source_name}: ${packet.message}` : String(packet);
                this.callbacks.onChatMessage({
                    botId: this.config.id,
                    timestamp: Date.now(),
                    sender: packet.source_name || 'Server',
                    message: packet.message || msg,
                    isSystem: packet.type === 'system' || !packet.source_name,
                });
            });
            client.on('kick', (reason) => {
                const cleanReason = typeof reason === 'string' ? reason : reason?.message || JSON.stringify(reason);
                this.emitActivity('disconnect', `❌ Kicked from Bedrock server: ${cleanReason}`);
                this.callbacks.onNotification('error', `[${this.config.name}] Kicked: ${cleanReason}`, this.config.id);
            });
            client.on('close', () => {
                this.bedrockClient = null;
                if (!this.isManuallyStopped) {
                    this.emitActivity('disconnect', '🔴 Disconnected from Bedrock server');
                    this.handleReconnect();
                }
                else {
                    this.updateStatus('offline', 'Disconnected');
                }
            });
            client.on('error', (err) => {
                this.updateStatus('error', err?.message || 'Bedrock connection error');
                this.emitActivity('status', `⚠️ Bedrock Error: ${err?.message || 'Connection failed'}`);
            });
        }
        catch (err) {
            console.error(`[VistaAFK] Bedrock init error for ${this.config.name}:`, err.message);
            this.updateStatus('error', err?.message || 'Failed to initialize Bedrock client');
            this.emitActivity('status', `⚠️ Bedrock Init Error: ${err?.message || 'Initialization failed'}`);
            this.callbacks.onNotification('error', `[${this.config.name}] Bedrock error: ${err?.message}`, this.config.id);
            this.handleReconnect();
        }
    }
    stop() {
        const uptime = this.getSessionUptime();
        this.isManuallyStopped = true;
        this.clearTimers();
        if (this.bedrockClient) {
            try {
                this.bedrockClient.close();
            }
            catch (e) { }
            this.bedrockClient = null;
        }
        if (this.bot) {
            try {
                this.bot.quit('VistaAFK: Disconnected by user');
            }
            catch (e) {
                // ignore
            }
            this.bot = null;
        }
        this.updateStatus('offline', 'Disconnected');
        if (this.connectStartTime) {
            this.emitActivity('disconnect', `⏹️ Disconnected by user (Session Uptime: ${uptime})`);
            this.sendDiscordAlert(`🔴 **${this.config.name}** disconnected from \`${this.config.host}:${this.config.port || 25565}\` (Session Uptime: ${uptime})`);
            this.connectStartTime = 0;
        }
    }
    sendChat(message) {
        if (this.bedrockClient && this.currentStatus === 'online') {
            try {
                this.bedrockClient.queue('text', {
                    type: 'chat',
                    needs_translation: false,
                    source_name: this.config.name,
                    message,
                    xuid: '',
                    platform_chat_id: '',
                });
                this.callbacks.onChatMessage({
                    botId: this.config.id,
                    timestamp: Date.now(),
                    sender: this.config.name,
                    message,
                    isSystem: false,
                });
            }
            catch (e) { }
            return;
        }
        if (!this.bot || this.currentStatus !== 'online') {
            this.callbacks.onNotification('error', `Cannot send chat: ${this.config.name} is offline.`, this.config.id);
            return;
        }
        try {
            this.bot.chat(message);
            if (message.startsWith('/')) {
                this.emitActivity('command', `⚡ Executed command: ${message}`);
                this.sendDiscordAlert(`⚡ **${this.config.name}** typed command: \`${message}\``);
            }
            else {
                this.emitActivity('chat', `💬 Sent chat: "${message}"`);
            }
        }
        catch (err) {
            this.callbacks.onNotification('error', `Failed to send chat: ${err.message}`, this.config.id);
        }
    }
    bindBotEvents() {
        if (!this.bot)
            return;
        this.bot.once('spawn', () => {
            this.connectStartTime = Date.now();
            this.reconnectAttempts = 0;
            this.authCodeInfo = undefined;
            this.updateStatus('online', 'Connected and spawned in world');
            this.callbacks.onNotification('success', `${this.config.name} has entered the world!`, this.config.id);
            const dimension = this.bot?.game?.dimension || 'Overworld';
            this.emitActivity('spawn', `🟢 Spawned in ${dimension} at [${this.getCoordinatesString()}]`);
            this.sendDiscordAlert(`🟢 **${this.config.name}** joined lobby/world on \`${this.config.host}:${this.config.port || 25565}\` (${dimension})`);
            this.setupAntiAfk();
            this.setupFarming();
            this.setupTelemetryLoop();
            this.checkSurvivalActions();
            this.setupAutoCommands();
            this.callbacks.onChatMessage({
                botId: this.config.id,
                timestamp: Date.now(),
                sender: 'VistaAFK',
                message: `🟢 Connected & spawned into ${this.config.host} (${dimension})`,
                isSystem: true,
            });
        });
        this.bot.on('chat', (username, message) => {
            if (username === this.bot?.username)
                return;
            const cleanMsg = message.trim();
            if (cleanMsg === this.lastChatText && (Date.now() - this.lastChatTimestamp) < 1500) {
                return;
            }
            this.lastChatText = cleanMsg;
            this.lastChatTimestamp = Date.now();
            this.callbacks.onChatMessage({
                botId: this.config.id,
                timestamp: Date.now(),
                sender: username,
                message,
                isSystem: false,
            });
            // Notify if whispered
            if (message.toLowerCase().includes('whisper') || message.toLowerCase().includes('-> me')) {
                this.emitActivity('chat', `💬 Received whisper from ${username}: "${message}"`);
                this.sendDiscordAlert(`💬 **${this.config.name}** received a whisper from **${username}**: "${message}"`);
            }
        });
        this.bot.on('messagestr', (message, position) => {
            if (position === 'system' || position === 'game_info') {
                const cleanMsg = message.trim();
                if (!cleanMsg || (cleanMsg === this.lastChatText && (Date.now() - this.lastChatTimestamp) < 1500)) {
                    return;
                }
                this.lastChatText = cleanMsg;
                this.lastChatTimestamp = Date.now();
                this.callbacks.onChatMessage({
                    botId: this.config.id,
                    timestamp: Date.now(),
                    sender: 'Server',
                    message: cleanMsg,
                    isSystem: true,
                });
            }
        });
        this.bot.on('health', () => {
            this.emitTelemetry();
            this.checkSurvivalActions();
        });
        this.bot.on('entityAttributes', (entity) => {
            if (this.bot && entity === this.bot.entity) {
                this.emitTelemetry();
                this.checkSurvivalActions();
            }
        });
        const handleAttrPacket = (packet) => {
            if (!this.bot)
                return;
            const myId = this.bot.entity?.id;
            if (myId === undefined || packet?.entityId === myId) {
                if (Array.isArray(packet?.properties)) {
                    for (const prop of packet.properties) {
                        const attrKey = prop?.key || prop?.name || '';
                        if (attrKey.includes('max_health')) {
                            let val = typeof prop.value === 'number' ? prop.value : 20;
                            if (Array.isArray(prop.modifiers) && prop.modifiers.length > 0) {
                                let op0 = 0, op1 = 0, op2 = 1;
                                for (const mod of prop.modifiers) {
                                    if (mod.operation === 0)
                                        op0 += (mod.amount || 0);
                                    else if (mod.operation === 1)
                                        op1 += (mod.amount || 0);
                                    else if (mod.operation === 2)
                                        op2 *= (1 + (mod.amount || 0));
                                }
                                val = Math.max(1, (val + op0) * (1 + op1) * op2);
                            }
                            this.customMaxHealth = Math.round(val * 10) / 10;
                            this.recordedMaxHealth = Math.max(this.recordedMaxHealth, this.customMaxHealth);
                            this.emitTelemetry();
                            this.checkSurvivalActions();
                        }
                    }
                }
            }
        };
        this.bot._client?.on('entity_update_attributes', handleAttrPacket);
        this.bot._client?.on('update_attributes', handleAttrPacket);
        // Auto accept resource packs (critical for SMP sub-servers like Lifesteal with custom packs)
        this.bot.on('resourcePack', (url, hash) => {
            try {
                this.bot?.acceptResourcePack();
                this.emitActivity('status', '📦 Accepted server custom resource pack');
                this.callbacks.onChatMessage({
                    botId: this.config.id,
                    timestamp: Date.now(),
                    sender: 'VistaAFK',
                    message: '📦 Accepted server custom resource pack',
                    isSystem: true,
                });
            }
            catch (e) {
                // ignore
            }
        });
        this.bot.on('respawn', () => {
            this.setupAntiAfk();
            this.setupFarming();
            this.checkSurvivalActions();
            this.emitActivity('spawn', '♻️ Respawned in world');
            this.callbacks.onChatMessage({
                botId: this.config.id,
                timestamp: Date.now(),
                sender: 'VistaAFK',
                message: '♻️ Respawned in world',
                isSystem: true,
            });
        });
        this.bot.on('death', () => {
            this.callbacks.onNotification('error', `${this.config.name} died in the world!`, this.config.id);
            this.emitActivity('status', `☠️ Bot died at [${this.getCoordinatesString()}] — Auto-respawning...`);
            this.callbacks.onChatMessage({
                botId: this.config.id,
                timestamp: Date.now(),
                sender: 'VistaAFK',
                message: `☠️ Died in world at [${this.getCoordinatesString()}]`,
                isSystem: true,
            });
            this.sendDiscordAlert(`☠️ **${this.config.name}** died at [${this.getCoordinatesString()}]`);
            setTimeout(() => {
                try {
                    this.bot?.respawn();
                }
                catch (e) {
                    // ignore
                }
            }, 1500);
        });
        this.bot.on('kicked', (reason) => {
            const cleanReason = parseMinecraftChat(reason);
            const uptime = this.getSessionUptime();
            this.updateStatus('offline', `Kicked: ${cleanReason}`);
            this.callbacks.onNotification('warn', `${this.config.name} was kicked: ${cleanReason}`, this.config.id);
            this.emitActivity('disconnect', `❌ Kicked: ${cleanReason} (Session Uptime: ${uptime})`);
            this.callbacks.onChatMessage({
                botId: this.config.id,
                timestamp: Date.now(),
                sender: 'Server',
                message: `❌ Kicked: ${cleanReason}`,
                isSystem: true,
            });
            this.sendDiscordAlert(`⚠️ **${this.config.name}** was kicked from \`${this.config.host}:${this.config.port || 25565}\` (Session Uptime: ${uptime})\n> **Reason:** \`${cleanReason}\``);
            this.connectStartTime = 0;
        });
        this.bot.on('error', (err) => {
            let friendlyMsg = err?.message || 'Connection failed';
            if (friendlyMsg.includes('ECONNREFUSED')) {
                friendlyMsg = `Cannot connect to ${this.config.host}:${this.config.port} — no Minecraft server is running there.`;
            }
            else if (friendlyMsg.includes('ENOTFOUND')) {
                friendlyMsg = `Server address not found: ${this.config.host}`;
            }
            else if (friendlyMsg.includes('ETIMEDOUT')) {
                friendlyMsg = `Connection to ${this.config.host}:${this.config.port} timed out.`;
            }
            this.updateStatus('error', friendlyMsg);
            this.emitActivity('status', `⚠️ Error: ${friendlyMsg}`);
            this.callbacks.onNotification('error', `[${this.config.name}] ${friendlyMsg}`, this.config.id);
        });
        this.bot.on('end', () => {
            const uptime = this.getSessionUptime();
            this.clearTimers();
            this.bot = null;
            if (!this.isManuallyStopped) {
                if (this.connectStartTime) {
                    this.emitActivity('disconnect', `🔴 Disconnected from server (Session Uptime: ${uptime})`);
                    this.sendDiscordAlert(`🔴 **${this.config.name}** disconnected from \`${this.config.host}:${this.config.port || 25565}\` (Session Uptime: ${uptime})`);
                    this.connectStartTime = 0;
                }
                this.handleReconnect();
            }
            else {
                this.updateStatus('offline', 'Disconnected');
            }
        });
    }
    setupAntiAfk() {
        if (this.antiAfkInterval)
            clearInterval(this.antiAfkInterval);
        if (!this.config.antiAfk.enabled)
            return;
        const intervalMs = Math.max(3, this.config.antiAfk.intervalSeconds || 10) * 1000;
        // Log routine once initially or every 10 mins
        if (Date.now() - this.lastAntiAfkLogTime > 600000) {
            this.emitActivity('anti_afk', '🛡️ Anti-AFK routine active');
            this.lastAntiAfkLogTime = Date.now();
        }
        this.antiAfkInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity)
                return;
            if (this.isEatingFood)
                return; // Never interrupt eating motion
            try {
                const { rotateHead, jump, sneak, swingArm } = this.config.antiAfk;
                // 1. Subtle head look rotation (natural motion)
                if (rotateHead) {
                    const deltaYaw = (Math.random() - 0.5) * 0.6;
                    const deltaPitch = (Math.random() - 0.5) * 0.3;
                    const newYaw = this.bot.entity.yaw + deltaYaw;
                    const newPitch = Math.max(-1.4, Math.min(1.4, this.bot.entity.pitch + deltaPitch));
                    this.bot.look(newYaw, newPitch, true);
                }
                // 2. Micro sneak
                if (sneak && Math.random() > 0.4) {
                    this.bot.setControlState('sneak', true);
                    setTimeout(() => this.bot?.setControlState('sneak', false), 350);
                }
                // 3. Jump (if grounded)
                if (jump && this.bot.entity.onGround && Math.random() > 0.6) {
                    this.bot.setControlState('jump', true);
                    setTimeout(() => this.bot?.setControlState('jump', false), 250);
                }
                // 4. Arm swing
                if (swingArm && Math.random() > 0.3) {
                    this.bot.swingArm('right');
                }
            }
            catch (err) {
                // Silently tolerate anti-afk action failure during chunk transitions
            }
        }, intervalMs);
    }
    getMaxHealth() {
        if (!this.bot)
            return 20;
        // 0. Use explicitly captured customMaxHealth from packets
        if (this.customMaxHealth && this.customMaxHealth > 0) {
            return this.customMaxHealth;
        }
        // 1. Check entity attributes (minecraft:generic.max_health)
        const entityAny = this.bot.entity;
        if (entityAny?.attributes) {
            const attr = entityAny.attributes['minecraft:generic.max_health'] ||
                entityAny.attributes['generic.max_health'];
            if (attr && typeof attr.value === 'number' && attr.value > 0) {
                let finalVal = attr.value;
                if (Array.isArray(attr.modifiers) && attr.modifiers.length > 0) {
                    let op0 = 0;
                    let op1 = 0;
                    let op2 = 1;
                    for (const mod of attr.modifiers) {
                        if (mod.operation === 0)
                            op0 += (mod.amount || 0);
                        else if (mod.operation === 1)
                            op1 += (mod.amount || 0);
                        else if (mod.operation === 2)
                            op2 *= (1 + (mod.amount || 0));
                    }
                    finalVal = Math.max(1, (attr.value + op0) * (1 + op1) * op2);
                }
                const calculated = Math.round(finalVal * 10) / 10;
                this.recordedMaxHealth = Math.max(this.recordedMaxHealth, calculated);
                return calculated;
            }
        }
        // 2. Check scoreboard lines for "Hearts: X" (e.g. FreshSMP / Lifesteal)
        if (this.bot.scoreboards) {
            try {
                const boards = Object.values(this.bot.scoreboards);
                for (const board of boards) {
                    if (!board || !board.items)
                        continue;
                    const items = Object.values(board.items);
                    for (const it of items) {
                        const text = it.displayName || it.name || '';
                        const match = text.match(/Hearts?:\s*([0-9]+)/i);
                        if (match) {
                            const hearts = parseInt(match[1], 10);
                            if (hearts > 0 && hearts <= 100) {
                                const calculated = hearts * 2;
                                this.recordedMaxHealth = Math.max(this.recordedMaxHealth, calculated);
                                return calculated;
                            }
                        }
                    }
                }
            }
            catch (e) { }
        }
        // 3. Check tablist / player displayName for hearts (e.g. FreshSMP tab list)
        try {
            const p = this.bot.players?.[this.bot.username];
            const name = p?.displayName ? cleanMinecraftJsonText(p.displayName) : '';
            const match = name.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:❤|hearts?)/i);
            if (match) {
                const parsedHearts = parseFloat(match[1]);
                if (parsedHearts > 0 && parsedHearts <= 100) {
                    const calculated = Math.round(parsedHearts * 2);
                    this.recordedMaxHealth = Math.max(this.recordedMaxHealth, calculated);
                    return calculated;
                }
            }
        }
        catch (e) { }
        // 4. Remember previously observed peak max health (e.g. before taking damage)
        if (this.recordedMaxHealth > 0) {
            return this.recordedMaxHealth;
        }
        // 5. If bot is at full hunger (food >= 18) and health is stable, that is their max health (e.g. 16 HP = 8 hearts)
        if (this.bot.health && (this.bot.food ?? 0) >= 18 && this.bot.health > 0) {
            const current = Math.round(this.bot.health * 10) / 10;
            this.recordedMaxHealth = Math.max(this.recordedMaxHealth, current);
            return current;
        }
        // 6. Fallback: if bot.health is higher than 20
        if (this.bot.health && this.bot.health > 20) {
            const current = Math.round(this.bot.health);
            this.recordedMaxHealth = Math.max(this.recordedMaxHealth, current);
            return current;
        }
        return 20;
    }
    checkSurvivalActions() {
        if (!this.bot)
            return;
        // 1. Auto Totem
        if (this.config.survival.autoTotem && this.bot.inventory) {
            try {
                const offhand = this.bot.inventory.slots[45];
                if (!offhand || offhand.name !== 'totem_of_undying') {
                    const totem = this.bot.inventory.items().find((i) => i.name === 'totem_of_undying');
                    if (totem) {
                        this.bot.equip(totem, 'off-hand').then(() => {
                            this.emitActivity('survival', '🛡️ Auto-totem: Equipped Totem of Undying in off-hand');
                        }).catch(() => { });
                    }
                }
            }
            catch (e) {
                // ignore
            }
        }
        // 2. Universal Auto Eat & Healing
        if (this.config.survival.autoEat && !this.isEatingFood && this.bot.inventory) {
            try {
                const currentHealth = Math.round((this.bot.health ?? 20) * 10) / 10;
                const currentFood = this.bot.food ?? 20;
                const maxHealth = this.getMaxHealth();
                const isInjured = currentHealth < maxHealth;
                const isHungry = currentFood < 20;
                const eatThreshold = this.config.survival.eatThreshold || (maxHealth - 2);
                const hungerBelowThreshold = currentFood <= eatThreshold;
                // In Minecraft:
                // - Golden apple can be eaten anytime (even when food is 20) and grants instant Absorption + Regeneration!
                // - Regular foods can be consumed whenever food < 20.
                // - Natural regeneration occurs when food >= 18.
                // If injured and hungry (or hunger below threshold), eating is urgent!
                const shouldEatRegular = isHungry && (isInjured || hungerBelowThreshold);
                const shouldEatGolden = isInjured || shouldEatRegular;
                if (shouldEatRegular || shouldEatGolden) {
                    const items = this.bot.inventory.items();
                    // 1. Check for golden apple if injured
                    let selectedFood = items.find((i) => ['enchanted_golden_apple', 'golden_apple'].includes(i.name));
                    // 2. If no golden apple or food is < 20, search all slots for any edible food
                    if (!selectedFood && shouldEatRegular) {
                        const FOOD_PRIORITY = [
                            'golden_carrot',
                            'cooked_beef', 'steak', 'cooked_porkchop', 'cooked_mutton', 'cooked_salmon', 'cooked_chicken',
                            'baked_potato', 'bread', 'cooked_cod', 'cooked_rabbit',
                            'apple', 'carrot', 'sweet_berries', 'glow_berries', 'melon_slice',
                            'pumpkin_pie', 'honey_bottle', 'cookie', 'dried_kelp', 'beetroot',
                            'mushroom_stew', 'rabbit_stew', 'beetroot_soup',
                            'potato', 'beef', 'porkchop', 'mutton', 'chicken', 'salmon', 'cod', 'rabbit'
                        ];
                        for (const fname of FOOD_PRIORITY) {
                            const match = items.find((i) => i.name === fname);
                            if (match) {
                                selectedFood = match;
                                break;
                            }
                        }
                        // Universal fallback: check minecraft-data foods registry
                        if (!selectedFood) {
                            selectedFood = items.find((i) => Boolean(this.bot?.registry?.foodsByName?.[i.name]) &&
                                !['rotten_flesh', 'pufferfish', 'poisonous_potato', 'spider_eye'].includes(i.name));
                        }
                    }
                    if (selectedFood) {
                        this.isEatingFood = true;
                        const foodToEat = selectedFood;
                        const foodName = foodToEat.displayName || foodToEat.name;
                        this.bot.equip(foodToEat, 'hand')
                            .then(async () => {
                            this.emitActivity('survival', `🍖 Auto-eat: Consuming ${foodName} (HP: ${Math.round(currentHealth)}/20, Hunger: ${currentFood}/20)`);
                            try {
                                await this.bot?.consume();
                                this.emitActivity('survival', `✨ Finished eating ${foodName} (Now HP: ${Math.round(this.bot?.health || 0)}/20, Hunger: ${this.bot?.food || 0}/20)`);
                            }
                            catch (err) {
                                // Eating interrupted or failed
                            }
                            finally {
                                this.isEatingFood = false;
                                this.emitTelemetry();
                            }
                        })
                            .catch(() => {
                            this.isEatingFood = false;
                        });
                    }
                }
            }
            catch (e) {
                this.isEatingFood = false;
            }
        }
    }
    handleReconnect() {
        if (!this.config.autoReconnect || this.isManuallyStopped) {
            this.updateStatus('offline', 'Disconnected');
            return;
        }
        this.reconnectAttempts++;
        // Exponential backoff capped at 60 seconds
        const delay = Math.min(60000, (this.config.reconnectDelayMs || 5000) * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 5)));
        const delaySec = Math.round(delay / 1000);
        this.updateStatus('reconnecting', `Reconnecting in ${delaySec}s (attempt ${this.reconnectAttempts})...`);
        this.emitActivity('reconnect', `🔄 Reconnecting in ${delaySec}s (attempt #${this.reconnectAttempts})...`);
        this.reconnectTimeout = setTimeout(() => {
            this.start();
        }, delay);
    }
    setupTelemetryLoop() {
        if (this.telemetryInterval)
            clearInterval(this.telemetryInterval);
        this.telemetryInterval = setInterval(() => {
            this.emitTelemetry();
            this.checkSurvivalActions();
        }, 2000);
    }
    emitTelemetry() {
        this.callbacks.onTelemetryUpdate(this.getTelemetry());
    }
    togglePatrol(enabled) {
        this.isPatrolling = enabled;
        if (this.patrolInterval) {
            clearInterval(this.patrolInterval);
            this.patrolInterval = null;
        }
        if (!this.bot || this.currentStatus !== 'online') {
            this.isPatrolling = false;
            return;
        }
        if (!enabled) {
            this.bot.setControlState('forward', false);
            this.bot.setControlState('back', false);
            this.callbacks.onNotification('info', `Patrol mode stopped for ${this.config.name}`, this.config.id);
            this.emitTelemetry();
            return;
        }
        this.callbacks.onNotification('success', `Patrol mode started for ${this.config.name} (Walking back and forth)`, this.config.id);
        let step = 0;
        this.patrolInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity)
                return;
            step++;
            const phase = step % 8;
            if (phase >= 0 && phase <= 2) {
                this.bot.setControlState('forward', true);
            }
            else if (phase === 3) {
                this.bot.setControlState('forward', false);
            }
            else if (phase === 4) {
                const currentYaw = this.bot.entity.yaw;
                this.bot.look(currentYaw + Math.PI, 0, true);
            }
            else if (phase >= 5 && phase <= 6) {
                this.bot.setControlState('forward', true);
            }
            else {
                this.bot.setControlState('forward', false);
                const currentYaw = this.bot.entity.yaw;
                this.bot.look(currentYaw + Math.PI, 0, true);
            }
        }, 1000);
        this.emitTelemetry();
    }
    move(control, state) {
        if (!this.bot || this.currentStatus !== 'online')
            return;
        try {
            this.bot.setControlState(control, state);
        }
        catch (e) { }
    }
    look(yaw, pitch) {
        if (!this.bot || this.currentStatus !== 'online')
            return;
        try {
            this.bot.look(yaw, pitch, true);
        }
        catch (e) { }
    }
    setupFarming() {
        if (this.farmingInterval) {
            clearInterval(this.farmingInterval);
            this.farmingInterval = null;
        }
        if (!this.config.farming?.enabled || !this.bot || this.currentStatus !== 'online')
            return;
        // Safety grace period: Never swing within the first 8 seconds of connecting/spawning
        // to prevent server-side lobby packet crash on Paper / GrimAC servers (e.g. FreshSMP)
        const timeSinceConnect = this.connectStartTime ? Date.now() - this.connectStartTime : 0;
        const initialDelay = timeSinceConnect < 8000 ? (8000 - timeSinceConnect) : 0;
        const baseInterval = Math.max(900, this.config.farming.swingIntervalMs || 1100);
        this.emitActivity('survival', `⚔️ Mob Farm active: Auto-swinging every ${(baseInterval / 1000).toFixed(1)}s (Auto-equip sword: ${this.config.farming.autoEquipSword ? 'ON' : 'OFF'})`);
        const runFarmingTick = async () => {
            if (!this.bot || !this.bot.entity || this.currentStatus !== 'online')
                return;
            if (this.isEatingFood)
                return; // Respect auto-eat priority
            // Ensure bot has been alive and in world for at least 8 seconds
            if (this.connectStartTime && (Date.now() - this.connectStartTime) < 8000)
                return;
            try {
                // 1. Safe Sword Selection (Check Hotbar first, avoid inventory window desyncs)
                if (this.config.farming?.autoEquipSword && Date.now() - this.lastSwordEquipCheck > 3000) {
                    this.lastSwordEquipCheck = Date.now();
                    const heldItem = this.bot.heldItem;
                    const isHoldingSword = heldItem && (heldItem.name.endsWith('_sword') || heldItem.name.includes('sword'));
                    if (!isHoldingSword && this.bot.inventory) {
                        const SWORD_NAMES = ['netherite_sword', 'diamond_sword', 'iron_sword', 'golden_sword', 'stone_sword', 'wooden_sword'];
                        // First check hotbar slots (36 to 44 in mineflayer inventory)
                        let hotbarSwordSlot = null;
                        for (let i = 0; i < 9; i++) {
                            const item = this.bot.inventory.slots[36 + i];
                            if (item && (SWORD_NAMES.includes(item.name) || item.name.endsWith('_sword'))) {
                                hotbarSwordSlot = i;
                                break;
                            }
                        }
                        if (hotbarSwordSlot !== null) {
                            this.bot.setQuickBarSlot(hotbarSwordSlot);
                        }
                        else {
                            // Not on hotbar, find in main inventory and equip safely
                            const items = this.bot.inventory.items();
                            const sword = items.find((i) => SWORD_NAMES.includes(i.name) || i.name.endsWith('_sword'));
                            if (sword) {
                                await this.bot.equip(sword, 'hand');
                                this.emitActivity('survival', `⚔️ Equipped ${sword.displayName || sword.name} from inventory`);
                            }
                        }
                    }
                }
                // 2. Mob Attack / Grinder Swing with GrimAC-safe reach & validation
                const targetMode = this.config.farming?.targetMode || 'continuous';
                // Check for nearby hostile entities within safe reach (<= 2.8 blocks, well within vanilla 3.0 limit)
                let targetEntity = null;
                if (this.bot.entities) {
                    const entities = Object.values(this.bot.entities);
                    targetEntity = entities.find((e) => {
                        if (!e || e === this.bot?.entity || !e.position || !e.isValid)
                            return false;
                        const dist = this.bot.entity.position.distanceTo(e.position);
                        if (dist > 2.8)
                            return false;
                        const name = (e.name || e.displayName || '').toLowerCase();
                        const type = (e.type || '').toLowerCase();
                        return type === 'hostile' || type === 'mob' || [
                            'enderman', 'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider',
                            'zombified_piglin', 'blaze', 'piglin', 'wither_skeleton', 'slime', 'magma_cube',
                            'drowned', 'husk', 'stray', 'witch', 'phantom', 'pillager', 'vindicator', 'ravager'
                        ].some((m) => name.includes(m));
                    });
                }
                if (targetEntity) {
                    // Look gently at entity chest height (not snap force=true)
                    try {
                        await this.bot.lookAt(targetEntity.position.offset(0, targetEntity.height ? targetEntity.height * 0.5 : 0.9, 0), false);
                    }
                    catch (e) { }
                    if (targetEntity.isValid && this.bot.entity.position.distanceTo(targetEntity.position) <= 2.8) {
                        this.bot.attack(targetEntity);
                    }
                }
                else if (targetMode === 'continuous') {
                    // In mob farm chute: swing arm into chute
                    this.bot.swingArm('right');
                }
            }
            catch (err) {
                // Safe catch
            }
        };
        if (initialDelay > 0) {
            setTimeout(() => {
                if (this.config.farming?.enabled && this.bot && this.currentStatus === 'online') {
                    this.farmingInterval = setInterval(runFarmingTick, baseInterval);
                }
            }, initialDelay);
        }
        else {
            this.farmingInterval = setInterval(runFarmingTick, baseInterval);
        }
    }
    async moveSlotItem(sourceSlot, targetSlot) {
        if (!this.bot || this.currentStatus !== 'online') {
            this.callbacks.onNotification('warn', 'Bot is offline, cannot move items', this.config.id);
            return;
        }
        try {
            if (typeof this.bot.moveSlotItem === 'function') {
                await this.bot.moveSlotItem(sourceSlot, targetSlot);
            }
            else {
                await this.bot.clickWindow(sourceSlot, 0, 0);
                await this.bot.clickWindow(targetSlot, 0, 0);
                if (this.bot.inventory?.selectedItem) {
                    await this.bot.clickWindow(sourceSlot, 0, 0);
                }
            }
            this.callbacks.onNotification('success', `Moved item between slot #${sourceSlot} and #${targetSlot}`, this.config.id);
            this.emitActivity('survival', `📦 Moved item from slot #${sourceSlot} to #${targetSlot}`);
            this.emitTelemetry();
        }
        catch (err) {
            console.error(`[VistaAFK] Failed to move slot item from ${sourceSlot} to ${targetSlot}:`, err.message);
            this.callbacks.onNotification('error', `Failed to move item: ${err.message}`, this.config.id);
        }
    }
    async setQuickBarSlot(slot) {
        if (!this.bot || this.currentStatus !== 'online')
            return;
        try {
            this.bot.setQuickBarSlot(slot);
            this.emitTelemetry();
        }
        catch (err) {
            console.error(`[VistaAFK] Failed to set quick bar slot ${slot}:`, err.message);
        }
    }
    getTelemetry() {
        if (this.bedrockClient) {
            return {
                id: this.config.id,
                name: this.config.name,
                status: this.currentStatus,
                statusMessage: this.statusMessage,
                authCodeInfo: this.authCodeInfo,
                health: 20,
                maxHealth: 20,
                hearts: 10,
                maxHearts: 10,
                food: 20,
                coordinates: { x: 0, y: 0, z: 0 },
                dimension: 'overworld',
                ping: 0,
                gamemode: 'survival',
                uptimeSeconds: this.connectStartTime ? Math.floor((Date.now() - this.connectStartTime) / 1000) : 0,
                inventoryCount: 0,
                facing: 'North',
                yaw: 0,
                pitch: 0,
                targetBlock: null,
                nearbyEntities: [],
                isPatrolling: false,
            };
        }
        if (!this.bot || !this.bot.entity) {
            return {
                id: this.config.id,
                name: this.config.name,
                status: this.currentStatus,
                statusMessage: this.statusMessage,
                authCodeInfo: this.authCodeInfo,
                health: 0,
                maxHealth: 20,
                hearts: 0,
                maxHearts: 10,
                food: 0,
                coordinates: { x: 0, y: 0, z: 0 },
                dimension: 'unknown',
                ping: 0,
                gamemode: 'survival',
                uptimeSeconds: 0,
                inventoryCount: 0,
                facing: 'North',
                yaw: 0,
                pitch: 0,
                targetBlock: null,
                nearbyEntities: [],
                isPatrolling: false,
            };
        }
        const pos = this.bot.entity.position;
        const offhand = this.bot.inventory.slots[45];
        const held = this.bot.heldItem;
        const yaw = this.bot.entity.yaw || 0;
        const pitch = this.bot.entity.pitch || 0;
        // Calculate Cardinal direction
        const deg = (((-yaw * 180 / Math.PI) % 360) + 360) % 360;
        let facing = 'South';
        if (deg >= 315 || deg < 45)
            facing = 'South';
        else if (deg >= 45 && deg < 135)
            facing = 'West';
        else if (deg >= 135 && deg < 225)
            facing = 'North';
        else
            facing = 'East';
        // Target block in crosshair
        let targetBlock = null;
        try {
            const b = this.bot.blockAtCursor ? this.bot.blockAtCursor(6) : null;
            if (b) {
                targetBlock = { name: b.name, x: b.position.x, y: b.position.y, z: b.position.z };
            }
        }
        catch (e) { }
        // Nearby entities in radar range (up to 24 blocks)
        const nearbyEntities = [];
        try {
            const myPos = this.bot.entity.position;
            for (const ent of Object.values(this.bot.entities)) {
                if (!ent || ent.id === this.bot.entity.id || !ent.position)
                    continue;
                const dx = ent.position.x - myPos.x;
                const dz = ent.position.z - myPos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist <= 24) {
                    const entName = ent.username || ent.name || ent.displayName || 'entity';
                    const isPlayer = ent.type === 'player';
                    const isHostile = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'blaze', 'ghast', 'warden', 'phantom', 'drowned'].includes(ent.name?.toLowerCase() || '');
                    nearbyEntities.push({
                        id: ent.id,
                        name: entName,
                        type: ent.type || 'mob',
                        distance: Math.round(dist * 10) / 10,
                        x: Math.round(ent.position.x * 10) / 10,
                        z: Math.round(ent.position.z * 10) / 10,
                        isPlayer,
                        isHostile,
                    });
                }
            }
            nearbyEntities.sort((a, b) => a.distance - b.distance);
        }
        catch (e) { }
        // Inventory serialization with enchantments and lore
        const inventoryList = [];
        try {
            if (this.bot.inventory && Array.isArray(this.bot.inventory.slots)) {
                for (let s = 0; s < this.bot.inventory.slots.length; s++) {
                    const it = this.bot.inventory.slots[s];
                    if (!it)
                        continue;
                    // Parse enchantments
                    const enchants = [];
                    if (Array.isArray(it.enchants)) {
                        for (const e of it.enchants) {
                            enchants.push({
                                name: e.name,
                                level: e.lvl,
                                displayName: formatEnchantName(e.name, e.lvl),
                            });
                        }
                    }
                    if (enchants.length === 0 && it.nbt?.value) {
                        const nbtVal = it.nbt.value;
                        const rawList = nbtVal.StoredEnchantments?.value?.value || nbtVal.Enchantments?.value?.value;
                        if (Array.isArray(rawList)) {
                            for (const itemEnch of rawList) {
                                const rawId = itemEnch.id?.value || itemEnch.id || 'enchantment';
                                const lvl = itemEnch.lvl?.value ?? itemEnch.lvl ?? 1;
                                enchants.push({
                                    name: String(rawId).replace(/^minecraft:/, ''),
                                    level: Number(lvl),
                                    displayName: formatEnchantName(String(rawId), Number(lvl)),
                                });
                            }
                        }
                    }
                    // Parse Lore
                    const loreLines = [];
                    if (Array.isArray(it.customLore)) {
                        for (const l of it.customLore) {
                            const cleaned = cleanMinecraftJsonText(l);
                            if (cleaned)
                                loreLines.push(cleaned);
                        }
                    }
                    if (loreLines.length === 0 && it.nbt?.value?.display?.value?.Lore?.value?.value) {
                        const rawLore = it.nbt.value.display.value.Lore.value.value;
                        if (Array.isArray(rawLore)) {
                            for (const l of rawLore) {
                                const cleaned = cleanMinecraftJsonText(typeof l === 'string' ? l : l?.value || String(l));
                                if (cleaned)
                                    loreLines.push(cleaned);
                            }
                        }
                    }
                    // Custom Name
                    let customName = undefined;
                    if (it.customName) {
                        customName = cleanMinecraftJsonText(it.customName);
                    }
                    else if (it.nbt?.value?.display?.value?.Name?.value) {
                        customName = cleanMinecraftJsonText(it.nbt.value.display.value.Name.value);
                    }
                    inventoryList.push({
                        slot: s,
                        name: it.name,
                        displayName: customName || it.displayName || it.name,
                        count: it.count,
                        maxStackSize: it.stackSize,
                        durabilityUsed: it.durabilityUsed,
                        maxDurability: it.maxDurability,
                        customName,
                        lore: loreLines.length > 0 ? loreLines : undefined,
                        enchantments: enchants.length > 0 ? enchants : undefined,
                    });
                }
            }
        }
        catch (e) { }
        const currentHealth = Math.round((this.bot.health || 0) * 10) / 10;
        const maxHealth = this.getMaxHealth();
        const hearts = Math.round((currentHealth / 2) * 10) / 10;
        const maxHearts = Math.round((maxHealth / 2) * 10) / 10;
        return {
            id: this.config.id,
            name: this.config.name,
            status: this.currentStatus,
            statusMessage: this.statusMessage,
            authCodeInfo: this.authCodeInfo,
            health: currentHealth,
            maxHealth,
            hearts,
            maxHearts,
            food: this.bot.food || 0,
            coordinates: {
                x: Math.round(pos.x * 10) / 10,
                y: Math.round(pos.y * 10) / 10,
                z: Math.round(pos.z * 10) / 10,
            },
            dimension: this.bot.game?.dimension || 'overworld',
            ping: this.bot.player?.ping || 0,
            gamemode: this.bot.game?.gameMode || 'survival',
            uptimeSeconds: this.connectStartTime ? Math.floor((Date.now() - this.connectStartTime) / 1000) : 0,
            heldItem: held?.name,
            offhandItem: offhand?.name,
            inventoryCount: this.bot.inventory ? this.bot.inventory.items().length : 0,
            inventory: inventoryList,
            selectedSlot: this.bot.quickBarSlot ?? 0,
            facing,
            yaw: Math.round(yaw * 100) / 100,
            pitch: Math.round(pitch * 100) / 100,
            targetBlock,
            nearbyEntities: nearbyEntities.slice(0, 15),
            isPatrolling: this.isPatrolling,
            isFarming: Boolean(this.config.farming?.enabled && this.currentStatus === 'online'),
        };
    }
    updateStatus(status, message) {
        this.currentStatus = status;
        if (message)
            this.statusMessage = message;
        this.emitTelemetry();
    }
    clearTimers() {
        if (this.reconnectTimeout)
            clearTimeout(this.reconnectTimeout);
        if (this.antiAfkInterval)
            clearInterval(this.antiAfkInterval);
        if (this.telemetryInterval)
            clearInterval(this.telemetryInterval);
        if (this.patrolInterval)
            clearInterval(this.patrolInterval);
        if (this.farmingInterval)
            clearInterval(this.farmingInterval);
        if (this.recurringCommandInterval)
            clearInterval(this.recurringCommandInterval);
        if (this.spawnCommandTimeout)
            clearTimeout(this.spawnCommandTimeout);
        this.reconnectTimeout = null;
        this.antiAfkInterval = null;
        this.telemetryInterval = null;
        this.patrolInterval = null;
        this.farmingInterval = null;
        this.recurringCommandInterval = null;
        this.spawnCommandTimeout = null;
    }
    setupAutoCommands() {
        if (this.recurringCommandInterval) {
            clearInterval(this.recurringCommandInterval);
            this.recurringCommandInterval = null;
        }
        if (this.spawnCommandTimeout) {
            clearTimeout(this.spawnCommandTimeout);
            this.spawnCommandTimeout = null;
        }
        // On-Spawn Auto Command (e.g. /lifesteal)
        const onSpawnCmd = this.config.survival?.onSpawnCommand?.trim();
        if (onSpawnCmd) {
            const delayMs = (this.config.survival.onSpawnDelaySeconds || 2) * 1000;
            this.spawnCommandTimeout = setTimeout(() => {
                if (this.bot && this.currentStatus === 'online') {
                    try {
                        this.bot.chat(onSpawnCmd);
                        this.emitActivity('command', `⚡ Executed spawn command: ${onSpawnCmd}`);
                        this.sendDiscordAlert(`⚡ **${this.config.name}** executed spawn command: \`${onSpawnCmd}\``);
                        this.callbacks.onChatMessage({
                            botId: this.config.id,
                            timestamp: Date.now(),
                            sender: 'AutoCommand',
                            message: `⚡ Executed spawn command: ${onSpawnCmd}`,
                            isSystem: true,
                        });
                    }
                    catch (e) { }
                }
            }, delayMs);
        }
        // Recurring Auto Command (e.g. /lifesteal every 300 seconds)
        const recurringCmd = this.config.survival?.recurringCommand?.trim();
        const intervalSec = this.config.survival?.recurringIntervalSeconds;
        if (recurringCmd && intervalSec && intervalSec > 0) {
            this.recurringCommandInterval = setInterval(() => {
                if (this.bot && this.currentStatus === 'online') {
                    try {
                        this.bot.chat(recurringCmd);
                        this.emitActivity('command', `⏱️ Executed recurring command: ${recurringCmd}`);
                        this.sendDiscordAlert(`⏱️ **${this.config.name}** executed recurring command: \`${recurringCmd}\``);
                        this.callbacks.onChatMessage({
                            botId: this.config.id,
                            timestamp: Date.now(),
                            sender: 'AutoCommand',
                            message: `⏱️ Executed recurring command: ${recurringCmd}`,
                            isSystem: true,
                        });
                    }
                    catch (e) { }
                }
            }, intervalSec * 1000);
        }
    }
    getCoordinatesString() {
        if (!this.bot?.entity?.position)
            return '0, 0, 0';
        const p = this.bot.entity.position;
        return `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    }
    async sendDiscordAlert(content) {
        const url = this.config.discordWebhookUrl?.trim();
        if (!url || !url.startsWith('http'))
            return;
        try {
            console.log(`[VistaAFK Discord Webhook] Sending: "${content}"`);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'VistaAFK Monitor',
                    avatar_url: `https://mc-heads.net/avatar/${this.config.name}/128`,
                    content,
                }),
            });
            if (res.ok) {
                console.log(`[VistaAFK Discord Webhook] Alert delivered successfully!`);
            }
            else {
                console.warn(`[VistaAFK Discord Webhook] HTTP Error ${res.status}: ${res.statusText}`);
            }
        }
        catch (e) {
            console.error('[VistaAFK Discord Webhook Failed]:', e?.message);
        }
    }
}
exports.BotInstance = BotInstance;

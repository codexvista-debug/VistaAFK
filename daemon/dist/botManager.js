"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const botInstance_js_1 = require("./botInstance.js");
class BotManager {
    bots = new Map();
    configs = new Map();
    activityLogs = new Map();
    storageFile = '';
    tokenFolder = '';
    currentUser = '';
    callbacks;
    constructor(callbacks, initialUser) {
        this.callbacks = callbacks;
        this.currentUser = (initialUser || '').trim().toLowerCase();
        this.initPaths();
        this.loadConfigs();
    }
    initPaths() {
        const cleanUser = this.currentUser.replace(/[^a-z0-9_-]/g, '_');
        this.storageFile = cleanUser
            ? path_1.default.resolve(process.cwd(), `bots_${cleanUser}.json`)
            : path_1.default.resolve(process.cwd(), 'bots.json');
        // Central tokens directory: all bots and discovery read from this location
        this.tokenFolder = path_1.default.resolve(process.cwd(), 'tokens');
        if (!fs_1.default.existsSync(this.tokenFolder)) {
            try {
                fs_1.default.mkdirSync(this.tokenFolder, { recursive: true });
            }
            catch (e) { }
        }
        // Auto-migrate any legacy user-subfolder tokens into the central tokenFolder
        if (cleanUser) {
            const userSubfolder = path_1.default.resolve(process.cwd(), 'tokens', cleanUser);
            if (fs_1.default.existsSync(userSubfolder)) {
                try {
                    const files = fs_1.default.readdirSync(userSubfolder);
                    for (const f of files) {
                        const src = path_1.default.join(userSubfolder, f);
                        const dst = path_1.default.join(this.tokenFolder, f);
                        if (!fs_1.default.existsSync(dst) && fs_1.default.statSync(src).isFile()) {
                            fs_1.default.copyFileSync(src, dst);
                            console.log(`[VistaAFK Daemon] Migrated cached token: ${f} -> central tokens/`);
                        }
                    }
                }
                catch (e) { }
            }
        }
    }
    getTokenFolder() {
        return this.tokenFolder;
    }
    getCurrentUser() {
        return this.currentUser;
    }
    setUser(newUser) {
        const clean = (newUser || '').trim().toLowerCase();
        if (!clean || clean === this.currentUser)
            return;
        console.log(`[VistaAFK Daemon] Setting user context: "${this.currentUser}" -> "${clean}"`);
        // Only stop and clear bots if switching from one explicit user to another explicit user
        if (this.currentUser !== '') {
            this.stopAll();
            this.bots.clear();
            this.configs.clear();
            this.activityLogs.clear();
        }
        this.currentUser = clean;
        this.initPaths();
        this.loadConfigs();
    }
    loadConfigs() {
        try {
            if (fs_1.default.existsSync(this.storageFile)) {
                const raw = fs_1.default.readFileSync(this.storageFile, 'utf8');
                const data = JSON.parse(raw);
                for (const cfg of data) {
                    if ((cfg.port === 19132 || cfg.id.includes('bedrock')) && cfg.edition !== 'bedrock') {
                        cfg.edition = 'bedrock';
                    }
                    this.configs.set(cfg.id, cfg);
                    this.createBotInstance(cfg);
                }
                console.log(`[VistaAFK Daemon] Loaded ${this.configs.size} bot configurations (${this.storageFile}).`);
            }
        }
        catch (err) {
            console.error('[VistaAFK Daemon] Failed to load bots storage:', err.message);
        }
    }
    saveConfigs() {
        try {
            const data = Array.from(this.configs.values());
            fs_1.default.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf8');
        }
        catch (err) {
            console.error('[VistaAFK Daemon] Failed to save bots storage:', err.message);
        }
    }
    createBotInstance(config) {
        const existing = this.bots.get(config.id);
        if (existing) {
            existing.stop();
            this.bots.delete(config.id);
        }
        if ((config.port === 19132 || config.id.includes('bedrock')) && config.edition !== 'bedrock') {
            config.edition = 'bedrock';
        }
        const instance = new botInstance_js_1.BotInstance(config, {
            onTelemetryUpdate: (t) => this.callbacks.onTelemetryUpdate(t),
            onChatMessage: (m) => this.callbacks.onChatMessage(m),
            onActivityLog: (log) => {
                const cur = this.activityLogs.get(log.botId) || [];
                const last = cur[cur.length - 1];
                if (last && last.message === log.message && Math.abs(log.timestamp - last.timestamp) < 2500) {
                    return;
                }
                this.activityLogs.set(log.botId, [...cur.slice(-50), log]);
                this.callbacks.onActivityLog(log);
            },
            onNotification: (lvl, msg, id) => this.callbacks.onNotification(lvl, msg, id),
            onConfigUpdated: (updatedCfg) => {
                this.configs.set(updatedCfg.id, updatedCfg);
                this.saveConfigs();
                this.callbacks.onConfigUpdated(updatedCfg);
            },
        }, this.tokenFolder);
        this.bots.set(config.id, instance);
        return instance;
    }
    addBot(config) {
        if ((config.port === 19132 || config.id.includes('bedrock')) && config.edition !== 'bedrock') {
            config.edition = 'bedrock';
        }
        this.configs.set(config.id, config);
        this.createBotInstance(config);
        this.saveConfigs();
        this.callbacks.onConfigAdded(config);
        this.callbacks.onNotification('info', `Added account ${config.name}`);
    }
    updateBot(config) {
        if ((config.port === 19132 || config.id.includes('bedrock')) && config.edition !== 'bedrock') {
            config.edition = 'bedrock';
        }
        this.configs.set(config.id, config);
        const existing = this.bots.get(config.id);
        if (existing) {
            existing.updateConfig(config);
        }
        else {
            this.createBotInstance(config);
        }
        this.saveConfigs();
        this.callbacks.onConfigUpdated(config);
    }
    removeBot(botId) {
        const instance = this.bots.get(botId);
        if (instance) {
            instance.stop();
            this.bots.delete(botId);
        }
        this.configs.delete(botId);
        this.saveConfigs();
        this.callbacks.onConfigRemoved(botId);
    }
    startBot(botId) {
        const instance = this.bots.get(botId);
        if (instance) {
            instance.start();
        }
    }
    stopBot(botId) {
        const instance = this.bots.get(botId);
        if (instance) {
            instance.stop();
        }
    }
    startAll() {
        for (const bot of this.bots.values()) {
            bot.start();
        }
    }
    stopAll() {
        for (const bot of this.bots.values()) {
            bot.stop();
        }
    }
    sendChat(botId, message) {
        const instance = this.bots.get(botId);
        if (instance) {
            instance.sendChat(message);
        }
    }
    moveBot(botId, control, state, durationMs) {
        const instance = this.bots.get(botId);
        if (instance) {
            instance.move(control, state, durationMs);
        }
    }
    togglePatrol(botId, enabled) {
        const instance = this.bots.get(botId);
        if (instance) {
            instance.togglePatrol(enabled);
        }
    }
    lookAt(botId, yaw, pitch) {
        const instance = this.bots.get(botId);
        if (instance) {
            instance.look(yaw, pitch);
        }
    }
    attackBot(botId) {
        const instance = this.bots.get(botId);
        if (instance) {
            instance.manualAttack();
        }
    }
    moveSlotItem(botId, sourceSlot, targetSlot) {
        const instance = this.bots.get(botId);
        if (instance) {
            instance.moveSlotItem(sourceSlot, targetSlot);
        }
    }
    setQuickBarSlot(botId, slot) {
        const instance = this.bots.get(botId);
        if (instance) {
            instance.setQuickBarSlot(slot);
        }
    }
    getAllConfigs() {
        return Array.from(this.configs.values());
    }
    getAllTelemetry() {
        const res = {};
        for (const [id, bot] of this.bots.entries()) {
            res[id] = bot.getTelemetry();
        }
        return res;
    }
    getAllActivityLogs() {
        const res = {};
        for (const [id, logs] of this.activityLogs.entries()) {
            res[id] = logs;
        }
        return res;
    }
}
exports.BotManager = BotManager;

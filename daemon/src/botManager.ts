import fs from 'fs';
import path from 'path';
import { BotConfig, BotTelemetry, ChatMessage, ActivityLog } from './types.js';
import { BotInstance } from './botInstance.js';

export interface BotManagerCallbacks {
  onTelemetryUpdate: (telemetry: BotTelemetry) => void;
  onChatMessage: (message: ChatMessage) => void;
  onActivityLog: (log: ActivityLog) => void;
  onNotification: (level: 'info' | 'warn' | 'error' | 'success', message: string, botId?: string) => void;
  onConfigAdded: (config: BotConfig) => void;
  onConfigUpdated: (config: BotConfig) => void;
  onConfigRemoved: (botId: string) => void;
}

export class BotManager {
  private bots: Map<string, BotInstance> = new Map();
  private configs: Map<string, BotConfig> = new Map();
  private activityLogs: Map<string, ActivityLog[]> = new Map();
  private storageFile: string = '';
  private tokenFolder: string = '';
  private currentUser: string = '';
  private callbacks: BotManagerCallbacks;

  constructor(callbacks: BotManagerCallbacks, initialUser?: string) {
    this.callbacks = callbacks;
    this.currentUser = (initialUser || '').trim().toLowerCase();
    this.initPaths();
    this.loadConfigs();
  }

  private initPaths() {
    const cleanUser = this.currentUser.replace(/[^a-z0-9_-]/g, '_');
    this.storageFile = cleanUser
      ? path.resolve(process.cwd(), `bots_${cleanUser}.json`)
      : path.resolve(process.cwd(), 'bots.json');

    // Central tokens directory: all bots and discovery read from this location
    this.tokenFolder = path.resolve(process.cwd(), 'tokens');
    if (!fs.existsSync(this.tokenFolder)) {
      try {
        fs.mkdirSync(this.tokenFolder, { recursive: true });
      } catch (e) {}
    }

    // Auto-migrate any legacy user-subfolder tokens into the central tokenFolder
    if (cleanUser) {
      const userSubfolder = path.resolve(process.cwd(), 'tokens', cleanUser);
      if (fs.existsSync(userSubfolder)) {
        try {
          const files = fs.readdirSync(userSubfolder);
          for (const f of files) {
            const src = path.join(userSubfolder, f);
            const dst = path.join(this.tokenFolder, f);
            if (!fs.existsSync(dst) && fs.statSync(src).isFile()) {
              fs.copyFileSync(src, dst);
              console.log(`[VistaAFK Daemon] Migrated cached token: ${f} -> central tokens/`);
            }
          }
        } catch (e) {}
      }
    }
  }

  public getTokenFolder(): string {
    return this.tokenFolder;
  }

  public getCurrentUser(): string {
    return this.currentUser;
  }

  public setUser(newUser: string) {
    const clean = (newUser || '').trim().toLowerCase();
    if (!clean || clean === this.currentUser) return;
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

  private loadConfigs() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf8');
        const data: BotConfig[] = JSON.parse(raw);
        for (const cfg of data) {
          if ((cfg.port === 19132 || cfg.id.includes('bedrock')) && cfg.edition !== 'bedrock') {
            cfg.edition = 'bedrock';
          }
          this.configs.set(cfg.id, cfg);
          this.createBotInstance(cfg);
        }
        console.log(`[VistaAFK Daemon] Loaded ${this.configs.size} bot configurations (${this.storageFile}).`);
      }
    } catch (err: any) {
      console.error('[VistaAFK Daemon] Failed to load bots storage:', err.message);
    }
  }

  private saveConfigs() {
    try {
      const data = Array.from(this.configs.values());
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err: any) {
      console.error('[VistaAFK Daemon] Failed to save bots storage:', err.message);
    }
  }

  private createBotInstance(config: BotConfig): BotInstance {
    const existing = this.bots.get(config.id);
    if (existing) {
      existing.stop();
      this.bots.delete(config.id);
    }
    if ((config.port === 19132 || config.id.includes('bedrock')) && config.edition !== 'bedrock') {
      config.edition = 'bedrock';
    }
    const instance = new BotInstance(config, {
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

  public addBot(config: BotConfig) {
    if ((config.port === 19132 || config.id.includes('bedrock')) && config.edition !== 'bedrock') {
      config.edition = 'bedrock';
    }
    this.configs.set(config.id, config);
    this.createBotInstance(config);
    this.saveConfigs();
    this.callbacks.onConfigAdded(config);
    this.callbacks.onNotification('info', `Added account ${config.name}`);
  }

  public updateBot(config: BotConfig) {
    if ((config.port === 19132 || config.id.includes('bedrock')) && config.edition !== 'bedrock') {
      config.edition = 'bedrock';
    }
    this.configs.set(config.id, config);
    const existing = this.bots.get(config.id);
    if (existing) {
      existing.updateConfig(config);
    } else {
      this.createBotInstance(config);
    }
    this.saveConfigs();
    this.callbacks.onConfigUpdated(config);
  }

  public removeBot(botId: string) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.stop();
      this.bots.delete(botId);
    }
    this.configs.delete(botId);
    this.saveConfigs();
    this.callbacks.onConfigRemoved(botId);
  }

  public startBot(botId: string) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.start();
    }
  }

  public stopBot(botId: string) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.stop();
    }
  }

  public startAll() {
    for (const bot of this.bots.values()) {
      bot.start();
    }
  }

  public stopAll() {
    for (const bot of this.bots.values()) {
      bot.stop();
    }
  }

  public sendChat(botId: string, message: string) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.sendChat(message);
    }
  }

  public moveBot(botId: string, control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', state: boolean, durationMs?: number) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.move(control, state, durationMs);
    }
  }

  public togglePatrol(botId: string, enabled: boolean) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.togglePatrol(enabled);
    }
  }

  public lookAt(botId: string, yaw: number, pitch: number) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.look(yaw, pitch);
    }
  }

  public attackBot(botId: string) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.manualAttack();
    }
  }

  public moveSlotItem(botId: string, sourceSlot: number, targetSlot: number) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.moveSlotItem(sourceSlot, targetSlot);
    }
  }

  public setQuickBarSlot(botId: string, slot: number) {
    const instance = this.bots.get(botId);
    if (instance) {
      instance.setQuickBarSlot(slot);
    }
  }

  public getAllConfigs(): BotConfig[] {
    return Array.from(this.configs.values());
  }

  public getAllTelemetry(): Record<string, BotTelemetry> {
    const res: Record<string, BotTelemetry> = {};
    for (const [id, bot] of this.bots.entries()) {
      res[id] = bot.getTelemetry();
    }
    return res;
  }

  public getAllActivityLogs(): Record<string, ActivityLog[]> {
    const res: Record<string, ActivityLog[]> = {};
    for (const [id, logs] of this.activityLogs.entries()) {
      res[id] = logs;
    }
    return res;
  }
}


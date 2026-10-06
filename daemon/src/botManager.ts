import fs from 'fs';
import path from 'path';
import { BotConfig, BotTelemetry, ChatMessage } from './types.js';
import { BotInstance } from './botInstance.js';

export interface BotManagerCallbacks {
  onTelemetryUpdate: (telemetry: BotTelemetry) => void;
  onChatMessage: (message: ChatMessage) => void;
  onNotification: (level: 'info' | 'warn' | 'error' | 'success', message: string, botId?: string) => void;
  onConfigAdded: (config: BotConfig) => void;
  onConfigUpdated: (config: BotConfig) => void;
  onConfigRemoved: (botId: string) => void;
}

export class BotManager {
  private bots: Map<string, BotInstance> = new Map();
  private configs: Map<string, BotConfig> = new Map();
  private storageFile: string;
  private callbacks: BotManagerCallbacks;

  constructor(callbacks: BotManagerCallbacks) {
    this.callbacks = callbacks;
    this.storageFile = path.resolve(process.cwd(), 'bots.json');
    this.loadConfigs();
  }

  private loadConfigs() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf8');
        const data: BotConfig[] = JSON.parse(raw);
        for (const cfg of data) {
          this.configs.set(cfg.id, cfg);
          this.createBotInstance(cfg);
        }
        console.log(`[VistaAFK Daemon] Loaded ${this.configs.size} bot configurations.`);
      }
    } catch (err: any) {
      console.error('[VistaAFK Daemon] Failed to load bots.json:', err.message);
    }
  }

  private saveConfigs() {
    try {
      const data = Array.from(this.configs.values());
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err: any) {
      console.error('[VistaAFK Daemon] Failed to save bots.json:', err.message);
    }
  }

  private createBotInstance(config: BotConfig): BotInstance {
    const instance = new BotInstance(config, {
      onTelemetryUpdate: (t) => this.callbacks.onTelemetryUpdate(t),
      onChatMessage: (m) => this.callbacks.onChatMessage(m),
      onNotification: (lvl, msg, id) => this.callbacks.onNotification(lvl, msg, id),
    });
    this.bots.set(config.id, instance);
    return instance;
  }

  public addBot(config: BotConfig) {
    this.configs.set(config.id, config);
    this.createBotInstance(config);
    this.saveConfigs();
    this.callbacks.onConfigAdded(config);
    this.callbacks.onNotification('info', `Added account ${config.name}`);
  }

  public updateBot(config: BotConfig) {
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
}

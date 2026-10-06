import mineflayer, { Bot } from 'mineflayer';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { BotConfig, BotTelemetry, ChatMessage } from './types.js';
import path from 'path';

export interface BotInstanceCallbacks {
  onTelemetryUpdate: (telemetry: BotTelemetry) => void;
  onChatMessage: (message: ChatMessage) => void;
  onNotification: (level: 'info' | 'warn' | 'error' | 'success', message: string, botId?: string) => void;
}

function parseMinecraftChat(raw: any): string {
  if (!raw) return 'Unknown reason';
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parseMinecraftChat(parsed);
    } catch {
      return raw;
    }
  }
  // Check NBT compound format
  if (raw.type === 'compound' && raw.value) {
    let text = '';
    if (raw.value.text?.value) text += raw.value.text.value;
    if (raw.value.extra?.value?.value) {
      const extraList = raw.value.extra.value.value;
      for (const item of extraList) {
        if (Array.isArray(item)) {
          for (const sub of item) {
            if (sub.text?.value) text += sub.text.value;
          }
        } else if (item.text?.value) {
          text += item.text.value;
        }
      }
    }
    return text.replace(/\n+/g, ' ').trim() || JSON.stringify(raw);
  }
  // Standard Mojang Chat component
  if (raw.text) {
    let text = raw.text;
    if (Array.isArray(raw.extra)) {
      for (const part of raw.extra) {
        text += typeof part === 'string' ? part : (part.text || '');
      }
    }
    return text.replace(/\n+/g, ' ').trim();
  }
  return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
}

export class BotInstance {
  public config: BotConfig;
  private bot: Bot | null = null;
  private callbacks: BotInstanceCallbacks;
  private isManuallyStopped: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private antiAfkInterval: NodeJS.Timeout | null = null;
  private telemetryInterval: NodeJS.Timeout | null = null;
  private connectStartTime: number = 0;
  private currentStatus: BotTelemetry['status'] = 'offline';
  private statusMessage: string = 'Offline';
  private authCodeInfo?: BotTelemetry['authCodeInfo'];
  private reconnectAttempts: number = 0;

  constructor(config: BotConfig, callbacks: BotInstanceCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  public updateConfig(newConfig: BotConfig) {
    this.config = newConfig;
    if (this.bot && this.currentStatus === 'online') {
      this.setupAntiAfk();
    }
  }

  public start() {
    if (this.bot) {
      this.callbacks.onNotification('info', `Bot ${this.config.name} is already starting or running.`, this.config.id);
      return;
    }

    this.isManuallyStopped = false;
    this.clearTimers();
    this.updateStatus('connecting', 'Connecting to Minecraft server...');

    const tokenFolder = path.resolve(process.cwd(), 'tokens');

    const options: mineflayer.BotOptions = {
      host: this.config.host,
      port: this.config.port || 25565,
      username: this.config.name,
      auth: this.config.authType === 'microsoft' ? 'microsoft' : 'offline',
      profilesFolder: tokenFolder,
      version: this.config.version || undefined,
      hideErrors: true,
      onMsaCode: (data: { user_code: string; verification_uri: string; expires_in: number }) => {
        this.authCodeInfo = {
          userCode: data.user_code,
          verificationUri: data.verification_uri,
          expiresIn: data.expires_in,
        };
        this.updateStatus('authenticating', `Device Code: ${data.user_code}`);
        this.callbacks.onNotification(
          'warn',
          `Microsoft Auth required for ${this.config.name}: Visit ${data.verification_uri} and enter code ${data.user_code}`,
          this.config.id
        );
      },
    };

    // Proxy support if configured
    if (this.config.proxyUrl) {
      try {
        const agent = new SocksProxyAgent(this.config.proxyUrl);
        (options as any).agent = agent;
      } catch (err: any) {
        this.callbacks.onNotification('error', `Invalid proxy URL for ${this.config.name}: ${err.message}`, this.config.id);
      }
    }

    try {
      this.bot = mineflayer.createBot(options);
      this.bindBotEvents();
    } catch (err: any) {
      this.updateStatus('error', err.message || 'Initialization failed');
      this.handleReconnect();
    }
  }

  public stop() {
    this.isManuallyStopped = true;
    this.clearTimers();
    if (this.bot) {
      try {
        this.bot.quit('VistaAFK: Disconnected by user');
      } catch (e) {
        // ignore
      }
      this.bot = null;
    }
    this.updateStatus('offline', 'Disconnected');
  }

  public sendChat(message: string) {
    if (!this.bot || this.currentStatus !== 'online') {
      this.callbacks.onNotification('error', `Cannot send chat: ${this.config.name} is offline.`, this.config.id);
      return;
    }
    try {
      this.bot.chat(message);
    } catch (err: any) {
      this.callbacks.onNotification('error', `Failed to send chat: ${err.message}`, this.config.id);
    }
  }

  private bindBotEvents() {
    if (!this.bot) return;

    this.bot.once('spawn', () => {
      this.connectStartTime = Date.now();
      this.reconnectAttempts = 0;
      this.authCodeInfo = undefined;
      this.updateStatus('online', 'Connected and spawned in world');
      this.callbacks.onNotification('success', `${this.config.name} has entered the world!`, this.config.id);
      this.sendDiscordAlert(`🟢 **${this.config.name}** connected to \`${this.config.host}:${this.config.port}\``);

      this.setupAntiAfk();
      this.setupTelemetryLoop();
      this.checkSurvivalActions();
    });

    this.bot.on('chat', (username: string, message: string) => {
      if (username === this.bot?.username) return;
      this.callbacks.onChatMessage({
        botId: this.config.id,
        timestamp: Date.now(),
        sender: username,
        message,
        isSystem: false,
      });

      // Notify if whispered
      if (message.toLowerCase().includes('whisper') || message.toLowerCase().includes('-> me')) {
        this.sendDiscordAlert(`💬 **${this.config.name}** received a whisper from **${username}**: "${message}"`);
      }
    });

    this.bot.on('messagestr', (message: string, position: string) => {
      if (position === 'system' || position === 'game_info') {
        this.callbacks.onChatMessage({
          botId: this.config.id,
          timestamp: Date.now(),
          sender: 'Server',
          message,
          isSystem: true,
        });
      }
    });

    this.bot.on('health', () => {
      this.emitTelemetry();
      this.checkSurvivalActions();
    });

    // Auto accept resource packs (critical for SMP sub-servers like Lifesteal with custom packs)
    (this.bot as any).on('resourcePack', (url: string, hash: string) => {
      try {
        this.bot?.acceptResourcePack();
      } catch (e) {
        // ignore
      }
    });

    this.bot.on('respawn', () => {
      this.setupAntiAfk();
      this.checkSurvivalActions();
    });

    this.bot.on('death', () => {
      this.callbacks.onNotification('error', `${this.config.name} died in the world!`, this.config.id);
      this.sendDiscordAlert(`☠️ **${this.config.name}** died at [${this.getCoordinatesString()}]`);
      setTimeout(() => {
        try {
          this.bot?.respawn();
        } catch (e) {
          // ignore
        }
      }, 1500);
    });

    this.bot.on('kicked', (reason: any) => {
      const cleanReason = parseMinecraftChat(reason);
      this.updateStatus('offline', `Kicked: ${cleanReason}`);
      this.callbacks.onNotification('warn', `${this.config.name} was kicked: ${cleanReason}`, this.config.id);
      this.sendDiscordAlert(`⚠️ **${this.config.name}** was kicked: \`${cleanReason}\``);
    });

    this.bot.on('error', (err: any) => {
      let friendlyMsg = err?.message || 'Connection failed';
      if (friendlyMsg.includes('ECONNREFUSED')) {
        friendlyMsg = `Cannot connect to ${this.config.host}:${this.config.port} — no Minecraft server is running there.`;
      } else if (friendlyMsg.includes('ENOTFOUND')) {
        friendlyMsg = `Server address not found: ${this.config.host}`;
      } else if (friendlyMsg.includes('ETIMEDOUT')) {
        friendlyMsg = `Connection to ${this.config.host}:${this.config.port} timed out.`;
      }
      this.updateStatus('error', friendlyMsg);
      this.callbacks.onNotification('error', `[${this.config.name}] ${friendlyMsg}`, this.config.id);
    });

    this.bot.on('end', () => {
      this.clearTimers();
      this.bot = null;
      if (!this.isManuallyStopped) {
        this.handleReconnect();
      } else {
        this.updateStatus('offline', 'Disconnected');
      }
    });
  }

  private setupAntiAfk() {
    if (this.antiAfkInterval) clearInterval(this.antiAfkInterval);
    if (!this.config.antiAfk.enabled) return;

    const intervalMs = Math.max(3, this.config.antiAfk.intervalSeconds || 10) * 1000;

    this.antiAfkInterval = setInterval(() => {
      if (!this.bot || !this.bot.entity) return;

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
        if (jump && (this.bot.entity as any).onGround && Math.random() > 0.6) {
          this.bot.setControlState('jump', true);
          setTimeout(() => this.bot?.setControlState('jump', false), 250);
        }

        // 4. Arm swing
        if (swingArm && Math.random() > 0.3) {
          this.bot.swingArm('right');
        }
      } catch (err) {
        // Silently tolerate anti-afk action failure during chunk transitions
      }
    }, intervalMs);
  }

  private checkSurvivalActions() {
    if (!this.bot) return;

    // 1. Auto Totem
    if (this.config.survival.autoTotem && this.bot.inventory) {
      try {
        const offhand = (this.bot.inventory.slots as any)[45];
        if (!offhand || offhand.name !== 'totem_of_undying') {
          const totem = this.bot.inventory.items().find(i => i.name === 'totem_of_undying');
          if (totem) {
            this.bot.equip(totem, 'off-hand').catch(() => {});
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // 2. Auto Eat
    if (this.config.survival.autoEat && this.bot.food < (this.config.survival.eatThreshold || 14)) {
      if ((this.bot as any).autoEat) {
        // if autoEat plugin exists
        return;
      }
      try {
        const food = this.bot.inventory.items().find(i =>
          ['golden_carrot', 'cooked_beef', 'cooked_porkchop', 'bread', 'baked_potato', 'cooked_mutton', 'cooked_chicken', 'apple'].includes(i.name)
        );
        if (food && !(this.bot as any).isEating) {
          this.bot.equip(food, 'hand').then(() => {
            this.bot?.consume().catch(() => {});
          }).catch(() => {});
        }
      } catch (e) {
        // ignore
      }
    }
  }

  private handleReconnect() {
    if (!this.config.autoReconnect || this.isManuallyStopped) {
      this.updateStatus('offline', 'Disconnected');
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff capped at 60 seconds
    const delay = Math.min(60000, (this.config.reconnectDelayMs || 5000) * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 5)));
    this.updateStatus('reconnecting', `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimeout = setTimeout(() => {
      this.start();
    }, delay);
  }

  private setupTelemetryLoop() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    this.telemetryInterval = setInterval(() => {
      this.emitTelemetry();
      this.checkSurvivalActions();
    }, 2000);
  }

  private emitTelemetry() {
    this.callbacks.onTelemetryUpdate(this.getTelemetry());
  }

  public getTelemetry(): BotTelemetry {
    if (!this.bot || !this.bot.entity) {
      return {
        id: this.config.id,
        name: this.config.name,
        status: this.currentStatus,
        statusMessage: this.statusMessage,
        authCodeInfo: this.authCodeInfo,
        health: 0,
        maxHealth: 20,
        food: 0,
        coordinates: { x: 0, y: 0, z: 0 },
        dimension: 'unknown',
        ping: 0,
        gamemode: 'survival',
        uptimeSeconds: 0,
        inventoryCount: 0,
      };
    }

    const pos = this.bot.entity.position;
    const offhand = (this.bot.inventory.slots as any)[45];
    const held = this.bot.heldItem;

    return {
      id: this.config.id,
      name: this.config.name,
      status: this.currentStatus,
      statusMessage: this.statusMessage,
      authCodeInfo: this.authCodeInfo,
      health: this.bot.health || 0,
      maxHealth: 20,
      food: this.bot.food || 0,
      coordinates: {
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
        z: Math.round(pos.z * 10) / 10,
      },
      dimension: (this.bot.game as any)?.dimension || 'overworld',
      ping: (this.bot.player as any)?.ping || 0,
      gamemode: (this.bot.game as any)?.gameMode || 'survival',
      uptimeSeconds: this.connectStartTime ? Math.floor((Date.now() - this.connectStartTime) / 1000) : 0,
      heldItem: held?.name,
      offhandItem: offhand?.name,
      inventoryCount: this.bot.inventory ? this.bot.inventory.items().length : 0,
    };
  }

  private updateStatus(status: BotTelemetry['status'], message?: string) {
    this.currentStatus = status;
    if (message) this.statusMessage = message;
    this.emitTelemetry();
  }

  private clearTimers() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.antiAfkInterval) clearInterval(this.antiAfkInterval);
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    this.reconnectTimeout = null;
    this.antiAfkInterval = null;
    this.telemetryInterval = null;
  }

  private getCoordinatesString(): string {
    if (!this.bot?.entity?.position) return '0, 0, 0';
    const p = this.bot.entity.position;
    return `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
  }

  private async sendDiscordAlert(content: string) {
    const url = this.config.discordWebhookUrl;
    if (!url || !url.startsWith('http')) return;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'VistaAFK Monitor',
          avatar_url: `https://mc-heads.net/avatar/${this.config.name}/128`,
          content,
        }),
      });
    } catch (e) {
      // ignore webhook failures
    }
  }
}

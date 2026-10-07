import mineflayer, { Bot } from 'mineflayer';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { BotConfig, BotTelemetry, ChatMessage, ActivityLog, InventoryItem, ItemEnchantment } from './types.js';
import path from 'path';

export interface BotInstanceCallbacks {
  onTelemetryUpdate: (telemetry: BotTelemetry) => void;
  onChatMessage: (message: ChatMessage) => void;
  onActivityLog?: (log: ActivityLog) => void;
  onNotification: (level: 'info' | 'warn' | 'error' | 'success', message: string, botId?: string) => void;
}

function romanNumeral(num: number): string {
  const romanMap: [number, string][] = [
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

function formatEnchantName(rawId: string, lvl: number): string {
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

function cleanMinecraftJsonText(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') {
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        return cleanMinecraftJsonText(parsed);
      } catch (e) {}
    }
    return raw.replace(/§[0-9a-fk-or]/gi, '').trim();
  }
  if (typeof raw === 'object') {
    let out = '';
    if (raw.text) out += raw.text;
    if (Array.isArray(raw.extra)) {
      for (const ex of raw.extra) {
        out += cleanMinecraftJsonText(ex);
      }
    }
    if (raw.value) {
      if (typeof raw.value === 'string') out += raw.value;
      else if (Array.isArray(raw.value)) out += raw.value.map(cleanMinecraftJsonText).join(' ');
    }
    return out.replace(/§[0-9a-fk-or]/gi, '').trim();
  }
  return String(raw).replace(/§[0-9a-fk-or]/gi, '').trim();
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
  // Standard Mojang Chat component or extra array
  if (raw.text !== undefined || raw.extra) {
    let text = raw.text || '';
    if (Array.isArray(raw.extra)) {
      for (const part of raw.extra) {
        if (typeof part === 'string') {
          text += part;
        } else if (part && typeof part === 'object') {
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
  private patrolInterval: NodeJS.Timeout | null = null;
  private isPatrolling: boolean = false;
  private farmingInterval: NodeJS.Timeout | null = null;
  private lastSwordEquipCheck: number = 0;
  private recurringCommandInterval: NodeJS.Timeout | null = null;
  private spawnCommandTimeout: NodeJS.Timeout | null = null;
  private lastChatText: string = '';
  private lastChatTimestamp: number = 0;
  private lastAntiAfkLogTime: number = 0;
  private isEatingFood: boolean = false;
  private customMaxHealth: number = 0;
  private recordedMaxHealth: number = 0;

  constructor(config: BotConfig, callbacks: BotInstanceCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  private emitActivity(type: ActivityLog['type'], message: string) {
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

  private formatUptime(seconds: number): string {
    if (!seconds || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  private getSessionUptime(): string {
    const sec = this.connectStartTime ? Math.floor((Date.now() - this.connectStartTime) / 1000) : 0;
    return this.formatUptime(sec);
  }


  public updateConfig(newConfig: BotConfig) {
    this.config = newConfig;
    if (this.bot && this.currentStatus === 'online') {
      this.setupAntiAfk();
      this.setupAutoCommands();
      this.setupFarming();
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
    this.emitActivity('connect', `Connecting to ${this.config.host}:${this.config.port || 25565}...`);

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
        this.emitActivity('status', `Microsoft Auth Required: Visit ${data.verification_uri} (Code: ${data.user_code})`);
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
    const uptime = this.getSessionUptime();
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
    if (this.connectStartTime) {
      this.emitActivity('disconnect', `⏹️ Disconnected by user (Session Uptime: ${uptime})`);
      this.sendDiscordAlert(`🔴 **${this.config.name}** disconnected from \`${this.config.host}:${this.config.port || 25565}\` (Session Uptime: ${uptime})`);
      this.connectStartTime = 0;
    }
  }

  public sendChat(message: string) {
    if (!this.bot || this.currentStatus !== 'online') {
      this.callbacks.onNotification('error', `Cannot send chat: ${this.config.name} is offline.`, this.config.id);
      return;
    }
    try {
      this.bot.chat(message);
      if (message.startsWith('/')) {
        this.emitActivity('command', `⚡ Executed command: ${message}`);
        this.sendDiscordAlert(`⚡ **${this.config.name}** typed command: \`${message}\``);
      } else {
        this.emitActivity('chat', `💬 Sent chat: "${message}"`);
      }
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

      const dimension = (this.bot?.game as any)?.dimension || 'Overworld';
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

    this.bot.on('chat', (username: string, message: string) => {
      if (username === this.bot?.username) return;

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

    this.bot.on('messagestr', (message: string, position: string) => {
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

    const handleAttrPacket = (packet: any) => {
      if (!this.bot) return;
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
                  if (mod.operation === 0) op0 += (mod.amount || 0);
                  else if (mod.operation === 1) op1 += (mod.amount || 0);
                  else if (mod.operation === 2) op2 *= (1 + (mod.amount || 0));
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

    (this.bot as any)._client?.on('entity_update_attributes', handleAttrPacket);
    (this.bot as any)._client?.on('update_attributes', handleAttrPacket);

    // Auto accept resource packs (critical for SMP sub-servers like Lifesteal with custom packs)
    (this.bot as any).on('resourcePack', (url: string, hash: string) => {
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
      } catch (e) {
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
        } catch (e) {
          // ignore
        }
      }, 1500);
    });

    this.bot.on('kicked', (reason: any) => {
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
      } else {
        this.updateStatus('offline', 'Disconnected');
      }
    });
  }

  private setupAntiAfk() {
    if (this.antiAfkInterval) clearInterval(this.antiAfkInterval);
    if (!this.config.antiAfk.enabled) return;

    const intervalMs = Math.max(3, this.config.antiAfk.intervalSeconds || 10) * 1000;

    // Log routine once initially or every 10 mins
    if (Date.now() - this.lastAntiAfkLogTime > 600000) {
      this.emitActivity('anti_afk', '🛡️ Anti-AFK routine active');
      this.lastAntiAfkLogTime = Date.now();
    }

    this.antiAfkInterval = setInterval(() => {
      if (!this.bot || !this.bot.entity) return;
      if (this.isEatingFood) return; // Never interrupt eating motion

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

  public getMaxHealth(): number {
    if (!this.bot) return 20;

    // 0. Use explicitly captured customMaxHealth from packets
    if (this.customMaxHealth && this.customMaxHealth > 0) {
      return this.customMaxHealth;
    }

    // 1. Check entity attributes (minecraft:generic.max_health)
    const entityAny = this.bot.entity as any;
    if (entityAny?.attributes) {
      const attr =
        entityAny.attributes['minecraft:generic.max_health'] ||
        entityAny.attributes['generic.max_health'];

      if (attr && typeof attr.value === 'number' && attr.value > 0) {
        let finalVal = attr.value;
        if (Array.isArray(attr.modifiers) && attr.modifiers.length > 0) {
          let op0 = 0;
          let op1 = 0;
          let op2 = 1;
          for (const mod of attr.modifiers) {
            if (mod.operation === 0) op0 += (mod.amount || 0);
            else if (mod.operation === 1) op1 += (mod.amount || 0);
            else if (mod.operation === 2) op2 *= (1 + (mod.amount || 0));
          }
          finalVal = Math.max(1, (attr.value + op0) * (1 + op1) * op2);
        }
        const calculated = Math.round(finalVal * 10) / 10;
        this.recordedMaxHealth = Math.max(this.recordedMaxHealth, calculated);
        return calculated;
      }
    }

    // 2. Check scoreboard lines for "Hearts: X" (e.g. FreshSMP / Lifesteal)
    if ((this.bot as any).scoreboards) {
      try {
        const boards = Object.values((this.bot as any).scoreboards);
        for (const board of boards as any[]) {
          if (!board || !board.items) continue;
          const items = Object.values(board.items) as any[];
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
      } catch (e) {}
    }

    // 3. Check tablist / player displayName for hearts (e.g. FreshSMP tab list)
    try {
      const p = (this.bot as any).players?.[this.bot.username];
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
    } catch (e) {}

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

  private checkSurvivalActions() {
    if (!this.bot) return;

    // 1. Auto Totem
    if (this.config.survival.autoTotem && this.bot.inventory) {
      try {
        const offhand = (this.bot.inventory.slots as any)[45];
        if (!offhand || offhand.name !== 'totem_of_undying') {
          const totem = this.bot.inventory.items().find((i) => i.name === 'totem_of_undying');
          if (totem) {
            this.bot.equip(totem, 'off-hand').then(() => {
              this.emitActivity('survival', '🛡️ Auto-totem: Equipped Totem of Undying in off-hand');
            }).catch(() => {});
          }
        }
      } catch (e) {
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
              selectedFood = items.find((i) =>
                Boolean((this.bot as any)?.registry?.foodsByName?.[i.name]) &&
                !['rotten_flesh', 'pufferfish', 'poisonous_potato', 'spider_eye'].includes(i.name)
              );
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
                } catch (err: any) {
                  // Eating interrupted or failed
                } finally {
                  this.isEatingFood = false;
                  this.emitTelemetry();
                }
              })
              .catch(() => {
                this.isEatingFood = false;
              });
          }
        }
      } catch (e) {
        this.isEatingFood = false;
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
    const delaySec = Math.round(delay / 1000);
    this.updateStatus('reconnecting', `Reconnecting in ${delaySec}s (attempt ${this.reconnectAttempts})...`);
    this.emitActivity('reconnect', `🔄 Reconnecting in ${delaySec}s (attempt #${this.reconnectAttempts})...`);

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

  public togglePatrol(enabled: boolean) {
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
      if (!this.bot || !this.bot.entity) return;
      step++;
      const phase = step % 8;
      if (phase >= 0 && phase <= 2) {
        this.bot.setControlState('forward', true);
      } else if (phase === 3) {
        this.bot.setControlState('forward', false);
      } else if (phase === 4) {
        const currentYaw = this.bot.entity.yaw;
        this.bot.look(currentYaw + Math.PI, 0, true);
      } else if (phase >= 5 && phase <= 6) {
        this.bot.setControlState('forward', true);
      } else {
        this.bot.setControlState('forward', false);
        const currentYaw = this.bot.entity.yaw;
        this.bot.look(currentYaw + Math.PI, 0, true);
      }
    }, 1000);
    this.emitTelemetry();
  }

  public move(control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', state: boolean) {
    if (!this.bot || this.currentStatus !== 'online') return;
    try {
      this.bot.setControlState(control, state);
    } catch (e) {}
  }

  public look(yaw: number, pitch: number) {
    if (!this.bot || this.currentStatus !== 'online') return;
    try {
      this.bot.look(yaw, pitch, true);
    } catch (e) {}
  }

  public setupFarming() {
    if (this.farmingInterval) {
      clearInterval(this.farmingInterval);
      this.farmingInterval = null;
    }
    if (!this.config.farming?.enabled || !this.bot || this.currentStatus !== 'online') return;

    const swingInterval = Math.max(300, this.config.farming.swingIntervalMs || 900);
    this.emitActivity('survival', `⚔️ Mob Farm active: Auto-swinging every ${(swingInterval / 1000).toFixed(1)}s (Auto-equip sword: ${this.config.farming.autoEquipSword ? 'ON' : 'OFF'})`);

    this.farmingInterval = setInterval(async () => {
      if (!this.bot || !this.bot.entity || this.currentStatus !== 'online') return;
      if (this.isEatingFood) return; // Respect auto-eat priority

      try {
        // 1. Auto Pick & Equip Sword from any slot
        if (this.config.farming?.autoEquipSword && Date.now() - this.lastSwordEquipCheck > 1500) {
          this.lastSwordEquipCheck = Date.now();
          const heldItem = this.bot.heldItem;
          const isHoldingSword = heldItem && (heldItem.name.endsWith('_sword') || heldItem.name.includes('sword'));

          if (!isHoldingSword && this.bot.inventory) {
            const SWORD_PRIORITY = [
              'netherite_sword',
              'diamond_sword',
              'iron_sword',
              'golden_sword',
              'stone_sword',
              'wooden_sword',
            ];
            const items = this.bot.inventory.items();
            let sword = items.find((i) => SWORD_PRIORITY.includes(i.name)) || items.find((i) => i.name.endsWith('_sword'));

            if (sword) {
              await this.bot.equip(sword, 'hand');
              this.emitActivity('survival', `⚔️ Auto-Equipped ${sword.displayName || sword.name} from inventory for mob farming`);
              this.emitTelemetry();
            }
          }
        }

        // 2. Mob Attack / Grinder Swing
        const targetMode = this.config.farming?.targetMode || 'continuous';

        // Check for nearby hostile entities within attack reach (3.5 blocks)
        let targetEntity: any = null;
        if (this.bot.entities) {
          const entities = Object.values(this.bot.entities);
          targetEntity = entities.find((e: any) => {
            if (!e || e === this.bot?.entity || !e.position) return false;
            const dist = this.bot!.entity.position.distanceTo(e.position);
            if (dist > 3.5) return false;
            const name = (e.name || (e as any).displayName || '').toLowerCase();
            const type = (e.type || '').toLowerCase();
            return type === 'hostile' || type === 'mob' || [
              'enderman', 'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider',
              'zombified_piglin', 'blaze', 'piglin', 'wither_skeleton', 'slime', 'magma_cube',
              'drowned', 'husk', 'stray', 'witch', 'phantom', 'pillager', 'vindicator', 'ravager'
            ].some((m) => name.includes(m));
          });
        }

        if (targetEntity) {
          try {
            await this.bot.lookAt(targetEntity.position.offset(0, targetEntity.height ? targetEntity.height * 0.7 : 1, 0), true);
          } catch (e) {}
          this.bot.attack(targetEntity);
        } else if (targetMode === 'continuous') {
          // Continuously swing arm into drop chute (for 1-hit Enderman farms & XP grinders)
          this.bot.swingArm('right');
        }
      } catch (err: any) {
        // Safe catch
      }
    }, swingInterval);
  }

  public async moveSlotItem(sourceSlot: number, targetSlot: number) {
    if (!this.bot || this.currentStatus !== 'online') {
      this.callbacks.onNotification('warn', 'Bot is offline, cannot move items', this.config.id);
      return;
    }
    try {
      if (typeof (this.bot as any).moveSlotItem === 'function') {
        await (this.bot as any).moveSlotItem(sourceSlot, targetSlot);
      } else {
        await (this.bot as any).clickWindow(sourceSlot, 0, 0);
        await (this.bot as any).clickWindow(targetSlot, 0, 0);
        if (this.bot.inventory?.selectedItem) {
          await (this.bot as any).clickWindow(sourceSlot, 0, 0);
        }
      }
      this.callbacks.onNotification('success', `Moved item between slot #${sourceSlot} and #${targetSlot}`, this.config.id);
      this.emitActivity('survival', `📦 Moved item from slot #${sourceSlot} to #${targetSlot}`);
      this.emitTelemetry();
    } catch (err: any) {
      console.error(`[VistaAFK] Failed to move slot item from ${sourceSlot} to ${targetSlot}:`, err.message);
      this.callbacks.onNotification('error', `Failed to move item: ${err.message}`, this.config.id);
    }
  }

  public async setQuickBarSlot(slot: number) {
    if (!this.bot || this.currentStatus !== 'online') return;
    try {
      this.bot.setQuickBarSlot(slot);
      this.emitTelemetry();
    } catch (err: any) {
      console.error(`[VistaAFK] Failed to set quick bar slot ${slot}:`, err.message);
    }
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
    const offhand = (this.bot.inventory.slots as any)[45];
    const held = this.bot.heldItem;
    const yaw = this.bot.entity.yaw || 0;
    const pitch = this.bot.entity.pitch || 0;

    // Calculate Cardinal direction
    const deg = (((-yaw * 180 / Math.PI) % 360) + 360) % 360;
    let facing = 'South';
    if (deg >= 315 || deg < 45) facing = 'South';
    else if (deg >= 45 && deg < 135) facing = 'West';
    else if (deg >= 135 && deg < 225) facing = 'North';
    else facing = 'East';

    // Target block in crosshair
    let targetBlock: { name: string; x: number; y: number; z: number } | null = null;
    try {
      const b = (this.bot as any).blockAtCursor ? (this.bot as any).blockAtCursor(6) : null;
      if (b) {
        targetBlock = { name: b.name, x: b.position.x, y: b.position.y, z: b.position.z };
      }
    } catch (e) {}

    // Nearby entities in radar range (up to 24 blocks)
    const nearbyEntities: Array<{ id: number; name: string; type: string; distance: number; x: number; z: number; isPlayer: boolean; isHostile: boolean }> = [];
    try {
      const myPos = this.bot.entity.position;
      for (const ent of Object.values(this.bot.entities)) {
        if (!ent || ent.id === this.bot.entity.id || !ent.position) continue;
        const dx = ent.position.x - myPos.x;
        const dz = ent.position.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= 24) {
          const entName = ent.username || ent.name || (ent as any).displayName || 'entity';
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
    } catch (e) {}

    // Inventory serialization with enchantments and lore
    const inventoryList: InventoryItem[] = [];
    try {
      if (this.bot.inventory && Array.isArray(this.bot.inventory.slots)) {
        for (let s = 0; s < this.bot.inventory.slots.length; s++) {
          const it = this.bot.inventory.slots[s];
          if (!it) continue;

          // Parse enchantments
          const enchants: ItemEnchantment[] = [];
          if (Array.isArray(it.enchants)) {
            for (const e of it.enchants) {
              enchants.push({
                name: e.name,
                level: e.lvl,
                displayName: formatEnchantName(e.name, e.lvl),
              });
            }
          }
          if (enchants.length === 0 && (it as any).nbt?.value) {
            const nbtVal = (it as any).nbt.value;
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
          const loreLines: string[] = [];
          if (Array.isArray(it.customLore)) {
            for (const l of it.customLore) {
              const cleaned = cleanMinecraftJsonText(l);
              if (cleaned) loreLines.push(cleaned);
            }
          }
          if (loreLines.length === 0 && (it as any).nbt?.value?.display?.value?.Lore?.value?.value) {
            const rawLore = (it as any).nbt.value.display.value.Lore.value.value;
            if (Array.isArray(rawLore)) {
              for (const l of rawLore) {
                const cleaned = cleanMinecraftJsonText(typeof l === 'string' ? l : l?.value || String(l));
                if (cleaned) loreLines.push(cleaned);
              }
            }
          }

          // Custom Name
          let customName: string | undefined = undefined;
          if (it.customName) {
            customName = cleanMinecraftJsonText(it.customName);
          } else if ((it as any).nbt?.value?.display?.value?.Name?.value) {
            customName = cleanMinecraftJsonText((it as any).nbt.value.display.value.Name.value);
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
    } catch (e) {}

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
      dimension: (this.bot.game as any)?.dimension || 'overworld',
      ping: (this.bot.player as any)?.ping || 0,
      gamemode: (this.bot.game as any)?.gameMode || 'survival',
      uptimeSeconds: this.connectStartTime ? Math.floor((Date.now() - this.connectStartTime) / 1000) : 0,
      heldItem: held?.name,
      offhandItem: offhand?.name,
      inventoryCount: this.bot.inventory ? this.bot.inventory.items().length : 0,
      inventory: inventoryList,
      selectedSlot: (this.bot as any).quickBarSlot ?? 0,
      facing,
      yaw: Math.round(yaw * 100) / 100,
      pitch: Math.round(pitch * 100) / 100,
      targetBlock,
      nearbyEntities: nearbyEntities.slice(0, 15),
      isPatrolling: this.isPatrolling,
      isFarming: Boolean(this.config.farming?.enabled && this.currentStatus === 'online'),
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
    if (this.patrolInterval) clearInterval(this.patrolInterval);
    if (this.farmingInterval) clearInterval(this.farmingInterval);
    if (this.recurringCommandInterval) clearInterval(this.recurringCommandInterval);
    if (this.spawnCommandTimeout) clearTimeout(this.spawnCommandTimeout);
    this.reconnectTimeout = null;
    this.antiAfkInterval = null;
    this.telemetryInterval = null;
    this.patrolInterval = null;
    this.farmingInterval = null;
    this.recurringCommandInterval = null;
    this.spawnCommandTimeout = null;
  }

  private setupAutoCommands() {
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
          } catch (e) {}
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
          } catch (e) {}
        }
      }, intervalSec * 1000);
    }
  }

  private getCoordinatesString(): string {
    if (!this.bot?.entity?.position) return '0, 0, 0';
    const p = this.bot.entity.position;
    return `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
  }

  private async sendDiscordAlert(content: string) {
    const url = this.config.discordWebhookUrl?.trim();
    if (!url || !url.startsWith('http')) return;

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
      } else {
        console.warn(`[VistaAFK Discord Webhook] HTTP Error ${res.status}: ${res.statusText}`);
      }
    } catch (e: any) {
      console.error('[VistaAFK Discord Webhook Failed]:', e?.message);
    }
  }
}

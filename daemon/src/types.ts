export type AuthType = 'microsoft' | 'offline';

export interface BotConfig {
  id: string;
  name: string;
  authType: AuthType;
  host: string;
  port: number;
  version?: string; // Optional Minecraft version override, e.g. "1.20.4"
  proxyUrl?: string; // Optional socks5://user:pass@host:port or http://...
  autoReconnect: boolean;
  reconnectDelayMs: number;
  antiAfk: {
    enabled: boolean;
    rotateHead: boolean;
    jump: boolean;
    sneak: boolean;
    swingArm: boolean;
    intervalSeconds: number;
  };
  survival: {
    autoEat: boolean;
    eatThreshold: number; // Hunger level below which bot eats (default 14)
    autoTotem: boolean;   // Equip totem to offhand if available
  };
  discordWebhookUrl?: string;
}

export type BotStatus = 'offline' | 'authenticating' | 'connecting' | 'online' | 'error' | 'reconnecting';

export interface BotTelemetry {
  id: string;
  name: string;
  status: BotStatus;
  statusMessage?: string;
  authCodeInfo?: {
    userCode: string;
    verificationUri: string;
    expiresIn: number;
  };
  health: number;
  maxHealth: number;
  food: number;
  coordinates: {
    x: number;
    y: number;
    z: number;
  };
  dimension: string;
  ping: number;
  gamemode: string;
  uptimeSeconds: number;
  heldItem?: string;
  offhandItem?: string;
  inventoryCount: number;
}

export interface ChatMessage {
  botId: string;
  timestamp: number;
  sender: string;
  message: string;
  isSystem: boolean;
}

export type ClientMessage =
  | { type: 'AUTH'; payload: { token?: string } }
  | { type: 'GET_STATE' }
  | { type: 'ADD_BOT'; payload: BotConfig }
  | { type: 'UPDATE_BOT'; payload: BotConfig }
  | { type: 'REMOVE_BOT'; payload: { botId: string } }
  | { type: 'START_BOT'; payload: { botId: string } }
  | { type: 'STOP_BOT'; payload: { botId: string } }
  | { type: 'START_ALL' }
  | { type: 'STOP_ALL' }
  | { type: 'SEND_CHAT'; payload: { botId: string; message: string } };

export type ServerMessage =
  | { type: 'AUTH_SUCCESS' }
  | { type: 'AUTH_FAILED'; payload: { reason: string } }
  | { type: 'INIT_STATE'; payload: { configs: BotConfig[]; telemetry: Record<string, BotTelemetry> } }
  | { type: 'BOT_CONFIG_ADDED'; payload: BotConfig }
  | { type: 'BOT_CONFIG_UPDATED'; payload: BotConfig }
  | { type: 'BOT_CONFIG_REMOVED'; payload: { botId: string } }
  | { type: 'TELEMETRY_UPDATE'; payload: BotTelemetry }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'NOTIFICATION'; payload: { level: 'info' | 'warn' | 'error' | 'success'; message: string; botId?: string } };

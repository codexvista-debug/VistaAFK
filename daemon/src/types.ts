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
    onSpawnCommand?: string;
    onSpawnDelaySeconds?: number;
    recurringCommand?: string;
    recurringIntervalSeconds?: number;
  };
  discordWebhookUrl?: string;
}

export type BotStatus = 'offline' | 'authenticating' | 'connecting' | 'online' | 'error' | 'reconnecting';

export interface ItemEnchantment {
  name: string;
  level: number;
  displayName: string;
}

export interface InventoryItem {
  slot: number;
  name: string;
  displayName: string;
  count: number;
  maxStackSize?: number;
  durabilityUsed?: number;
  maxDurability?: number;
  customName?: string;
  lore?: string[];
  enchantments?: ItemEnchantment[];
}

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
  inventory?: InventoryItem[];
  selectedSlot?: number;
  facing?: string;
  yaw?: number;
  pitch?: number;
  targetBlock?: { name: string; x: number; y: number; z: number } | null;
  nearbyEntities?: Array<{ id: number; name: string; type: string; distance: number; x: number; z: number; isPlayer: boolean; isHostile: boolean }>;
  isPatrolling?: boolean;
}

export interface ChatMessage {
  botId: string;
  timestamp: number;
  sender: string;
  message: string;
  isSystem: boolean;
}

export interface ActivityLog {
  id: string;
  botId: string;
  timestamp: number;
  type: 'status' | 'connect' | 'spawn' | 'command' | 'survival' | 'anti_afk' | 'disconnect' | 'reconnect' | 'chat';
  message: string;
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
  | { type: 'SEND_CHAT'; payload: { botId: string; message: string } }
  | { type: 'MOVE_BOT'; payload: { botId: string; control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak'; state: boolean } }
  | { type: 'TOGGLE_PATROL'; payload: { botId: string; enabled: boolean } }
  | { type: 'LOOK_AT'; payload: { botId: string; yaw: number; pitch: number } };

export type ServerMessage =
  | { type: 'AUTH_SUCCESS' }
  | { type: 'AUTH_FAILED'; payload: { reason: string } }
  | { type: 'INIT_STATE'; payload: { configs: BotConfig[]; telemetry: Record<string, BotTelemetry>; activityLogs?: Record<string, ActivityLog[]> } }
  | { type: 'BOT_CONFIG_ADDED'; payload: BotConfig }
  | { type: 'BOT_CONFIG_UPDATED'; payload: BotConfig }
  | { type: 'BOT_CONFIG_REMOVED'; payload: { botId: string } }
  | { type: 'TELEMETRY_UPDATE'; payload: BotTelemetry }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'ACTIVITY_LOG'; payload: ActivityLog }
  | { type: 'NOTIFICATION'; payload: { level: 'info' | 'warn' | 'error' | 'success'; message: string; botId?: string } };


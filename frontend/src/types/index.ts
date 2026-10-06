export type AuthType = 'microsoft' | 'offline';

export interface SavedAccount {
  id: string;
  name: string;
  authType: AuthType;
  notes?: string;
  createdAt: number;
}

export interface ServerPreset {
  id: string;
  name: string;
  host: string;
  port: number;
  version?: string;
}

export interface BotConfig {
  id: string;
  name: string;
  authType: AuthType;
  host: string;
  port: number;
  version?: string;
  proxyUrl?: string;
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
    eatThreshold: number;
    autoTotem: boolean;
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

export interface VistaNotification {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  botId?: string;
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SavedAccount, ServerPreset, BotConfig } from '../types';
import { supabase } from './supabase';

export interface UserRecord {
  id: string;
  username: string; // min 4 chars
  passwordHash: string;
  salt: string;
  createdAt: number;
  updatedAt: number;
  daemonUrl?: string;
  daemonDeviceType?: 'pc' | 'mobile';
  daemonDeviceLabel?: string;
  secretToken?: string;
  lastHeartbeat?: number;
  savedAccounts?: SavedAccount[];
  serverPresets?: ServerPreset[];
  botConfigs?: BotConfig[];
  botTelemetry?: Record<string, any>;
}

export interface SystemSettings {
  registrationEnabled: boolean;
  adminWidgetEnabled?: boolean;
}

export interface FleetBotInfo {
  id: string;
  name: string;
  edition: 'java' | 'bedrock';
  host: string;
  port: number;
  status: 'online' | 'offline' | 'connecting' | 'error' | 'reconnecting';
  health?: number;
  maxHealth?: number;
  food?: number;
  uptimeSeconds?: number;
  lastSeen?: number;
  dimension?: string;
}

export interface FleetAccountInfo {
  id: string;
  name: string;
  gamertag?: string;
  edition: 'java' | 'bedrock';
  authType: string;
}

export interface FleetUserInfo {
  id: string;
  username: string;
  role: 'admin' | 'user';
  isDaemonOnline: boolean;
  daemonDeviceType?: 'pc' | 'mobile';
  daemonDeviceLabel?: string;
  daemonUrl?: string;
  secretToken?: string;
  lastHeartbeat?: number;
  bots: FleetBotInfo[];
  savedAccounts: FleetAccountInfo[];
}

export interface UserSummary {
  id: string;
  username: string;
  createdAt: number;
  updatedAt: number;
  savedAccountsCount: number;
  serverPresetsCount: number;
  botConfigsCount: number;
  hasDaemon: boolean;
  role: 'admin' | 'user';
}

const SECRET_KEY = process.env.VISTAAFK_AUTH_SECRET || 'vistaafk_cloud_auth_secret_token_2026';

// In-memory cache for ultra-fast session & auth verification
const memoryCache = new Map<string, UserRecord>();

function getLocalFilePath(): string {
  const dir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  }
  return path.resolve(dir, 'users.json');
}

function loadLocalUsers(): Record<string, UserRecord> {
  try {
    const file = getLocalFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
}

function saveLocalUsers(users: Record<string, UserRecord>) {
  try {
    const file = getLocalFilePath();
    fs.writeFileSync(file, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {}
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  const clean = (username || '').trim().toLowerCase();
  if (clean.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long' };
  }
  if (clean.length > 5) {
    return { valid: false, error: 'Username can be a maximum of 5 characters' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    return { valid: false, error: 'Username may only contain letters, numbers, hyphens, and underscores' };
  }
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 4) {
    return { valid: false, error: 'Password must be at least 4 characters long' };
  }
  return { valid: true };
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return check === hash;
}

export function createSessionToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      username: username.toLowerCase().trim(),
      exp: Date.now() + 30 * 24 * 3600 * 1000, // 30 days
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64url');
    if (sig !== expectedSig) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && data.exp < Date.now()) return null;
    return data.username;
  } catch (e) {
    return null;
  }
}

// Convert Supabase database row to UserRecord
function mapRowToUser(row: any): UserRecord {
  const bots = Array.isArray(row.bot_configs) ? row.bot_configs : [];
  const firstBotWithDevice = bots.find((b: any) => b?.deviceType || b?.deviceLabel);
  const isNanov = String(row.username || '').toLowerCase() === 'nanov';

  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    daemonUrl: row.daemon_url || undefined,
    daemonDeviceType: row.daemon_device_type || firstBotWithDevice?.deviceType || (isNanov ? 'mobile' : undefined),
    daemonDeviceLabel: row.daemon_device_label || firstBotWithDevice?.deviceLabel || (isNanov ? 'Mobile (Termux)' : undefined),
    secretToken: row.secret_token || undefined,
    lastHeartbeat: row.last_heartbeat ? Number(row.last_heartbeat) : undefined,
    savedAccounts: Array.isArray(row.saved_accounts) ? row.saved_accounts : [],
    serverPresets: Array.isArray(row.server_presets) ? row.server_presets : [],
    botConfigs: bots,
  };
}

// User Record Persistence Functions
export async function getUser(rawUsername: string): Promise<UserRecord | null> {
  const username = (rawUsername || '').trim().toLowerCase();
  if (!username) return null;

  // 1. Check Supabase Postgres database first (live multi-device / multi-tab source of truth)
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (!error && data) {
      const user = mapRowToUser(data);
      const existing = memoryCache.get(username);
      if (existing) {
        if (!user.daemonDeviceType && existing.daemonDeviceType) user.daemonDeviceType = existing.daemonDeviceType;
        if (!user.daemonDeviceLabel && existing.daemonDeviceLabel) user.daemonDeviceLabel = existing.daemonDeviceLabel;
      }
      memoryCache.set(username, user);
      return user;
    }
  } catch (e) {
    console.error('[UserStore] Supabase query error:', e);
  }

  // 2. Fallback to memory cache
  if (memoryCache.has(username)) {
    return memoryCache.get(username)!;
  }

  // 3. Check local file storage (fallback)
  const localUsers = loadLocalUsers();
  if (localUsers[username]) {
    memoryCache.set(username, localUsers[username]);
    return localUsers[username];
  }

  // 4. Auto-seed master administrator 'vista' with password '897721'
  if (username === 'vista') {
    const { hash, salt } = hashPassword('897721');
    const defaultVista: UserRecord = {
      id: 'admin_vista_001',
      username: 'vista',
      passwordHash: hash,
      salt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      savedAccounts: [],
      serverPresets: [
        { id: 'donutsmp', name: 'DonutSMP', host: 'donutsmp.net', port: 25565, version: '' },
        { id: 'freshsmp', name: 'FreshSMP', host: 'play.freshsmp.fun', port: 25565, version: '' },
        { id: 'custom', name: 'Custom Server', host: '', port: 25565, version: '' },
      ],
      botConfigs: [],
    };
    try {
      await saveUser(defaultVista);
    } catch (e) {}
    return defaultVista;
  }

  return null;
}

export async function saveUser(user: UserRecord): Promise<void> {
  const username = user.username.trim().toLowerCase();
  user.username = username;
  user.updatedAt = Date.now();

  // 1. Update memory cache
  memoryCache.set(username, user);

  // 2. Save local file (for local dev fallback)
  try {
    const localUsers = loadLocalUsers();
    localUsers[username] = user;
    saveLocalUsers(localUsers);
  } catch (e) {}

  // 3. Save to Supabase Postgres database
  try {
    const payload = {
      id: user.id,
      username: user.username,
      password_hash: user.passwordHash,
      salt: user.salt,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      daemon_url: user.daemonUrl || null,
      secret_token: user.secretToken || null,
      last_heartbeat: user.lastHeartbeat || null,
      saved_accounts: user.savedAccounts || [],
      server_presets: user.serverPresets || [],
      bot_configs: user.botConfigs || [],
    };

    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'username' });
    if (error) {
      console.warn('[UserStore] Supabase saveUser notice:', error.message);
    }
  } catch (e) {
    console.error('[UserStore] Supabase saveUser error:', e);
  }
}

export async function getAllUsers(): Promise<UserSummary[]> {
  const summaries: UserSummary[] = [];
  const processed = new Set<string>();

  // 1. Fetch from Supabase
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (!error && Array.isArray(data)) {
      data.forEach((row) => {
        const u = mapRowToUser(row);
        memoryCache.set(u.username, u);
        processed.add(u.username);
        summaries.push({
          id: u.id,
          username: u.username,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          savedAccountsCount: u.savedAccounts?.length || 0,
          serverPresetsCount: u.serverPresets?.length || 0,
          botConfigsCount: u.botConfigs?.length || 0,
          hasDaemon: !!u.daemonUrl,
          role: u.username === 'vista' ? 'admin' : 'user',
        });
      });
    }
  } catch (e) {}

  // 2. Merge local file users if not yet processed
  const localUsers = loadLocalUsers();
  Object.values(localUsers).forEach((u) => {
    if (!processed.has(u.username)) {
      processed.add(u.username);
      summaries.push({
        id: u.id,
        username: u.username,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        savedAccountsCount: u.savedAccounts?.length || 0,
        serverPresetsCount: u.serverPresets?.length || 0,
        botConfigsCount: u.botConfigs?.length || 0,
        hasDaemon: !!u.daemonUrl,
        role: u.username === 'vista' ? 'admin' : 'user',
      });
    }
  });

  // Ensure vista is always in summaries
  if (!processed.has('vista')) {
    const vista = await getUser('vista');
    if (vista) {
      summaries.push({
        id: vista.id,
        username: vista.username,
        createdAt: vista.createdAt,
        updatedAt: vista.updatedAt,
        savedAccountsCount: vista.savedAccounts?.length || 0,
        serverPresetsCount: vista.serverPresets?.length || 0,
        botConfigsCount: vista.botConfigs?.length || 0,
        hasDaemon: !!vista.daemonUrl,
        role: 'admin',
      });
    }
  }

  // Sort: vista first, then alphabetically
  summaries.sort((a, b) => {
    if (a.username.toLowerCase() === 'vista') return -1;
    if (b.username.toLowerCase() === 'vista') return 1;
    return a.username.localeCompare(b.username);
  });

  return summaries;
}

export async function deleteUser(rawUsername: string): Promise<{ success: boolean; error?: string }> {
  const username = rawUsername.trim().toLowerCase();
  if (username === 'vista') {
    return { success: false, error: 'Cannot delete the primary administrator account (vista).' };
  }

  // 1. Memory cache
  memoryCache.delete(username);

  // 2. Local file
  const localUsers = loadLocalUsers();
  if (localUsers[username]) {
    delete localUsers[username];
    saveLocalUsers(localUsers);
  }

  // 3. Supabase
  try {
    await supabase.from('users').delete().eq('username', username);
  } catch (e) {}

  return { success: true };
}

export async function resetPassword(rawUsername: string, newPass: string): Promise<{ success: boolean; error?: string }> {
  const username = rawUsername.trim().toLowerCase();
  const pVal = validatePassword(newPass);
  if (!pVal.valid) {
    return { success: false, error: pVal.error };
  }

  const user = await getUser(username);
  if (!user) {
    return { success: false, error: `User "${username}" not found.` };
  }

  const { hash, salt } = hashPassword(newPass);
  user.passwordHash = hash;
  user.salt = salt;
  user.updatedAt = Date.now();

  await saveUser(user);
  return { success: true };
}

function getSettingsFilePath(): string {
  const dir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  }
  return path.resolve(dir, 'settings.json');
}

export async function getSystemSettings(): Promise<SystemSettings> {
  // 1. Supabase
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'system')
      .maybeSingle();

    if (!error && data?.value) {
      return {
        registrationEnabled: data.value.registrationEnabled ?? true,
        adminWidgetEnabled: data.value.adminWidgetEnabled ?? true,
      };
    }
  } catch (e) {}

  // 2. Local file fallback
  try {
    const file = getSettingsFilePath();
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        registrationEnabled: raw.registrationEnabled ?? true,
        adminWidgetEnabled: raw.adminWidgetEnabled ?? true,
      };
    }
  } catch (e) {}

  return { registrationEnabled: true, adminWidgetEnabled: true };
}

export async function getAllFleetUsers(): Promise<FleetUserInfo[]> {
  const users: UserRecord[] = [];
  const processed = new Set<string>();

  // 1. Fetch from Supabase
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (!error && Array.isArray(data)) {
      data.forEach((row) => {
        const u = mapRowToUser(row);
        memoryCache.set(u.username, u);
        processed.add(u.username);
        users.push(u);
      });
    }
  } catch (e) {}

  // 2. Fetch local storage fallback
  try {
    const local = loadLocalUsers();
    Object.values(local).forEach((u) => {
      if (!processed.has(u.username)) {
        memoryCache.set(u.username, u);
        processed.add(u.username);
        users.push(u);
      }
    });
  } catch (e) {}

  // Ensure vista is included
  if (!processed.has('vista')) {
    const vista = await getUser('vista');
    if (vista) users.push(vista);
  }

  const now = Date.now();
  return users.map((u) => {
    // Daemon is online if heartbeat was within last 120 seconds
    const isDaemonOnline = Boolean(u.lastHeartbeat && (now - u.lastHeartbeat) < 120000);
    const telemetryMap = (u as any).botTelemetry || {};

    const bots: FleetBotInfo[] = (u.botConfigs || []).map((bot: any) => {
      const telem = telemetryMap[bot.id] || bot.lastTelemetry || {};
      const status = telem.status || (isDaemonOnline ? 'online' : 'offline');
      const isOnline = status === 'online';
      const dimension = telem.dimension || telem.currentBiome || (isOnline ? 'Overworld' : undefined);
      return {
        id: bot.id,
        name: bot.name,
        edition: bot.edition || 'java',
        host: bot.host || 'localhost',
        port: bot.port || (bot.edition === 'bedrock' ? 19132 : 25565),
        status,
        health: telem.hearts !== undefined ? telem.hearts : (telem.health !== undefined ? Math.round((telem.health / 2) * 10) / 10 : (isOnline ? 10 : undefined)),
        maxHealth: telem.maxHearts !== undefined ? telem.maxHearts : (telem.maxHealth ? Math.round((telem.maxHealth / 2) * 10) / 10 : 10),
        food: telem.food,
        uptimeSeconds: telem.uptimeSeconds || (isOnline ? Math.max(1, Math.floor((now - (bot.onlineSince || bot.createdAt || u.lastHeartbeat || now)) / 1000)) : 0),
        lastSeen: u.lastHeartbeat,
        dimension,
      };
    });

    const savedAccounts: FleetAccountInfo[] = (u.savedAccounts || []).map((acc) => ({
      id: acc.id,
      name: acc.name,
      gamertag: acc.gamertag,
      edition: acc.edition || 'java',
      authType: acc.authType,
    }));

    const isNanov = u.username.toLowerCase() === 'nanov';
    const firstBot = (u.botConfigs || []).find((b: any) => b?.deviceType || b?.deviceLabel) as any;
    const resolvedDeviceType =
      u.daemonDeviceType ||
      firstBot?.deviceType ||
      (isNanov ? 'mobile' : undefined);
    const resolvedDeviceLabel =
      u.daemonDeviceLabel ||
      firstBot?.deviceLabel ||
      (isNanov ? 'Mobile (Termux)' : undefined);

    return {
      id: u.id,
      username: u.username,
      role: (u.username === 'vista' ? 'admin' : 'user') as 'admin' | 'user',
      isDaemonOnline,
      daemonDeviceType: resolvedDeviceType,
      daemonDeviceLabel: resolvedDeviceLabel,
      daemonUrl: u.daemonUrl,
      secretToken: u.secretToken,
      lastHeartbeat: u.lastHeartbeat,
      bots,
      savedAccounts,
    };
  }).sort((a, b) => {
    if (a.username.toLowerCase() === 'vista') return -1;
    if (b.username.toLowerCase() === 'vista') return 1;
    return a.username.localeCompare(b.username);
  });
}

export async function updateSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const updated: SystemSettings = { ...current, ...settings };

  // 1. Save local
  try {
    const file = getSettingsFilePath();
    fs.writeFileSync(file, JSON.stringify(updated, null, 2), 'utf8');
  } catch (e) {}

  // 2. Save Supabase
  try {
    await supabase.from('settings').upsert({ key: 'system', value: updated }, { onConflict: 'key' });
  } catch (e) {}

  return updated;
}

export function verifyAdmin(req: Request): { authorized: boolean; username?: string; error?: string } {
  const authHeader = req.headers.get('authorization');
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (!token) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/vistaafk_auth_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) {
    return { authorized: false, error: 'Unauthorized: Missing session token' };
  }
  const username = verifySessionToken(token);
  if (!username) {
    return { authorized: false, error: 'Unauthorized: Invalid or expired session token' };
  }
  if (username.toLowerCase() !== 'vista') {
    return { authorized: false, error: 'Forbidden: Admin access restricted to vista' };
  }
  return { authorized: true, username };
}

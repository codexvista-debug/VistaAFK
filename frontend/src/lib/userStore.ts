import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SavedAccount, ServerPreset, BotConfig } from '../types';

export interface UserRecord {
  id: string;
  username: string; // min 4 chars
  passwordHash: string;
  salt: string;
  createdAt: number;
  updatedAt: number;
  daemonUrl?: string;
  secretToken?: string;
  lastHeartbeat?: number;
  savedAccounts?: SavedAccount[];
  serverPresets?: ServerPreset[];
  botConfigs?: BotConfig[];
  cloudObjectId?: string; // Cache ID for cloud fallback store
}

const SECRET_KEY = process.env.VISTAAFK_AUTH_SECRET || 'vistaafk_cloud_auth_secret_token_2026';
const CLOUD_FALLBACK_URL = 'https://api.restful-api.dev/objects';

// In-memory memory cache for fast lookups
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
  if (clean.length < 4) {
    return { valid: false, error: 'Username must be at least 4 characters long' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    return { valid: false, error: 'Username may only contain letters, numbers, hyphens, and underscores' };
  }
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long' };
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

// User Record Persistence Functions
export async function getUser(rawUsername: string): Promise<UserRecord | null> {
  const username = (rawUsername || '').trim().toLowerCase();
  if (!username) return null;

  // 1. Check memory cache
  if (memoryCache.has(username)) {
    return memoryCache.get(username)!;
  }

  // 2. Check local file storage (dev environment)
  const localUsers = loadLocalUsers();
  if (localUsers[username]) {
    memoryCache.set(username, localUsers[username]);
    return localUsers[username];
  }

  // 3. Check Cloud Fallback (persistent across Vercel serverless lambdas)
  try {
    const cloudKey = `vistaafk_u_${username}`;
    // Query object from cloud store
    const res = await fetch(`${CLOUD_FALLBACK_URL}?name=${encodeURIComponent(cloudKey)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        // Find exact match
        const match = list.find((item: any) => item.name === cloudKey);
        if (match && match.data) {
          const userRecord: UserRecord = {
            ...match.data,
            cloudObjectId: match.id,
          };
          memoryCache.set(username, userRecord);
          return userRecord;
        }
      }
    }
  } catch (e) {
    // Cloud lookup error, ignore
  }

  // Auto-seed primary admin 'vista' if not found anywhere so it is always available
  if (username === 'vista') {
    const { hash, salt } = hashPassword('vista2026');
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
        { id: 'custom', name: 'Other / Custom Server', host: '', port: 25565, version: '' },
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

  // 2. Save local file (for local dev)
  try {
    const localUsers = loadLocalUsers();
    localUsers[username] = user;
    saveLocalUsers(localUsers);
  } catch (e) {}

  // 3. Save to Cloud Store (for Vercel serverless)
  try {
    const cloudKey = `vistaafk_u_${username}`;
    const payload = {
      name: cloudKey,
      data: {
        id: user.id,
        username: user.username,
        passwordHash: user.passwordHash,
        salt: user.salt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        daemonUrl: user.daemonUrl,
        secretToken: user.secretToken,
        lastHeartbeat: user.lastHeartbeat,
        savedAccounts: user.savedAccounts,
        serverPresets: user.serverPresets,
        botConfigs: user.botConfigs,
      },
    };

    if (user.cloudObjectId) {
      // Update existing object
      await fetch(`${CLOUD_FALLBACK_URL}/${user.cloudObjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      // Check if one already exists
      const checkRes = await fetch(`${CLOUD_FALLBACK_URL}?name=${encodeURIComponent(cloudKey)}`);
      if (checkRes.ok) {
        const list = await checkRes.json();
        const existing = Array.isArray(list) ? list.find((i: any) => i.name === cloudKey) : null;
        if (existing) {
          user.cloudObjectId = existing.id;
          await fetch(`${CLOUD_FALLBACK_URL}/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } else {
          // Create new object
          const createRes = await fetch(CLOUD_FALLBACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (createRes.ok) {
            const created = await createRes.json();
            if (created?.id) {
              user.cloudObjectId = created.id;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('[UserStore] Cloud sync warning:', e);
  }

  // 4. Track in user index
  try {
    await addUserToIndex(username);
  } catch (e) {}
}

export interface SystemSettings {
  registrationEnabled: boolean;
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

function getSettingsFilePath(): string {
  const dir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }
  return path.resolve(dir, 'settings.json');
}

export async function getSystemSettings(): Promise<SystemSettings> {
  // Check local file
  try {
    const file = getSettingsFilePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {}

  // Check cloud
  try {
    const res = await fetch(`${CLOUD_FALLBACK_URL}?name=vistaafk_system_settings`);
    if (res.ok) {
      const list = await res.json();
      const existing = Array.isArray(list) ? list.find((i: any) => i.name === 'vistaafk_system_settings') : null;
      if (existing && existing.data) {
        return existing.data;
      }
    }
  } catch (e) {}

  return { registrationEnabled: true };
}

export async function updateSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const updated: SystemSettings = { ...current, ...settings };

  // Save local
  try {
    const file = getSettingsFilePath();
    fs.writeFileSync(file, JSON.stringify(updated, null, 2), 'utf8');
  } catch (e) {}

  // Save cloud
  try {
    const res = await fetch(`${CLOUD_FALLBACK_URL}?name=vistaafk_system_settings`);
    let existingId: string | null = null;
    if (res.ok) {
      const list = await res.json();
      const existing = Array.isArray(list) ? list.find((i: any) => i.name === 'vistaafk_system_settings') : null;
      if (existing) existingId = existing.id;
    }

    const payload = {
      name: 'vistaafk_system_settings',
      data: updated,
    };

    if (existingId) {
      await fetch(`${CLOUD_FALLBACK_URL}/${existingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(CLOUD_FALLBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  } catch (e) {}

  return updated;
}

async function getUserIndex(): Promise<string[]> {
  const localUsers = loadLocalUsers();
  const set = new Set<string>(Object.keys(localUsers));

  memoryCache.forEach((_, k) => {
    set.add(k);
  });

  try {
    const res = await fetch(`${CLOUD_FALLBACK_URL}?name=vistaafk_user_index`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const item = list.find((i: any) => i.name === 'vistaafk_user_index');
        if (item && item.data && Array.isArray(item.data.usernames)) {
          for (const u of item.data.usernames) {
            set.add(u);
          }
        }
      }
    }
  } catch (e) {}

  set.add('vista');
  return Array.from(set);
}

async function addUserToIndex(username: string): Promise<void> {
  const list = await getUserIndex();
  if (!list.includes(username)) {
    list.push(username);
    await saveUserIndex(list);
  }
}

async function saveUserIndex(usernames: string[]): Promise<void> {
  try {
    const res = await fetch(`${CLOUD_FALLBACK_URL}?name=vistaafk_user_index`);
    let existingId: string | null = null;
    if (res.ok) {
      const list = await res.json();
      const existing = Array.isArray(list) ? list.find((i: any) => i.name === 'vistaafk_user_index') : null;
      if (existing) existingId = existing.id;
    }

    const payload = {
      name: 'vistaafk_user_index',
      data: { usernames },
    };

    if (existingId) {
      await fetch(`${CLOUD_FALLBACK_URL}/${existingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(CLOUD_FALLBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  } catch (e) {}
}

export async function getAllUsers(): Promise<UserSummary[]> {
  const usernames = await getUserIndex();
  const summaries: UserSummary[] = [];

  for (const u of usernames) {
    const user = await getUser(u);
    if (user) {
      summaries.push({
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        savedAccountsCount: user.savedAccounts?.length || 0,
        serverPresetsCount: user.serverPresets?.length || 0,
        botConfigsCount: user.botConfigs?.length || 0,
        hasDaemon: !!user.daemonUrl,
        role: user.username.toLowerCase() === 'vista' ? 'admin' : 'user',
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

  // 3. Cloud store
  const user = await getUser(username);
  if (user && user.cloudObjectId) {
    try {
      await fetch(`${CLOUD_FALLBACK_URL}/${user.cloudObjectId}`, {
        method: 'DELETE',
      });
    } catch (e) {}
  }

  // 4. Update index
  const index = await getUserIndex();
  const updated = index.filter(u => u !== username);
  await saveUserIndex(updated);

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

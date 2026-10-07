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
          return;
        }
      }

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
  } catch (e) {
    console.error('[UserStore] Cloud sync warning:', e);
  }
}

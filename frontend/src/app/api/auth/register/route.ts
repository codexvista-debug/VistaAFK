import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getUser,
  saveUser,
  validateUsername,
  validatePassword,
  hashPassword,
  createSessionToken,
  UserRecord,
} from '../../../../lib/userStore';

const DEFAULT_SERVER_PRESETS = [
  { id: 'donutsmp', name: 'DonutSMP', host: 'donutsmp.net', port: 25565, version: '' },
  { id: 'freshsmp', name: 'FreshSMP', host: 'play.freshsmp.fun', port: 25565, version: '' },
  { id: 'custom', name: 'Other / Custom Server', host: '', port: 25565, version: '' },
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    const uVal = validateUsername(username);
    if (!uVal.valid) {
      return NextResponse.json({ error: uVal.error }, { status: 400 });
    }

    const pVal = validatePassword(password);
    if (!pVal.valid) {
      return NextResponse.json({ error: pVal.error }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = await getUser(cleanUsername);
    if (existing) {
      return NextResponse.json(
        { error: 'Username is already taken. Please choose another username or log in.' },
        { status: 409 }
      );
    }

    const { hash, salt } = hashPassword(password);
    const newUser: UserRecord = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      passwordHash: hash,
      salt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      serverPresets: DEFAULT_SERVER_PRESETS,
      savedAccounts: [],
      botConfigs: [],
    };

    await saveUser(newUser);

    const token = createSessionToken(cleanUsername);

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        daemonUrl: newUser.daemonUrl,
        savedAccounts: newUser.savedAccounts || [],
        serverPresets: newUser.serverPresets || DEFAULT_SERVER_PRESETS,
        botConfigs: newUser.botConfigs || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Registration failed' }, { status: 500 });
  }
}

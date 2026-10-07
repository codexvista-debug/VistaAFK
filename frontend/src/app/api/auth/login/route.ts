import { NextResponse } from 'next/server';
import {
  getUser,
  validateUsername,
  validatePassword,
  verifyPassword,
  createSessionToken,
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
    const user = await getUser(cleanUsername);
    if (!user) {
      return NextResponse.json(
        { error: 'No user found with this username. Please register first.' },
        { status: 404 }
      );
    }

    const isMatch = verifyPassword(password, user.passwordHash, user.salt);
    if (!isMatch) {
      return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 401 });
    }

    const token = createSessionToken(cleanUsername);

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        daemonUrl: user.daemonUrl,
        secretToken: user.secretToken,
        lastHeartbeat: user.lastHeartbeat,
        savedAccounts: user.savedAccounts || [],
        serverPresets: user.serverPresets || DEFAULT_SERVER_PRESETS,
        botConfigs: user.botConfigs || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Login failed' }, { status: 500 });
  }
}

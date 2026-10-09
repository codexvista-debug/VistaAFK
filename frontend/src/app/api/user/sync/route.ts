import { NextResponse } from 'next/server';
import { getUser, saveUser, verifySessionToken } from '../../../../lib/userStore';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = verifySessionToken(token);
    if (!username) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const user = await getUser(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { savedAccounts, serverPresets, botConfigs, daemonUrl, secretToken, deletedAccountId } = body;

    // 1. Safe Saved Accounts Sync: Never wipe out existing accounts on empty payload
    if (deletedAccountId) {
      user.savedAccounts = (user.savedAccounts || []).filter((a) => a.id !== deletedAccountId);
    } else if (Array.isArray(savedAccounts)) {
      if (body.replaceAccounts === true) {
        user.savedAccounts = savedAccounts;
      } else {
        // Merge: keep all existing accounts, update or append newly added accounts
        const existingMap = new Map((user.savedAccounts || []).map((a) => [a.id, a]));
        for (const acc of savedAccounts) {
          if (acc && acc.id) {
            existingMap.set(acc.id, acc);
          }
        }
        user.savedAccounts = Array.from(existingMap.values());
      }
    }

    if (Array.isArray(serverPresets)) {
      user.serverPresets = serverPresets;
    }
    if (Array.isArray(botConfigs)) {
      user.botConfigs = botConfigs;
    }
    if (daemonUrl !== undefined) {
      let cleanUrl = String(daemonUrl).trim();
      const cfMatch = cleanUrl.match(/([a-zA-Z0-9-]+\.trycloudflare\.com)/i);
      if (cfMatch && cfMatch[1]) {
        cleanUrl = `wss://${cfMatch[1]}`;
      } else {
        cleanUrl = cleanUrl.replace(/^(wss?):\/+/i, '$1://');
        if (cleanUrl.startsWith('https://')) cleanUrl = 'wss://' + cleanUrl.slice('https://'.length);
        if (cleanUrl.startsWith('http://')) cleanUrl = 'ws://' + cleanUrl.slice('http://'.length);
        if (!cleanUrl.startsWith('ws://') && !cleanUrl.startsWith('wss://')) cleanUrl = 'wss://' + cleanUrl;
      }
      user.daemonUrl = cleanUrl;
    }
    if (secretToken !== undefined) {
      user.secretToken = secretToken;
    }

    await saveUser(user);

    return NextResponse.json({
      success: true,
      message: 'Cloud setup synchronized successfully',
      user: {
        id: user.id,
        username: user.username,
        daemonUrl: user.daemonUrl,
        secretToken: user.secretToken,
        savedAccounts: user.savedAccounts || [],
        serverPresets: user.serverPresets || [],
        botConfigs: user.botConfigs || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Sync failed' }, { status: 500 });
  }
}

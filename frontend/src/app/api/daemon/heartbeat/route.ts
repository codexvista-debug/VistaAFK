import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getUser,
  saveUser,
  verifyPassword,
  validateUsername,
  validatePassword,
  hashPassword,
  verifySessionToken,
  UserRecord,
} from '../../../../lib/userStore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, token, daemonUrl, secretToken, accounts, bots } = body;

    const uVal = validateUsername(username);
    if (!uVal.valid) {
      return NextResponse.json({ error: uVal.error }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    let user = await getUser(cleanUsername);

    // Verify authentication via either token or password
    let isAuthorized = false;

    if (token) {
      const verifiedUsername = verifySessionToken(token);
      if (verifiedUsername === cleanUsername) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && password) {
      if (user) {
        isAuthorized = verifyPassword(password, user.passwordHash, user.salt);
      } else {
        const pVal = validatePassword(password);
        if (pVal.valid) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Invalid authentication credentials (token or password)' },
        { status: 401 }
      );
    }

    // If user doesn't exist yet and daemon connects with password, auto-register them
    if (!user) {
      const { hash, salt } = hashPassword(password || crypto.randomBytes(16).toString('hex'));
      user = {
        id: crypto.randomUUID(),
        username: cleanUsername,
        passwordHash: hash,
        salt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        daemonUrl,
        secretToken,
        lastHeartbeat: Date.now(),
        savedAccounts: Array.isArray(accounts) ? accounts : [],
        botConfigs: Array.isArray(bots) ? bots : [],
      };
      await saveUser(user);

      return NextResponse.json({
        success: true,
        message: `Daemon auto-registered and linked to new account "${cleanUsername}"`,
        daemonUrl,
      });
    }

    // Update daemon connection & heartbeat
    if (daemonUrl) {
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
    user.lastHeartbeat = Date.now();

    // Sync accounts from daemon if provided
    if (Array.isArray(accounts) && accounts.length > 0) {
      const existingAccounts = user.savedAccounts || [];
      const accountMap = new Map(existingAccounts.map((a) => [a.id, a]));
      for (const acc of accounts) {
        if (acc && acc.id) {
          accountMap.set(acc.id, acc);
        }
      }
      user.savedAccounts = Array.from(accountMap.values());
    }

    // Sync bots from daemon if provided
    if (Array.isArray(bots) && bots.length > 0) {
      user.botConfigs = bots;
    }

    await saveUser(user);

    return NextResponse.json({
      success: true,
      message: `Heartbeat acknowledged. Linked to "${cleanUsername}"`,
      daemonUrl: user.daemonUrl,
      savedAccountsCount: user.savedAccounts?.length || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Heartbeat failed' }, { status: 500 });
  }
}

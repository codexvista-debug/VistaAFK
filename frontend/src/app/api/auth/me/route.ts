import { NextResponse } from 'next/server';
import { getUser, verifySessionToken } from '../../../../lib/userStore';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = verifySessionToken(token);
    if (!username) {
      return NextResponse.json({ error: 'Session expired or invalid. Please log in again.' }, { status: 401 });
    }

    const user = await getUser(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        daemonUrl: user.daemonUrl,
        daemonDeviceType: user.daemonDeviceType,
        daemonDeviceLabel: user.daemonDeviceLabel,
        secretToken: user.secretToken,
        lastHeartbeat: user.lastHeartbeat,
        savedAccounts: user.savedAccounts || [],
        serverPresets: user.serverPresets || [],
        botConfigs: user.botConfigs || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to verify session' }, { status: 500 });
  }
}

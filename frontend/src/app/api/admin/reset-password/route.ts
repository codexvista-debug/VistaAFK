import { NextResponse } from 'next/server';
import { resetPassword, verifyAdmin } from '../../../../lib/userStore';

export async function POST(req: Request) {
  try {
    const auth = verifyAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { username, newPassword } = body;

    if (!username || !newPassword) {
      return NextResponse.json({ error: 'Username and new password are required' }, { status: 400 });
    }

    const result = await resetPassword(username, newPassword);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to reset password' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Password for ${username} has been reset.` });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

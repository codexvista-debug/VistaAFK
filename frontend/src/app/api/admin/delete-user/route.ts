import { NextResponse } from 'next/server';
import { deleteUser, verifyAdmin } from '../../../../lib/userStore';

export async function POST(req: Request) {
  try {
    const auth = verifyAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const result = await deleteUser(username);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete user' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Account ${username} deleted.` });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

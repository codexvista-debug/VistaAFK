import { NextResponse } from 'next/server';
import { getAllUsers, verifyAdmin } from '../../../../lib/userStore';

export async function GET(req: Request) {
  try {
    const auth = verifyAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Forbidden' }, { status: 403 });
    }

    const users = await getAllUsers();
    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch users' }, { status: 500 });
  }
}

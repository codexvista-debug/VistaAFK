import { NextResponse } from 'next/server';
import { getSystemSettings, updateSystemSettings, verifyAdmin } from '../../../../lib/userStore';

export async function GET(req: Request) {
  try {
    const auth = verifyAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Forbidden' }, { status: 403 });
    }

    const settings = await getSystemSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = verifyAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { registrationEnabled } = body;

    const updated = await updateSystemSettings({
      registrationEnabled: typeof registrationEnabled === 'boolean' ? registrationEnabled : true,
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

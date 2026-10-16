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
    const { registrationEnabled, adminWidgetEnabled } = body;

    const payload: any = {};
    if (typeof registrationEnabled === 'boolean') payload.registrationEnabled = registrationEnabled;
    if (typeof adminWidgetEnabled === 'boolean') payload.adminWidgetEnabled = adminWidgetEnabled;

    const updated = await updateSystemSettings(payload);

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

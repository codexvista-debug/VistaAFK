import { NextResponse } from 'next/server';
import { getAllFleetUsers, getSystemSettings, verifyAdmin } from '../../../../lib/userStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = verifyAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Forbidden' }, { status: 403 });
    }

    const settings = await getSystemSettings();
    const users = await getAllFleetUsers();

    return NextResponse.json({
      success: true,
      adminWidgetEnabled: settings.adminWidgetEnabled ?? true,
      users,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch fleet overview' }, { status: 500 });
  }
}

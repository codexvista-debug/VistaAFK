import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    let email: string | undefined;
    try {
      const body = await req.json();
      email = body.email;
    } catch (e) {}

    const clientId = '00000000402b5328';
    const scope = 'service::user.auth.xboxlive.com::MBI_SSL';

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('scope', scope);
    params.append('response_type', 'device_code');

    const res = await fetch('https://login.live.com/oauth20_connect.srf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[DeviceCode API] Error response from Microsoft:', res.status, errText);
      return NextResponse.json({ error: 'Failed to initiate Microsoft device code flow' }, { status: 502 });
    }

    const data = await res.json();
    const userCode: string = data.user_code;
    const deviceCode: string = data.device_code;
    const expiresIn: number = data.expires_in || 900;
    const interval: number = data.interval || 5;

    let verificationUri = data.verification_uri || 'https://www.microsoft.com/link';
    if (userCode) {
      verificationUri = `https://www.microsoft.com/link?otc=${encodeURIComponent(userCode)}`;
      if (email && email.trim()) {
        verificationUri += `&login_hint=${encodeURIComponent(email.trim())}`;
      }
      verificationUri += `&prompt=select_account`;
    }

    return NextResponse.json({
      success: true,
      userCode,
      deviceCode,
      verificationUri,
      expiresIn,
      interval,
    });
  } catch (err: any) {
    console.error('[DeviceCode API] Unhandled exception:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}

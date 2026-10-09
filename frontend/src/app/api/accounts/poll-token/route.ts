import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface PollRequestBody {
  deviceCode: string;
  editionFilter?: 'both' | 'java' | 'bedrock';
}

export async function POST(req: Request) {
  try {
    const body: PollRequestBody = await req.json();
    const { deviceCode, editionFilter = 'both' } = body;

    if (!deviceCode) {
      return NextResponse.json({ error: 'deviceCode is required' }, { status: 400 });
    }

    const clientId = '00000000402b5328';
    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', clientId);
    tokenParams.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
    tokenParams.append('device_code', deviceCode);

    const tokenRes = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const errorData = await tokenRes.json().catch(() => ({}));
      const errCode = errorData.error;

      if (errCode === 'authorization_pending') {
        return NextResponse.json({ status: 'pending' });
      }
      if (errCode === 'slow_down') {
        return NextResponse.json({ status: 'pending', slowDown: true });
      }
      if (errCode === 'expired_token') {
        return NextResponse.json({
          status: 'error',
          error: 'Authentication request expired. Please initiate login again.',
        });
      }

      return NextResponse.json({
        status: 'error',
        error: errorData.error_description || errCode || 'Microsoft authorization failed',
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.json({ status: 'error', error: 'Missing access token in Microsoft response' });
    }

    // 1. Authenticate with Xbox Live User Token
    const xblRes = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${accessToken}`,
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT',
      }),
    });

    if (!xblRes.ok) {
      console.warn('[PollToken API] Xbox Live user authenticate failed:', xblRes.status);
      return NextResponse.json({
        status: 'error',
        error: 'Xbox Live authentication failed. Please ensure your Microsoft account has an active Xbox profile.',
      });
    }

    const xblData = await xblRes.json();
    const userToken: string = xblData.Token;
    const userHash: string = xblData.DisplayClaims?.xui?.[0]?.uhs || '';

    const profiles: {
      java?: { name: string; uuid: string };
      bedrock?: { gamertag: string; xuid?: string };
    } = {};

    // 2. Discover Bedrock Edition (Xbox Live Gamertag) if requested
    if (editionFilter === 'both' || editionFilter === 'bedrock') {
      try {
        const xstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            Properties: {
              SandboxId: 'RETAIL',
              UserTokens: [userToken],
            },
            RelyingParty: 'http://xboxlive.com',
            TokenType: 'JWT',
          }),
        });

        if (xstsRes.ok) {
          const xstsData = await xstsRes.json();
          let gamertag = xstsData?.DisplayClaims?.xui?.[0]?.gtg || '';
          let xuid = xstsData?.DisplayClaims?.xui?.[0]?.xid || '';
          const xstsUhs = xstsData?.DisplayClaims?.xui?.[0]?.uhs || userHash;
          const xstsToken = xstsData.Token;

          if (!gamertag && xstsUhs && xstsToken) {
            try {
              const profRes = await fetch('https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag', {
                headers: {
                  'x-xbl-contract-version': '2',
                  Authorization: `XBL3.0 x=${xstsUhs};${xstsToken}`,
                },
              });
              if (profRes.ok) {
                const profData = await profRes.json();
                const gtgSetting = profData?.profileUsers?.[0]?.settings?.find((s: any) => s.id === 'Gamertag');
                if (gtgSetting?.value) {
                  gamertag = gtgSetting.value;
                }
                if (!xuid && profData?.profileUsers?.[0]?.id) {
                  xuid = profData.profileUsers[0].id;
                }
              }
            } catch (e) {}
          }

          if (gamertag) {
            profiles.bedrock = { gamertag, xuid };
          }
        }
      } catch (err: any) {
        console.warn('[PollToken API] Bedrock Gamertag discovery error:', err?.message);
      }
    }

    // 3. Discover Java Edition Profile if requested
    if (editionFilter === 'both' || editionFilter === 'java') {
      try {
        const javaXstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            Properties: {
              SandboxId: 'RETAIL',
              UserTokens: [userToken],
            },
            RelyingParty: 'rp://api.minecraftservices.com/',
            TokenType: 'JWT',
          }),
        });

        if (javaXstsRes.ok) {
          const javaXstsData = await javaXstsRes.json();
          const javaUhs = javaXstsData?.DisplayClaims?.xui?.[0]?.uhs || userHash;
          const javaXstsToken = javaXstsData.Token;

          const mcLoginRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              identityToken: `XBL3.0 x=${javaUhs};${javaXstsToken}`,
            }),
          });

          if (mcLoginRes.ok) {
            const mcLoginData = await mcLoginRes.json();
            const mcToken = mcLoginData.access_token;

            const mcProfileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
              headers: {
                Authorization: `Bearer ${mcToken}`,
              },
            });

            if (mcProfileRes.ok) {
              const mcProfile = await mcProfileRes.json();
              if (mcProfile?.name) {
                profiles.java = {
                  name: mcProfile.name,
                  uuid: mcProfile.id,
                };
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[PollToken API] Java profile discovery error:', err?.message);
      }
    }

    if (!profiles.java && !profiles.bedrock) {
      return NextResponse.json({
        status: 'error',
        error:
          'No Minecraft profile found on this Microsoft account. Please ensure Minecraft has been launched or created for this account on xbox.com or minecraft.net.',
      });
    }

    return NextResponse.json({
      status: 'success',
      profiles,
    });
  } catch (err: any) {
    console.error('[PollToken API] Unhandled exception:', err);
    return NextResponse.json({ status: 'error', error: err?.message || 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface PollRequestBody {
  deviceCode: string;
  editionFilter?: 'both' | 'java' | 'bedrock';
}

const XBOX_ERROR_MESSAGES: Record<number, string> = {
  2148916227: 'Your account was banned by Xbox for violating Community Standards.',
  2148916229: 'Your account has parental restrictions and requires guardian permission at account.microsoft.com/family.',
  2148916233: 'This Microsoft account does not have an Xbox gamer profile yet. Please visit https://signup.live.com or xbox.com to create your free Xbox gamer profile.',
  2148916234: "Please log into xbox.com to accept Xbox's Terms of Service first.",
  2148916235: 'Xbox Live is not available in your region.',
  2148916236: 'Your account requires age verification at https://login.live.com.',
  2148916237: 'Your account has reached its daily playtime limit.',
  2148916238: 'Child account (under 18): must be added to a Microsoft Family to play online.',
};

async function discoverBedrock(
  userToken: string,
  userHash: string
): Promise<{ profile?: { gamertag: string; xuid?: string }; diagnosticError?: string }> {
  try {
    // 1. Request XSTS for Bedrock Multiplayer
    const bedrockXstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MCPE/UWP',
        'x-xbl-contract-version': '1',
      },
      body: JSON.stringify({
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [userToken],
        },
        RelyingParty: 'https://multiplayer.minecraft.net/',
        TokenType: 'JWT',
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (bedrockXstsRes.ok) {
      const bedrockXstsData = await bedrockXstsRes.json();
      const bUhs = bedrockXstsData?.DisplayClaims?.xui?.[0]?.uhs || userHash;
      const bToken = bedrockXstsData.Token;
      let bGtg = bedrockXstsData?.DisplayClaims?.xui?.[0]?.gtg || '';
      let bXuid = bedrockXstsData?.DisplayClaims?.xui?.[0]?.xid || '';

      // If gamertag not in claims directly, query Bedrock token chain
      if (!bGtg && bToken) {
        try {
          const keyPair = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
          const publicKeyDER = keyPair.publicKey.export({ format: 'der', type: 'spki' });
          const clientPublicKey = publicKeyDER.toString('base64');

          const mcpeRes = await fetch('https://multiplayer.minecraft.net/authentication', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'MCPE/UWP',
              Authorization: `XBL3.0 x=${bUhs};${bToken}`,
            },
            body: JSON.stringify({ identityPublicKey: clientPublicKey }),
            signal: AbortSignal.timeout(5000),
          });

          if (mcpeRes.ok) {
            const mcpeData = await mcpeRes.json();
            if (Array.isArray(mcpeData.chain) && mcpeData.chain.length > 1) {
              const jwtPayload = JSON.parse(Buffer.from(mcpeData.chain[1].split('.')[1], 'base64').toString());
              if (jwtPayload?.extraData?.displayName) {
                bGtg = jwtPayload.extraData.displayName;
                bXuid = jwtPayload.extraData.XUID || bXuid;
              }
            }
          }
        } catch (e: any) {
          console.warn('[PollToken API] Bedrock authentication token chain query:', e?.message);
        }
      }

      if (bGtg) {
        return { profile: { gamertag: bGtg, xuid: bXuid } };
      }
    } else {
      const errJson = await bedrockXstsRes.json().catch(() => ({}));
      if (errJson.XErr && XBOX_ERROR_MESSAGES[errJson.XErr]) {
        return { diagnosticError: XBOX_ERROR_MESSAGES[errJson.XErr] };
      }
    }
  } catch (err: any) {
    console.warn('[PollToken API] Bedrock multiplayer XSTS error:', err?.message);
  }

  // Fallback: Query xboxlive.com relying party for Gamertag
  try {
    const xstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'x-xbl-contract-version': '1',
      },
      body: JSON.stringify({
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [userToken],
        },
        RelyingParty: 'http://xboxlive.com',
        TokenType: 'JWT',
      }),
      signal: AbortSignal.timeout(6000),
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
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(5000),
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
        } catch (e: any) {
          console.warn('[PollToken API] Xbox profile settings fallback error:', e?.message);
        }
      }

      if (gamertag) {
        return { profile: { gamertag, xuid } };
      }
    } else {
      const errJson = await xstsRes.json().catch(() => ({}));
      if (errJson.XErr && XBOX_ERROR_MESSAGES[errJson.XErr]) {
        return { diagnosticError: XBOX_ERROR_MESSAGES[errJson.XErr] };
      }
    }
  } catch (err: any) {
    console.warn('[PollToken API] Xbox fallback error:', err?.message);
  }

  return {};
}

async function discoverJava(
  userToken: string,
  userHash: string
): Promise<{ profile?: { name: string; uuid: string }; diagnosticError?: string }> {
  try {
    const javaXstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MinecraftLauncher/2.2.10675',
        'x-xbl-contract-version': '1',
      },
      body: JSON.stringify({
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [userToken],
        },
        RelyingParty: 'rp://api.minecraftservices.com/',
        TokenType: 'JWT',
      }),
      signal: AbortSignal.timeout(6000),
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
          'User-Agent': 'MinecraftLauncher/2.2.10675',
        },
        body: JSON.stringify({
          identityToken: `XBL3.0 x=${javaUhs};${javaXstsToken}`,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (mcLoginRes.ok) {
        const mcLoginData = await mcLoginRes.json();
        const mcToken = mcLoginData.access_token;

        const mcProfileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
          headers: {
            Authorization: `Bearer ${mcToken}`,
            'User-Agent': 'MinecraftLauncher/2.2.10675',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (mcProfileRes.ok) {
          const mcProfile = await mcProfileRes.json();
          if (mcProfile?.name) {
            return { profile: { name: mcProfile.name, uuid: mcProfile.id } };
          }
        } else if (mcProfileRes.status === 404) {
          console.log('[PollToken API] Account has no Java profile name created yet (404)');
        }
      }
    } else {
      const errJson = await javaXstsRes.json().catch(() => ({}));
      if (errJson.XErr && XBOX_ERROR_MESSAGES[errJson.XErr]) {
        return { diagnosticError: XBOX_ERROR_MESSAGES[errJson.XErr] };
      }
    }
  } catch (err: any) {
    console.warn('[PollToken API] Java discovery error:', err?.message);
  }

  return {};
}

export async function POST(req: Request) {
  try {
    const body: PollRequestBody = await req.json();
    const { deviceCode } = body;

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
        'User-Agent': 'MinecraftLauncher/2.2.10675',
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
    // Try prefixes 't=' (standard for Live/consumer tokens), then 'd=' (Azure AD), then ''
    let userToken = '';
    let userHash = '';
    let lastXblErrorText = '';

    for (const prefix of ['t=', 'd=', '']) {
      try {
        const xblRes = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'MinecraftLauncher/2.2.10675',
            'x-xbl-contract-version': '1',
          },
          body: JSON.stringify({
            Properties: {
              AuthMethod: 'RPS',
              SiteName: 'user.auth.xboxlive.com',
              RpsTicket: `${prefix}${accessToken}`,
            },
            RelyingParty: 'http://auth.xboxlive.com',
            TokenType: 'JWT',
          }),
          signal: AbortSignal.timeout(6000),
        });

        if (xblRes.ok) {
          const xblData = await xblRes.json();
          userToken = xblData.Token;
          userHash = xblData.DisplayClaims?.xui?.[0]?.uhs || '';
          if (userToken) break;
        } else {
          lastXblErrorText = await xblRes.text();
          console.warn(`[PollToken API] Xbox Live user authenticate attempt (${prefix}) returned ${xblRes.status}:`, lastXblErrorText);
        }
      } catch (err: any) {
        console.warn(`[PollToken API] Xbox Live user authenticate network error (${prefix}):`, err?.message);
      }
    }

    if (!userToken) {
      console.warn('[PollToken API] All Xbox Live user authenticate attempts failed:', lastXblErrorText);
      let errMsg = 'Xbox Live authentication failed. Please ensure your Microsoft account has an active Xbox profile at xbox.com.';
      try {
        const parsed = JSON.parse(lastXblErrorText);
        if (parsed.XErr && XBOX_ERROR_MESSAGES[parsed.XErr]) {
          errMsg = XBOX_ERROR_MESSAGES[parsed.XErr];
        } else if (parsed.Message) {
          errMsg = parsed.Message;
        }
      } catch {}
      return NextResponse.json({
        status: 'error',
        error: errMsg,
      });
    }

    // 2. Concurrently discover Bedrock & Java profiles
    const [bedrockResult, javaResult] = await Promise.allSettled([
      discoverBedrock(userToken, userHash),
      discoverJava(userToken, userHash),
    ]);

    const profiles: {
      java?: { name: string; uuid: string };
      bedrock?: { gamertag: string; xuid?: string };
    } = {};

    let diagnosticError: string | null = null;

    if (bedrockResult.status === 'fulfilled') {
      if (bedrockResult.value.profile) {
        profiles.bedrock = bedrockResult.value.profile;
      }
      if (bedrockResult.value.diagnosticError) {
        diagnosticError = bedrockResult.value.diagnosticError;
      }
    }

    if (javaResult.status === 'fulfilled') {
      if (javaResult.value.profile) {
        profiles.java = javaResult.value.profile;
      }
      if (javaResult.value.diagnosticError) {
        diagnosticError = javaResult.value.diagnosticError;
      }
    }

    // 3. Final Validation: If no Java or Bedrock profile was found
    if (!profiles.java && !profiles.bedrock) {
      if (diagnosticError) {
        return NextResponse.json({
          status: 'error',
          error: diagnosticError,
        });
      }

      // Provide fallback gamer profile so user is never blocked
      const fallbackName = 'Player_' + (userHash ? userHash.slice(-6) : Math.random().toString(36).substring(2, 8));
      profiles.bedrock = {
        gamertag: fallbackName,
        xuid: userHash || '',
      };
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

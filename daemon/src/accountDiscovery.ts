import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Authflow, Titles } from 'prismarine-auth';

function getPrismarineHash(input: string): string {
  return crypto.createHash('sha1').update(input ?? '', 'binary').digest('hex').substring(0, 6);
}

function syncMicrosoftTokens(
  tokenFolder: string,
  sourceId: string,
  targetNames: string[],
  cacheIds: string[] = ['msal', 'live']
) {
  const sourceHash = getPrismarineHash(sourceId);
  // Share Microsoft sign-in credentials by default. Xbox proof keys and Bedrock
  // credentials are bound to a particular Authflow/client and must be issued
  // again by the client that will actually connect. A discovered Java profile
  // token is copied separately to the exact Java account alias below.
  
  // Expand targetNames with lowercase, uppercase, and trimmed variants
  const expandedTargets = new Set<string>();
  for (const name of targetNames) {
    if (!name) continue;
    expandedTargets.add(name);
    expandedTargets.add(name.toLowerCase());
    expandedTargets.add(name.toUpperCase());
    expandedTargets.add(name.trim());
  }

  try {
    for (const targetName of expandedTargets) {
      const targetHash = getPrismarineHash(targetName);
      for (const cacheId of cacheIds) {
        const srcFile = path.join(tokenFolder, `${sourceHash}_${cacheId}-cache.json`);
        const dstFile = path.join(tokenFolder, `${targetHash}_${cacheId}-cache.json`);
        if (fs.existsSync(srcFile)) {
          const stat = fs.statSync(srcFile);
          if (stat.size > 2) {
            fs.copyFileSync(srcFile, dstFile);
            console.log(`[VistaAFK Discovery] Cached token credentials ready for ${targetName} (${targetHash}) [${cacheId}]`);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[VistaAFK Discovery] Warning syncing token caches:', err.message);
  }
}

export interface DiscoveredProfiles {
  java?: {
    name: string;
    uuid: string;
  };
  bedrock?: {
    gamertag: string;
    xuid?: string;
  };
}

export async function discoverMicrosoftProfiles(
  tokenFolder: string,
  onDeviceCode: (data: { userCode: string; verificationUri: string; expiresIn: number }) => void,
  email?: string,
  editionFilter: 'both' | 'java' | 'bedrock' = 'both'
): Promise<DiscoveredProfiles> {
  // Always use a unique session ID for discovery so it never re-uses an old cached token
  const accountId = 'msa_discovery_' + (email ? email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') : 'acc') + '_' + Date.now();
  console.log(`[VistaAFK Discovery] Initiating Microsoft OAuth device code flow for ${email || 'new account'} (filter: ${editionFilter})...`);

  const onMicrosoftCode = (codeData: any) => {
    const userCode = codeData.user_code || codeData.userCode;
    const baseUri = codeData.verification_uri || codeData.verificationUri || 'https://www.microsoft.com/link';
    let directUri = userCode ? `https://www.microsoft.com/link?otc=${encodeURIComponent(userCode)}` : baseUri;
    if (email && email.trim()) {
      directUri += `&login_hint=${encodeURIComponent(email.trim())}`;
    }
    directUri += `&prompt=select_account`;

    console.log(`[VistaAFK Discovery] Received Device Code: ${userCode} (Link: ${directUri})`);
    onDeviceCode({
      userCode,
      verificationUri: directUri,
      expiresIn: codeData.expires_in || codeData.expiresIn || 900,
    });
  };

  const flow = new Authflow(
    accountId,
    tokenFolder,
    {
      // Match the auth identity used by both bot transports. The daemon's
      // minecraft-protocol and bedrock-protocol clients default to the
      // Nintendo title/device. The reported discovery regression began after
      // switching the shared flow to MinecraftJava, which is where the user's
      // daemon log showed the 403 responses.
      authTitle: Titles.MinecraftNintendoSwitch,
      deviceType: 'Nintendo',
      flow: 'live',
      forceRefresh: true,
    },
    onMicrosoftCode
  );

  const result: DiscoveredProfiles = {};
  const lookupErrors: string[] = [];

  // 1. Discover Minecraft: Java Edition Profile (if requested)
  if (editionFilter === 'both' || editionFilter === 'java') {
    try {
      // Keep the library's established auth flow and request its profile using
      // the same headers/path used by its Minecraft Java token manager.
      const javaRes = await flow.getMinecraftJavaToken({ fetchProfile: true, fetchEntitlements: true });
      if (javaRes?.profile?.name && javaRes.profile.id) {
        result.java = { name: javaRes.profile.name, uuid: javaRes.profile.id };
        console.log(`[VistaAFK Discovery] ✅ Discovered Java Profile: ${result.java.name} (${result.java.uuid})`);
      } else if (!javaRes?.token) {
        throw new Error('Minecraft Java authentication did not return an access token.');
      } else {
        console.log('[VistaAFK Discovery] No Java profile was returned for this Microsoft account.');
      }
    } catch (err: any) {
      console.warn('[VistaAFK Discovery] Java authentication/profile lookup error:', err.message);
      lookupErrors.push(`Java: ${err.message || 'profile lookup failed'}`);
    }

    // Some Minecraft accounts only complete the Java title flow. First use
    // the shared Microsoft sign-in from the Nintendo client flow, then
    // retry with the Java title and Windows device identity without asking the
    // user to approve a second device code.
    if (!result.java) {
      const javaAccountId = `${accountId}_java`;
      syncMicrosoftTokens(tokenFolder, accountId, [javaAccountId]);
      try {
        const javaFlow = new Authflow(
          javaAccountId,
          tokenFolder,
          {
            authTitle: Titles.MinecraftJava,
            deviceType: 'Win32',
            flow: 'live',
          },
          onMicrosoftCode
        );
        const javaRes = await javaFlow.getMinecraftJavaToken({ fetchProfile: true, fetchEntitlements: true });
        if (javaRes?.profile?.name && javaRes.profile.id) {
          result.java = { name: javaRes.profile.name, uuid: javaRes.profile.id };
          console.log(`[VistaAFK Discovery] ✅ Discovered Java Profile via Java title fallback: ${result.java.name} (${result.java.uuid})`);
        } else if (!javaRes?.token) {
          throw new Error('Java title fallback did not return an access token.');
        }
      } catch (err: any) {
        console.warn('[VistaAFK Discovery] Java title fallback error:', err.message);
        lookupErrors.push(`Java title fallback: ${err.message || 'profile lookup failed'}`);
      }
    }
  }

  // 2. Discover the Bedrock profile with the same Xbox identity used by the
  // Bedrock client. Keeping this in one Authflow also ensures both editions
  // share the same Microsoft device-code session.
  if (editionFilter === 'both' || editionFilter === 'bedrock') {
    let xboxToken: Awaited<ReturnType<typeof flow.getXboxToken>> | undefined;
    try {
      xboxToken = await flow.getXboxToken('http://xboxlive.com');
    } catch (err: any) {
      console.warn('[VistaAFK Discovery] Xbox gamertag token lookup error:', err.message);
      lookupErrors.push(`Bedrock Xbox profile: ${err.message || 'Xbox profile lookup failed'}`);
    }

    let gamertag = (xboxToken as any)?.DisplayClaims?.xui?.[0]?.gtg || (xboxToken as any)?.gamertag || '';
    let xuid = xboxToken?.userXUID || (xboxToken as any)?.DisplayClaims?.xui?.[0]?.xid || '';

    if (!gamertag && xboxToken?.userHash && xboxToken?.XSTSToken) {
      try {
        const profileResponse = await fetch('https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag', {
          headers: {
            'x-xbl-contract-version': '2',
            Authorization: `XBL3.0 x=${xboxToken.userHash};${xboxToken.XSTSToken}`,
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(6000),
        });
        if (profileResponse.ok) {
          const profile = await profileResponse.json() as {
            profileUsers?: Array<{ id?: string; settings?: Array<{ id?: string; value?: string }> }>;
          };
          const user = profile.profileUsers?.[0];
          gamertag = user?.settings?.find((setting) => setting.id === 'Gamertag')?.value || '';
          xuid = xuid || user?.id || '';
        } else {
          console.warn(`[VistaAFK Discovery] Xbox profile lookup returned HTTP ${profileResponse.status}.`);
        }
      } catch (err: any) {
        console.warn('[VistaAFK Discovery] Xbox profile API lookup error:', err.message);
      }
    }

    // Some accounts expose the gamertag only in the Bedrock auth chain. Keep
    // this separate from the Xbox-profile lookup so one rejected RP does not
    // prevent trying the Bedrock-specific exchange.
    if (!gamertag) {
      try {
        const keyPair = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
        const clientX509 = keyPair.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
        const bedrockAuth = await (flow as any).getMinecraftBedrockToken(clientX509);
        const chain = Array.isArray(bedrockAuth) ? bedrockAuth : bedrockAuth?.chain;
        if (Array.isArray(chain)) {
          for (const token of chain) {
            try {
              const encodedPayload = token.split('.')[1];
              if (!encodedPayload) continue;
              const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
              if (payload?.extraData?.displayName) {
                gamertag = payload.extraData.displayName;
                xuid = xuid || String(payload.extraData.XUID || '');
                break;
              }
            } catch {
              // Other chain entries can be opaque or use a different JWT payload.
            }
          }
        }
      } catch (err: any) {
        console.warn('[VistaAFK Discovery] Bedrock token-chain lookup error:', err.message);
        lookupErrors.push(`Bedrock token chain: ${err.message || 'Bedrock profile lookup failed'}`);
      }
    }

    if (gamertag) {
      result.bedrock = { gamertag, xuid };
      console.log(`[VistaAFK Discovery] ✅ Discovered Bedrock Gamertag: ${gamertag}`);
    } else if (!lookupErrors.some((error) => error.startsWith('Bedrock'))) {
      lookupErrors.push('Bedrock: Xbox authentication succeeded, but no gamertag was present in the Minecraft profile token.');
    }
  }

  // Copy the reusable Microsoft token so both clients can obtain their own
  // fresh edition-specific credentials without prompting for another sign-in.
  const targetNames = [
    result.java?.name,
    result.java?.uuid,
    result.bedrock?.gamertag,
    result.bedrock?.xuid,
    email,
  ].filter(Boolean) as string[];

  if (targetNames.length > 0) {
    syncMicrosoftTokens(tokenFolder, accountId, targetNames);
    syncMicrosoftTokens(tokenFolder, `${accountId}_java`, targetNames);
  }

  // Discovery already authenticated this exact Java profile and fetched its
  // Minecraft Services token. Make that token available under the username
  // mineflayer uses. This avoids repeating a profile lookup with a newly
  // constructed Authflow that may not be able to complete on mobile, even
  // though discovery just proved the account and profile are valid. The token
  // manager validates its expiry before using it; Xbox and Bedrock caches are
  // intentionally not shared.
  if (result.java) {
    const javaAliases = [result.java.name, result.java.uuid];
    syncMicrosoftTokens(tokenFolder, accountId, javaAliases, ['mca']);
    syncMicrosoftTokens(tokenFolder, `${accountId}_java`, javaAliases, ['mca']);
  }

  if (!result.java && !result.bedrock && lookupErrors.length > 0) {
    throw new Error(`Profile lookup failed. ${lookupErrors.join(' | ')}`);
  }

  return result;
}

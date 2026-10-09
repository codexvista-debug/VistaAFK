import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Authflow, Titles } from 'prismarine-auth';

function getPrismarineHash(input: string): string {
  return crypto.createHash('sha1').update(input ?? '', 'binary').digest('hex').substring(0, 6);
}

function syncTokenCaches(tokenFolder: string, sourceId: string, targetNames: string[]) {
  const sourceHash = getPrismarineHash(sourceId);
  const cacheIds = ['msal', 'live', 'sisu', 'xbl', 'bed', 'mca', 'mcs', 'pfb'];
  try {
    for (const targetName of targetNames) {
      if (!targetName) continue;
      const targetHash = getPrismarineHash(targetName);
      for (const cacheId of cacheIds) {
        const srcFile = path.join(tokenFolder, `${sourceHash}_${cacheId}-cache.json`);
        const dstFile = path.join(tokenFolder, `${targetHash}_${cacheId}-cache.json`);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, dstFile);
          console.log(`[VistaAFK Discovery] Cached token credentials ready for ${targetName} (${targetHash})`);
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

  const flow = new Authflow(
    accountId,
    tokenFolder,
    {
      authTitle: Titles.MinecraftJava,
      flow: 'live',
      forceRefresh: true,
    },
    (codeData: any) => {
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
    }
  );

  const result: DiscoveredProfiles = {};

  // 1. Discover Minecraft: Java Edition Profile (if requested)
  if (editionFilter === 'both' || editionFilter === 'java') {
    try {
      const javaRes = await flow.getMinecraftJavaToken({ fetchProfile: true, fetchEntitlements: true });
      if (javaRes?.profile?.name) {
        result.java = {
          name: javaRes.profile.name,
          uuid: javaRes.profile.id,
        };
        console.log(`[VistaAFK Discovery] ✅ Discovered Java Profile: ${result.java.name} (${result.java.uuid})`);
      } else {
        console.log('[VistaAFK Discovery] Account has no active Minecraft Java profile');
      }
    } catch (err: any) {
      console.warn('[VistaAFK Discovery] Java profile fetch error:', err.message);
    }
  }

  // 2. Discover Minecraft: Bedrock Edition / Xbox Live Gamertag (if requested)
  if (editionFilter === 'both' || editionFilter === 'bedrock') {
    try {
      const xsts: any = await flow.getXboxToken('http://xboxlive.com');
      let gamertag = (xsts as any)?.DisplayClaims?.xui?.[0]?.gtg || (xsts as any)?.gamertag || '';
      let xuid = xsts?.userXUID || (xsts as any)?.DisplayClaims?.xui?.[0]?.xid || '';

      if (!gamertag && xsts?.userHash && xsts?.XSTSToken) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const resp = await fetch('https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag', {
            signal: controller.signal,
            headers: {
              'x-xbl-contract-version': '2',
              'Authorization': `XBL3.0 x=${xsts.userHash};${xsts.XSTSToken}`,
            },
          });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const json: any = await resp.json();
            const gtgSetting = json?.profileUsers?.[0]?.settings?.find((s: any) => s.id === 'Gamertag');
            if (gtgSetting?.value) {
              gamertag = gtgSetting.value;
            }
            if (!xuid && json?.profileUsers?.[0]?.id) {
              xuid = json.profileUsers[0].id;
            }
          }
        } catch (e: any) {
          console.warn('[VistaAFK Discovery] Xbox profile settings endpoint lookup failed:', e.message);
        }
      }

      if (gamertag) {
        result.bedrock = {
          gamertag,
          xuid,
        };
        console.log(`[VistaAFK Discovery] ✅ Discovered Bedrock Gamertag: ${gamertag}`);
      }
    } catch (err: any) {
      console.warn('[VistaAFK Discovery] Bedrock Xbox discovery error:', err.message);
    }
  }

  // Sync token caches so future bot instances can instantly connect without re-auth
  const targetNames = [result.java?.name, result.bedrock?.gamertag].filter(Boolean) as string[];
  if (targetNames.length > 0) {
    syncTokenCaches(tokenFolder, accountId, targetNames);
  }

  return result;
}

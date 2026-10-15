import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Authflow, Titles } from 'prismarine-auth';

function getPrismarineHash(input: string): string {
  return crypto.createHash('sha1').update(input ?? '', 'binary').digest('hex').substring(0, 6);
}

function syncMicrosoftTokens(tokenFolder: string, sourceId: string, targetNames: string[]) {
  const sourceHash = getPrismarineHash(sourceId);
  // Share only the Microsoft sign-in token. Xbox proof keys and edition-specific
  // Minecraft tokens are bound to a particular Authflow/client and must be issued
  // again by the Java or Bedrock client that will actually connect.
  const cacheIds = ['msal', 'live'];
  
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
      authTitle: Titles.MinecraftJava,
      flow: 'live',
      forceRefresh: true,
    },
    onMicrosoftCode
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

  // 2. Discover the Bedrock profile using Bedrock's own Xbox title. Reuse the
  // Microsoft device-code token from the Java flow so the user signs in once.
  if (editionFilter === 'both' || editionFilter === 'bedrock' || !result.java) {
    try {
      let gamertag = '';
      let xuid = '';

      const bedrockAccountId = `${accountId}_bedrock`;
      syncMicrosoftTokens(tokenFolder, accountId, [bedrockAccountId]);
      const bedrockFlow = new Authflow(
        bedrockAccountId,
        tokenFolder,
        {
          authTitle: Titles.MinecraftNintendoSwitch,
          flow: 'live',
        },
        onMicrosoftCode
      );
      const keyPair = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
      const clientX509 = keyPair.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
      const bedrockChain = await (bedrockFlow as any).getMinecraftBedrockToken(clientX509);
      const chain = Array.isArray(bedrockChain) ? bedrockChain : bedrockChain?.chain;
      if (Array.isArray(chain) && chain.length > 1) {
        const payload = JSON.parse(Buffer.from(chain[1].split('.')[1], 'base64url').toString('utf8'));
        if (payload?.extraData?.displayName) {
          gamertag = payload.extraData.displayName;
          xuid = String(payload.extraData.XUID || '');
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
      console.warn('[VistaAFK Discovery] Bedrock discovery error:', err.message);
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
    for (const sourceId of [accountId, `${accountId}_bedrock`]) {
      syncMicrosoftTokens(tokenFolder, sourceId, targetNames);
    }
  }

  return result;
}

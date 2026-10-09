"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverMicrosoftProfiles = discoverMicrosoftProfiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const prismarine_auth_1 = require("prismarine-auth");
function getPrismarineHash(input) {
    return crypto_1.default.createHash('sha1').update(input ?? '', 'binary').digest('hex').substring(0, 6);
}
function syncTokenCaches(tokenFolder, sourceId, targetNames) {
    const sourceHash = getPrismarineHash(sourceId);
    const cacheIds = ['msal', 'live', 'sisu', 'xbl', 'bed', 'mca', 'mcs', 'pfb'];
    // Expand targetNames with lowercase, uppercase, and trimmed variants
    const expandedTargets = new Set();
    for (const name of targetNames) {
        if (!name)
            continue;
        expandedTargets.add(name);
        expandedTargets.add(name.toLowerCase());
        expandedTargets.add(name.toUpperCase());
        expandedTargets.add(name.trim());
    }
    try {
        for (const targetName of expandedTargets) {
            const targetHash = getPrismarineHash(targetName);
            for (const cacheId of cacheIds) {
                const srcFile = path_1.default.join(tokenFolder, `${sourceHash}_${cacheId}-cache.json`);
                const dstFile = path_1.default.join(tokenFolder, `${targetHash}_${cacheId}-cache.json`);
                if (fs_1.default.existsSync(srcFile)) {
                    const stat = fs_1.default.statSync(srcFile);
                    if (stat.size > 2) {
                        fs_1.default.copyFileSync(srcFile, dstFile);
                        console.log(`[VistaAFK Discovery] Cached token credentials ready for ${targetName} (${targetHash}) [${cacheId}]`);
                    }
                }
            }
        }
    }
    catch (err) {
        console.warn('[VistaAFK Discovery] Warning syncing token caches:', err.message);
    }
}
async function discoverMicrosoftProfiles(tokenFolder, onDeviceCode, email, editionFilter = 'both') {
    // Always use a unique session ID for discovery so it never re-uses an old cached token
    const accountId = 'msa_discovery_' + (email ? email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') : 'acc') + '_' + Date.now();
    console.log(`[VistaAFK Discovery] Initiating Microsoft OAuth device code flow for ${email || 'new account'} (filter: ${editionFilter})...`);
    const flow = new prismarine_auth_1.Authflow(accountId, tokenFolder, {
        authTitle: prismarine_auth_1.Titles.MinecraftJava,
        flow: 'live',
        forceRefresh: true,
    }, (codeData) => {
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
    });
    const result = {};
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
            }
            else {
                console.log('[VistaAFK Discovery] Account has no active Minecraft Java profile');
            }
        }
        catch (err) {
            console.warn('[VistaAFK Discovery] Java profile fetch error:', err.message);
        }
    }
    // 2. Discover Minecraft: Bedrock Edition / Xbox Live Gamertag
    if (editionFilter === 'both' || editionFilter === 'bedrock' || !result.java) {
        try {
            let gamertag = '';
            let xuid = '';
            // Direct official Bedrock Minecraft token exchange
            if (typeof flow.getMinecraftBedrockToken === 'function') {
                try {
                    const keyPair = crypto_1.default.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
                    const clientX509 = keyPair.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
                    const loginData = await flow.getMinecraftBedrockToken(clientX509);
                    if (Array.isArray(loginData) && loginData.length > 1) {
                        const jwt = loginData[1];
                        const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
                        if (payload?.extraData?.displayName) {
                            gamertag = payload.extraData.displayName;
                            xuid = payload.extraData.XUID || '';
                        }
                    }
                }
                catch (e) {
                    console.warn('[VistaAFK Discovery] Bedrock token exchange error:', e.message);
                }
            }
            if (gamertag) {
                result.bedrock = {
                    gamertag,
                    xuid,
                };
                console.log(`[VistaAFK Discovery] ✅ Discovered Bedrock Gamertag: ${gamertag}`);
            }
        }
        catch (err) {
            console.warn('[VistaAFK Discovery] Bedrock discovery error:', err.message);
        }
    }
    // 3. Fallback: If no custom Mojang Java name found, provide Bedrock gamer profile from email prefix so user is never blocked
    if (!result.java && !result.bedrock) {
        const fallbackName = email ? email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : 'Player';
        result.bedrock = {
            gamertag: fallbackName,
        };
        console.log(`[VistaAFK Discovery] Fallback profile created for ${fallbackName}`);
    }
    // Sync token caches so future bot instances can instantly connect without re-auth
    const targetNames = [
        result.java?.name,
        result.java?.uuid,
        result.bedrock?.gamertag,
        result.bedrock?.xuid,
        email,
    ].filter(Boolean);
    if (targetNames.length > 0) {
        syncTokenCaches(tokenFolder, accountId, targetNames);
    }
    return result;
}

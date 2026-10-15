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
function syncMicrosoftTokens(tokenFolder, sourceId, targetNames) {
    const sourceHash = getPrismarineHash(sourceId);
    // Share only the Microsoft sign-in token. Xbox proof keys and edition-specific
    // Minecraft tokens are bound to a particular Authflow/client and must be issued
    // again by the Java or Bedrock client that will actually connect.
    const cacheIds = ['msal', 'live'];
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
    const onMicrosoftCode = (codeData) => {
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
    const flow = new prismarine_auth_1.Authflow(accountId, tokenFolder, {
        authTitle: prismarine_auth_1.Titles.MinecraftJava,
        deviceType: 'Win32',
        flow: 'live',
        forceRefresh: true,
    }, onMicrosoftCode);
    const result = {};
    const lookupErrors = [];
    // 1. Discover Minecraft: Java Edition Profile (if requested)
    if (editionFilter === 'both' || editionFilter === 'java') {
        try {
            // prismarine-auth currently catches profile endpoint errors internally and
            // returns an empty profile. Fetch the profile here so the UI can distinguish
            // a missing profile from an API/auth failure.
            const javaRes = await flow.getMinecraftJavaToken();
            const profileResponse = await fetch('https://api.minecraftservices.com/minecraft/profile', {
                headers: {
                    Authorization: `Bearer ${javaRes.token}`,
                    'User-Agent': 'MinecraftLauncher/2.2.10675',
                },
            });
            if (profileResponse.ok) {
                const profile = await profileResponse.json();
                if (profile?.name && profile?.id) {
                    result.java = {
                        name: profile.name,
                        uuid: profile.id,
                    };
                    console.log(`[VistaAFK Discovery] ✅ Discovered Java Profile: ${result.java.name} (${result.java.uuid})`);
                }
                else {
                    console.log('[VistaAFK Discovery] Java profile endpoint returned no profile name or id');
                }
            }
            else if (profileResponse.status === 404) {
                console.log('[VistaAFK Discovery] Account has no active Minecraft Java profile');
            }
            else {
                const responseText = await profileResponse.text();
                throw new Error(`Minecraft Java profile lookup failed (${profileResponse.status}): ${responseText.slice(0, 240)}`);
            }
        }
        catch (err) {
            console.warn('[VistaAFK Discovery] Java profile fetch error:', err.message);
            lookupErrors.push(`Java: ${err.message || 'profile lookup failed'}`);
        }
    }
    // 2. Discover the Bedrock profile using Bedrock's own Xbox title. Reuse the
    // Microsoft device-code token from the Java flow so the user signs in once.
    if (editionFilter === 'both' || editionFilter === 'bedrock') {
        try {
            let gamertag = '';
            let xuid = '';
            const bedrockAccountId = `${accountId}_bedrock`;
            syncMicrosoftTokens(tokenFolder, accountId, [bedrockAccountId]);
            const bedrockFlow = new prismarine_auth_1.Authflow(bedrockAccountId, tokenFolder, {
                authTitle: prismarine_auth_1.Titles.MinecraftNintendoSwitch,
                deviceType: 'Nintendo',
                flow: 'live',
            }, onMicrosoftCode);
            const keyPair = crypto_1.default.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
            const clientX509 = keyPair.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
            const bedrockChain = await bedrockFlow.getMinecraftBedrockToken(clientX509);
            const chain = Array.isArray(bedrockChain) ? bedrockChain : bedrockChain?.chain;
            if (Array.isArray(chain)) {
                for (const token of chain) {
                    try {
                        const encodedPayload = token.split('.')[1];
                        if (!encodedPayload)
                            continue;
                        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
                        if (payload?.extraData?.displayName) {
                            gamertag = payload.extraData.displayName;
                            xuid = String(payload.extraData.XUID || '');
                            break;
                        }
                    }
                    catch {
                        // Other chain entries can be opaque or use a different JWT payload.
                    }
                }
            }
            if (gamertag) {
                result.bedrock = {
                    gamertag,
                    xuid,
                };
                console.log(`[VistaAFK Discovery] ✅ Discovered Bedrock Gamertag: ${gamertag}`);
            }
            else {
                lookupErrors.push('Bedrock: Xbox authentication succeeded, but no gamertag was present in the Minecraft profile token.');
            }
        }
        catch (err) {
            console.warn('[VistaAFK Discovery] Bedrock discovery error:', err.message);
            lookupErrors.push(`Bedrock: ${err.message || 'Xbox profile lookup failed'}`);
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
    ].filter(Boolean);
    if (targetNames.length > 0) {
        for (const sourceId of [accountId, `${accountId}_bedrock`]) {
            syncMicrosoftTokens(tokenFolder, sourceId, targetNames);
        }
    }
    if (!result.java && !result.bedrock && lookupErrors.length > 0) {
        throw new Error(`Profile lookup failed. ${lookupErrors.join(' | ')}`);
    }
    return result;
}

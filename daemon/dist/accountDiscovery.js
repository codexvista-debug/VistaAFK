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
        // Match the auth identity used by both bot transports. The daemon's
        // minecraft-protocol and bedrock-protocol clients default to the
        // Nintendo title/device. The reported discovery regression began after
        // switching the shared flow to MinecraftJava, which is where the user's
        // daemon log showed the 403 responses.
        authTitle: prismarine_auth_1.Titles.MinecraftNintendoSwitch,
        deviceType: 'Nintendo',
        flow: 'live',
        forceRefresh: true,
    }, onMicrosoftCode);
    const result = {};
    const lookupErrors = [];
    // 1. Discover Minecraft: Java Edition Profile (if requested)
    if (editionFilter === 'both' || editionFilter === 'java') {
        try {
            // Keep the library's established auth flow and request its profile using
            // the same headers/path used by its Minecraft Java token manager.
            const javaRes = await flow.getMinecraftJavaToken({ fetchProfile: true, fetchEntitlements: true });
            if (javaRes?.profile?.name && javaRes.profile.id) {
                result.java = { name: javaRes.profile.name, uuid: javaRes.profile.id };
                console.log(`[VistaAFK Discovery] ✅ Discovered Java Profile: ${result.java.name} (${result.java.uuid})`);
            }
            else if (!javaRes?.token) {
                throw new Error('Minecraft Java authentication did not return an access token.');
            }
            else {
                console.log('[VistaAFK Discovery] No Java profile was returned for this Microsoft account.');
            }
        }
        catch (err) {
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
                const javaFlow = new prismarine_auth_1.Authflow(javaAccountId, tokenFolder, {
                    authTitle: prismarine_auth_1.Titles.MinecraftJava,
                    deviceType: 'Win32',
                    flow: 'live',
                }, onMicrosoftCode);
                const javaRes = await javaFlow.getMinecraftJavaToken({ fetchProfile: true, fetchEntitlements: true });
                if (javaRes?.profile?.name && javaRes.profile.id) {
                    result.java = { name: javaRes.profile.name, uuid: javaRes.profile.id };
                    console.log(`[VistaAFK Discovery] ✅ Discovered Java Profile via Java title fallback: ${result.java.name} (${result.java.uuid})`);
                }
                else if (!javaRes?.token) {
                    throw new Error('Java title fallback did not return an access token.');
                }
            }
            catch (err) {
                console.warn('[VistaAFK Discovery] Java title fallback error:', err.message);
                lookupErrors.push(`Java title fallback: ${err.message || 'profile lookup failed'}`);
            }
        }
    }
    // 2. Discover the Bedrock profile with the same Xbox identity used by the
    // Bedrock client. Keeping this in one Authflow also ensures both editions
    // share the same Microsoft device-code session.
    if (editionFilter === 'both' || editionFilter === 'bedrock') {
        let xboxToken;
        try {
            xboxToken = await flow.getXboxToken('http://xboxlive.com');
        }
        catch (err) {
            console.warn('[VistaAFK Discovery] Xbox gamertag token lookup error:', err.message);
            lookupErrors.push(`Bedrock Xbox profile: ${err.message || 'Xbox profile lookup failed'}`);
        }
        let gamertag = xboxToken?.DisplayClaims?.xui?.[0]?.gtg || xboxToken?.gamertag || '';
        let xuid = xboxToken?.userXUID || xboxToken?.DisplayClaims?.xui?.[0]?.xid || '';
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
                    const profile = await profileResponse.json();
                    const user = profile.profileUsers?.[0];
                    gamertag = user?.settings?.find((setting) => setting.id === 'Gamertag')?.value || '';
                    xuid = xuid || user?.id || '';
                }
                else {
                    console.warn(`[VistaAFK Discovery] Xbox profile lookup returned HTTP ${profileResponse.status}.`);
                }
            }
            catch (err) {
                console.warn('[VistaAFK Discovery] Xbox profile API lookup error:', err.message);
            }
        }
        // Some accounts expose the gamertag only in the Bedrock auth chain. Keep
        // this separate from the Xbox-profile lookup so one rejected RP does not
        // prevent trying the Bedrock-specific exchange.
        if (!gamertag) {
            try {
                const keyPair = crypto_1.default.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
                const clientX509 = keyPair.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
                const bedrockAuth = await flow.getMinecraftBedrockToken(clientX509);
                const chain = Array.isArray(bedrockAuth) ? bedrockAuth : bedrockAuth?.chain;
                if (Array.isArray(chain)) {
                    for (const token of chain) {
                        try {
                            const encodedPayload = token.split('.')[1];
                            if (!encodedPayload)
                                continue;
                            const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
                            if (payload?.extraData?.displayName) {
                                gamertag = payload.extraData.displayName;
                                xuid = xuid || String(payload.extraData.XUID || '');
                                break;
                            }
                        }
                        catch {
                            // Other chain entries can be opaque or use a different JWT payload.
                        }
                    }
                }
            }
            catch (err) {
                console.warn('[VistaAFK Discovery] Bedrock token-chain lookup error:', err.message);
                lookupErrors.push(`Bedrock token chain: ${err.message || 'Bedrock profile lookup failed'}`);
            }
        }
        if (gamertag) {
            result.bedrock = { gamertag, xuid };
            console.log(`[VistaAFK Discovery] ✅ Discovered Bedrock Gamertag: ${gamertag}`);
        }
        else if (!lookupErrors.some((error) => error.startsWith('Bedrock'))) {
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
    ].filter(Boolean);
    if (targetNames.length > 0) {
        syncMicrosoftTokens(tokenFolder, accountId, targetNames);
        syncMicrosoftTokens(tokenFolder, `${accountId}_java`, targetNames);
    }
    if (!result.java && !result.bedrock && lookupErrors.length > 0) {
        throw new Error(`Profile lookup failed. ${lookupErrors.join(' | ')}`);
    }
    return result;
}

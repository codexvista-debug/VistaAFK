'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { BotConfig, BotTelemetry, ChatMessage, ActivityLog, VistaNotification, SavedAccount, ServerPreset, MinecraftEdition } from '../types';
import { useAuth } from './VistaAuthContext';

const DEFAULT_SERVER_PRESETS: ServerPreset[] = [
  { id: 'donutsmp', name: 'DonutSMP', host: 'donutsmp.net', port: 25565, version: '' },
  { id: 'freshsmp', name: 'FreshSMP', host: 'play.freshsmp.fun', port: 25565, version: '' },
  { id: 'custom', name: 'Other / Custom Server', host: '', port: 25565, version: '' },
];

export function normalizeWsUrl(raw: string): string {
  let url = (raw || '').trim();
  if (!url) return '';

  // 1. If someone pasted a full website URL containing ?connect= or ?daemon=, extract the inner tunnel URL
  if (url.includes('connect=')) {
    const match = url.match(/[?&]connect=([^&#\s]+)/);
    if (match && match[1]) {
      url = decodeURIComponent(match[1]).trim();
    }
  } else if (url.includes('daemon=')) {
    const match = url.match(/[?&]daemon=([^&#\s]+)/);
    if (match && match[1]) {
      url = decodeURIComponent(match[1]).trim();
    }
  }

  // 2. If it contains a trycloudflare.com domain anywhere, clean and return wss:// domain
  const cfMatch = url.match(/([a-zA-Z0-9-]+\.trycloudflare\.com)/i);
  if (cfMatch && cfMatch[1]) {
    return `wss://${cfMatch[1]}`;
  }

  // 3. Remove any multiple slashes after ws: or wss: (e.g. wss://// -> wss://)
  url = url.replace(/^(wss?):\/+/i, '$1://');

  // 4. Normal protocol conversions
  if (url.startsWith('https://')) {
    url = 'wss://' + url.slice('https://'.length);
  } else if (url.startsWith('http://')) {
    url = 'ws://' + url.slice('http://'.length);
  } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = 'wss://' + url;
  }

  // 5. Strip trailing slashes
  url = url.replace(/\/+$/, '');

  // 6. If user pasted trycloudflare.com with :8080, strip :8080
  if (url.includes('trycloudflare.com') && url.includes(':8080')) {
    url = url.replace(':8080', '');
  }

  return url;
}

export interface VistaWebSocketContextType {
  daemonUrl: string;
  secretToken: string;
  isConnected: boolean;
  isConnecting: boolean;
  authError: string | null;
  configs: BotConfig[];
  telemetry: Record<string, BotTelemetry>;
  chatLogs: Record<string, ChatMessage[]>;
  activityLogs: Record<string, ActivityLog[]>;
  notifications: VistaNotification[];
  savedAccounts: SavedAccount[];
  serverPresets: ServerPreset[];
  saveAccount: (account: SavedAccount) => void;
  deleteSavedAccount: (id: string) => void;
  saveServerPreset: (preset: ServerPreset) => void;
  deleteServerPreset: (id: string) => void;
  deployAccountToServer: (account: SavedAccount, server: { host: string; port: number; version?: string; edition?: MinecraftEdition }) => void;
  updateDaemonConfig: (url: string, token: string) => void;
  connect: () => void;
  addBot: (config: BotConfig) => void;
  updateBot: (config: BotConfig) => void;
  removeBot: (botId: string) => void;
  startBot: (botId: string) => void;
  stopBot: (botId: string) => void;
  startAll: () => void;
  stopAll: () => void;
  sendChat: (botId: string, message: string) => void;
  moveBot: (botId: string, control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', state: boolean) => void;
  togglePatrol: (botId: string, enabled: boolean) => void;
  lookAt: (botId: string, yaw: number, pitch: number) => void;
  moveInventoryItem: (botId: string, sourceSlot: number, targetSlot: number) => void;
  setQuickBarSlot: (botId: string, slot: number) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  discoveryDeviceCode: { userCode: string; verificationUri: string; expiresIn: number } | null;
  discoveryStatus: 'idle' | 'waiting_code' | 'waiting_approval' | 'success' | 'error';
  discoveryProfiles: { java?: { name: string; uuid: string }; bedrock?: { gamertag: string; xuid?: string } } | null;
  discoveryError: string | null;
  discoverMicrosoftAccount: (email?: string, editionFilter?: 'both' | 'java' | 'bedrock') => void;
  resetDiscovery: () => void;
  retryConnection: () => void;
  connectionAttempts: number;
  isConnectionLocked: boolean;
  toggleConnectionLock: (locked?: boolean) => void;
}

const VistaWebSocketContext = createContext<VistaWebSocketContextType | null>(null);

export const VistaWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, syncToCloud, refreshProfile } = useAuth();
  const [daemonUrl, setDaemonUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const isLocalhostHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const lastKnown = localStorage.getItem('vistaafk_last_known_daemon_url');
      if (lastKnown) return normalizeWsUrl(lastKnown);
      return isLocalhostHost ? 'ws://localhost:8080' : '';
    }
    return '';
  });
  const [secretToken, setSecretToken] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const [authError, setAuthError] = useState<string | null>(null);

  const retryCountRef = useRef<number>(0);
  const failedUrlRef = useRef<string>('');

  const [configs, setConfigs] = useState<BotConfig[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, BotTelemetry>>({});
  const [chatLogs, setChatLogs] = useState<Record<string, ChatMessage[]>>({});
  const [activityLogs, setActivityLogs] = useState<Record<string, ActivityLog[]>>({});
  const [notifications, setNotifications] = useState<VistaNotification[]>([]);

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const savedAccountsRef = useRef<SavedAccount[]>([]);
  savedAccountsRef.current = savedAccounts;
  const processedDiscoveryRef = useRef<string>('');

  const [serverPresets, setServerPresets] = useState<ServerPreset[]>(DEFAULT_SERVER_PRESETS);

  // Microsoft OAuth Discovery State
  const [discoveryDeviceCode, setDiscoveryDeviceCode] = useState<{ userCode: string; verificationUri: string; expiresIn: number } | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'waiting_code' | 'waiting_approval' | 'success' | 'error'>('idle');
  const [discoveryProfiles, setDiscoveryProfiles] = useState<{ java?: { name: string; uuid: string }; bedrock?: { gamertag: string; xuid?: string } } | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const discoveryFilterRef = useRef<'both' | 'java' | 'bedrock'>('both');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingReceivedRef = useRef<number>(Date.now());
  const [isConnectionLocked, setIsConnectionLocked] = useState<boolean>(true);

  // Load connection lock preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vistaafk_connection_locked');
      if (saved !== null) {
        setIsConnectionLocked(saved === 'true');
      }
    }
  }, []);

  const toggleConnectionLock = useCallback((locked?: boolean) => {
    setIsConnectionLocked((prev) => {
      const next = locked !== undefined ? locked : !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('vistaafk_connection_locked', next ? 'true' : 'false');
      }
      return next;
    });
  }, []);

  // Check for URL parameters ?connect=wss://... or ?daemon=... on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connectParam = params.get('connect') || params.get('daemon');
    if (connectParam) {
      const norm = normalizeWsUrl(connectParam);
      if (norm) {
        setDaemonUrl(norm);
        retryCountRef.current = 0;
        failedUrlRef.current = '';
        setConnectionAttempts(0);
        localStorage.setItem('vistaafk_last_known_daemon_url', norm);
        if (user) {
          const username = user.username.toLowerCase();
          localStorage.setItem(`vistaafk_${username}_daemon_url`, norm);
          syncToCloud({ daemonUrl: norm });
        } else {
          localStorage.setItem('vistaafk_guest_daemon_url', norm);
        }
      }
    }
  }, [user, syncToCloud]);

  // Sync with logged-in user cloud setup or guest mode
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!user) {
      // Logged out: reset state cleanly and do not connect to any daemon
      setSavedAccounts([]);
      setConfigs([]);
      setTelemetry({});
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    // User is signed in: load accounts linked specifically to this user
    const username = user.username.toLowerCase();
    const userAccountsKey = `vistaafk_${username}_saved_accounts`;
    const userPresetsKey = `vistaafk_${username}_server_presets`;
    const userDaemonKey = `vistaafk_${username}_daemon_url`;
    const lastKnownDaemonKey = 'vistaafk_last_known_daemon_url';
    const userTokenKey = `vistaafk_${username}_secret_token`;

    // 1. Daemon URL and Secret Token
    const cachedUrl = typeof window !== 'undefined'
      ? (localStorage.getItem(userDaemonKey) || localStorage.getItem(lastKnownDaemonKey))
      : null;
    const activeDaemonUrl = user.daemonUrl || cachedUrl;

    if (activeDaemonUrl) {
      const norm = normalizeWsUrl(activeDaemonUrl);
      if (norm && norm !== daemonUrl) {
        setDaemonUrl(norm);
        retryCountRef.current = 0;
        setConnectionAttempts(0);
        failedUrlRef.current = '';
        if (wsRef.current) {
          try { wsRef.current.close(); } catch (e) {}
        }
      } else {
        // Uniform sync across tabs: reset pause so newly opened tab or refreshed window connects immediately
        retryCountRef.current = 0;
        setConnectionAttempts(0);
        failedUrlRef.current = '';
      }
      // If user.daemonUrl in Supabase was null, auto-sync this known working daemonUrl to Supabase immediately!
      if (!user.daemonUrl && norm && !norm.includes('localhost')) {
        syncToCloud({ daemonUrl: norm });
      }
    }
    const activeToken = user.secretToken !== undefined ? user.secretToken : (typeof window !== 'undefined' ? localStorage.getItem(userTokenKey) : null);
    if (activeToken !== null && activeToken !== secretToken) {
      setSecretToken(activeToken);
    }

    // 2. Saved Accounts: Load from user profile or user-scoped storage, migrating legacy global storage if needed
    let accountsToLoad: SavedAccount[] = [];
    if (Array.isArray(user.savedAccounts) && user.savedAccounts.length > 0) {
      accountsToLoad = user.savedAccounts;
    } else if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(userAccountsKey);
      if (cached) {
        try {
          accountsToLoad = JSON.parse(cached);
        } catch (e) {}
      }

      // Check legacy un-scoped key (from before multi-user accounts) and adopt into this user's profile
      const legacyRaw = localStorage.getItem('vistaafk_saved_accounts');
      if (legacyRaw) {
        try {
          const legacyList: SavedAccount[] = JSON.parse(legacyRaw);
          if (legacyList.length > 0) {
            const map = new Map(accountsToLoad.map((a) => [a.id, a]));
            legacyList.forEach((a) => map.set(a.id, a));
            accountsToLoad = Array.from(map.values());
            syncToCloud({ savedAccounts: accountsToLoad });
          }
          // Remove global key so logged-out users never see it
          localStorage.removeItem('vistaafk_saved_accounts');
        } catch (e) {}
      }
    }

    if (accountsToLoad.length > 0) {
      setSavedAccounts(accountsToLoad);
      if (typeof window !== 'undefined') {
        localStorage.setItem(userAccountsKey, JSON.stringify(accountsToLoad));
      }
    } else {
      setSavedAccounts([]);
    }

    // 3. Server Presets: Load user-scoped presets
    let presetsToLoad = DEFAULT_SERVER_PRESETS;
    if (Array.isArray(user.serverPresets) && user.serverPresets.length > 0) {
      presetsToLoad = user.serverPresets;
    } else if (typeof window !== 'undefined') {
      const cachedPresets = localStorage.getItem(userPresetsKey);
      if (cachedPresets) {
        try {
          presetsToLoad = JSON.parse(cachedPresets);
        } catch (e) {}
      }
    }
    setServerPresets(presetsToLoad);
  }, [user]);

  const saveAccount = (account: SavedAccount) => {
    setSavedAccounts((prev) => {
      const updated = [...prev.filter((a) => a.id !== account.id), account];
      if (typeof window !== 'undefined') {
        if (user) {
          const userAccountsKey = `vistaafk_${user.username.toLowerCase()}_saved_accounts`;
          localStorage.setItem(userAccountsKey, JSON.stringify(updated));
          syncToCloud({ savedAccounts: updated });
        } else {
          localStorage.setItem('vistaafk_guest_saved_accounts', JSON.stringify(updated));
        }
      }
      return updated;
    });
  };

  const deleteSavedAccount = (id: string) => {
    setSavedAccounts((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      if (typeof window !== 'undefined') {
        if (user) {
          const userAccountsKey = `vistaafk_${user.username.toLowerCase()}_saved_accounts`;
          localStorage.setItem(userAccountsKey, JSON.stringify(updated));
          syncToCloud({ savedAccounts: updated, deletedAccountId: id } as any);
        } else {
          localStorage.setItem('vistaafk_guest_saved_accounts', JSON.stringify(updated));
        }
      }
      return updated;
    });
  };

  const handleDiscoveredProfiles = useCallback((
    profiles: { java?: { name: string; uuid: string }; bedrock?: { gamertag: string; xuid?: string } },
    filter: 'both' | 'java' | 'bedrock' = 'both'
  ) => {
    const discoveryKey = `${profiles.java?.uuid || profiles.java?.name || ''}:${profiles.bedrock?.gamertag || ''}`;
    if (discoveryKey && processedDiscoveryRef.current === discoveryKey) {
      return;
    }
    processedDiscoveryRef.current = discoveryKey;

    const currentAccounts = savedAccountsRef.current || [];
    const newlyAdded: string[] = [];

    const javaProf = profiles.java;
    if ((filter === 'both' || filter === 'java') && javaProf?.name) {
      const alreadyExists = currentAccounts.some(
        (a) =>
          (a.uuid && javaProf.uuid && a.uuid === javaProf.uuid) ||
          a.name.toLowerCase() === javaProf.name.toLowerCase()
      );
      if (!alreadyExists) {
        const javaAccount: SavedAccount = {
          id: `msa-java-${javaProf.name.toLowerCase()}`,
          name: javaProf.name,
          authType: 'microsoft',
          edition: 'java',
          uuid: javaProf.uuid,
          createdAt: Date.now(),
        };
        saveAccount(javaAccount);
        newlyAdded.push(`${javaProf.name} (Java)`);
      }
    }

    const bedrockProf = profiles.bedrock;
    if ((filter === 'both' || filter === 'bedrock') && bedrockProf?.gamertag) {
      const alreadyExists = currentAccounts.some(
        (a) =>
          (a.gamertag && a.gamertag.toLowerCase() === bedrockProf.gamertag.toLowerCase()) ||
          a.name.toLowerCase() === bedrockProf.gamertag.toLowerCase()
      );
      if (!alreadyExists) {
        const bedrockAccount: SavedAccount = {
          id: `msa-bedrock-${bedrockProf.gamertag.toLowerCase()}`,
          name: bedrockProf.gamertag,
          gamertag: bedrockProf.gamertag,
          authType: 'microsoft',
          edition: 'bedrock',
          createdAt: Date.now(),
        };
        saveAccount(bedrockAccount);
        newlyAdded.push(`${bedrockProf.gamertag} (Bedrock)`);
      }
    }

    if (newlyAdded.length > 0) {
      const notif: VistaNotification = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        level: 'success',
        message: `🎮 Linked Microsoft Account: ${newlyAdded.join(' & ')} added to Vault!`,
      };
      setNotifications((prev) => {
        if (prev.some((n) => n.message === notif.message)) return prev;
        return [notif, ...prev.slice(0, 19)];
      });
    }
  }, []);

  const saveServerPreset = (preset: ServerPreset) => {
    setServerPresets((prev) => {
      const updated = [...prev.filter((p) => p.id !== preset.id), preset];
      if (typeof window !== 'undefined') {
        if (user) {
          const userPresetsKey = `vistaafk_${user.username.toLowerCase()}_server_presets`;
          localStorage.setItem(userPresetsKey, JSON.stringify(updated));
          syncToCloud({ serverPresets: updated });
        } else {
          localStorage.setItem('vistaafk_guest_server_presets', JSON.stringify(updated));
        }
      }
      return updated;
    });
  };

  const deleteServerPreset = (id: string) => {
    setServerPresets((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      if (typeof window !== 'undefined') {
        if (user) {
          const userPresetsKey = `vistaafk_${user.username.toLowerCase()}_server_presets`;
          localStorage.setItem(userPresetsKey, JSON.stringify(updated));
          syncToCloud({ serverPresets: updated });
        } else {
          localStorage.setItem('vistaafk_guest_server_presets', JSON.stringify(updated));
        }
      }
      return updated;
    });
  };

  const username = user?.username;

  const connect = useCallback((force: boolean = false) => {
    if (typeof window === 'undefined') return;
    if (!username) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    const targetUrl = normalizeWsUrl(daemonUrl);
    if (!targetUrl) {
      setIsConnecting(false);
      return;
    }

    const isLocalhostHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isLocalhostHost && (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1'))) {
      setIsConnecting(false);
      return;
    }

    // If target URL changed, reset retry count
    if (targetUrl !== failedUrlRef.current) {
      retryCountRef.current = 0;
      failedUrlRef.current = targetUrl;
      setConnectionAttempts(0);
    }

    if (force) {
      retryCountRef.current = 0;
      setConnectionAttempts(0);
    } else if (!isConnectionLocked && retryCountRef.current >= 3) {
      console.log(`[VistaAFK WS Provider] Max retries reached (3) for ${targetUrl}. Pausing auto-reconnect.`);
      setIsConnecting(false);
      return;
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setIsConnecting(true);
    setAuthError(null);

    try {
      console.log('[VistaAFK WS Provider] Connecting to:', targetUrl);
      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[VistaAFK WS Provider] Connected successfully to daemon!');
        retryCountRef.current = 0;
        setConnectionAttempts(0);
        setIsConnected(true);
        setIsConnecting(false);
        setAuthError(null);
        lastPingReceivedRef.current = Date.now();

        // Authenticate immediately upon connection
        ws.send(JSON.stringify({ type: 'AUTH', payload: { token: secretToken || undefined, username } }));

        // Start client keepalive ping every 5 seconds to keep connection rock solid without data bloat
        if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'PING' }));
            } catch (e) {}
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        lastPingReceivedRef.current = Date.now();
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'AUTH_SUCCESS':
              setAuthError(null);
              break;

            case 'AUTH_FAILED':
              setAuthError(msg.payload?.reason || 'Authentication failed');
              break;

            case 'INIT_STATE': {
              const rawConfigs: BotConfig[] = msg.payload.configs || [];
              const sanitizedConfigs = rawConfigs.map((c) => {
                if ((c.port === 19132 || c.id.includes('bedrock')) && c.edition !== 'bedrock') {
                  return { ...c, edition: 'bedrock' as const };
                }
                return c;
              });
              setConfigs(sanitizedConfigs);
              setTelemetry(msg.payload.telemetry || {});
              if (msg.payload.activityLogs) {
                setActivityLogs(msg.payload.activityLogs);
              }
              break;
            }

            case 'BOT_CONFIG_ADDED': {
              const c = msg.payload;
              const sanitized = ((c.port === 19132 || c.id.includes('bedrock')) && c.edition !== 'bedrock') ? { ...c, edition: 'bedrock' as const } : c;
              setConfigs((prev) => [...prev.filter((item) => item.id !== sanitized.id), sanitized]);
              break;
            }

            case 'BOT_CONFIG_UPDATED': {
              const c = msg.payload;
              const sanitized = ((c.port === 19132 || c.id.includes('bedrock')) && c.edition !== 'bedrock') ? { ...c, edition: 'bedrock' as const } : c;
              setConfigs((prev) => prev.map((item) => (item.id === sanitized.id ? sanitized : item)));
              break;
            }

            case 'BOT_CONFIG_REMOVED':
              setConfigs((prev) => prev.filter((c) => c.id !== msg.payload.botId));
              setTelemetry((prev) => {
                const next = { ...prev };
                delete next[msg.payload.botId];
                return next;
              });
              break;

            case 'TELEMETRY_UPDATE': {
              const item: BotTelemetry = msg.payload;
              setTelemetry((prev) => ({
                ...prev,
                [item.id]: item,
              }));
              break;
            }

            case 'CHAT_MESSAGE': {
              const chat: ChatMessage = msg.payload;
              setChatLogs((prev) => {
                const current = prev[chat.botId] || [];
                const last = current[current.length - 1];
                if (
                  last &&
                  last.message === chat.message &&
                  last.sender === chat.sender &&
                  Math.abs(last.timestamp - chat.timestamp) < 2000
                ) {
                  return prev;
                }
                return {
                  ...prev,
                  [chat.botId]: [...current.slice(-150), chat],
                };
              });
              break;
            }

            case 'ACTIVITY_LOG': {
              const log: ActivityLog = msg.payload;
              setActivityLogs((prev) => {
                const current = prev[log.botId] || [];
                const last = current[current.length - 1];
                if (last && last.message === log.message && Math.abs(log.timestamp - last.timestamp) < 2500) {
                  return prev;
                }
                return {
                  ...prev,
                  [log.botId]: [...current.slice(-60), log],
                };
              });
              break;
            }

            case 'NOTIFICATION': {
              const notif: VistaNotification = {
                id: Math.random().toString(36).substring(2, 9),
                timestamp: Date.now(),
                level: msg.payload.level,
                message: msg.payload.message,
                botId: msg.payload.botId,
              };
              setNotifications((prev) => {
                // Reject duplicate notification arriving within 15 seconds to prevent spam
                if (prev.some((n) => n.message === notif.message && Math.abs(Date.now() - n.timestamp) < 15000)) {
                  return prev;
                }
                return [notif, ...prev.slice(0, 14)];
              });
              break;
            }

            case 'MICROSOFT_DEVICE_CODE': {
              setDiscoveryDeviceCode(msg.payload);
              setDiscoveryStatus('waiting_approval');
              break;
            }

            case 'MICROSOFT_PROFILES_DISCOVERED': {
              const profiles = msg.payload;
              setDiscoveryProfiles(profiles);
              setDiscoveryStatus('success');
              handleDiscoveredProfiles(profiles, discoveryFilterRef.current);
              break;
            }

            case 'MICROSOFT_DISCOVERY_ERROR': {
              setDiscoveryError(msg.payload.message);
              setDiscoveryStatus('error');
              break;
            }
          }
        } catch (e) {
          console.error('[VistaAFK WS Provider] Parse error:', e);
        }
      };

      ws.onclose = (event) => {
        console.warn(`[VistaAFK WS Provider] Disconnected. Code: ${event.code}, Reason: "${event.reason}"`);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

        // Reset telemetry status to offline and uptime to 0 so UI never shows stale online status or ticking uptime
        setTelemetry((prev) => {
          const updated: Record<string, BotTelemetry> = {};
          for (const [id, t] of Object.entries(prev)) {
            updated[id] = { ...t, status: 'offline', uptimeSeconds: 0 };
          }
          return updated;
        });

        // Resilient background reconnect: relentless 1.2s reconnect when connection is locked
        if (username) {
          retryCountRef.current += 1;
          setConnectionAttempts(retryCountRef.current);

          const delay = isConnectionLocked
            ? 1200
            : retryCountRef.current === 1
            ? 3000
            : retryCountRef.current === 2
            ? 6000
            : retryCountRef.current === 3
            ? 10000
            : 15000;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect(true);
          }, delay);
        }
      };

      ws.onerror = (err) => {
        console.error('[VistaAFK WS Provider] Socket error occurred:', err);
        try {
          ws.close();
        } catch (e) {}
      };
    } catch (e) {
      console.error('[VistaAFK WS Provider] Connect exception:', e);
      setIsConnecting(false);
    }
  }, [username, daemonUrl, secretToken, isConnectionLocked]);

  // Active connection watchdog: verifies that messages/heartbeats are flowing; if connection goes silently dead (Cloudflare tunnel drop), immediately force-reconnects
  useEffect(() => {
    if (!username) return;

    const watchdog = setInterval(() => {
      if (isConnected && wsRef.current) {
        const timeSinceLastPing = Date.now() - lastPingReceivedRef.current;
        if (timeSinceLastPing > 14000) {
          console.warn(`[VistaAFK WS Provider] Watchdog detected silent socket drop (${Math.round(timeSinceLastPing / 1000)}s silent). Reconnecting now...`);
          try {
            wsRef.current.close();
          } catch (e) {}
        }
      }
    }, 3000);

    return () => clearInterval(watchdog);
  }, [username, isConnected]);

  // Main connection lifecycle
  useEffect(() => {
    if (!username) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [username, daemonUrl, secretToken, connect]);

  // Active daemon tunnel detection: polls cloud every 2.5s while disconnected so Termux links sync automatically
  useEffect(() => {
    if (!username || isConnected) return;

    refreshProfile();
    const pollInterval = setInterval(() => {
      refreshProfile();
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [username, isConnected, refreshProfile]);

  const retryConnection = useCallback(() => {
    retryCountRef.current = 0;
    setConnectionAttempts(0);
    connect(true);
  }, [connect]);

  const send = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const updateDaemonConfig = (rawUrl: string, token: string) => {
    const url = normalizeWsUrl(rawUrl);
    setDaemonUrl(url);
    setSecretToken(token);
    retryCountRef.current = 0;
    setConnectionAttempts(0);
    failedUrlRef.current = '';
    if (typeof window !== 'undefined') {
      if (url && !url.includes('localhost')) {
        localStorage.setItem('vistaafk_last_known_daemon_url', url);
      }
      if (user) {
        const username = user.username.toLowerCase();
        localStorage.setItem(`vistaafk_${username}_daemon_url`, url);
        localStorage.setItem(`vistaafk_${username}_secret_token`, token);
        syncToCloud({ daemonUrl: url, secretToken: token });
      } else {
        localStorage.setItem('vistaafk_guest_daemon_url', url);
        localStorage.setItem('vistaafk_guest_secret_token', token);
      }
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    setTimeout(() => connect(true), 150);
  };

  const addBot = (config: BotConfig) => send({ type: 'ADD_BOT', payload: config });
  const updateBot = (config: BotConfig) => send({ type: 'UPDATE_BOT', payload: config });
  const removeBot = (botId: string) => send({ type: 'REMOVE_BOT', payload: { botId } });
  const startBot = (botId: string) => send({ type: 'START_BOT', payload: { botId } });
  const stopBot = (botId: string) => send({ type: 'STOP_BOT', payload: { botId } });
  const startAll = () => send({ type: 'START_ALL' });
  const stopAll = () => send({ type: 'STOP_ALL' });
  const sendChat = (botId: string, message: string) => send({ type: 'SEND_CHAT', payload: { botId, message } });
  const moveBot = (botId: string, control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', state: boolean) =>
    send({ type: 'MOVE_BOT', payload: { botId, control, state } });
  const togglePatrol = (botId: string, enabled: boolean) =>
    send({ type: 'TOGGLE_PATROL', payload: { botId, enabled } });
  const lookAt = (botId: string, yaw: number, pitch: number) =>
    send({ type: 'LOOK_AT', payload: { botId, yaw, pitch } });
  const moveInventoryItem = (botId: string, sourceSlot: number, targetSlot: number) =>
    send({ type: 'MOVE_INVENTORY_ITEM', payload: { botId, sourceSlot, targetSlot } });
  const setQuickBarSlot = (botId: string, slot: number) =>
    send({ type: 'SET_QUICK_BAR_SLOT', payload: { botId, slot } });
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);
  const clearNotifications = useCallback(() => setNotifications([]), []);
  const resetDiscovery = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setDiscoveryStatus('idle');
    setDiscoveryDeviceCode(null);
    setDiscoveryProfiles(null);
    setDiscoveryError(null);
  }, []);

  const discoverMicrosoftAccount = useCallback(async (email?: string, editionFilter: 'both' | 'java' | 'bedrock' = 'both') => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    discoveryFilterRef.current = editionFilter;
    setDiscoveryStatus('waiting_code');
    setDiscoveryDeviceCode(null);
    setDiscoveryProfiles(null);
    setDiscoveryError(null);

    try {
      const res = await fetch('/api/accounts/device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email ? email.trim() : undefined }),
      });

      if (!res.ok) {
        throw new Error('Failed to initiate Microsoft device code flow');
      }

      const data = await res.json();
      if (!data.success || !data.userCode || !data.deviceCode) {
        throw new Error(data.error || 'Failed to obtain Microsoft device code');
      }

      const devCode = {
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        expiresIn: data.expiresIn,
      };
      setDiscoveryDeviceCode(devCode);
      setDiscoveryStatus('waiting_approval');

      // If daemon is open, notify daemon so it also knows discovery is in progress
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({
            type: 'DISCOVER_MICROSOFT_ACCOUNT',
            payload: { email: email ? email.trim() : undefined, editionFilter },
          }));
        } catch (e) {}
      }

      const pollStartTime = Date.now();
      const maxPollTime = (data.expiresIn || 900) * 1000;

      pollTimerRef.current = setInterval(async () => {
        if (Date.now() - pollStartTime > maxPollTime) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setDiscoveryError('Authentication session timed out. Please try again.');
          setDiscoveryStatus('error');
          return;
        }

        try {
          const pollRes = await fetch('/api/accounts/poll-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceCode: data.deviceCode,
              editionFilter,
            }),
          });

          if (!pollRes.ok) return;

          const pollData = await pollRes.json();
          if (pollData.status === 'pending') {
            return;
          }

          if (pollData.status === 'error') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setDiscoveryError(pollData.error || 'Microsoft authentication failed');
            setDiscoveryStatus('error');
            return;
          }

          if (pollData.status === 'success' && pollData.profiles) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setDiscoveryProfiles(pollData.profiles);
            setDiscoveryStatus('success');
            handleDiscoveredProfiles(pollData.profiles, editionFilter);
          }
        } catch (e) {
          console.warn('[VistaAFK] Polling token error:', e);
        }
      }, 4000);
    } catch (err: any) {
      console.warn('[VistaAFK] Cloud discovery failed, checking WebSocket daemon...', err);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        send({
          type: 'DISCOVER_MICROSOFT_ACCOUNT',
          payload: {
            email: email ? email.trim() : undefined,
            editionFilter,
          },
        });
      } else {
        setDiscoveryError(err?.message || 'Failed to start Microsoft authentication');
        setDiscoveryStatus('error');
      }
    }
  }, [handleDiscoveredProfiles]);

  // Deploy a saved account to a specific server instance
  const deployAccountToServer = (
    account: SavedAccount,
    server: { host: string; port: number; version?: string; edition?: MinecraftEdition }
  ) => {
    // DonutSMP is strictly sensitive to non-idle actions; default anti-actions to OFF for safety
    const isDonut = server.host.toLowerCase().includes('donut');
    const edition = server.edition || account.edition || (server.port === 19132 ? 'bedrock' : 'java');
    let host = (server.host || '').trim();
    let port = edition === 'bedrock' && server.port === 25565 ? 19132 : server.port;

    // Auto-map DonutSMP Bedrock server address
    if (edition === 'bedrock' && host.toLowerCase().includes('donutsmp.net') && !host.toLowerCase().startsWith('bedrock.')) {
      host = 'bedrock.donutsmp.net';
      port = 19132;
    } else if (edition === 'bedrock' && host.toLowerCase().includes('freshsmp') && port === 25565) {
      port = 19132;
    }

    const newBotConfig: BotConfig = {
      id: `${account.id}-${host.replace(/[^a-zA-Z0-9]/g, '')}`,
      name: account.name,
      authType: account.authType,
      edition,
      host,
      port,
      version: (server.version && server.version.trim() !== '') ? server.version.trim() : undefined,
      autoReconnect: true,
      reconnectDelayMs: 5000,
      antiAfk: {
        enabled: !isDonut, // Disabled by default on DonutSMP
        rotateHead: !isDonut,
        jump: false,
        sneak: !isDonut,
        swingArm: !isDonut,
        intervalSeconds: 12,
      },
      survival: {
        autoEat: !isDonut, // Disabled by default on DonutSMP
        eatThreshold: 14,
        autoTotem: !isDonut, // Disabled by default on DonutSMP
      },
    };
    addBot(newBotConfig);
    setTimeout(() => {
      startBot(newBotConfig.id);
    }, 500);
  };

  return (
    <VistaWebSocketContext.Provider
      value={{
        daemonUrl,
        secretToken,
        isConnected,
        isConnecting,
        authError,
        configs,
        telemetry,
        chatLogs,
        activityLogs,
        notifications,
        savedAccounts,
        serverPresets,
        saveAccount,
        deleteSavedAccount,
        saveServerPreset,
        deleteServerPreset,
        deployAccountToServer,
        updateDaemonConfig,
        connect,
        addBot,
        updateBot,
        removeBot,
        startBot,
        stopBot,
        startAll,
        stopAll,
        sendChat,
        moveBot,
        togglePatrol,
        lookAt,
        moveInventoryItem,
        setQuickBarSlot,
        dismissNotification,
        clearNotifications,
        discoveryDeviceCode,
        discoveryStatus,
        discoveryProfiles,
        discoveryError,
        discoverMicrosoftAccount,
        resetDiscovery,
        retryConnection,
        connectionAttempts,
        isConnectionLocked,
        toggleConnectionLock,
      }}
    >
      {children}
    </VistaWebSocketContext.Provider>
  );
};

export function useVistaWebSocketContext(): VistaWebSocketContextType {
  const context = useContext(VistaWebSocketContext);
  if (!context) {
    throw new Error('useVistaWebSocketContext must be used within a VistaWebSocketProvider');
  }
  return context;
}

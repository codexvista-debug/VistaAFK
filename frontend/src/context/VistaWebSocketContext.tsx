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
  if (!url) return 'ws://localhost:8080';

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

  // 3. Normal protocol conversions
  if (url.startsWith('https://')) {
    url = 'wss://' + url.slice('https://'.length);
  } else if (url.startsWith('http://')) {
    url = 'ws://' + url.slice('http://'.length);
  } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = 'wss://' + url;
  }

  // 4. Strip trailing slashes
  url = url.replace(/\/+$/, '');

  // 5. If user pasted trycloudflare.com with :8080, strip :8080
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
}

const VistaWebSocketContext = createContext<VistaWebSocketContextType | null>(null);

export const VistaWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, syncToCloud, refreshProfile } = useAuth();
  const [daemonUrl, setDaemonUrl] = useState<string>('ws://localhost:8080');
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

  // Check for URL parameters ?connect=wss://... or ?daemon=... on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connectParam = params.get('connect') || params.get('daemon');
    if (connectParam) {
      const norm = normalizeWsUrl(connectParam);
      setDaemonUrl(norm);
      retryCountRef.current = 0;
      failedUrlRef.current = '';
      setConnectionAttempts(0);
      if (user) {
        const username = user.username.toLowerCase();
        localStorage.setItem(`vistaafk_${username}_daemon_url`, norm);
        syncToCloud({ daemonUrl: norm });
      } else {
        localStorage.setItem('vistaafk_guest_daemon_url', norm);
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
    const userTokenKey = `vistaafk_${username}_secret_token`;

    // 1. Daemon URL and Secret Token
    const activeDaemonUrl = user.daemonUrl || (typeof window !== 'undefined' ? localStorage.getItem(userDaemonKey) : null);
    if (activeDaemonUrl) {
      const norm = normalizeWsUrl(activeDaemonUrl);
      if (norm !== daemonUrl) {
        setDaemonUrl(norm);
        retryCountRef.current = 0;
        setConnectionAttempts(0);
        failedUrlRef.current = '';
        if (wsRef.current) {
          try { wsRef.current.close(); } catch (e) {}
        }
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
          syncToCloud({ savedAccounts: updated });
        } else {
          localStorage.setItem('vistaafk_guest_saved_accounts', JSON.stringify(updated));
        }
      }
      return updated;
    });
  };

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

    // If target URL changed, reset retry count
    if (targetUrl !== failedUrlRef.current) {
      retryCountRef.current = 0;
      failedUrlRef.current = targetUrl;
      setConnectionAttempts(0);
    }

    if (force) {
      retryCountRef.current = 0;
      setConnectionAttempts(0);
    } else if (retryCountRef.current >= 3) {
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

        // Authenticate immediately upon connection
        ws.send(JSON.stringify({ type: 'AUTH', payload: { token: secretToken || undefined, username } }));

        // Start client keepalive ping every 10 seconds to keep connection rock solid
        if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'GET_STATE' }));
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
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

              // Automatically copy code to clipboard & open browser tab
              if (typeof window !== 'undefined') {
                if (msg.payload?.userCode) {
                  try {
                    navigator.clipboard.writeText(msg.payload.userCode);
                  } catch (e) {
                    console.warn('[VistaAFK] Clipboard copy failed:', e);
                  }
                }
                if (msg.payload?.verificationUri) {
                  try {
                    window.open(msg.payload.verificationUri, '_blank');
                  } catch (e) {
                    console.warn('[VistaAFK] Popup open failed:', e);
                  }
                }
              }
              break;
            }

            case 'MICROSOFT_PROFILES_DISCOVERED': {
              const profiles = msg.payload;
              setDiscoveryProfiles(profiles);
              setDiscoveryStatus('success');

              const discoveryKey = `${profiles.java?.uuid || profiles.java?.name || ''}:${profiles.bedrock?.gamertag || ''}`;
              if (discoveryKey && processedDiscoveryRef.current === discoveryKey) {
                // Already processed this exact discovery event, do not duplicate
                break;
              }
              processedDiscoveryRef.current = discoveryKey;

              const currentAccounts = savedAccountsRef.current || [];
              const filter = discoveryFilterRef.current;
              const newlyAdded: string[] = [];

              if ((filter === 'both' || filter === 'java') && profiles.java?.name) {
                const alreadyExists = currentAccounts.some(
                  (a) =>
                    (a.uuid && profiles.java?.uuid && a.uuid === profiles.java.uuid) ||
                    a.name.toLowerCase() === profiles.java.name.toLowerCase()
                );
                if (!alreadyExists) {
                  const javaAccount: SavedAccount = {
                    id: `msa-java-${profiles.java.name.toLowerCase()}`,
                    name: profiles.java.name,
                    authType: 'microsoft',
                    edition: 'java',
                    uuid: profiles.java.uuid,
                    createdAt: Date.now(),
                  };
                  saveAccount(javaAccount);
                  newlyAdded.push(`${profiles.java.name} (Java)`);
                }
              }

              if ((filter === 'both' || filter === 'bedrock') && profiles.bedrock?.gamertag) {
                const alreadyExists = currentAccounts.some(
                  (a) =>
                    (a.gamertag && a.gamertag.toLowerCase() === profiles.bedrock.gamertag.toLowerCase()) ||
                    a.name.toLowerCase() === profiles.bedrock.gamertag.toLowerCase()
                );
                if (!alreadyExists) {
                  const bedrockAccount: SavedAccount = {
                    id: `msa-bedrock-${profiles.bedrock.gamertag.toLowerCase()}`,
                    name: profiles.bedrock.gamertag,
                    gamertag: profiles.bedrock.gamertag,
                    authType: 'microsoft',
                    edition: 'bedrock',
                    createdAt: Date.now(),
                  };
                  saveAccount(bedrockAccount);
                  newlyAdded.push(`${profiles.bedrock.gamertag} (Bedrock)`);
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

        // Auto reconnect: attempt one retry after 4s (in case of momentary Wi-Fi blip)
        // If that fails, pause cleanly to keep UI completely stable and prevent blinking!
        if (username) {
          retryCountRef.current += 1;
          setConnectionAttempts(retryCountRef.current);

          if (retryCountRef.current === 1) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, 4000);
          } else {
            console.log(`[VistaAFK WS Provider] Daemon offline at ${targetUrl}. Pausing reconnect to keep UI stable.`);
            setIsConnecting(false);
          }
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
  }, [username, daemonUrl, secretToken]);

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

  // Active daemon tunnel detection: polls cloud every 3.5s while disconnected so Termux links sync automatically
  useEffect(() => {
    if (!username || isConnected) return;

    refreshProfile();
    const pollInterval = setInterval(() => {
      refreshProfile();
    }, 3500);

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
  const discoverMicrosoftAccount = (email?: string, editionFilter: 'both' | 'java' | 'bedrock' = 'both') => {
    discoveryFilterRef.current = editionFilter;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setDiscoveryError('VistaAFK daemon is not connected. Please ensure your local daemon terminal is running.');
      setDiscoveryStatus('error');
      return;
    }
    setDiscoveryStatus('waiting_code');
    setDiscoveryDeviceCode(null);
    setDiscoveryProfiles(null);
    setDiscoveryError(null);
    send({
      type: 'DISCOVER_MICROSOFT_ACCOUNT',
      payload: {
        email: email ? email.trim() : undefined,
        editionFilter,
      },
    });
  };

  const resetDiscovery = () => {
    setDiscoveryStatus('idle');
    setDiscoveryDeviceCode(null);
    setDiscoveryProfiles(null);
    setDiscoveryError(null);
  };

  // Deploy a saved account to a specific server instance
  const deployAccountToServer = (
    account: SavedAccount,
    server: { host: string; port: number; version?: string; edition?: MinecraftEdition }
  ) => {
    // DonutSMP is strictly sensitive to non-idle actions; default anti-actions to OFF for safety
    const isDonut = server.host.toLowerCase().includes('donut');
    const edition = server.edition || account.edition || (server.port === 19132 ? 'bedrock' : 'java');
    const port = edition === 'bedrock' && server.port === 25565 ? 19132 : server.port;

    const newBotConfig: BotConfig = {
      id: `${account.id}-${server.host.replace(/[^a-zA-Z0-9]/g, '')}`,
      name: account.name,
      authType: account.authType,
      edition,
      host: server.host,
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

'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { BotConfig, BotTelemetry, ChatMessage, ActivityLog, VistaNotification, SavedAccount, ServerPreset } from '../types';

const DEFAULT_SERVER_PRESETS: ServerPreset[] = [
  { id: 'donutsmp', name: 'DonutSMP', host: 'donutsmp.net', port: 25565, version: '' },
  { id: 'freshsmp', name: 'FreshSMP', host: 'play.freshsmp.fun', port: 25565, version: '' },
  { id: 'custom', name: 'Other / Custom Server', host: '', port: 25565, version: '' },
];

export function normalizeWsUrl(raw: string): string {
  let url = (raw || '').trim();
  if (!url) return 'ws://localhost:8080';
  if (url.startsWith('https://')) {
    url = 'wss://' + url.slice('https://'.length);
  } else if (url.startsWith('http://')) {
    url = 'ws://' + url.slice('http://'.length);
  } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = 'wss://' + url;
  }
  // Strip trailing slashes
  url = url.replace(/\/+$/, '');
  // If user pasted trycloudflare.com with :8080, strip :8080
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
  deployAccountToServer: (account: SavedAccount, server: { host: string; port: number; version?: string }) => void;
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
  clearNotifications: () => void;
}

const VistaWebSocketContext = createContext<VistaWebSocketContextType | null>(null);

export const VistaWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [daemonUrl, setDaemonUrl] = useState<string>('ws://localhost:8080');
  const [secretToken, setSecretToken] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [configs, setConfigs] = useState<BotConfig[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, BotTelemetry>>({});
  const [chatLogs, setChatLogs] = useState<Record<string, ChatMessage[]>>({});
  const [activityLogs, setActivityLogs] = useState<Record<string, ActivityLog[]>>({});
  const [notifications, setNotifications] = useState<VistaNotification[]>([]);

  // Persistent Accounts & Server Vault
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [serverPresets, setServerPresets] = useState<ServerPreset[]>(DEFAULT_SERVER_PRESETS);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved daemon URL, token, accounts, and server presets from localStorage once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('vistaafk_daemon_url');
      const savedToken = localStorage.getItem('vistaafk_secret_token');
      if (savedUrl) setDaemonUrl(normalizeWsUrl(savedUrl));
      if (savedToken) setSecretToken(savedToken);

      const accountsRaw = localStorage.getItem('vistaafk_saved_accounts');
      if (accountsRaw) {
        try {
          setSavedAccounts(JSON.parse(accountsRaw));
        } catch (e) {}
      }

      const presetsRaw = localStorage.getItem('vistaafk_server_presets');
      if (presetsRaw) {
        try {
          let parsed: ServerPreset[] = JSON.parse(presetsRaw);
          let modified = false;
          // Migrate old hypixel to donutsmp, local to custom
          parsed = parsed.map((p) => {
            if (p.id === 'hypixel' || p.name.toLowerCase().includes('hypixel')) {
              modified = true;
              return { id: 'donutsmp', name: 'DonutSMP', host: 'donutsmp.net', port: 25565, version: '' };
            }
            if (p.id === 'local' || p.name.toLowerCase().includes('local test')) {
              modified = true;
              return { id: 'custom', name: 'Other / Custom Server', host: '', port: 25565, version: '' };
            }
            return p;
          });

          if (!parsed.some((p) => p.id === 'donutsmp' || p.host.toLowerCase().includes('donut'))) {
            parsed.unshift({ id: 'donutsmp', name: 'DonutSMP', host: 'donutsmp.net', port: 25565, version: '' });
            modified = true;
          }
          if (!parsed.some((p) => p.id === 'custom' || p.id === 'other')) {
            parsed.push({ id: 'custom', name: 'Other / Custom Server', host: '', port: 25565, version: '' });
            modified = true;
          }

          if (modified && typeof window !== 'undefined') {
            localStorage.setItem('vistaafk_server_presets', JSON.stringify(parsed));
          }
          setServerPresets(parsed);
        } catch (e) {
          setServerPresets(DEFAULT_SERVER_PRESETS);
        }
      } else {
        setServerPresets(DEFAULT_SERVER_PRESETS);
      }
    }
  }, []);

  const saveAccount = (account: SavedAccount) => {
    setSavedAccounts((prev) => {
      const updated = [...prev.filter((a) => a.id !== account.id), account];
      if (typeof window !== 'undefined') {
        localStorage.setItem('vistaafk_saved_accounts', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const deleteSavedAccount = (id: string) => {
    setSavedAccounts((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('vistaafk_saved_accounts', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const saveServerPreset = (preset: ServerPreset) => {
    setServerPresets((prev) => {
      const updated = [...prev.filter((p) => p.id !== preset.id), preset];
      if (typeof window !== 'undefined') {
        localStorage.setItem('vistaafk_server_presets', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const deleteServerPreset = (id: string) => {
    setServerPresets((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('vistaafk_server_presets', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setIsConnecting(true);
    setAuthError(null);

    try {
      const targetUrl = normalizeWsUrl(daemonUrl);
      console.log('[VistaAFK WS Provider] Connecting to:', targetUrl);
      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[VistaAFK WS Provider] Connected successfully to daemon!');
        setIsConnected(true);
        setIsConnecting(false);
        setAuthError(null);

        // Authenticate immediately upon connection
        ws.send(JSON.stringify({ type: 'AUTH', payload: { token: secretToken || undefined } }));

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

            case 'INIT_STATE':
              setConfigs(msg.payload.configs || []);
              setTelemetry(msg.payload.telemetry || {});
              if (msg.payload.activityLogs) {
                setActivityLogs(msg.payload.activityLogs);
              }
              break;

            case 'BOT_CONFIG_ADDED':
              setConfigs((prev) => [...prev.filter((c) => c.id !== msg.payload.id), msg.payload]);
              break;

            case 'BOT_CONFIG_UPDATED':
              setConfigs((prev) => prev.map((c) => (c.id === msg.payload.id ? msg.payload : c)));
              break;

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
              setNotifications((prev) => [notif, ...prev.slice(0, 19)]);
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

        // Auto reconnect every 3 seconds
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.error('[VistaAFK WS Provider] Socket error occurred:', err);
        setIsConnected(false);
        setIsConnecting(false);
        try {
          ws.close();
        } catch (e) {}
      };
    } catch (e) {
      console.error('[VistaAFK WS Provider] Connect exception:', e);
      setIsConnecting(false);
    }
  }, [daemonUrl, secretToken]);

  useEffect(() => {
    connect();

    // Resilient connection watchdog: automatically reconnects whenever socket drops
    const watchdog = setInterval(() => {
      if (typeof window === 'undefined') return;
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    }, 3000);

    return () => {
      clearInterval(watchdog);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('vistaafk_daemon_url', url);
      localStorage.setItem('vistaafk_secret_token', token);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
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
  const clearNotifications = () => setNotifications([]);

  // Deploy a saved account to a specific server instance
  const deployAccountToServer = (
    account: SavedAccount,
    server: { host: string; port: number; version?: string }
  ) => {
    // DonutSMP is strictly sensitive to non-idle actions; default anti-actions to OFF for safety
    const isDonut = server.host.toLowerCase().includes('donut');

    const newBotConfig: BotConfig = {
      id: `${account.id}-${server.host.replace(/[^a-zA-Z0-9]/g, '')}`,
      name: account.name,
      authType: account.authType,
      host: server.host,
      port: server.port,
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
        clearNotifications,
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

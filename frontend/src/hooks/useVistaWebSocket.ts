'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BotConfig, BotTelemetry, ChatMessage, VistaNotification } from '../types';

export function useVistaWebSocket() {
  const [daemonUrl, setDaemonUrl] = useState<string>('ws://localhost:8080');
  const [secretToken, setSecretToken] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [configs, setConfigs] = useState<BotConfig[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, BotTelemetry>>({});
  const [chatLogs, setChatLogs] = useState<Record<string, ChatMessage[]>>({});
  const [notifications, setNotifications] = useState<VistaNotification[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved daemon URL and token from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('vistaafk_daemon_url');
      const savedToken = localStorage.getItem('vistaafk_secret_token');
      if (savedUrl) setDaemonUrl(savedUrl);
      if (savedToken) setSecretToken(savedToken);
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setIsConnecting(true);
    setAuthError(null);

    try {
      const ws = new WebSocket(daemonUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setAuthError(null);

        // Authenticate immediately upon connection
        ws.send(JSON.stringify({ type: 'AUTH', payload: { token: secretToken || undefined } }));
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
                return {
                  ...prev,
                  [chat.botId]: [...current.slice(-150), chat],
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
          console.error('[VistaAFK WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Auto reconnect every 4 seconds
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 4000);
      };

      ws.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };
    } catch (e) {
      setIsConnecting(false);
    }
  }, [daemonUrl, secretToken]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
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

  const updateDaemonConfig = (url: string, token: string) => {
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

  return {
    daemonUrl,
    secretToken,
    isConnected,
    isConnecting,
    authError,
    configs,
    telemetry,
    chatLogs,
    notifications,
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
  };
}

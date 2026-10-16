'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  RefreshCw,
  Server,
  Activity,
  Heart,
  Clock,
  Smartphone,
  Laptop,
  CheckCircle2,
  Users,
  Settings,
  AlertCircle,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { ChatMessage } from '../types';
import { MinecraftChatMessage } from './MinecraftChatMessage';

export interface FleetBotInfo {
  id: string;
  name: string;
  edition: 'java' | 'bedrock';
  host: string;
  port: number;
  status: 'online' | 'offline' | 'connecting' | 'error' | 'reconnecting';
  health?: number;
  maxHealth?: number;
  food?: number;
  uptimeSeconds?: number;
  lastSeen?: number;
  dimension?: string;
  recentChats?: ChatMessage[];
}

export interface FleetAccountInfo {
  id: string;
  name: string;
  gamertag?: string;
  edition: 'java' | 'bedrock';
  authType: string;
}

export interface FleetUserInfo {
  id: string;
  username: string;
  role: 'admin' | 'user';
  isDaemonOnline: boolean;
  daemonDeviceType?: 'pc' | 'mobile';
  daemonDeviceLabel?: string;
  daemonUrl?: string;
  secretToken?: string;
  lastHeartbeat?: number;
  bots: FleetBotInfo[];
  savedAccounts: FleetAccountInfo[];
}

interface AdminFleetWidgetProps {
  token: string | null;
  currentUser?: string;
  localTelemetry?: Record<string, any>;
  onRefreshTrigger?: () => void;
}

function formatDimension(dim?: string): string {
  if (!dim || dim === 'unknown') return 'Overworld';
  const clean = dim.toLowerCase().replace(/^(minecraft:)?(the_)?/, '');
  if (clean.includes('nether')) return 'Nether';
  if (clean.includes('end')) return 'The End';
  if (clean.includes('overworld')) return 'Overworld';
  return dim.charAt(0).toUpperCase() + dim.slice(1);
}

function formatUptime(seconds?: number): string {
  if (seconds === undefined || seconds === null || seconds < 0) return '0s';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatChatTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export const AdminFleetWidget: React.FC<AdminFleetWidgetProps> = ({
  token,
  currentUser,
  localTelemetry = {},
}) => {
  const [fleetUsers, setFleetUsers] = useState<FleetUserInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [liveBotTelemetry, setLiveBotTelemetry] = useState<Record<string, any>>({});
  const [liveDaemonStatus, setLiveDaemonStatus] = useState<Record<string, boolean>>({});
  const [liveChatLogs, setLiveChatLogs] = useState<Record<string, ChatMessage[]>>({});
  const daemonSocketsRef = useRef<Map<string, { ws: WebSocket; pingTimer?: any; targetUrl: string }>>(new Map());

  const fetchFleet = useCallback(async (manual = false) => {
    const activeToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('vistaafk_auth_token') : null);
    if (!activeToken) return;

    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/fleet', {
        headers: { Authorization: `Bearer ${activeToken}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setFleetUsers(data.users);
          setError(null);
          setLastUpdated(new Date());
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to sync fleet overview');
      }
    } catch (err: any) {
      setError(err?.message || 'Connection error syncing fleet');
    } finally {
      setIsLoading(false);
      if (manual) setIsRefreshing(false);
    }
  }, [token]);

  // Initial fetch and 10s auto-refresh interval
  useEffect(() => {
    fetchFleet();
    const interval = setInterval(() => {
      fetchFleet();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchFleet]);

  // Filter out current user (vista) so their own accounts are not duplicated on the right
  const otherUsers = fleetUsers.filter(
    (u) => u.username.toLowerCase() !== (currentUser || 'vista').toLowerCase()
  );

  // Synchronize live WebSocket connections to each other user's daemonUrl
  useEffect(() => {
    const activeSockets = daemonSocketsRef.current;

    otherUsers.forEach((u) => {
      const userKey = u.username.toLowerCase();
      let daemonUrl = u.daemonUrl ? String(u.daemonUrl).trim() : null;

      if (!daemonUrl) return;

      const cfMatch = daemonUrl.match(/([a-zA-Z0-9-]+\.trycloudflare\.com)/i);
      if (cfMatch && cfMatch[1]) {
        daemonUrl = `wss://${cfMatch[1]}`;
      } else {
        daemonUrl = daemonUrl.replace(/^(wss?):\/+/i, '$1://');
        if (daemonUrl.startsWith('https://')) daemonUrl = 'wss://' + daemonUrl.slice('https://'.length);
        if (daemonUrl.startsWith('http://')) daemonUrl = 'ws://' + daemonUrl.slice('http://'.length);
        if (!daemonUrl.startsWith('ws://') && !daemonUrl.startsWith('wss://')) daemonUrl = 'wss://' + daemonUrl;
      }

      const existing = activeSockets.get(userKey);
      if (existing) {
        if (
          existing.targetUrl === daemonUrl &&
          (existing.ws.readyState === WebSocket.OPEN || existing.ws.readyState === WebSocket.CONNECTING)
        ) {
          return;
        }
        if (existing.pingTimer) clearInterval(existing.pingTimer);
        try {
          existing.ws.close();
        } catch (e) {}
        activeSockets.delete(userKey);
      }

      try {
        const ws = new WebSocket(daemonUrl);
        const entry: { ws: WebSocket; pingTimer?: any; targetUrl: string } = {
          ws,
          targetUrl: daemonUrl,
        };
        activeSockets.set(userKey, entry);

        ws.onopen = () => {
          try {
            ws.send(
              JSON.stringify({
                type: 'AUTH',
                payload: { username: u.username, token: u.secretToken || undefined },
              })
            );
          } catch (e) {}

          setLiveDaemonStatus((prev) => ({ ...prev, [userKey]: true }));

          // Keep alive ping every 8s
          entry.pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'PING' }));
              } catch (e) {}
            }
          }, 8000);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'INIT_STATE') {
              if (msg.payload?.telemetry && typeof msg.payload.telemetry === 'object') {
                const telemMap = msg.payload.telemetry;
                setLiveBotTelemetry((prev) => {
                  const updated = { ...prev };
                  for (const [id, item] of Object.entries(telemMap) as [string, any][]) {
                    updated[id] = item;
                    if (item?.name) {
                      updated[item.name] = item;
                      updated[item.name.toLowerCase()] = item;
                    }
                  }
                  return updated;
                });
              }
              if (msg.payload?.chatLogs && typeof msg.payload.chatLogs === 'object') {
                const logsMap = msg.payload.chatLogs;
                setLiveChatLogs((prev) => {
                  const updated = { ...prev };
                  for (const [id, list] of Object.entries(logsMap) as [string, ChatMessage[]][]) {
                    if (Array.isArray(list)) {
                      updated[id] = list.slice(-20);
                      const botCfg = u.bots.find((b) => b.id === id);
                      if (botCfg?.name) {
                        updated[botCfg.name] = list.slice(-20);
                        updated[botCfg.name.toLowerCase()] = list.slice(-20);
                      }
                    }
                  }
                  return updated;
                });
              }
              setLiveDaemonStatus((prev) => ({ ...prev, [userKey]: true }));
            } else if (msg.type === 'CHAT_MESSAGE' && msg.payload) {
              const chat: ChatMessage = msg.payload;
              if (chat.botId) {
                setLiveChatLogs((prev) => {
                  const cur = prev[chat.botId] || [];
                  const updated = [...cur.slice(-19), chat];
                  const res: Record<string, ChatMessage[]> = {
                    ...prev,
                    [chat.botId]: updated,
                  };
                  const botCfg = u.bots.find((b) => b.id === chat.botId);
                  if (botCfg?.name) {
                    res[botCfg.name] = updated;
                    res[botCfg.name.toLowerCase()] = updated;
                  }
                  return res;
                });
              }
            } else if (msg.type === 'TELEMETRY_UPDATE' && msg.payload) {
              const item = msg.payload;
              if (item.id) {
                setLiveBotTelemetry((prev) => ({
                  ...prev,
                  [item.id]: item,
                  [item.name]: item,
                  [item.name?.toLowerCase()]: item,
                }));
              }
              setLiveDaemonStatus((prev) => ({ ...prev, [userKey]: true }));
            }
          } catch (e) {}
        };

        ws.onerror = () => {
          // Keep fallback active on network error
        };

        ws.onclose = () => {
          if (entry.pingTimer) clearInterval(entry.pingTimer);
          activeSockets.delete(userKey);
          setLiveDaemonStatus((prev) => ({ ...prev, [userKey]: false }));
        };
      } catch (err) {}
    });

    // Cleanup disconnected users
    const currentUserKeys = new Set(otherUsers.map((u) => u.username.toLowerCase()));
    activeSockets.forEach((entry, key) => {
      if (!currentUserKeys.has(key)) {
        if (entry.pingTimer) clearInterval(entry.pingTimer);
        try {
          entry.ws.close();
        } catch (e) {}
        activeSockets.delete(key);
      }
    });
  }, [otherUsers]);

  // Clean up all sockets when unmounting
  useEffect(() => {
    return () => {
      const activeSockets = daemonSocketsRef.current;
      activeSockets.forEach((entry) => {
        if (entry.pingTimer) clearInterval(entry.pingTimer);
        try {
          entry.ws.close();
        } catch (e) {}
      });
      activeSockets.clear();
    };
  }, []);

  // 1-second interval to tick uptime for all active/online bots in real time
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveBotTelemetry((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [key, telem] of Object.entries(next)) {
          if (
            telem &&
            (telem.status === 'online' || telem.status === 'authenticating') &&
            typeof telem.uptimeSeconds === 'number'
          ) {
            next[key] = {
              ...telem,
              uptimeSeconds: telem.uptimeSeconds + 1,
            };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Merge server data with live WebSocket telemetry
  const mergedUsers = otherUsers.map((u) => {
    const userKey = u.username.toLowerCase();
    const isDaemonWsOnline = liveDaemonStatus[userKey];
    const isDaemonOnline = isDaemonWsOnline !== undefined ? isDaemonWsOnline : u.isDaemonOnline;
    const secondsSinceUpdate = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);

    const mergedBots = u.bots.map((bot) => {
      const liveTelem =
        liveBotTelemetry[bot.id] ||
        liveBotTelemetry[bot.name] ||
        liveBotTelemetry[bot.name?.toLowerCase()];

      if (liveTelem) {
        const isOnline = liveTelem.status === 'online';
        let displayHealth = liveTelem.hearts;
        if (displayHealth === undefined && liveTelem.health !== undefined) {
          displayHealth = Math.round((liveTelem.health / 2) * 10) / 10;
        }
        let displayMaxHealth = liveTelem.maxHearts;
        if (displayMaxHealth === undefined && liveTelem.maxHealth !== undefined) {
          displayMaxHealth = Math.round((liveTelem.maxHealth / 2) * 10) / 10;
        }
        if (displayMaxHealth === undefined) displayMaxHealth = 10;

        return {
          ...bot,
          status: liveTelem.status || (isDaemonOnline ? 'online' : bot.status),
          health: displayHealth ?? bot.health ?? (isOnline ? 10 : undefined),
          maxHealth: displayMaxHealth ?? bot.maxHealth ?? 10,
          food: liveTelem.food ?? bot.food,
          uptimeSeconds:
            liveTelem.uptimeSeconds ??
            (bot.uptimeSeconds ? bot.uptimeSeconds + secondsSinceUpdate : 0),
          dimension:
            liveTelem.dimension ||
            liveTelem.currentBiome ||
            bot.dimension ||
            'Overworld',
        };
      }

      const isBotOnline = bot.status === 'online' || isDaemonOnline;
      return {
        ...bot,
        status: isBotOnline ? 'online' : bot.status,
        health: bot.health ?? (isBotOnline ? 10 : undefined),
        maxHealth: bot.maxHealth ?? 10,
        uptimeSeconds: bot.uptimeSeconds
          ? bot.uptimeSeconds + secondsSinceUpdate
          : isBotOnline
          ? secondsSinceUpdate
          : 0,
        dimension: bot.dimension || (isBotOnline ? 'Overworld' : undefined),
      };
    });

    return {
      ...u,
      isDaemonOnline,
      bots: mergedBots,
    };
  });

  const getBotChats = (bot: FleetBotInfo): ChatMessage[] => {
    const live =
      liveChatLogs[bot.id] ||
      liveChatLogs[bot.name] ||
      liveChatLogs[bot.name?.toLowerCase()] ||
      [];
    const initial = bot.recentChats || [];
    if (live.length === 0) return initial;
    if (initial.length === 0) return live;

    const seen = new Set<string>();
    const combined: ChatMessage[] = [];
    for (const item of [...initial, ...live]) {
      const key = `${item.timestamp}_${item.sender}_${item.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }
    return combined.sort((a, b) => a.timestamp - b.timestamp);
  };

  const totalBots = mergedUsers.reduce((sum, u) => sum + u.bots.length, 0);
  const onlineBots = mergedUsers.reduce(
    (sum, u) => sum + u.bots.filter((b) => b.status === 'online').length,
    0
  );
  const activeDaemons = mergedUsers.filter((u) => u.isDaemonOnline).length;

  return (
    <div className="bg-white border-2 border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
      {/* Widget Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <h3 className="font-black text-sm text-slate-900 tracking-tight truncate">
                  Users Fleet Monitor
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                  Admin
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                {mergedUsers.length} user{mergedUsers.length === 1 ? '' : 's'} • {activeDaemons} live • {onlineBots}/{totalBots} bots online
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => fetchFleet(true)}
              disabled={isRefreshing}
              title="Refresh Fleet Status"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200 active:scale-95"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
            <Link
              href="/control-panel"
              title="Open Admin Control Panel"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Live Counters Pill */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/80 text-center">
          <div className="bg-white/80 border border-slate-200 rounded-xl p-1.5 shadow-2xs">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Other Users</span>
            <span className="text-xs font-black text-slate-800">{mergedUsers.length}</span>
          </div>
          <div className="bg-white/80 border border-slate-200 rounded-xl p-1.5 shadow-2xs">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Daemons</span>
            <span className="text-xs font-black text-emerald-600">{activeDaemons} Active</span>
          </div>
          <div className="bg-white/80 border border-slate-200 rounded-xl p-1.5 shadow-2xs">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bots</span>
            <span className="text-xs font-black text-slate-900">{onlineBots} Online</span>
          </div>
        </div>
      </div>

      {/* Widget Content Body */}
      <div className="p-3 sm:p-4 space-y-4 max-h-[640px] overflow-y-auto">
        {isLoading && mergedUsers.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-slate-400 space-y-2 text-xs">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
            <span>Scanning connected fleet...</span>
          </div>
        ) : error && mergedUsers.length === 0 ? (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        ) : mergedUsers.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No other user accounts connected yet.
          </div>
        ) : (
          mergedUsers.map((u) => {
            const isUserVista = u.username.toLowerCase() === 'vista';
            const userOnlineBots = u.bots.filter((b) => b.status === 'online').length;

            return (
              <div
                key={u.id || u.username}
                className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3 space-y-3 transition hover:border-slate-300"
              >
                {/* User Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs uppercase shadow-2xs shrink-0 ${
                        isUserVista
                          ? 'bg-amber-500 text-white font-mono'
                          : 'bg-emerald-600 text-white font-mono'
                      }`}
                    >
                      {u.username.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-black text-xs text-slate-900 truncate">
                          @{u.username}
                        </span>
                        {isUserVista ? (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                            Master Admin
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold text-slate-500 bg-white border border-slate-200">
                            User
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                        {u.daemonDeviceType === 'mobile' ? (
                          <Smartphone className="h-3 w-3 text-slate-400" />
                        ) : (
                          <Laptop className="h-3 w-3 text-slate-400" />
                        )}
                        <span className="truncate">
                          {u.daemonDeviceLabel || (u.daemonDeviceType === 'mobile' ? 'Mobile Termux' : 'PC Daemon')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Daemon status pill */}
                  <div className="shrink-0">
                    {u.isDaemonOnline ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Online</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-200/60 text-slate-500 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span>Offline</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bots & Accounts Listing */}
                {u.bots.length > 0 ? (
                  <div className="space-y-2 pt-1 border-t border-slate-200/60">
                    {u.bots.map((bot) => {
                      const isOnline = bot.status === 'online';
                      const isConnecting = bot.status === 'connecting' || bot.status === 'reconnecting';
                      const isBedrock = bot.edition === 'bedrock';

                      return (
                        <div
                          key={bot.id}
                          className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs space-y-2"
                        >
                          {/* Row 1: Avatar + Name + Edition Badge + Status Badge */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <img
                                src={`https://mc-heads.net/avatar/${encodeURIComponent(bot.name)}/48`}
                                alt={bot.name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://mc-heads.net/avatar/MHF_Steve/48';
                                }}
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-100 shrink-0 [image-rendering:pixelated]"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-extrabold text-xs text-slate-900 truncate">
                                    {bot.name}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${
                                      isBedrock
                                        ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}
                                  >
                                    {isBedrock ? 'BEDROCK' : 'JAVA'}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-500 truncate">
                                  <Server className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                                  <span className="truncate">
                                    {bot.host}:{bot.port}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 shrink-0 font-sans">
                                    🌍 {formatDimension(bot.dimension)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Status Pill */}
                            <div className="shrink-0">
                              {isOnline ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                  <span>Online</span>
                                </span>
                              ) : isConnecting ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100/70 text-amber-800 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                  <span>Connecting</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  <span>Offline</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Live Health & Uptime Metrics */}
                          <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-100 text-slate-600">
                            <div className="flex items-center space-x-1 text-rose-600 font-bold">
                              <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                              <span>
                                {bot.health !== undefined
                                  ? `${bot.health} / ${bot.maxHealth || 10} HP`
                                  : isOnline
                                  ? '10 / 10 HP'
                                  : '—'}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1 font-mono text-slate-500">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>{isOnline ? formatUptime(bot.uptimeSeconds) : 'Idle'}</span>
                            </div>
                          </div>

                          {/* Row 3: Live In-Game Server Chat Feed (3-4 chats matching Chat tab style) */}
                          {(() => {
                            const botChats = getBotChats(bot);
                            const displayChats = botChats.slice(-4);

                            return (
                              <div className="pt-2 border-t border-slate-100">
                                <div className="bg-[#f8fafc] border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
                                  {/* Chat Box Header */}
                                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100/90 border-b border-slate-200/80">
                                    <div className="flex items-center space-x-1.5 text-slate-700 font-bold">
                                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                      <span className="uppercase text-[9px] font-black tracking-wider text-slate-600 font-mono">
                                        Live In-Game Chat
                                      </span>
                                    </div>
                                    {isOnline ? (
                                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>Live Verified</span>
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[8.5px] font-medium bg-slate-200/70 text-slate-500">
                                        Offline
                                      </span>
                                    )}
                                  </div>

                                  {/* Chat Messages rendered with identical MinecraftChatMessage component */}
                                  <div className="p-1 sm:p-1.5 flex flex-col space-y-0.5 divide-y divide-slate-100/80">
                                    {displayChats.length > 0 ? (
                                      displayChats.map((chat, idx) => (
                                        <div key={chat.timestamp ? `${chat.timestamp}-${idx}` : idx} className="pt-0.5 first:pt-0">
                                          <MinecraftChatMessage message={chat} showTimestamp={true} compact={true} />
                                        </div>
                                      ))
                                    ) : isOnline ? (
                                      <div className="py-2.5 text-center text-slate-400 italic text-[10px] flex items-center justify-center space-x-1.5 font-sans">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>Awaiting in-game chat messages...</span>
                                      </div>
                                    ) : (
                                      <div className="py-2 text-center text-slate-400 italic text-[10px] font-sans">
                                        Bot offline (no chat stream)
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ) : u.savedAccounts && u.savedAccounts.length > 0 ? (
                  /* User has accounts in Vault, but none actively connected */
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Vault Accounts ({u.savedAccounts.length})
                    </div>
                    {u.savedAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="bg-white/80 border border-slate-200/90 rounded-xl p-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <img
                            src={`https://mc-heads.net/avatar/${encodeURIComponent(acc.gamertag || acc.name)}/48`}
                            alt={acc.name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://mc-heads.net/avatar/MHF_Steve/48';
                            }}
                            className="w-6 h-6 rounded-md border border-slate-200 bg-slate-100 shrink-0 [image-rendering:pixelated]"
                          />
                          <span className="font-bold text-slate-800 text-[11px] truncate">
                            {acc.gamertag || acc.name}
                          </span>
                        </div>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider ${
                            acc.edition === 'bedrock'
                              ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {acc.edition === 'bedrock' ? 'BEDROCK' : 'JAVA'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pt-1 text-[11px] text-slate-400 italic">
                    No bots deployed or vault accounts added yet.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Widget Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-medium">
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <Link
          href="/control-panel"
          className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center space-x-1"
        >
          <span>Admin Settings</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
};

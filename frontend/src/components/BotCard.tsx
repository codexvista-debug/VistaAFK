'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Play,
  Square,
  MessageSquare,
  Trash2,
  Settings2,
  Heart,
  Utensils,
  MapPin,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Zap,
  Compass,
  Terminal,
  ChevronDown,
  ChevronUp,
  Package,
  Swords,
  Key,
} from 'lucide-react';
import { BotConfig, BotTelemetry, ChatMessage, ActivityLog } from '../types';

interface BotCardProps {
  config: BotConfig;
  telemetry?: BotTelemetry;
  activityLogs?: ActivityLog[];
  logs?: ChatMessage[];
  isDaemonConnected?: boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenChat: (id: string) => void;
  onOpenSightModal?: (config: BotConfig) => void;
  onOpenInventory?: (config: BotConfig) => void;
  onEdit: (config: BotConfig) => void;
}

export const BotCard: React.FC<BotCardProps> = ({
  config,
  telemetry,
  activityLogs = [],
  logs = [],
  isDaemonConnected = true,
  onStart,
  onStop,
  onDelete,
  onOpenChat,
  onOpenSightModal,
  onOpenInventory,
  onEdit,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLogsExpanded, setIsLogsExpanded] = useState(true);

  const rawStatus = telemetry?.status || 'offline';
  const isOnline = isDaemonConnected && rawStatus === 'online';
  const isAuthenticating = isDaemonConnected && rawStatus === 'authenticating';
  const isConnecting = isDaemonConnected && (rawStatus === 'connecting' || rawStatus === 'reconnecting');
  const statusDisplay = !isDaemonConnected ? 'Daemon Offline' : rawStatus;

  const health = telemetry?.health ?? 0;
  const rawHearts = telemetry?.hearts !== undefined ? telemetry.hearts : Math.round((health / 2) * 10) / 10;
  let rawMaxHearts = telemetry?.maxHearts !== undefined ? telemetry.maxHearts : Math.round(((telemetry?.maxHealth || 20) / 2) * 10) / 10;

  // On custom servers (like Lifesteal SMP) where default max was 10 hearts (20 HP)
  // but bot has full hunger (food >= 18) and hearts is stable (e.g. 8 hearts),
  // adapt maxHearts to match actual hearts so it displays 8 / 8 at 100% full bar
  if (isOnline && (telemetry?.food ?? 0) >= 18 && rawHearts > 0 && rawHearts < 10 && rawMaxHearts === 10) {
    rawMaxHearts = rawHearts;
  }
  const displayHearts = rawHearts;
  const displayMaxHearts = Math.max(rawHearts, rawMaxHearts || 10);
  const food = telemetry?.food ?? 0;
  const coords = telemetry?.coordinates ?? { x: 0, y: 0, z: 0 };
  const dimension = telemetry?.dimension || 'overworld';
  const ping = telemetry?.ping || 0;

  const copyDeviceCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Filter to dedicated bot activity events (connects, joins, commands, survival, kicks, reconnects)
  const rawLogs: Array<{ id: string; timestamp: number; type?: string; message: string }> =
    activityLogs.length > 0
      ? activityLogs
      : logs
          .filter((l) => l.isSystem && (l.sender === 'VistaAFK' || l.sender === 'AutoCommand'))
          .map((l, i) => ({
            id: `fallback-${i}`,
            timestamp: l.timestamp,
            type: 'status',
            message: l.message,
          }));

  // Clean consecutive duplicate logs
  const displayLogs = rawLogs.filter((item, idx, arr) => {
    if (idx === 0) return true;
    const prev = arr[idx - 1];
    return !(prev.message === item.message && Math.abs(item.timestamp - prev.timestamp) < 3000);
  });

  const recentActivities = displayLogs.slice(-50);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isLogsExpanded && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [displayLogs, isLogsExpanded]);

  const isBedrock = config.edition === 'bedrock' || config.port === 19132 || config.id.includes('bedrock');

  return (
    <div className="bg-white border-2 border-slate-200/90 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div className="p-5">
        {/* Card Header: Avatar & Server Info */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={`https://mc-heads.net/avatar/${config.name}/48`}
                alt={config.name}
                className="h-11 w-11 shrink-0 rounded-xl bg-slate-100 border-2 border-slate-300 shadow-sm object-cover aspect-square"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/48';
                }}
              />
              <span
                className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                  isOnline
                    ? 'bg-emerald-500'
                    : isConnecting
                    ? 'bg-amber-400 animate-ping'
                    : isAuthenticating
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <h3 className="font-black text-sm text-slate-900 tracking-tight truncate max-w-[110px] sm:max-w-[170px]" title={config.name}>
                  {config.name}
                </h3>
                {/* Compact Edition Icon Button */}
                <button
                  type="button"
                  onClick={() => {
                    const nextEdition = isBedrock ? 'java' : 'bedrock';
                    const nextPort = nextEdition === 'bedrock' ? 19132 : 25565;
                    onEdit({ ...config, edition: nextEdition, port: nextPort });
                  }}
                  title={`Currently ${isBedrock ? 'Bedrock Edition' : 'Java Edition'}. Click to switch to ${isBedrock ? 'Java' : 'Bedrock'}.`}
                  className={`px-1.5 py-0.5 rounded-md border text-xs font-bold transition hover:scale-105 cursor-pointer shrink-0 flex items-center justify-center ${
                    isBedrock
                      ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  <span role="img" aria-label={isBedrock ? 'Bedrock' : 'Java'}>
                    {isBedrock ? '🧱' : '☕'}
                  </span>
                </button>
                {/* Compact Auth Type Icon Badge */}
                <span
                  title={config.authType === 'microsoft' ? 'Microsoft Account' : 'Offline / Cracked'}
                  className="p-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 shrink-0 flex items-center justify-center"
                >
                  {config.authType === 'microsoft' ? (
                    <Key className="h-3 w-3 text-sky-600" />
                  ) : (
                    <Shield className="h-3 w-3 text-slate-400" />
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5 font-medium truncate">
                {config.host}:{config.port}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="text-right shrink-0">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                isOnline
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : isConnecting
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                  : isAuthenticating
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {statusDisplay}
            </span>
            {isOnline && ping > 0 && (
              <span className="block text-[10px] font-mono text-slate-400 mt-1 font-semibold">{ping}ms</span>
            )}
          </div>
        </div>

        {/* OAuth Device Code Alert */}
        {isAuthenticating && telemetry?.authCodeInfo && (
          <div className="mt-4 p-3 bg-amber-50 border-2 border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
            <div className="flex items-center justify-between font-bold">
              <span>Microsoft OAuth Code:</span>
              <a
                href={telemetry.authCodeInfo.verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 underline hover:text-amber-700"
              >
                <span>microsoft.com/link</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center justify-between bg-white border border-amber-200 px-3 py-1.5 rounded-lg font-mono text-sm text-slate-900 font-bold shadow-sm">
              <span>{telemetry.authCodeInfo.userCode}</span>
              <button
                onClick={() => copyDeviceCode(telemetry.authCodeInfo!.userCode)}
                className="p-1 hover:text-emerald-600 transition"
                title="Copy code"
              >
                {copiedCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
              </button>
            </div>
          </div>
        )}

        {/* Telemetry Stats */}
        <div className="mt-4 space-y-3 pt-3.5 border-t border-slate-100">
          {/* Health & Hunger */}
          <div className="grid grid-cols-2 gap-3">
            {/* Health */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center space-x-1">
                  <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                  <span className="font-semibold text-slate-700">HP</span>
                </span>
                <span className="font-mono text-slate-800 font-bold text-xs">
                  {isOnline ? `${displayHearts} / ${displayMaxHearts}` : '--'}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${isOnline && displayMaxHearts > 0 ? Math.min(100, (displayHearts / displayMaxHearts) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Hunger */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center space-x-1">
                  <Utensils className="h-3 w-3 text-amber-500" />
                  <span>Hunger</span>
                </span>
                <span className="font-mono text-slate-800 font-semibold">{isOnline ? `${Math.round(food)} / 20` : '--'}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${isOnline ? Math.min(100, (food / 20) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Coordinates & Dimension */}
          <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            <div className="flex items-center space-x-1.5 font-mono text-[11px]">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>
                {isOnline ? `X: ${coords.x} Y: ${coords.y} Z: ${coords.z}` : 'Inactive'}
              </span>
            </div>
            <span className="capitalize px-2 py-0.5 rounded-full text-[10px] bg-white border border-slate-200 text-slate-700 font-semibold shadow-xs">
              {isOnline ? dimension.replace('minecraft:', '') : 'Offline'}
            </span>
          </div>

          {/* Features Active Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] pt-1">
            <span
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-full font-medium border ${
                config.antiAfk.enabled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <Zap className="h-2.5 w-2.5" />
              <span>Anti-AFK</span>
            </span>

            <span
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-full font-medium border ${
                config.survival.autoEat
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <Utensils className="h-2.5 w-2.5" />
              <span>Auto-Eat</span>
            </span>

            <span
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-full font-medium border ${
                config.survival.autoTotem
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <Shield className="h-2.5 w-2.5" />
              <span>Totem</span>
            </span>

            {config.farming?.enabled && (
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold border bg-purple-50 border-purple-200 text-purple-700 animate-pulse">
                <Swords className="h-2.5 w-2.5" />
                <span>Farm (Auto-Swing)</span>
              </span>
            )}

            {isOnline && (
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full font-mono font-bold text-[10px] bg-emerald-100 text-emerald-800 border-2 border-emerald-400 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>UPTIME: {formatUptime(telemetry?.uptimeSeconds || 0)}</span>
              </span>
            )}
          </div>

          {/* In-Card Live Player Activity Logs */}
          <div className="mt-3 bg-[#0a0f1d] border-2 border-slate-800 rounded-2xl p-3 text-xs shadow-inner">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-emerald-400 font-mono font-bold text-[10px] tracking-wider uppercase">
                  Player Logs & Activity
                </span>
                <span className="text-[10px] text-slate-500 font-mono">({displayLogs.length})</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLogsExpanded(!isLogsExpanded)}
                  className="text-slate-400 hover:text-white transition p-0.5"
                  title={isLogsExpanded ? 'Collapse logs' : 'Expand logs'}
                >
                  {isLogsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <a
                  href={`/logs?bot=${config.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 transition flex items-center space-x-1 text-[10px] font-bold bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/80 px-2 py-0.5 rounded-md"
                  title="Open Player Logs as dedicated page in a new tab"
                >
                  <span>Open Tab</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>

            {/* Activity Stream Messages */}
            {isLogsExpanded && (
              <div
                ref={logsContainerRef}
                className="mt-2 space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px] leading-tight pr-1 scrollbar-thin scroll-smooth"
              >
                {recentActivities.length === 0 ? (
                  <div className="text-slate-500 py-2 text-center text-[10px] italic">
                    {isOnline ? 'Bot is active in world. Waiting for next player activity...' : 'Bot is offline. Connect to start streaming logs.'}
                  </div>
                ) : (
                  recentActivities.map((act) => (
                    <div key={act.id} className="flex items-start space-x-1.5 text-slate-300">
                      <span className="text-slate-500 shrink-0 text-[10px]">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="break-all text-slate-200">{act.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="bg-slate-50/90 px-3 sm:px-5 py-2.5 sm:py-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Toggle Connect / Disconnect */}
        <div className="w-full sm:w-auto">
          {isOnline || isConnecting || isAuthenticating ? (
            <button
              onClick={() => onStop(config.id)}
              className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 sm:py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl shadow-sm transition active:scale-95"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>{isConnecting ? 'Cancel' : 'Disconnect'}</span>
            </button>
          ) : (
            <button
              onClick={() => onStart(config.id)}
              className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/25 transition active:scale-95"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Connect</span>
            </button>
          )}
        </div>

        {/* 6 Quick Action Tool Buttons */}
        <div className="grid grid-cols-6 sm:flex items-center gap-1.5 w-full sm:w-auto">
          {/* 1. Player Live Logs Button */}
          <a
            href={`/logs?bot=${config.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 sm:h-8 px-2 sm:px-2.5 rounded-xl border shadow-xs transition flex items-center justify-center space-x-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200 active:scale-95"
            title="Open Dedicated Player Logs"
          >
            <Terminal className="h-4 w-4 text-emerald-700 shrink-0" />
            {displayLogs.length > 0 && (
              <span className="text-[10px] font-mono font-bold text-emerald-800 hidden md:inline">
                {displayLogs.length}
              </span>
            )}
          </a>

          {/* 2. Tactical Sight & Movement Controls */}
          {onOpenSightModal && (
            <button
              onClick={() => onOpenSightModal(config)}
              className="h-10 sm:h-8 px-2 sm:px-2 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl border border-slate-200 shadow-xs transition flex items-center justify-center active:scale-95"
              title="Tactical Radar & Movement Controls"
            >
              <Compass className="h-4 w-4 text-emerald-700 shrink-0" />
            </button>
          )}

          {/* 3. Player Inventory & Lore Viewer */}
          {onOpenInventory && (
            <button
              onClick={() => onOpenInventory(config)}
              className="h-10 sm:h-8 px-2 sm:px-2 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 rounded-xl border border-slate-200 shadow-xs transition flex items-center justify-center active:scale-95"
              title="View Player Inventory & Items"
            >
              <Package className="h-4 w-4 text-amber-700 shrink-0" />
            </button>
          )}

          {/* 4. Live Chat & Full Console */}
          <button
            onClick={() => onOpenChat(config.id)}
            className="h-10 sm:h-8 px-2 sm:px-2 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl border border-slate-200 shadow-xs transition flex items-center justify-center active:scale-95"
            title="Open Console & Send Chat"
          >
            <MessageSquare className="h-4 w-4 text-blue-600 shrink-0" />
          </button>

          {/* 5. Edit Settings */}
          <button
            onClick={() => onEdit(config)}
            className="h-10 sm:h-8 px-2 sm:px-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl border border-slate-200 shadow-xs transition flex items-center justify-center active:scale-95"
            title="Bot Settings"
          >
            <Settings2 className="h-4 w-4 text-slate-600 shrink-0" />
          </button>

          {/* 6. Delete Bot */}
          <button
            onClick={() => onDelete(config.id)}
            className="h-10 sm:h-8 px-2 sm:px-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl border border-slate-200 shadow-xs transition flex items-center justify-center active:scale-95"
            title="Delete Deployment"
          >
            <Trash2 className="h-4 w-4 text-rose-500 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};

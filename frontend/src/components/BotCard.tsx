'use client';

import React, { useState } from 'react';
import {
  Play,
  Square,
  MessageSquare,
  Trash2,
  Settings2,
  Heart,
  Utensils,
  MapPin,
  Compass,
  Copy,
  Check,
  ExternalLink,
  Shield,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { BotConfig, BotTelemetry } from '../types';

interface BotCardProps {
  config: BotConfig;
  telemetry?: BotTelemetry;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenChat: (id: string) => void;
  onEdit: (config: BotConfig) => void;
}

export const BotCard: React.FC<BotCardProps> = ({
  config,
  telemetry,
  onStart,
  onStop,
  onDelete,
  onOpenChat,
  onEdit,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const status = telemetry?.status || 'offline';
  const isOnline = status === 'online';
  const isAuthenticating = status === 'authenticating';
  const isConnecting = status === 'connecting' || status === 'reconnecting';

  const health = telemetry?.health ?? 0;
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

  return (
    <div className="bg-[#111827]/90 border border-gray-800 rounded-xl overflow-hidden shadow-lg transition-all hover:border-gray-700 flex flex-col justify-between">
      {/* Top Header */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {/* Minecraft Avatar Face */}
            <div className="relative">
              <img
                src={`https://mc-heads.net/avatar/${config.name}/64`}
                alt={config.name}
                className="w-12 h-12 rounded-lg border border-gray-700 bg-gray-900 object-cover shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/64';
                }}
              />
              <span
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#111827] ${
                  isOnline
                    ? 'bg-emerald-500'
                    : isAuthenticating
                    ? 'bg-amber-400 animate-pulse'
                    : isConnecting
                    ? 'bg-blue-400 animate-ping'
                    : status === 'error'
                    ? 'bg-rose-500'
                    : 'bg-gray-500'
                }`}
              />
            </div>

            {/* Name & Target Server */}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base tracking-tight">{config.name}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                  {config.authType === 'microsoft' ? 'MS OAuth' : 'Offline'}
                </span>
                {config.proxyUrl && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Proxy
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                {config.host}:{config.port}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex flex-col items-end">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${
                isOnline
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
                  : isAuthenticating
                  ? 'bg-amber-950/70 text-amber-400 border-amber-800 animate-pulse'
                  : isConnecting
                  ? 'bg-blue-950/70 text-blue-400 border-blue-800'
                  : status === 'error'
                  ? 'bg-rose-950/70 text-rose-400 border-rose-800'
                  : 'bg-gray-800/80 text-gray-400 border-gray-700'
              }`}
            >
              {status}
            </span>
            {isOnline && ping > 0 && <span className="text-[10px] text-gray-400 font-mono mt-1">{ping}ms</span>}
          </div>
        </div>

        {/* Microsoft OAuth Prompt Alert */}
        {isAuthenticating && telemetry?.authCodeInfo && (
          <div className="mt-4 p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-xs space-y-2">
            <div className="flex items-center justify-between text-amber-300 font-medium">
              <span>Microsoft Login Required</span>
              <a
                href={telemetry.authCodeInfo.verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 underline hover:text-amber-200"
              >
                <span>microsoft.com/link</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded font-mono text-sm text-white">
              <span>{telemetry.authCodeInfo.userCode}</span>
              <button
                onClick={() => copyDeviceCode(telemetry.authCodeInfo!.userCode)}
                className="p-1 hover:text-amber-300 transition"
                title="Copy code"
              >
                {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Telemetry Stats: HP, Hunger, Coords */}
        <div className="mt-4 space-y-3 pt-3 border-t border-gray-800/60">
          {/* Health & Hunger */}
          <div className="grid grid-cols-2 gap-3">
            {/* Health */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center space-x-1">
                  <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
                  <span>HP</span>
                </span>
                <span className="font-mono text-gray-200 font-medium">{isOnline ? `${Math.round(health)} / 20` : '--'}</span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-300"
                  style={{ width: `${isOnline ? Math.min(100, (health / 20) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Hunger */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center space-x-1">
                  <Utensils className="h-3 w-3 text-amber-500" />
                  <span>Hunger</span>
                </span>
                <span className="font-mono text-gray-200 font-medium">{isOnline ? `${Math.round(food)} / 20` : '--'}</span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${isOnline ? Math.min(100, (food / 20) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Coordinates & Dimension */}
          <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-900/60 px-2.5 py-1.5 rounded-lg border border-gray-800/40">
            <div className="flex items-center space-x-1.5 font-mono">
              <MapPin className="h-3.5 w-3.5 text-gray-500" />
              <span>
                {isOnline ? `X: ${coords.x} Y: ${coords.y} Z: ${coords.z}` : 'XYZ: Inactive'}
              </span>
            </div>
            <span className="capitalize px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-300 font-medium">
              {isOnline ? dimension.replace('minecraft:', '') : 'Offline'}
            </span>
          </div>

          {/* Features Active Pills */}
          <div className="flex items-center space-x-2 text-[10px] text-gray-400 pt-1">
            <span
              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border ${
                config.antiAfk.enabled
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-gray-800 border-gray-700 text-gray-500'
              }`}
            >
              <Zap className="h-2.5 w-2.5" />
              <span>Anti-AFK</span>
            </span>

            <span
              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border ${
                config.survival.autoEat
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-gray-800 border-gray-700 text-gray-500'
              }`}
            >
              <Utensils className="h-2.5 w-2.5" />
              <span>Auto-Eat</span>
            </span>

            <span
              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border ${
                config.survival.autoTotem
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-gray-800 border-gray-700 text-gray-500'
              }`}
            >
              <Shield className="h-2.5 w-2.5" />
              <span>Totem</span>
            </span>

            {isOnline && telemetry?.uptimeSeconds ? (
              <span className="ml-auto font-mono text-gray-400">
                Up: {formatUptime(telemetry.uptimeSeconds)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="bg-gray-900/80 px-4 py-3 border-t border-gray-800 flex items-center justify-between">
        {/* Toggle Connect / Disconnect */}
        {isOnline ? (
          <button
            onClick={() => onStop(config.id)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 text-xs font-semibold rounded-lg transition"
          >
            <Square className="h-3 w-3 fill-current" />
            <span>Disconnect</span>
          </button>
        ) : (
          <button
            onClick={() => onStart(config.id)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Connect</span>
          </button>
        )}

        <div className="flex items-center space-x-1.5">
          {/* Live Chat */}
          <button
            onClick={() => onOpenChat(config.id)}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg border border-gray-700 transition"
            title="Open in-game live chat"
          >
            <MessageSquare className="h-4 w-4" />
          </button>

          {/* Edit Settings */}
          <button
            onClick={() => onEdit(config)}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg border border-gray-700 transition"
            title="Account Settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          {/* Delete Bot */}
          <button
            onClick={() => onDelete(config.id)}
            className="p-1.5 bg-gray-800 hover:bg-rose-900/60 text-gray-400 hover:text-rose-400 rounded-lg border border-gray-700 transition"
            title="Delete Account"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

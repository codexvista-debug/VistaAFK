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
  Copy,
  Check,
  ExternalLink,
  Shield,
  Zap,
  Compass,
} from 'lucide-react';
import { BotConfig, BotTelemetry } from '../types';

interface BotCardProps {
  config: BotConfig;
  telemetry?: BotTelemetry;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenChat: (id: string) => void;
  onOpenSightModal?: (config: BotConfig) => void;
  onEdit: (config: BotConfig) => void;
}

export const BotCard: React.FC<BotCardProps> = ({
  config,
  telemetry,
  onStart,
  onStop,
  onDelete,
  onOpenChat,
  onOpenSightModal,
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
    <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      {/* Top Header */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            {/* Minecraft Avatar Face */}
            <div className="relative">
              <img
                src={`https://mc-heads.net/avatar/${config.name}/64`}
                alt={config.name}
                className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-100 object-cover shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/64';
                }}
              />
              <span
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  isOnline
                    ? 'bg-emerald-500'
                    : isAuthenticating
                    ? 'bg-amber-400 animate-pulse'
                    : isConnecting
                    ? 'bg-blue-400 animate-ping'
                    : status === 'error'
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
                }`}
              />
            </div>

            {/* Name & Target Server */}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base tracking-tight">{config.name}</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono border border-slate-200">
                  {config.authType === 'microsoft' ? 'MS OAuth' : 'Offline'}
                </span>
                {config.proxyUrl && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Proxy
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {config.host}:{config.port}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex flex-col items-end">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border shadow-sm ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isAuthenticating
                  ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                  : isConnecting
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : status === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {status}
            </span>
            {isOnline && ping > 0 && <span className="text-[10px] text-slate-400 font-mono mt-1">{ping}ms</span>}
          </div>
        </div>

        {/* Microsoft OAuth Prompt Alert */}
        {isAuthenticating && telemetry?.authCodeInfo && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between text-amber-900 font-semibold">
              <span>Microsoft Login Required</span>
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
                  <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
                  <span>HP</span>
                </span>
                <span className="font-mono text-slate-800 font-semibold">{isOnline ? `${Math.round(health)} / 20` : '--'}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${isOnline ? Math.min(100, (health / 20) * 100) : 0}%` }}
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
          <div className="flex items-center space-x-2 text-[10px] pt-1">
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

            {isOnline && telemetry?.uptimeSeconds ? (
              <span className="ml-auto font-mono text-slate-500 font-medium">
                Up: {formatUptime(telemetry.uptimeSeconds)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-200/80 flex items-center justify-between">
        {/* Toggle Connect / Disconnect */}
        {isOnline || isConnecting || isAuthenticating ? (
          <button
            onClick={() => onStop(config.id)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg shadow-sm transition"
          >
            <Square className="h-3 w-3 fill-current" />
            <span>{isConnecting ? 'Cancel' : 'Disconnect'}</span>
          </button>
        ) : (
          <button
            onClick={() => onStart(config.id)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-emerald-600/25 transition"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Connect</span>
          </button>
        )}

        <div className="flex items-center space-x-1.5">
          {/* Tactical Sight & Movement Controls */}
          {onOpenSightModal && (
            <button
              onClick={() => onOpenSightModal(config)}
              className="p-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg border border-slate-200 shadow-sm transition"
              title="Tactical Radar & Movement Controls"
            >
              <Compass className="h-4 w-4" />
            </button>
          )}

          {/* Live Chat */}
          <button
            onClick={() => onOpenChat(config.id)}
            className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-sm transition"
            title="Open in-game live chat"
          >
            <MessageSquare className="h-4 w-4" />
          </button>

          {/* Edit Settings */}
          <button
            onClick={() => onEdit(config)}
            className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-sm transition"
            title="Account Settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          {/* Delete Bot */}
          <button
            onClick={() => onDelete(config.id)}
            className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 shadow-sm transition"
            title="Delete Account"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { Activity, Play, Square, Plus, Settings, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  isConnected: boolean;
  isConnecting: boolean;
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onStartAll: () => void;
  onStopAll: () => void;
  botCount: number;
  onlineCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  isConnected,
  isConnecting,
  onOpenAddModal,
  onOpenSettingsModal,
  onStartAll,
  onStopAll,
  botCount,
  onlineCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-all shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white">
            <Activity className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                Vista<span className="text-emerald-600">AFK</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block font-medium">Headless Minecraft Java AFK Portal</p>
          </div>
        </div>

        {/* Daemon Connection Pill */}
        <button
          onClick={onOpenSettingsModal}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all shadow-sm ${
            isConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
              : isConnecting
              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70'
              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70'
          }`}
          title="Click to configure Daemon connection"
        >
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <Wifi className="h-3.5 w-3.5" />
              <span>Daemon Connected</span>
            </>
          ) : isConnecting ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Connecting Daemon...</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              <span>Daemon Disconnected</span>
            </>
          )}
          <Settings className="h-3 w-3 text-slate-400 ml-1 hover:text-slate-700" />
        </button>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={onStartAll}
            disabled={!isConnected || botCount === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-sm transition"
            title="Connect all accounts"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span className="hidden md:inline">Start All</span>
          </button>

          <button
            onClick={onStopAll}
            disabled={!isConnected || onlineCount === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-sm transition"
            title="Disconnect all accounts"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            <span className="hidden md:inline">Stop All</span>
          </button>

          <button
            onClick={onOpenAddModal}
            disabled={!isConnected}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-sm shadow-emerald-600/30 transition"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Account</span>
          </button>
        </div>
      </div>
    </header>
  );
};

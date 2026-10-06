'use client';

import React from 'react';
import { Activity, Play, Square, Plus, Settings, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

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
    <header className="sticky top-0 z-40 w-full border-b border-gray-800 bg-[#0c121e]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                VistaAFK
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-full">
                v1.0
              </span>
            </div>
            <p className="text-xs text-gray-400 hidden sm:block">Headless Minecraft Java AFK Portal</p>
          </div>
        </div>

        {/* Daemon Connection Pill */}
        <button
          onClick={onOpenSettingsModal}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            isConnected
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900/60'
              : isConnecting
              ? 'bg-amber-950/60 text-amber-400 border-amber-800/80 hover:bg-amber-900/60'
              : 'bg-rose-950/60 text-rose-400 border-rose-800/80 hover:bg-rose-900/60'
          }`}
          title="Click to configure Daemon connection"
        >
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="h-3.5 w-3.5" />
              <span>Daemon Connected</span>
            </>
          ) : isConnecting ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Connecting Daemon...</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              <span>Daemon Disconnected</span>
            </>
          )}
          <Settings className="h-3 w-3 text-gray-400 ml-1 hover:text-white" />
        </button>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={onStartAll}
            disabled={!isConnected || botCount === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-800 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-gray-800 text-gray-200 hover:text-white text-xs font-medium rounded-lg border border-gray-700 transition"
            title="Connect all accounts"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span className="hidden md:inline">Start All</span>
          </button>

          <button
            onClick={onStopAll}
            disabled={!isConnected || onlineCount === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-800 hover:bg-rose-600 disabled:opacity-40 disabled:hover:bg-gray-800 text-gray-200 hover:text-white text-xs font-medium rounded-lg border border-gray-700 transition"
            title="Disconnect all accounts"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            <span className="hidden md:inline">Stop All</span>
          </button>

          <button
            onClick={onOpenAddModal}
            disabled={!isConnected}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-md shadow-emerald-700/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>
    </header>
  );
};

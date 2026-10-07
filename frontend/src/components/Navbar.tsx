'use client';

import React, { useState } from 'react';
import { Play, Square, Plus, Settings, Wifi, WifiOff, Box, Server, Users, User, LogOut, ShieldCheck, ChevronDown, Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/VistaAuthContext';

interface NavbarProps {
  isConnected: boolean;
  isConnecting: boolean;
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onStartAll?: () => void;
  onStopAll?: () => void;
  botCount: number;
  onlineCount: number;
  savedAccountCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  isConnected,
  isConnecting,
  onOpenAddModal,
  onOpenSettingsModal,
  botCount,
  onlineCount,
  savedAccountCount,
}) => {
  const pathname = usePathname();
  const { user, openAuthModal, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isVista = user?.username?.toLowerCase() === 'vista';

  return (
    <header className="sticky top-0 z-40 w-full border-b-2 border-[#2b3a4f] bg-[#121a27]/95 backdrop-blur-md shadow-lg">
      {/* Minecraft Emerald Accent Top Glow Line */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 shadow-sm shadow-emerald-400" />

      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Minecraft Brand Logo */}
        <div className="flex items-center space-x-2 sm:space-x-3.5 shrink-0">
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-b from-[#22c55e] to-[#15803d] border-2 border-[#4ade80] flex items-center justify-center shadow-lg shadow-emerald-500/25 relative overflow-hidden shrink-0">
              <div className="absolute inset-x-0 bottom-0 h-3 sm:h-4 bg-[#854d0e] border-t-2 border-[#166534]" />
              <Box className="h-4 w-4 sm:h-5 sm:w-5 text-white relative z-10 drop-shadow" />
            </div>

            <div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-black text-base sm:text-xl tracking-tight text-white drop-shadow-sm font-sans">
                  Vista<span className="text-emerald-400">AFK</span>
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-[#1b2738] text-emerald-300 border border-[#2d4059] rounded-md shadow-inner">
                  JAVA 24/7
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden md:block">Minecraft Chunk Loader & Multi-Server Bot Controller</p>
            </div>
          </Link>
        </div>

        {/* Primary Page Navigation */}
        <nav className="flex items-center space-x-1 sm:space-x-2 shrink-0">
          <Link
            href="/"
            className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
              pathname === '/'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                : 'bg-[#1b2637]/70 text-slate-300 hover:text-white hover:bg-[#1b2637] border-slate-700'
            }`}
          >
            <Server className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Server Fleet</span>
            <span className="inline sm:hidden text-[11px]">Fleet</span>
            {botCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                pathname === '/' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-300'
              }`}>
                {botCount}
              </span>
            )}
          </Link>

          <Link
            href="/accounts"
            className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
              pathname === '/accounts'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                : 'bg-[#1b2637]/70 text-slate-300 hover:text-white hover:bg-[#1b2637] border-slate-700'
            }`}
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Accounts Vault</span>
            <span className="inline sm:hidden text-[11px]">Vault</span>
            {typeof savedAccountCount === 'number' && savedAccountCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                pathname === '/accounts' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-300'
              }`}>
                {savedAccountCount}
              </span>
            )}
          </Link>

          {isVista && (
            <Link
              href="/control-panel"
              className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                pathname === '/control-panel'
                  ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30'
                  : 'bg-amber-500/15 text-amber-300 hover:text-white hover:bg-amber-600/30 border-amber-500/40 shadow-sm'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
              <span>CP</span>
            </Link>
          )}
        </nav>

        {/* Right Section: User Login & Daemon Status */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* User Account Pill / Login Trigger */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-emerald-500 text-xs text-slate-200 font-bold transition shadow-sm"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[80px] sm:max-w-[120px] truncate">{user.username}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl p-3 z-50 text-xs space-y-2.5 animate-in fade-in duration-150">
                    <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Signed In As</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-extrabold text-sm text-white">{user.username}</span>
                          {isVista && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              ADMIN
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                        Active
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-slate-300 font-medium">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Daemon Link:</span>
                        <span className="font-mono text-emerald-400 truncate max-w-[130px]">
                          {user.daemonUrl ? 'Cloud Connected' : 'Not linked yet'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Saved Accounts:</span>
                        <span className="font-bold">{user.savedAccounts?.length || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Server Presets:</span>
                        <span className="font-bold">{user.serverPresets?.length || 0}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenSettingsModal();
                          }}
                          className="text-slate-300 hover:text-white flex items-center space-x-1 text-[11px] font-bold"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          <span>Settings</span>
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="text-rose-400 hover:text-rose-300 flex items-center space-x-1 text-[11px] font-bold"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider transition shadow-md shadow-emerald-600/30 active:scale-95"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign In / Sync</span>
              <span className="inline sm:hidden text-[11px]">Sign In</span>
            </button>
          )}

          {/* Daemon Connection Pill */}
          <button
            onClick={onOpenSettingsModal}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all shadow-md shrink-0 ${
              isConnected
                ? 'bg-[#0f291e] text-emerald-400 border-emerald-600/80 hover:bg-[#143527]'
                : isConnecting
                ? 'bg-[#291e0f] text-amber-400 border-amber-600/80 hover:bg-[#352714]'
                : 'bg-[#290f14] text-rose-400 border-rose-600/80 hover:bg-[#351419]'
            }`}
            title="Configure Daemon connection"
          >
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Wifi className="h-3.5 w-3.5 hidden sm:inline" />
                <span className="hidden sm:inline">Online</span>
              </>
            ) : isConnecting ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden sm:inline">Connecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </>
            )}
            <Settings className="h-3 w-3 text-slate-400 hover:text-white" />
          </button>
        </div>
      </div>
    </header>
  );
};

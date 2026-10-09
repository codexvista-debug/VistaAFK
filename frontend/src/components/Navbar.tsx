'use client';

import React, { useState } from 'react';
import { Play, Square, Plus, Settings, Wifi, WifiOff, Box, Server, Users, User, LogOut, ShieldCheck, ChevronDown, Lock, Menu, Layers } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/VistaAuthContext';

interface NavbarProps {
  isConnected: boolean;
  isConnecting: boolean;
  onOpenAddModal: () => void;
  onOpenSettingsModal?: () => void;
  onRetryConnection?: () => void;
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
  onRetryConnection,
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

        {/* Primary Page Navigation: Icons on Mobile, Text + Icons on PC */}
        <nav className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          <Link
            href="/"
            className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-black transition-all border ${
              pathname === '/'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                : 'bg-[#1b2637]/70 text-slate-300 hover:text-white hover:bg-[#1b2637] border-slate-700'
            }`}
            title="Server Fleet"
          >
            <Server className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Server Fleet</span>
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
            className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-black transition-all border ${
              pathname === '/accounts'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                : 'bg-[#1b2637]/70 text-slate-300 hover:text-white hover:bg-[#1b2637] border-slate-700'
            }`}
            title="Accounts Vault"
          >
            <Users className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Accounts Vault</span>
            {typeof savedAccountCount === 'number' && savedAccountCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                pathname === '/accounts' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-300'
              }`}>
                {savedAccountCount}
              </span>
            )}
          </Link>

          <Link
            href="/versions"
            className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-black transition-all border ${
              pathname === '/versions'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                : 'bg-[#1b2637]/70 text-slate-300 hover:text-white hover:bg-[#1b2637] border-slate-700'
            }`}
            title="Supported Minecraft Versions"
          >
            <Layers className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Versions</span>
          </Link>
        </nav>

        {/* Right Section: Single Unified Dropdown Menu (Only when Logged In) */}
        {user ? (
          <div className="relative shrink-0">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full sm:rounded-xl text-xs font-black transition-all shadow-md active:scale-95 border-2 ${
                isConnected
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border-emerald-400 shadow-emerald-950/40'
                  : isConnecting
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white border-amber-400 shadow-amber-950/40'
                  : 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white border-rose-400 shadow-rose-950/40'
              }`}
              title={`@${user.username} - Bot Daemon: ${isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}`}
            >
              {/* Status Indicator Dot */}
              <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5 shrink-0">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-80" />
                    <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-white shadow-xs" />
                  </>
                ) : isConnecting ? (
                  <span className="animate-pulse inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-white shadow-xs" />
                ) : (
                  <span className="inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-white/90 shadow-xs" />
                )}
              </span>

              {/* Username */}
              <span className="font-black text-xs tracking-tight text-white max-w-[85px] sm:max-w-[130px] truncate">
                {user.username}
              </span>

              <Menu className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/90 shrink-0" />
            </button>

            {/* Unified Dropdown Panel */}
            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs" onClick={() => setIsUserMenuOpen(false)} />
                <div className="fixed sm:absolute top-16 sm:top-auto sm:mt-2 right-2 sm:right-0 w-[calc(100vw-16px)] sm:w-80 max-w-sm bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl p-4 z-50 text-xs space-y-3.5 animate-in fade-in duration-150">
                  {/* 1. Daemon Status Card */}
                  <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bot Daemon</span>
                      <div className="flex items-center space-x-1.5">
                        <span className="relative flex h-2 w-2">
                          {isConnected ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </>
                          ) : isConnecting ? (
                            <span className="inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse" />
                          ) : (
                            <span className="inline-flex rounded-full h-2 w-2 bg-rose-500" />
                          )}
                        </span>
                        <span className={`text-[11px] font-bold ${
                          isConnected ? 'text-emerald-400' : isConnecting ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {isConnected ? 'Connected (24/7)' : isConnecting ? 'Connecting...' : 'Disconnected'}
                        </span>
                        {!isConnected && !isConnecting && onRetryConnection && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetryConnection();
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold transition ml-1"
                            title="Retry daemon connection"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>

                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`w-full py-2 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 border text-xs font-bold ${
                        pathname === '/settings'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                          : 'bg-slate-700/60 hover:bg-slate-700 text-slate-200 border-slate-600/50'
                      }`}
                    >
                      <Settings className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Daemon Connection &amp; Settings</span>
                    </Link>
                  </div>

                  {/* 2. Navigation Links inside dropdown */}
                  <div className="space-y-1.5">
                    <Link
                      href="/versions"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                        pathname === '/versions'
                          ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 font-bold'
                          : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Layers className="h-4 w-4 text-cyan-400 shrink-0" />
                        <span>Supported Minecraft Versions</span>
                      </div>
                      <span className="text-[10px] text-cyan-400/80 font-mono">1.7 - 26.x</span>
                    </Link>
                  </div>

                  {/* 3. Admin Control Panel (for user vista) */}
                  {isVista && (
                    <Link
                      href="/control-panel"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                        pathname === '/control-panel'
                          ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30'
                          : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                        <div>
                          <div className="font-extrabold text-xs">Admin Control Panel</div>
                          <div className="text-[10px] text-amber-200/70">Manage users, passwords &amp; settings</div>
                        </div>
                      </div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono">
                        CP
                      </span>
                    </Link>
                  )}

                  {/* 4. User Session / Auth Section */}
                  <div className="pt-2 border-t border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black uppercase ring-2 ring-emerald-500/40">
                          {user.username.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-black text-white text-xs">@{user.username}</span>
                            {isVista && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {user.savedAccounts?.length || 0} accounts &bull; {user.serverPresets?.length || 0} presets
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 rounded-xl transition flex items-center space-x-1 text-[11px] font-bold border border-rose-500/30"
                        title="Sign Out"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={openAuthModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full sm:rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/30 border border-emerald-400 shrink-0"
          >
            <User className="h-3.5 w-3.5" />
            <span>Login</span>
          </button>
        )}
      </div>
    </header>
  );
};

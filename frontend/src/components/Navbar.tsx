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

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Minecraft Brand Logo: Icon Only on Mobile, Icon + Name on Desktop */}
        <div className="flex items-center shrink-0">
          <Link href="/" className="flex items-center space-x-2.5 sm:space-x-3 group" title="VistaAFK Home">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-b from-[#22c55e] to-[#15803d] border-2 border-[#4ade80] flex items-center justify-center shadow-lg shadow-emerald-500/25 relative overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
              <div className="absolute inset-x-0 bottom-0 h-3 sm:h-4 bg-[#854d0e] border-t-2 border-[#166534]" />
              <Box className="h-4 w-4 sm:h-5 sm:w-5 text-white relative z-10 drop-shadow" />
            </div>

            <div className="hidden sm:block">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-black text-base sm:text-xl tracking-tight text-white drop-shadow-sm font-sans">
                  Vista<span className="text-emerald-400">AFK</span>
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-[#1b2738] text-emerald-300 border border-[#2d4059] rounded-md shadow-inner">
                  24/7
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden md:block">Minecraft Chunk Loader & Multi-Server Bot Controller</p>
            </div>
          </Link>
        </div>

        {/* Right Section: Mobile & Desktop Status Button */}
        {user ? (
          <div className="relative shrink-0">
            {/* Username Bubble: Max 5 Letters, Green bg if connected, Red bg if disconnected */}
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`flex items-center space-x-1.5 sm:space-x-2 px-3 py-1.5 rounded-full text-xs font-black transition-all shadow-md active:scale-95 border-2 ${
                isConnected
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-950/40'
                  : isConnecting
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-amber-950/40'
                  : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-950/40'
              }`}
              title={`@${user.username} - Bot Daemon: ${isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}`}
            >
              {/* Status Indicator Dot */}
              <span className="relative flex h-2 w-2 shrink-0">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-80" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white shadow-xs" />
                  </>
                ) : isConnecting ? (
                  <span className="animate-pulse inline-flex rounded-full h-2 w-2 bg-white shadow-xs" />
                ) : (
                  <span className="inline-flex rounded-full h-2 w-2 bg-white/90 shadow-xs" />
                )}
              </span>

              {/* Username: Up to 5 Letters */}
              <span className="font-black text-xs tracking-tight text-white font-mono">
                {user.username.slice(0, 5)}
              </span>

              <Menu className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/90 shrink-0" />
            </button>

            {/* Clean, Simple Dropdown Navigation Menu */}
            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs" onClick={() => setIsUserMenuOpen(false)} />
                <div className="fixed sm:absolute top-16 sm:top-auto sm:mt-2 right-2 sm:right-0 w-[calc(100vw-16px)] sm:w-72 max-w-sm bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl p-3 sm:p-4 z-50 text-xs space-y-2 animate-in fade-in duration-150">
                  {/* Daemon Connection Pill */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-800/90 border border-slate-700/80 rounded-2xl mb-1">
                    <div className="flex items-center space-x-2">
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
                        Daemon: {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
                      </span>
                    </div>

                    {!isConnected && !isConnecting && onRetryConnection && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetryConnection();
                        }}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 font-bold transition"
                      >
                        Retry
                      </button>
                    )}
                  </div>

                  {/* Clean Page Navigation Buttons */}
                  <div className="space-y-1">
                    <Link
                      href="/"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs transition border ${
                        pathname === '/'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Server className="h-4 w-4 text-emerald-400" />
                        <span>Server Fleet</span>
                      </div>
                      {botCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-900/60 text-slate-300">
                          {botCount}
                        </span>
                      )}
                    </Link>

                    <Link
                      href="/accounts"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs transition border ${
                        pathname === '/accounts'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Users className="h-4 w-4 text-emerald-400" />
                        <span>Accounts Vault</span>
                      </div>
                      {typeof savedAccountCount === 'number' && savedAccountCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-900/60 text-slate-300">
                          {savedAccountCount}
                        </span>
                      )}
                    </Link>

                    <Link
                      href="/versions"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs transition border ${
                        pathname === '/versions'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Layers className="h-4 w-4 text-cyan-400" />
                        <span>Supported Versions</span>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-400/80">1.7 - 26.x</span>
                    </Link>

                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-2xl font-bold text-xs transition border ${
                        pathname === '/settings'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/60'
                      }`}
                    >
                      <Settings className="h-4 w-4 text-emerald-400" />
                      <span>Daemon Connection</span>
                    </Link>

                    {isVista && (
                      <Link
                        href="/control-panel"
                        onClick={() => setIsUserMenuOpen(false)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs transition border ${
                          pathname === '/control-panel'
                            ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                            : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <ShieldCheck className="h-4 w-4 text-amber-400" />
                          <span>Admin Control Panel</span>
                        </div>
                        <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300">
                          CP
                        </span>
                      </Link>
                    )}
                  </div>

                  {/* Clean User Profile & Logout Footer */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between px-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black uppercase ring-1 ring-emerald-400/50">
                        {user.username.charAt(0)}
                      </div>
                      <span className="font-bold text-white text-xs">@{user.username}</span>
                    </div>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 rounded-xl transition flex items-center space-x-1.5 text-xs font-bold border border-rose-500/30"
                      title="Sign Out"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="relative flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              onClick={openAuthModal}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full sm:rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/30 border border-emerald-400 shrink-0"
            >
              <User className="h-3.5 w-3.5" />
              <span>Login</span>
            </button>
            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs" onClick={() => setIsUserMenuOpen(false)} />
                <div className="fixed sm:absolute top-16 sm:top-auto sm:mt-2 right-2 sm:right-0 w-[calc(100vw-16px)] sm:w-64 max-w-sm bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl p-3 sm:p-4 z-50 text-xs space-y-2 animate-in fade-in duration-150">
                  <div className="space-y-1.5">
                    <Link
                      href="/"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-2xl font-bold text-xs transition border ${
                        pathname === '/' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/60'
                      }`}
                    >
                      <Server className="h-4 w-4 text-emerald-400" />
                      <span>Server Fleet</span>
                    </Link>
                    <Link
                      href="/accounts"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-2xl font-bold text-xs transition border ${
                        pathname === '/accounts' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/60'
                      }`}
                    >
                      <Users className="h-4 w-4 text-emerald-400" />
                      <span>Accounts Vault</span>
                    </Link>
                    <Link
                      href="/versions"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-2xl font-bold text-xs transition border ${
                        pathname === '/versions' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/60'
                      }`}
                    >
                      <Layers className="h-4 w-4 text-cyan-400" />
                      <span>Supported Versions</span>
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-2xl font-bold text-xs transition border ${
                        pathname === '/settings' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/60'
                      }`}
                    >
                      <Settings className="h-4 w-4 text-emerald-400" />
                      <span>Daemon Connection</span>
                    </Link>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        openAuthModal();
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center space-x-2 shadow-md"
                    >
                      <User className="h-4 w-4" />
                      <span>Sign In / Register</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

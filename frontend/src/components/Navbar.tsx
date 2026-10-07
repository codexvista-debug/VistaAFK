'use client';

import React, { useState } from 'react';
import { Play, Square, Plus, Settings, Wifi, WifiOff, Box, Server, Users, User, LogOut, ShieldCheck, ChevronDown, Lock, Menu } from 'lucide-react';
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

        {/* Primary Page Navigation: Just Icons + Badge */}
        <nav className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          <Link
            href="/"
            className={`flex items-center space-x-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-black transition-all border ${
              pathname === '/'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                : 'bg-[#1b2637]/70 text-slate-300 hover:text-white hover:bg-[#1b2637] border-slate-700'
            }`}
            title="Server Fleet"
          >
            <Server className="h-4 w-4 stroke-[2.5]" />
            {botCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                pathname === '/' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-300'
              }`}>
                {botCount}
              </span>
            )}
          </Link>

          <Link
            href="/accounts"
            className={`flex items-center space-x-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-black transition-all border ${
              pathname === '/accounts'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                : 'bg-[#1b2637]/70 text-slate-300 hover:text-white hover:bg-[#1b2637] border-slate-700'
            }`}
            title="Accounts Vault"
          >
            <Users className="h-4 w-4 stroke-[2.5]" />
            {typeof savedAccountCount === 'number' && savedAccountCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                pathname === '/accounts' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-300'
              }`}>
                {savedAccountCount}
              </span>
            )}
          </Link>
        </nav>

        {/* Right Section: Single Unified Dropdown Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#1b2637]/90 hover:bg-[#253449] border border-slate-700 hover:border-emerald-500/80 text-xs font-bold transition shadow-sm active:scale-95 text-slate-200"
            title="Menu & Controls"
          >
            {/* Live Indicator Dot for Daemon Status (only when logged in) */}
            {user && (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </>
                ) : isConnecting ? (
                  <span className="inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 animate-pulse" />
                ) : (
                  <span className="inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                )}
              </span>
            )}

            {user ? (
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black uppercase shrink-0">
                {user.username.charAt(0)}
              </div>
            ) : null}

            <Menu className="h-4 w-4 text-slate-300 shrink-0" />
          </button>

          {/* Unified Dropdown Panel */}
          {isUserMenuOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs" onClick={() => setIsUserMenuOpen(false)} />
              <div className="fixed sm:absolute top-16 sm:top-auto sm:mt-2 right-2 sm:right-0 w-[calc(100vw-16px)] sm:w-80 max-w-sm bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl p-4 z-50 text-xs space-y-3.5 animate-in fade-in duration-150">
                {/* 1. Daemon Status Card (When Logged In) */}
                {user ? (
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
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenSettingsModal();
                      }}
                      className="w-full py-2 px-3 bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 border border-slate-600/50"
                    >
                      <Settings className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Connection Settings &amp; Termux</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-2 text-center">
                    <p className="text-slate-300 text-xs font-semibold">
                      Sign in to connect your 24/7 daemon and sync across devices.
                    </p>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        openAuthModal();
                      }}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                    >
                      Sign In / Register
                    </button>
                  </div>
                )}

                {/* 2. Admin Control Panel (for user vista) */}
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

                {/* 3. User Session / Auth Section */}
                <div className="pt-2 border-t border-slate-800 space-y-2.5">
                  {user ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black uppercase ring-2 ring-emerald-500/40">
                          {user.username.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-black text-white text-xs">@{user.username}</span>
                            {isVista && (
                              <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
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
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-400">
                        You are in <strong>Guest Mode</strong>. Sign in to save accounts across devices.
                      </div>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          openAuthModal();
                        }}
                        className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/25 flex items-center justify-center space-x-1.5"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Sign In / Create Account</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

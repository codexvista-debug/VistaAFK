'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Server,
  Compass,
  Layers,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Lock,
  Unlock,
} from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { useVistaWebSocket, normalizeWsUrl } from '../../hooks/useVistaWebSocket';
import { useAuth } from '../../context/VistaAuthContext';

export default function SettingsPage() {
  const { user, token: authToken } = useAuth();
  const {
    daemonUrl,
    isConnected,
    isConnecting,
    retryConnection,
    updateDaemonConfig,
    configs,
    telemetry,
    savedAccounts,
    isConnectionLocked,
    toggleConnectionLock,
  } = useVistaWebSocket();

  const [inputUrl, setInputUrl] = useState(daemonUrl);
  const [copiedTermux, setCopiedTermux] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setInputUrl(daemonUrl);
  }, [daemonUrl]);

  const termuxCommand = user?.username
    ? `pkg update -y && pkg install -y git nodejs cloudflared curl && if [ -d "$HOME/VistaAFK" ]; then cd "$HOME/VistaAFK" && git pull origin main; else git clone https://github.com/codexvista-debug/VistaAFK.git "$HOME/VistaAFK" && cd "$HOME/VistaAFK"; fi && bash start.sh ${user.username} ${authToken || ''}`
    : 'pkg update -y && pkg install -y git nodejs cloudflared curl && git clone https://github.com/codexvista-debug/VistaAFK.git "$HOME/VistaAFK" && cd "$HOME/VistaAFK" && bash start.sh';

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    const cleanUrl = normalizeWsUrl(inputUrl.trim());
    setInputUrl(cleanUrl);
    updateDaemonConfig(cleanUrl, '');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSetLocalhost = () => {
    setInputUrl('ws://localhost:8080');
    updateDaemonConfig('ws://localhost:8080', '');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const onlineCount = Object.values(telemetry).filter((t) => t.status === 'online').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800 font-sans">
      <Navbar
        isConnected={isConnected}
        isConnecting={isConnecting}
        onOpenAddModal={() => {}}
        onOpenSettingsModal={() => {}}
        onRetryConnection={retryConnection}
        botCount={configs.length}
        onlineCount={onlineCount}
        savedAccountCount={savedAccounts.length}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6">
        {/* Page Title */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
            <Settings className="h-4 w-4" />
            <span>Connection &amp; System Configuration</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Daemon Connection &amp; Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Link your mobile Termux controller or PC to this dashboard &bull; All links sync automatically
          </p>
        </div>

        {/* 1-Click Termux Command Section */}
        <div className="p-4 sm:p-6 bg-white border-2 border-slate-200 rounded-2xl sm:rounded-3xl shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="p-2 sm:p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl sm:rounded-2xl border border-emerald-500/20 shrink-0 mt-0.5 sm:mt-0">
                <Smartphone className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span>1-Click Termux Command</span>
                  {user && (
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                      @{user.username}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Run this single command in Termux on your phone to launch your 24/7 bot daemon.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
              <a
                href="https://play.google.com/store/apps/details?id=com.termux"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 text-center"
              >
                <span>Google Play</span>
                <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />
              </a>
              <a
                href="https://f-droid.org/en/packages/com.termux/"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 text-center"
              >
                <span>F-Droid APK</span>
                <ExternalLink className="h-3 w-3 text-emerald-200 shrink-0" />
              </a>
            </div>
          </div>

          {/* Terminal Command Code Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 sm:p-4 text-xs font-mono space-y-3 shadow-inner">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span className="text-[11px] font-bold text-slate-300">Termux Command</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Zero Setup Needed</span>
            </div>

            <div className="bg-black/60 border border-slate-800/80 rounded-xl p-3 max-h-40 overflow-y-auto">
              <code className="text-emerald-400 font-mono text-[11px] leading-relaxed break-words select-all block whitespace-pre-wrap">
                {termuxCommand}
              </code>
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(termuxCommand);
                setCopiedTermux(true);
                setTimeout(() => setCopiedTermux(false), 2500);
              }}
              className="w-full py-2.5 sm:py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-xs sm:text-sm font-black rounded-xl transition flex items-center justify-center space-x-2 shadow-md shadow-emerald-900/30"
            >
              {copiedTermux ? (
                <>
                  <Check className="h-4 w-4 text-white" />
                  <span>Command Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-white" />
                  <span>Copy 1-Click Termux Command</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-start space-x-2.5 text-xs text-emerald-950 font-medium leading-relaxed">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <p>
              <strong>Automated Cloud Linking:</strong> When you press Enter in Termux, your phone establishes a secure Cloudflare tunnel and automatically registers the connection link with your VistaAFK account. The URL is updated below and connected instantly without copying or pasting links!
            </p>
          </div>
        </div>

        {/* Live WebSocket Connection Section */}
        <div className="p-4 sm:p-6 bg-white border-2 border-slate-200 rounded-2xl sm:rounded-3xl shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="p-2 sm:p-2.5 bg-slate-100 text-slate-700 rounded-xl sm:rounded-2xl border border-slate-200 shrink-0 mt-0.5 sm:mt-0">
                <Server className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                  Bot Daemon Connection
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Active WebSocket link used by this browser to send commands to your bots
                </p>
              </div>
            </div>

            {/* Live Indicator Status Badge */}
            <div className="flex items-center space-x-2 shrink-0">
              <div
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-2 ${
                  isConnected
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : isConnecting
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
                <span className="relative flex h-2.5 w-2.5">
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
                <span>
                  {isConnected ? 'Connected (24/7)' : isConnecting ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>

              <button
                type="button"
                onClick={retryConnection}
                disabled={isConnecting}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition flex items-center space-x-1 disabled:opacity-50"
                title="Retry connecting to daemon"
              >
                <RefreshCw className={`h-3 w-3 ${isConnecting ? 'animate-spin text-emerald-600' : ''}`} />
                <span>Retry</span>
              </button>
            </div>
          </div>

          {/* Persistent Connection Lock Card */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start sm:items-center space-x-3">
              <div
                className={`p-2 sm:p-2.5 rounded-xl border shrink-0 mt-0.5 sm:mt-0 ${
                  isConnectionLocked
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                    : 'bg-slate-200 border-slate-300 text-slate-500'
                }`}
              >
                {isConnectionLocked ? <Lock className="h-4 w-4 sm:h-5 sm:w-5" /> : <Unlock className="h-4 w-4 sm:h-5 sm:w-5" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                    Persistent 24/7 Connection Lock
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      isConnectionLocked
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isConnectionLocked ? 'ACTIVE LOCK' : 'PAUSED'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                  Relentlessly reconnects every 1.2s whenever network hiccups or Termux restarts. Never pauses or times out.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggleConnectionLock()}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shrink-0 ${
                isConnectionLocked
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              {isConnectionLocked ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Lock Enabled (Auto)</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5" />
                  <span>Lock Disabled</span>
                </>
              )}
            </button>
          </div>

          {/* Form to view / update WebSocket Daemon URL */}
          <form onSubmit={handleSaveUrl} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">WebSocket Daemon URL</label>
                <span className="text-[10px] text-slate-500 font-medium">Auto-updated by Termux or manual</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="wss://xxxx.trycloudflare.com or ws://localhost:8080"
                  className="flex-1 px-3.5 sm:px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
                <div className="grid grid-cols-2 sm:flex gap-2">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm active:scale-95 text-center"
                  >
                    Save &amp; Reconnect
                  </button>
                  <button
                    type="button"
                    onClick={handleSetLocalhost}
                    className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition text-center"
                    title="Use default local port for PC"
                  >
                    Use Localhost
                  </button>
                </div>
              </div>
            </div>

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 animate-in fade-in duration-150">
                ✅ Daemon URL updated and saved! Connecting...
              </div>
            )}
          </form>
        </div>

        {/* Quick Links Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Link
            href="/versions"
            className="p-4 sm:p-5 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl sm:rounded-3xl transition flex items-center justify-between shadow-xs group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 group-hover:scale-105 transition shrink-0">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-slate-900">Supported Minecraft Versions</div>
                <div className="text-[11px] sm:text-xs text-slate-500 font-medium">View live Mojang manifest &amp; protocol support</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition shrink-0 ml-2" />
          </Link>

          <Link
            href="/accounts"
            className="p-4 sm:p-5 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl sm:rounded-3xl transition flex items-center justify-between shadow-xs group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 group-hover:scale-105 transition shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-slate-900">Accounts Vault</div>
                <div className="text-[11px] sm:text-xs text-slate-500 font-medium">Manage and deploy your saved Minecraft accounts</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition shrink-0 ml-2" />
          </Link>
        </div>
      </main>
    </div>
  );
}

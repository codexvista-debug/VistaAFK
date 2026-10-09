'use client';

import React, { useState } from 'react';
import { X, Server, Key, Terminal, Smartphone, Monitor, Copy, Check, ExternalLink, BatteryCharging, Zap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/VistaAuthContext';
import { normalizeWsUrl } from '../context/VistaWebSocketContext';

interface DaemonSettingsModalProps {
  onClose: () => void;
  currentUrl: string;
  currentToken: string;
  onSave: (url: string, token: string) => void;
}

export const DaemonSettingsModal: React.FC<DaemonSettingsModalProps> = ({
  onClose,
  currentUrl,
  currentToken,
  onSave,
}) => {
  const { user, token: authToken } = useAuth();
  const [url, setUrl] = useState(currentUrl);
  const [token, setToken] = useState(currentToken);
  const [activeTab, setActiveTab] = useState<'connection' | 'termux' | 'pc'>('connection');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const termuxCommand = user?.username
    ? `pkg update -y && pkg install -y git nodejs cloudflared && if [ -d "$HOME/VistaAFK" ]; then cd "$HOME/VistaAFK" && git pull origin main; else git clone https://github.com/codexvista-debug/VistaAFK.git "$HOME/VistaAFK" && cd "$HOME/VistaAFK"; fi && bash start.sh ${user.username} ${authToken || ''}`
    : `pkg update -y && pkg install -y git nodejs cloudflared && if [ -d "$HOME/VistaAFK" ]; then cd "$HOME/VistaAFK" && git pull origin main; else git clone https://github.com/codexvista-debug/VistaAFK.git "$HOME/VistaAFK" && cd "$HOME/VistaAFK"; fi && bash start.sh`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(normalizeWsUrl(url), token.trim());
    onClose();
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b-2 border-slate-200 flex items-center justify-between bg-slate-50 gap-2">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 shrink-0">
              <Server className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight truncate">Bot Daemon Connection</h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Connect web dashboard to phone or PC controller</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 active:scale-95 transition shrink-0"
            title="Close (Esc)"
          >
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b-2 border-slate-200 bg-slate-100/70 px-6 pt-2 space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('connection')}
            className={`pb-2.5 px-3 font-bold text-xs flex items-center space-x-1.5 border-b-2 transition ${
              activeTab === 'connection'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="h-4 w-4" />
            <span>Connection URL</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('termux')}
            className={`pb-2.5 px-3 font-bold text-xs flex items-center space-x-1.5 border-b-2 transition ${
              activeTab === 'termux'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="h-4 w-4 text-emerald-600" />
            <span>Android / Termux 24/7 Guide</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pc')}
            className={`pb-2.5 px-3 font-bold text-xs flex items-center space-x-1.5 border-b-2 transition ${
              activeTab === 'pc'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="h-4 w-4 text-blue-600" />
            <span>PC / VPS Guide</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[65vh] space-y-4">
          {/* TAB 1: Connection Settings */}
          {activeTab === 'connection' && (
            <div className="space-y-4">
              {/* 1-Click Termux Launch Section */}
              <div className="p-4 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/60 border-2 border-emerald-300 rounded-2xl space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Terminal className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span className="font-black text-slate-900 text-xs uppercase tracking-wide">
                      {user ? `⚡ 1-Click Termux Command for @${user.username}` : '⚡ 1-Click Termux Setup Command'}
                    </span>
                  </div>
                  {user && (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-white/80 border border-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      <span>Authenticated</span>
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Run this single command in <strong>Termux</strong> on your phone. It installs all packages, launches the bot, and prints your instant access link:
                </p>

                {/* Command Box with 1-Click Copy */}
                <div className="flex items-center justify-between bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] shadow-inner gap-2">
                  <code className="break-all select-all leading-relaxed line-clamp-3">
                    {termuxCommand}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(termuxCommand, 'quickCommand')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shrink-0 transition flex items-center space-x-1 shadow-sm"
                  >
                    {copiedKey === 'quickCommand' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-white" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-white" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Termux App Download Links */}
                <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-700">Need Termux?</span>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.termux"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg font-bold shadow-xs transition"
                  >
                    <span>Google Play Store</span>
                    <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                  <a
                    href="https://f-droid.org/en/packages/com.termux/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-300 rounded-lg font-bold shadow-xs transition"
                    title="Recommended if Google Play has repository issues"
                  >
                    <span>F-Droid (Recommended APK)</span>
                    <ExternalLink className="h-3 w-3 text-emerald-600" />
                  </a>
                </div>
              </div>

              {/* URL Form */}
              <form onSubmit={handleSave} className="space-y-4 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      WebSocket Daemon URL
                    </label>
                    <span className="text-[10px] text-slate-500">Auto-cleans website & tunnel links</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={url}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes('trycloudflare.com') || val.includes('connect=')) {
                        setUrl(normalizeWsUrl(val));
                      } else {
                        setUrl(val);
                      }
                    }}
                    onBlur={() => setUrl(normalizeWsUrl(url))}
                    placeholder="wss://your-name.trycloudflare.com or ws://localhost:8080"
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition font-mono font-bold"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    • <strong>Paste any link:</strong> Paste your Cloudflare tunnel link or full 1-click link (e.g. <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono font-bold">wss://xxxx.trycloudflare.com</code>).<br />
                    • <strong>On Local PC:</strong> Use <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono">ws://localhost:8080</code>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Secret Token <span className="text-slate-400 font-normal">(optional, if VISTAAFK_SECRET is configured)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Leave blank if no secret configured on daemon"
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition font-mono"
                    />
                    <Key className="h-4 w-4 text-slate-400 absolute right-3.5 top-3" />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveTab('termux')}
                    className="text-emerald-600 hover:text-emerald-700 text-xs font-bold flex items-center space-x-1"
                  >
                    <Smartphone className="h-4 w-4" />
                    <span>Termux 24/7 Setup Guide ➔</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {currentUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSave('', '');
                          onClose();
                        }}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition"
                        title="Unlink and disconnect this daemon from your account"
                      >
                        Disconnect
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/25 transition"
                    >
                      Save & Reconnect
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: In-Depth Android / Termux 24/7 Setup Guide */}
          {activeTab === 'termux' && (
            <div className="space-y-4 text-xs leading-relaxed text-slate-700">
              <div className="p-3.5 bg-emerald-50/70 border-2 border-emerald-200 rounded-2xl flex items-start space-x-3">
                <Zap className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-wide">
                    Android 24/7 Minecraft AFK System
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Your phone runs the bot silently in the background while your screen is locked. Follow these steps once:
                  </p>
                </div>
              </div>

              {/* Step 1 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Step 1: Install Termux & Packages</span>
                  <span className="text-[10px] font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold">First time only</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Open <strong>Termux</strong> on your Android phone and install Node.js, Git, and Cloudflared:
                </p>
                <div className="flex items-center justify-between bg-slate-900 text-emerald-400 p-2.5 rounded-xl font-mono text-[11px]">
                  <code>pkg update -y && pkg install -y git nodejs-lts cloudflared</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('pkg update -y && pkg install -y git nodejs-lts cloudflared', 'step1')}
                    className="p-1 text-slate-400 hover:text-white transition"
                    title="Copy command"
                  >
                    {copiedKey === 'step1' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 2: Critical Battery & Lock Screen */}
              <div className="p-4 bg-amber-50/70 border-2 border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs">
                  <BatteryCharging className="h-4 w-4 text-amber-600" />
                  <span>Step 2: Keep Screen Locked & Prevent Phone from Sleeping</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-normal">
                  Android will kill background apps unless you do these two things:
                </p>
                <ol className="list-decimal list-inside text-[11px] space-y-1 text-slate-700 font-medium">
                  <li>
                    In Termux, run this command to prevent CPU sleep:
                    <div className="flex items-center justify-between bg-slate-900 text-amber-300 p-2 mt-1 rounded-xl font-mono text-[11px]">
                      <code>termux-wake-lock</code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('termux-wake-lock', 'step2')}
                        className="p-1 text-slate-400 hover:text-white transition"
                      >
                        {copiedKey === 'step2' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </li>
                  <li>
                    On your phone: Open <strong>Phone Settings ➔ Apps ➔ Termux ➔ Battery</strong> ➔ Select <strong>"Unrestricted"</strong> (No battery optimizations).
                  </li>
                </ol>
              </div>

              {/* Step 3: Download & Build */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Step 3: Download and Build Daemon</span>
                  <span className="text-[10px] font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold">First time</span>
                </div>
                <div className="flex items-center justify-between bg-slate-900 text-emerald-400 p-2.5 rounded-xl font-mono text-[11px]">
                  <code>git clone https://github.com/codexvista-debug/VistaAFK.git ~/VistaAFK && cd ~/VistaAFK && npm run build:daemon</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('git clone https://github.com/codexvista-debug/VistaAFK.git ~/VistaAFK && cd ~/VistaAFK && npm run build:daemon', 'step3')}
                    className="p-1 text-slate-400 hover:text-white transition"
                  >
                    {copiedKey === 'step3' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 4: Run Daemon */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <span className="font-bold text-slate-900 text-xs">Step 4: Launch Daemon</span>
                <p className="text-[11px] text-slate-600">Start the bot controller daemon:</p>
                <div className="flex items-center justify-between bg-slate-900 text-emerald-400 p-2.5 rounded-xl font-mono text-[11px]">
                  <code>node daemon/dist/server.js</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('node daemon/dist/server.js', 'step4')}
                    className="p-1 text-slate-400 hover:text-white transition"
                  >
                    {copiedKey === 'step4' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  It will display: <code>[VistaAFK Daemon] WebSocket server listening on ws://0.0.0.0:8080</code>
                </p>
              </div>

              {/* Step 5: Cloudflare Tunnel */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Step 5: Connect to Online Vercel Website</span>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Tunnel</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Swipe from the <strong>left edge</strong> of your Termux screen ➔ tap <strong>NEW SESSION</strong> ➔ run:
                </p>
                <div className="flex items-center justify-between bg-slate-900 text-cyan-400 p-2.5 rounded-xl font-mono text-[11px]">
                  <code>cloudflared tunnel --url http://127.0.0.1:8080</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('cloudflared tunnel --url http://127.0.0.1:8080', 'step5')}
                    className="p-1 text-slate-400 hover:text-white transition"
                  >
                    {copiedKey === 'step5' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600">
                  Look for the line ending in <code className="font-bold text-slate-900">.trycloudflare.com</code> (e.g. <code className="text-emerald-700 font-mono">https://xxxx.trycloudflare.com</code>).
                  Copy it, click the <strong>Connection URL</strong> tab at the top of this popup, paste as <code className="text-emerald-700 font-mono">wss://xxxx.trycloudflare.com</code> and click <strong>Save & Reconnect</strong>!
                </p>
              </div>

              {/* Quick Daily Cheat Sheet */}
              <div className="p-4 bg-slate-100 border-2 border-slate-300 rounded-2xl space-y-2">
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-tight flex items-center space-x-1.5">
                  <Terminal className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Daily Relaunch Cheat Sheet (Whenever you reboot your phone)</span>
                </h4>
                <div className="space-y-1.5 text-[11px] font-mono text-slate-800">
                  <div>
                    <span className="text-slate-500">Session 1 (Daemon):</span>
                    <pre className="bg-white p-2 rounded-lg border border-slate-200 mt-0.5 text-emerald-800 font-bold select-all">
                      termux-wake-lock && cd ~/VistaAFK && node daemon/dist/server.js
                    </pre>
                  </div>
                  <div>
                    <span className="text-slate-500">Session 2 (Tunnel):</span>
                    <pre className="bg-white p-2 rounded-lg border border-slate-200 mt-0.5 text-cyan-800 font-bold select-all">
                      cloudflared tunnel --url http://127.0.0.1:8080
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PC / VPS Guide */}
          {activeTab === 'pc' && (
            <div className="space-y-4 text-xs leading-relaxed text-slate-700">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <span className="font-bold text-slate-900 text-xs">Running Locally on Windows / Mac / Linux PC</span>
                <p className="text-[11px] text-slate-600">
                  If running on the same PC where you open Chrome:
                </p>
                <div className="bg-slate-900 text-emerald-400 p-2.5 rounded-xl font-mono text-[11px] space-y-1">
                  <div>cd VistaAFK/daemon</div>
                  <div>npm run build</div>
                  <div>node dist/server.js</div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Then in Connection URL tab, simply use: <code className="text-slate-800 bg-slate-200 px-1 py-0.5 rounded font-mono font-bold">ws://localhost:8080</code>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

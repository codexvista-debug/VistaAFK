'use client';

import React, { useState } from 'react';
import { X, Server, Key, Terminal } from 'lucide-react';

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
  const [url, setUrl] = useState(currentUrl);
  const [token, setToken] = useState(currentToken);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(url.trim(), token.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Bot Daemon Connection</h2>
              <p className="text-xs text-slate-500 font-medium">Connect this web dashboard to your persistent bot controller</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              WebSocket Daemon URL
            </label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://localhost:8080 or wss://my-vps.com:8080"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              • For local browser: Use <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono">ws://localhost:8080</code><br />
              • For Vercel cloud: Connect to your remote VPS or public tunnel (e.g. ngrok or Cloudflare tunnel).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Secret Token <span className="text-slate-400 font-normal">(optional, if VISTAAFK_SECRET is configured)</span>
            </label>
            <div className="relative">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Leave blank if no secret configured on daemon"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
              />
              <Key className="h-4 w-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
            <div className="flex items-center space-x-2 text-emerald-700 font-bold">
              <Terminal className="h-4 w-4" />
              <span>How to run the Daemon</span>
            </div>
            <p className="text-slate-600 text-[11px]">
              Open a terminal in the <code className="text-slate-900 font-mono font-semibold">daemon/</code> directory and run:
            </p>
            <pre className="bg-slate-900 p-2.5 rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto shadow-inner">
              npm run dev
            </pre>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition"
            >
              Save & Reconnect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

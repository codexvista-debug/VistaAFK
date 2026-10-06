'use client';

import React, { useState } from 'react';
import { X, Server, Key, HelpCircle, Check, Terminal } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0e1626] border border-gray-800 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Bot Daemon Connection</h2>
              <p className="text-xs text-gray-400">Connect this dashboard to your persistent bot controller</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              WebSocket Daemon URL
            </label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://localhost:8080 or wss://my-vps.com:8080"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              • For local testing: Use <code className="text-gray-400">ws://localhost:8080</code><br />
              • If dashboard is on Vercel: Connect to your remote VPS or public tunnel (e.g. ngrok / cloudflared).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Secret Token <span className="text-gray-500 font-normal">(optional, if VISTAAFK_SECRET is set)</span>
            </label>
            <div className="relative">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Leave blank if no secret configured on daemon"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              <Key className="h-4 w-4 text-gray-500 absolute right-3 top-3" />
            </div>
          </div>

          <div className="p-3.5 bg-gray-900/60 border border-gray-800 rounded-xl text-xs space-y-2">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
              <Terminal className="h-4 w-4" />
              <span>How to start the Daemon</span>
            </div>
            <p className="text-gray-400 text-[11px]">
              Open a terminal in the <code className="text-gray-300">daemon/</code> folder and run:
            </p>
            <pre className="bg-black/60 p-2 rounded text-[11px] font-mono text-emerald-300 overflow-x-auto">
              npm run dev
            </pre>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
            >
              Save & Reconnect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

'use client';

import React, { useState, useEffect } from 'react';
import { X, Server, Play, Users, CheckCircle2, Globe, ShieldCheck, Box } from 'lucide-react';
import { SavedAccount, ServerPreset, MinecraftEdition } from '../types';
import Link from 'next/link';

interface DeployServerModalProps {
  onClose: () => void;
  savedAccounts: SavedAccount[];
  serverPresets: ServerPreset[];
  initialAccount?: SavedAccount | null;
  onDeploy: (account: SavedAccount, server: { host: string; port: number; version?: string; edition?: MinecraftEdition }) => void;
}

export const DeployServerModal: React.FC<DeployServerModalProps> = ({
  onClose,
  savedAccounts,
  serverPresets,
  initialAccount,
  onDeploy,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialAccount?.id || (savedAccounts.length > 0 ? savedAccounts[0].id : '')
  );

  const initialAcc = savedAccounts.find((a) => a.id === (initialAccount?.id || (savedAccounts.length > 0 ? savedAccounts[0].id : '')));
  const edition: MinecraftEdition = 'java';

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    return serverPresets.length > 0 ? serverPresets[0].id : 'custom';
  });

  const [targetServerHost, setTargetServerHost] = useState(
    serverPresets.length > 0 ? serverPresets[0].host : 'donutsmp.net'
  );
  const [targetServerPort, setTargetServerPort] = useState(
    serverPresets.length > 0 ? serverPresets[0].port : 25565
  );
  const [targetServerVersion, setTargetServerVersion] = useState(
    serverPresets.length > 0 ? (serverPresets[0].version || '') : ''
  );

  const selectedAccount = savedAccounts.find((a) => a.id === selectedAccountId);

  const handleSelectAccount = (acc: SavedAccount) => {
    setSelectedAccountId(acc.id);
  };

  const handlePresetSelect = (preset: ServerPreset) => {
    setSelectedPresetId(preset.id);
    setTargetServerHost(preset.host);
    setTargetServerPort(preset.port || 25565);
    setTargetServerVersion(preset.version || '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !targetServerHost.trim()) return;

    onDeploy(selectedAccount, {
      host: targetServerHost.trim(),
      port: targetServerPort,
      version: targetServerVersion.trim() || undefined,
      edition,
    });

    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#0c1220] border border-slate-700/80 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl shadow-black/60 overflow-hidden my-auto max-h-[92vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#11192e] gap-2">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 shrink-0">
              <Server className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight truncate">Deploy Server Bot</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate">Connect an account from your vault to a Minecraft server</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition shrink-0"
            title="Close (Esc)"
          >
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Step 1: Select Saved Account */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                <span>1. Select Account to Deploy</span>
              </label>
              <Link
                href="/accounts"
                className="text-[11px] font-bold text-emerald-400 hover:underline"
                onClick={onClose}
              >
                + Add New to Vault
              </Link>
            </div>

            {savedAccounts.length === 0 ? (
              <div className="p-4 bg-amber-950/60 border border-amber-600/70 rounded-2xl text-xs text-amber-200 font-medium">
                No accounts found in your Vault. Please add an account in the{' '}
                <Link href="/accounts" className="font-bold underline text-white" onClick={onClose}>
                  Accounts Vault
                </Link>{' '}
                first.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-36 overflow-y-auto pr-1">
                {savedAccounts.map((acc) => {
                  const isSelected = acc.id === selectedAccountId;
                  const isBedrock = acc.edition === 'bedrock' || acc.id.includes('bedrock');
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleSelectAccount(acc)}
                      className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-sm'
                          : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <img
                          src={`https://mc-heads.net/avatar/${acc.name}/32`}
                          alt={acc.name}
                          className="h-7 w-7 rounded-lg border border-slate-700 bg-slate-800 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="truncate">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-xs text-white truncate">{acc.name}</span>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${
                              isBedrock
                                ? 'bg-sky-950/80 text-sky-300 border-sky-700/60'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                            }`}>
                              {isBedrock ? '🧱' : '☕'}
                            </span>
                          </div>
                          <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                            {acc.authType === 'microsoft' ? 'MS OAuth' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Select Server Preset */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center space-x-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-400" />
              <span>2. Choose Server Target</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {serverPresets.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-emerald-950/80 border-emerald-500 font-bold text-emerald-300 shadow-sm'
                        : 'bg-[#0e1626] border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="block truncate font-bold text-xs">{preset.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono block truncate mt-0.5">
                      {preset.host || 'Any custom IP'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DonutSMP Safe Mode Notice */}
          {targetServerHost.toLowerCase().includes('donut') && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-700/60 rounded-2xl flex items-start space-x-2.5 text-xs text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-emerald-300">DonutSMP Safe AFK Mode Active</span>
                <span className="text-[11px] text-emerald-400/90 leading-tight block mt-0.5">
                  Anti-AFK movements, auto-eat, and auto-totem are <strong>turned OFF by default</strong> for DonutSMP to prevent anti-cheat kicks. You can enable them manually in bot settings if needed.
                </span>
              </div>
            </div>
          )}

          {/* Step 3: Server Details (Host, Port, Version) */}
          <div className="p-3.5 bg-[#0a0f1d] border border-slate-800 rounded-2xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Server Host / IP</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. donutsmp.net or play.freshsmp.fun"
                  value={targetServerHost}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTargetServerHost(val);
                    const matched = serverPresets.find(
                      (p) => p.host && p.host.toLowerCase() === val.trim().toLowerCase()
                    );
                    setSelectedPresetId(matched ? matched.id : 'custom');
                  }}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Port</label>
                <input
                  type="number"
                  value={targetServerPort}
                  onChange={(e) => setTargetServerPort(parseInt(e.target.value, 10) || 25565)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">
                  Version Override <span className="font-normal text-slate-500">(Optional)</span>
                </label>
                <span className="text-[10px] text-emerald-400 font-semibold">Blank = Auto-Detect Server Version</span>
              </div>
              <input
                type="text"
                placeholder="Auto-detect (Recommended, leave blank)"
                value={targetServerVersion}
                onChange={(e) => setTargetServerVersion(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500 font-mono shadow-inner"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedAccount || !targetServerHost.trim()}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition flex items-center space-x-2"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Deploy & Connect Bot</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

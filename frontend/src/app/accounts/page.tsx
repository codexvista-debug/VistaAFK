'use client';

import React, { useState } from 'react';
import { useVistaWebSocket } from '../../hooks/useVistaWebSocket';
import { Navbar } from '../../components/Navbar';
import { DaemonSettingsModal } from '../../components/DaemonSettingsModal';
import { NotificationToast } from '../../components/NotificationToast';
import { SavedAccount, ServerPreset } from '../../types';
import {
  Users,
  Plus,
  Trash2,
  Play,
  Server,
  Key,
  ShieldCheck,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export default function AccountsPage() {
  const {
    savedAccounts,
    saveAccount,
    deleteSavedAccount,
    serverPresets,
    saveServerPreset,
    deployAccountToServer,
    configs,
    telemetry,
    startAll,
    stopAll,
    isConnected,
    isConnecting,
    daemonUrl,
    secretToken,
    updateDaemonConfig,
    notifications,
  } = useVistaWebSocket();

  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [selectedAccountForDeploy, setSelectedAccountForDeploy] = useState<SavedAccount | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // New Account Form State
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountAuth, setNewAccountAuth] = useState<'microsoft' | 'offline'>('microsoft');
  const [newAccountNotes, setNewAccountNotes] = useState('');

  // Deploy to Server Form State
  const [targetServerHost, setTargetServerHost] = useState('play.freshsmp.fun');
  const [targetServerPort, setTargetServerPort] = useState(25565);
  const [targetServerVersion, setTargetServerVersion] = useState('');

  const handleAddAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;

    const account: SavedAccount = {
      id: Math.random().toString(36).substring(2, 9),
      name: newAccountName.trim(),
      authType: newAccountAuth,
      notes: newAccountNotes.trim() || undefined,
      createdAt: Date.now(),
    };

    saveAccount(account);
    setNewAccountName('');
    setNewAccountNotes('');
    setIsAddAccountModalOpen(false);
  };

  const handleOpenDeploy = (account: SavedAccount) => {
    setSelectedAccountForDeploy(account);
    setIsDeployModalOpen(true);
  };

  const handleDeploySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountForDeploy || !targetServerHost.trim()) return;

    deployAccountToServer(selectedAccountForDeploy, {
      host: targetServerHost.trim(),
      port: targetServerPort,
      version: targetServerVersion.trim() || undefined,
    });

    setIsDeployModalOpen(false);
  };

  const onlineCount = Object.values(telemetry).filter((t) => t.status === 'online').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#e2e8f0] text-slate-800 font-sans">
      {/* Navbar with active Accounts Vault tab */}
      <Navbar
        isConnected={isConnected}
        isConnecting={isConnecting}
        onOpenAddModal={() => setIsAddAccountModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        botCount={configs.length}
        onlineCount={onlineCount}
        savedAccountCount={savedAccounts.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b-2 border-slate-300 gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-800 border-2 border-emerald-300 flex items-center justify-center shadow-sm">
              <Users className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                Accounts Vault
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Save your Minecraft accounts once &bull; Deploy the same account to multiple servers anytime
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsAddAccountModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-emerald-700/20 transition flex items-center space-x-2"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Add Account to Vault</span>
            </button>
          </div>
        </div>

        {/* Saved Accounts Grid */}
        <div className="mt-8 space-y-4">
          {savedAccounts.length === 0 ? (
            <div className="p-12 bg-white border-4 border-t-white border-l-white border-b-slate-400 border-r-slate-400 rounded-3xl flex flex-col items-center justify-center text-center shadow-lg">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-slate-500 mb-4">
                <Users className="h-8 w-8 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Your Account Vault is Empty</h3>
              <p className="text-xs text-slate-600 max-w-md mt-1 leading-relaxed font-medium">
                Add your Minecraft Gamertags here once. They will stay saved permanently, so you can connect them to FreshSMP, Hypixel, or any server with one click!
              </p>
              <button
                onClick={() => setIsAddAccountModalOpen(true)}
                className="mt-6 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                + Save Your First Account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {savedAccounts.map((acc) => {
                // Check if this account is currently deployed on any server
                const activeDeployments = configs.filter((c) => c.name.toLowerCase() === acc.name.toLowerCase());

                return (
                  <div
                    key={acc.id}
                    className="bg-white border-4 border-t-white border-l-white border-b-slate-400 border-r-slate-400 rounded-2xl p-5 shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3.5">
                          <img
                            src={`https://mc-heads.net/avatar/${acc.name}/64`}
                            alt={acc.name}
                            className="w-12 h-12 rounded-xl border-2 border-slate-300 bg-slate-100 object-cover shadow-sm"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/64';
                            }}
                          />
                          <div>
                            <h3 className="font-black text-slate-900 text-base">{acc.name}</h3>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {acc.authType === 'microsoft' ? 'Microsoft OAuth' : 'Offline'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                Saved {new Date(acc.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => deleteSavedAccount(acc.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete from Vault"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Active Server Deployments count */}
                      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                          Active Server Deployments: {activeDeployments.length}
                        </span>
                        {activeDeployments.length > 0 ? (
                          <div className="space-y-1 pt-1">
                            {activeDeployments.map((d) => (
                              <div key={d.id} className="flex items-center justify-between text-[11px] font-mono font-medium text-slate-700">
                                <span>&bull; {d.host}:{d.port}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${telemetry[d.id]?.status === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                                  {telemetry[d.id]?.status || 'offline'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500">Not currently connected to any server.</p>
                        )}
                      </div>
                    </div>

                    {/* Deploy Action Button */}
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <button
                        onClick={() => handleOpenDeploy(acc)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center space-x-2"
                      >
                        <Server className="h-4 w-4" />
                        <span>Deploy to Server</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add Account Modal */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border-4 border-t-white border-l-white border-b-slate-400 border-r-slate-400 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="font-black text-slate-900 text-base">Save Account to Vault</h3>
              </div>
              <button onClick={() => setIsAddAccountModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccountSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Minecraft Gamertag / Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. acollo"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Auth Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewAccountAuth('microsoft')}
                    className={`p-3 rounded-xl border-2 text-left text-xs font-bold transition ${
                      newAccountAuth === 'microsoft'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Microsoft OAuth
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAccountAuth('offline')}
                    className={`p-3 rounded-xl border-2 text-left text-xs font-bold transition ${
                      newAccountAuth === 'offline'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Offline / Cracked
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deploy Account to Server Modal */}
      {isDeployModalOpen && selectedAccountForDeploy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border-4 border-t-white border-l-white border-b-slate-400 border-r-slate-400 rounded-3xl w-full max-w-lg p-4 sm:p-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200">
              <div className="flex items-center space-x-2.5">
                <img
                  src={`https://mc-heads.net/avatar/${selectedAccountForDeploy.name}/48`}
                  alt=""
                  className="w-8 h-8 rounded-lg border border-slate-300"
                />
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Deploy <span className="text-emerald-700">{selectedAccountForDeploy.name}</span> to Server
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Select a server to launch this bot instance</p>
                </div>
              </div>
              <button onClick={() => setIsDeployModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="mt-4">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-2">
                Quick Server Presets:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {serverPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setTargetServerHost(preset.host);
                      setTargetServerPort(preset.port);
                      setTargetServerVersion(preset.version || '');
                    }}
                    className={`p-2 rounded-xl border text-left text-xs transition ${
                      preset.host ? targetServerHost === preset.host : (!targetServerHost || preset.id === 'custom')
                        ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block truncate font-bold">{preset.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono block truncate">
                      {preset.host || 'Any custom IP'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* DonutSMP Safe Mode Notice */}
            {targetServerHost.toLowerCase().includes('donut') && (
              <div className="mt-3 p-3 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-start space-x-2 text-xs text-emerald-950">
                <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-emerald-900">DonutSMP Safe AFK Mode Active</span>
                  <span className="text-[11px] text-emerald-800 leading-tight block mt-0.5">
                    Anti-AFK movements, auto-eat, and auto-totem are <strong>turned OFF by default</strong> for DonutSMP to prevent anti-cheat kicks. You can enable them manually in bot settings if needed.
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleDeploySubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Server Host / IP</label>
                  <input
                    type="text"
                    required
                    value={targetServerHost}
                    onChange={(e) => setTargetServerHost(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Port</label>
                  <input
                    type="number"
                    value={targetServerPort}
                    onChange={(e) => setTargetServerPort(parseInt(e.target.value, 10) || 25565)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Version Override <span className="font-normal text-slate-400">(leave blank for auto-detect)</span>
                </label>
                <input
                  type="text"
                  placeholder="Auto-detect (recommended, leave blank)"
                  value={targetServerVersion}
                  onChange={(e) => setTargetServerVersion(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsDeployModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-1.5"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Launch Bot Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daemon Settings Modal */}
      {isSettingsModalOpen && (
        <DaemonSettingsModal
          onClose={() => setIsSettingsModalOpen(false)}
          currentUrl={daemonUrl}
          currentToken={secretToken}
          onSave={updateDaemonConfig}
        />
      )}

      {/* Live Toast Notifications */}
      <NotificationToast
        notifications={notifications}
        onDismiss={() => {}}
      />
    </div>
  );
}

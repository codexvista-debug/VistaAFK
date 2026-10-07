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
  Package,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Coffee,
  Box,
} from 'lucide-react';
import { BotInventoryModal } from '../../components/BotInventoryModal';
import { BotConfig } from '../../types';
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
    dismissNotification,
    discoveryDeviceCode,
    discoveryStatus,
    discoveryProfiles,
    discoveryError,
    discoverMicrosoftAccount,
    resetDiscovery,
  } = useVistaWebSocket();

  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [selectedAccountForDeploy, setSelectedAccountForDeploy] = useState<SavedAccount | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [inventoryModalBot, setInventoryModalBot] = useState<BotConfig | null>(null);

  // New Account Form State
  const [newAccountAuth, setNewAccountAuth] = useState<'microsoft' | 'offline'>('microsoft');
  const [newAccountEdition, setNewAccountEdition] = useState<'java' | 'bedrock'>('java');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountNotes, setNewAccountNotes] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showManualMsaInput, setShowManualMsaInput] = useState(false);

  // Deploy to Server Form State
  const [targetServerHost, setTargetServerHost] = useState('play.freshsmp.fun');
  const [targetServerPort, setTargetServerPort] = useState(25565);
  const [targetServerVersion, setTargetServerVersion] = useState('');

  const copyAndOpenMicrosoft = (code: string, url: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
    window.open(url, '_blank');
  };

  const handleOpenAddModal = () => {
    resetDiscovery();
    setNewAccountName('');
    setNewAccountNotes('');
    setShowManualMsaInput(false);
    setIsAddAccountModalOpen(true);
  };

  const handleAddAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;

    if (newAccountAuth === 'microsoft') {
      const baseName = newAccountName.trim();
      const javaAccount: SavedAccount = {
        id: `msa-java-${baseName.toLowerCase()}`,
        name: baseName,
        authType: 'microsoft',
        edition: 'java',
        notes: newAccountNotes.trim() || undefined,
        createdAt: Date.now(),
      };
      const bedrockAccount: SavedAccount = {
        id: `msa-bedrock-${baseName.toLowerCase()}`,
        name: baseName,
        gamertag: baseName,
        authType: 'microsoft',
        edition: 'bedrock',
        notes: newAccountNotes.trim() || undefined,
        createdAt: Date.now(),
      };
      saveAccount(javaAccount);
      saveAccount(bedrockAccount);
    } else {
      const account: SavedAccount = {
        id: `${newAccountEdition}-${Math.random().toString(36).substring(2, 9)}`,
        name: newAccountName.trim(),
        authType: 'offline',
        edition: newAccountEdition,
        notes: newAccountNotes.trim() || undefined,
        createdAt: Date.now(),
      };
      saveAccount(account);
    }

    setNewAccountName('');
    setNewAccountNotes('');
    setShowManualMsaInput(false);
    setIsAddAccountModalOpen(false);
  };

  const handleOpenDeploy = (account: SavedAccount) => {
    setSelectedAccountForDeploy(account);
    if (account.edition === 'bedrock') {
      setTargetServerHost('geo.freshsmp.fun');
      setTargetServerPort(19132);
    } else {
      setTargetServerHost('donutsmp.net');
      setTargetServerPort(25565);
    }
    setTargetServerVersion('');
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
                                <div className="flex items-center space-x-1.5">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${telemetry[d.id]?.status === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                                    {telemetry[d.id]?.status || 'offline'}
                                  </span>
                                  {telemetry[d.id]?.status === 'online' && (
                                    <button
                                      type="button"
                                      onClick={() => setInventoryModalBot(d)}
                                      className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition"
                                      title="View Inventory, Items & Lore"
                                    >
                                      <Package className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
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
          <div className="bg-white border-4 border-t-white border-l-white border-b-slate-400 border-r-slate-400 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b-2 border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Add Account to Vault</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Link Microsoft Account or add Offline profile</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddAccountModalOpen(false);
                  resetDiscovery();
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Auth Type Switcher */}
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Account Authentication</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewAccountAuth('microsoft');
                    setShowManualMsaInput(false);
                  }}
                  className={`p-3 rounded-2xl border-2 text-left transition flex items-center space-x-3 ${
                    newAccountAuth === 'microsoft'
                      ? 'bg-emerald-50/70 border-emerald-600 text-emerald-950 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-0.5 w-4 h-4 shrink-0">
                    <span className="bg-[#f25022] rounded-2xs" />
                    <span className="bg-[#7fba00] rounded-2xs" />
                    <span className="bg-[#00a4ef] rounded-2xs" />
                    <span className="bg-[#ffb900] rounded-2xs" />
                  </div>
                  <div>
                    <span className="block text-xs font-black">Microsoft Account</span>
                    <span className="text-[10px] text-slate-500 font-medium block">Auto-detects Java & Bedrock</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNewAccountAuth('offline')}
                  className={`p-3 rounded-2xl border-2 text-left transition flex items-center space-x-2.5 ${
                    newAccountAuth === 'offline'
                      ? 'bg-emerald-50/70 border-emerald-600 text-emerald-950 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Key className="h-4 w-4 text-slate-600 shrink-0" />
                  <div>
                    <span className="block text-xs font-black">Offline / Cracked</span>
                    <span className="text-[10px] text-slate-500 font-medium block">Custom Username & Edition</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Microsoft OAuth Flow (NO Username asked upfront!) */}
            {newAccountAuth === 'microsoft' ? (
              <div className="mt-4 space-y-4">
                {discoveryStatus === 'idle' && !showManualMsaInput && (
                  <div className="p-4 bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-slate-50 border-2 border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm mt-0.5">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">Lunar & Launcher-Style Auto Detection</h4>
                        <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-relaxed">
                          No need to type your username! Click <strong>Sign In with Microsoft</strong> below. You'll receive a secure Microsoft device code. Once approved in your browser, VistaAFK will automatically detect your <strong>Java Edition profile</strong> and your <strong>Bedrock Edition Gamertag</strong> and save both as ready-to-deploy accounts.
                        </p>
                      </div>
                    </div>

                    {!isConnected && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2 text-amber-800 text-xs font-medium">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>Daemon is currently offline. Ensure your VistaAFK daemon is active to initiate OAuth.</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => discoverMicrosoftAccount()}
                      disabled={!isConnected}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-700/20 transition flex items-center justify-center space-x-2"
                    >
                      <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
                        <span className="bg-[#f25022] rounded-2xs" />
                        <span className="bg-[#7fba00] rounded-2xs" />
                        <span className="bg-[#00a4ef] rounded-2xs" />
                        <span className="bg-[#ffb900] rounded-2xs" />
                      </div>
                      <span>Sign In with Microsoft</span>
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setShowManualMsaInput(true)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline transition font-medium"
                      >
                        Daemon offline or having trouble? Enter Microsoft username manually
                      </button>
                    </div>
                  </div>
                )}

                {discoveryStatus === 'waiting_code' && (
                  <div className="p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                    <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Connecting to Microsoft Identity Service...</span>
                      <span className="text-[11px] text-slate-500 font-medium">Generating device authorization code</span>
                    </div>
                  </div>
                )}

                {discoveryStatus === 'waiting_approval' && discoveryDeviceCode && (
                  <div className="p-5 bg-slate-50 border-2 border-emerald-300 rounded-2xl space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Microsoft Device Code:</span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center space-x-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>Waiting for approval</span>
                      </span>
                    </div>

                    <div className="p-3 bg-slate-900 border-2 border-slate-700 rounded-2xl text-center">
                      <span className="font-mono text-2xl font-black text-emerald-400 tracking-widest selection:bg-emerald-800">
                        {discoveryDeviceCode.userCode}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyAndOpenMicrosoft(discoveryDeviceCode.userCode, discoveryDeviceCode.verificationUri)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-700/20 transition flex items-center justify-center space-x-2"
                    >
                      {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span>{copiedCode ? 'Code Copied! Opening Microsoft...' : 'Copy Code & Open Microsoft Login ↗'}</span>
                    </button>

                    <p className="text-[11px] text-slate-500 text-center font-medium leading-relaxed">
                      Go to <code className="text-emerald-700 font-bold">{discoveryDeviceCode.verificationUri}</code>, paste the code, and sign in. Your Java and Bedrock accounts will automatically appear below!
                    </p>
                  </div>
                )}

                {discoveryStatus === 'success' && discoveryProfiles && (
                  <div className="p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-3.5">
                    <div className="flex items-center space-x-2 text-emerald-800 font-black text-sm">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>Microsoft Account Linked Successfully!</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      The following Minecraft profiles were detected and saved to your Vault:
                    </p>

                    <div className="space-y-2">
                      {discoveryProfiles.java?.name && (
                        <div className="p-3 bg-white border border-emerald-200 rounded-xl flex items-center justify-between shadow-2xs">
                          <div className="flex items-center space-x-3">
                            <img
                              src={`https://mc-heads.net/avatar/${discoveryProfiles.java.name}/48`}
                              alt=""
                              className="w-9 h-9 rounded-lg border border-slate-200"
                            />
                            <div>
                              <span className="font-black text-slate-900 text-xs block">{discoveryProfiles.java.name}</span>
                              <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">☕ Java Edition Profile</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Saved in Vault ✅
                          </span>
                        </div>
                      )}

                      {discoveryProfiles.bedrock?.gamertag && (
                        <div className="p-3 bg-white border border-sky-200 rounded-xl flex items-center justify-between shadow-2xs">
                          <div className="flex items-center space-x-3">
                            <img
                              src={`https://mc-heads.net/avatar/${discoveryProfiles.bedrock.gamertag}/48`}
                              alt=""
                              className="w-9 h-9 rounded-lg border border-slate-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/48';
                              }}
                            />
                            <div>
                              <span className="font-black text-slate-900 text-xs block">{discoveryProfiles.bedrock.gamertag}</span>
                              <span className="text-[10px] text-sky-700 font-bold uppercase tracking-wider">🧱 Bedrock Gamertag</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                            Saved in Vault ✅
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAddAccountModalOpen(false);
                        resetDiscovery();
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                    >
                      Done & View in Vault
                    </button>
                  </div>
                )}

                {discoveryStatus === 'error' && (
                  <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl space-y-3">
                    <div className="flex items-center space-x-2 text-rose-800 text-xs font-bold">
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                      <span>{discoveryError || 'Failed to authenticate with Microsoft'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => discoverMicrosoftAccount()}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Manual Microsoft fallback form */}
                {showManualMsaInput && (
                  <form onSubmit={handleAddAccountSubmit} className="space-y-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Microsoft Gamertag / Username
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. acollo"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                      />
                      <span className="text-[10px] text-slate-500 font-medium block mt-1">
                        Will add both Java and Bedrock accounts with this name to your Vault.
                      </span>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowManualMsaInput(false)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl"
                      >
                        Cancel Manual Entry
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
                      >
                        Save Manual Account
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* Offline / Cracked Form with Edition Selector */
              <form onSubmit={handleAddAccountSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Minecraft Edition</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewAccountEdition('java')}
                      className={`p-2.5 rounded-xl border-2 text-left text-xs font-bold transition flex items-center space-x-2 ${
                        newAccountEdition === 'java'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <Coffee className="h-4 w-4 text-emerald-600" />
                      <span>☕ Java Edition</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAccountEdition('bedrock')}
                      className={`p-2.5 rounded-xl border-2 text-left text-xs font-bold transition flex items-center space-x-2 ${
                        newAccountEdition === 'bedrock'
                          ? 'bg-sky-50 border-sky-600 text-sky-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <Box className="h-4 w-4 text-sky-600" />
                      <span>🧱 Bedrock Edition</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {newAccountEdition === 'bedrock' ? 'Bedrock Gamertag' : 'Java Username'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={newAccountEdition === 'bedrock' ? 'e.g. acollo7421' : 'e.g. acollo'}
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Notes <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alt account for mob grinder"
                    value={newAccountNotes}
                    onChange={(e) => setNewAccountNotes(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  />
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
                    Save Offline Account
                  </button>
                </div>
              </form>
            )}
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
                  <div className="flex items-center space-x-2">
                    <h3 className="font-black text-slate-900 text-base">
                      Deploy <span className="text-emerald-700">{selectedAccountForDeploy.name}</span>
                    </h3>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                      selectedAccountForDeploy.edition === 'bedrock'
                        ? 'bg-sky-50 text-sky-700 border-sky-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}>
                      {selectedAccountForDeploy.edition === 'bedrock' ? '🧱 Bedrock' : '☕ Java'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">Select a server to launch this bot instance</p>
                </div>
              </div>
              <button onClick={() => setIsDeployModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Bedrock Protocol Notice */}
            {selectedAccountForDeploy.edition === 'bedrock' && (
              <div className="mt-3 p-3 bg-sky-50 border-2 border-sky-200 rounded-2xl flex items-start space-x-2 text-xs text-sky-950">
                <Box className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sky-900">Bedrock Edition RakNet Client</span>
                  <span className="text-[11px] text-sky-800 leading-tight block mt-0.5">
                    This account will connect using Minecraft Bedrock UDP protocol (default port: <strong>19132</strong>). Compatible with Bedrock servers and GeyserMC proxies.
                  </span>
                </div>
              </div>
            )}

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

      {/* Live Inventory & Lore Modal */}
      {inventoryModalBot && (
        <BotInventoryModal
          config={inventoryModalBot}
          telemetry={telemetry[inventoryModalBot.id]}
          onClose={() => setInventoryModalBot(null)}
        />
      )}

      {/* Live Toast Notifications */}
      <NotificationToast
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </div>
  );
}

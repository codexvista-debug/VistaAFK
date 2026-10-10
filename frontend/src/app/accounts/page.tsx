'use client';

import React, { useState } from 'react';
import { useVistaWebSocket } from '../../hooks/useVistaWebSocket';
import { Navbar } from '../../components/Navbar';
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
  Mail,
  User,
  Terminal,
  Activity,
} from 'lucide-react';
import { BotInventoryModal } from '../../components/BotInventoryModal';
import { BotConfig } from '../../types';
import Link from 'next/link';
import { useAuth } from '../../context/VistaAuthContext';

export default function AccountsPage() {
  const { user, openAuthModal, isLoading: isAuthLoading } = useAuth();
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
    retryConnection,
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
  const [inventoryModalBot, setInventoryModalBot] = useState<BotConfig | null>(null);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);

  // New Account Form State (MinecraftAFK style)
  const [accountType, setAccountType] = useState<'both' | 'java' | 'bedrock' | 'offline'>('both');
  const [accountInput, setAccountInput] = useState('');
  const [offlineEdition, setOfflineEdition] = useState<'java' | 'bedrock'>('java');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedIncognito, setCopiedIncognito] = useState(false);
  const popupRef = React.useRef<Window | null>(null);

  // Sync popup URL when discoveryDeviceCode arrives
  React.useEffect(() => {
    if (discoveryDeviceCode && popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.location.href = discoveryDeviceCode.verificationUri;
      } catch (e) {
        console.warn('Popup redirect error:', e);
      }
    }
  }, [discoveryDeviceCode]);

  // Close popup and auto-close modal on success
  React.useEffect(() => {
    if (discoveryStatus === 'success') {
      if (popupRef.current && !popupRef.current.closed) {
        try {
          popupRef.current.close();
        } catch (e) {}
      }
      const timer = setTimeout(() => {
        setIsAddAccountModalOpen(false);
        resetDiscovery();
        setAccountInput('');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [discoveryStatus]);

  // Global Escape key handler to close active popups
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddAccountModalOpen) {
          if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
          setIsAddAccountModalOpen(false);
          resetDiscovery();
        }
        if (isDeployModalOpen) {
          setIsDeployModalOpen(false);
          setSelectedAccountForDeploy(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddAccountModalOpen, isDeployModalOpen, resetDiscovery]);

  // Deploy to Server Form State
  const [targetServerHost, setTargetServerHost] = useState('play.freshsmp.fun');
  const [targetServerPort, setTargetServerPort] = useState(25565);
  const [targetServerVersion, setTargetServerVersion] = useState('');

  const copyAndOpenMicrosoft = (code: string, url: string) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch (e) {}
    window.open(url, '_blank');
  };

  const handleOpenAddModal = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    resetDiscovery();
    setAccountInput('');
    setIsAddAccountModalOpen(true);
  };

  const handleAddAccountSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (accountType === 'offline') {
      const val = accountInput.trim();
      if (!val) return;
      const account: SavedAccount = {
        id: `offline-${offlineEdition}-${Math.random().toString(36).substring(2, 9)}`,
        name: val,
        authType: 'offline',
        edition: offlineEdition,
        createdAt: Date.now(),
      };
      saveAccount(account);
      setIsAddAccountModalOpen(false);
      setAccountInput('');
      return;
    }

    // Direct Microsoft Connect: No email required!
    const popup = window.open('about:blank', 'ms_oauth_popup', 'width=520,height=680,scrollbars=yes,resizable=yes');
    if (popup) {
      try {
        popup.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Connecting to Microsoft...</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui,-apple-system,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; padding:20px; box-sizing:border-box; }
                .spinner { width:36px; height:36px; border:3px solid #334155; border-top-color:#10b981; border-radius:50%; animation:spin 0.8s linear infinite; margin-bottom:18px; }
                @keyframes spin { to { transform:rotate(360deg); } }
                h2 { font-size:16px; margin:0 0 6px 0; font-weight:700; }
                p { color:#94a3b8; font-size:12px; margin:0; line-height:1.4; }
              </style>
            </head>
            <body>
              <div class="spinner"></div>
              <h2>Connecting to Microsoft Identity...</h2>
              <p>Redirecting you to Microsoft login in a moment...</p>
            </body>
          </html>
        `);
      } catch (e) {}
      popupRef.current = popup;
    }

    discoverMicrosoftAccount(accountInput.trim() || undefined, accountType);
  };

  const handleOpenDeploy = (account: SavedAccount) => {
    setSelectedAccountForDeploy(account);
    if (account.edition === 'bedrock') {
      setTargetServerHost('play.freshsmp.fun');
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
      edition: selectedAccountForDeploy.edition || (targetServerPort === 19132 ? 'bedrock' : 'java'),
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
        onRetryConnection={retryConnection}
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
              onClick={() => setIsDiagnosticsModalOpen(true)}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-2 border-slate-300 shadow-sm transition flex items-center space-x-1.5"
              title="Bedrock & Account Diagnostics"
            >
              <Activity className="h-4 w-4 text-emerald-600" />
              <span>Bedrock Diagnostics</span>
            </button>
            <button
              onClick={handleOpenAddModal}
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
              <h3 className="text-lg font-black text-slate-900">
                {!user ? 'Sign In to Access Accounts Vault' : 'Your Account Vault is Empty'}
              </h3>
              <p className="text-xs text-slate-600 max-w-md mt-1 leading-relaxed font-medium">
                {!user
                  ? 'Sign in to save your Minecraft gamertags securely and sync them across all your phones and computers.'
                  : 'Add your Minecraft Gamertags here once. They will stay saved permanently, so you can connect them to FreshSMP, Hypixel, or any server with one click!'}
              </p>
              <button
                onClick={handleOpenAddModal}
                className="mt-6 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                {!user ? 'Sign In / Register' : '+ Save Your First Account'}
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
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const newEdition = acc.edition === 'bedrock' ? 'java' : 'bedrock';
                                  saveAccount({ ...acc, edition: newEdition });
                                }}
                                title="Click to toggle between Java and Bedrock"
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase transition hover:scale-105 cursor-pointer ${
                                  acc.edition === 'bedrock'
                                    ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                }`}
                              >
                                {acc.edition === 'bedrock' ? '🧱 Bedrock' : '☕ Java'}
                              </button>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {acc.authType === 'microsoft' ? 'MS OAuth' : 'Offline'}
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

      {/* Add Account Modal (MinecraftAFK style) */}
      {isAddAccountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
              setIsAddAccountModalOpen(false);
              resetDiscovery();
            }
          }}
        >
          <div
            className="bg-white border-4 border-t-white border-l-white border-b-slate-400 border-r-slate-400 rounded-3xl w-full max-w-md shadow-2xl my-auto max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between p-5 pb-3.5 border-b-2 border-slate-200 gap-2 shrink-0 bg-white">
              <div>
                <h3 className="font-black text-slate-900 text-base">Add an account</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Link an official Microsoft account or add an offline profile.
                </p>
              </div>
              <button
                onClick={() => {
                  if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
                  setIsAddAccountModalOpen(false);
                  resetDiscovery();
                }}
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 active:scale-95 transition shrink-0"
                title="Close (Esc)"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Waiting for popup confirmation (MinecraftAFK Screenshot 3) */}
              {(discoveryStatus === 'waiting_code' || discoveryStatus === 'waiting_approval') ? (
              <div className="py-6 px-3 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-emerald-500 animate-spin" />
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900">Authorize Microsoft Account</h3>
                  <p className="text-xs text-slate-500 font-medium">Follow the link below to enter your device code on Microsoft.</p>
                </div>

                {discoveryDeviceCode && (
                  <div className="w-full max-w-sm space-y-3 pt-1">
                    <div className="p-3.5 bg-slate-900 border border-slate-700 rounded-xl text-center flex items-center justify-between">
                      <div className="text-left">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Authorization Code</span>
                        <span className="font-mono text-2xl font-black text-emerald-400 tracking-widest">
                          {discoveryDeviceCode.userCode}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            navigator.clipboard.writeText(discoveryDeviceCode.userCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2500);
                          } catch (e) {}
                        }}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-lg border border-slate-600 flex items-center space-x-1.5 transition active:scale-95"
                      >
                        {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => copyAndOpenMicrosoft(discoveryDeviceCode.userCode, discoveryDeviceCode.verificationUri)}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span>Open Microsoft Sign-In ↗</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          try {
                            navigator.clipboard.writeText(discoveryDeviceCode.verificationUri);
                            setCopiedIncognito(true);
                            setTimeout(() => setCopiedIncognito(false), 3000);
                          } catch (e) {}
                        }}
                        className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-slate-200 border border-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5"
                      >
                        {copiedIncognito ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-300" />}
                        <span>{copiedIncognito ? 'Copied Incognito Link!' : 'Copy for Incognito Tab'}</span>
                      </button>
                    </div>

                    <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-left space-y-1.5 text-xs text-slate-800">
                      <div className="font-bold text-[11px] text-slate-900 flex items-center space-x-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>How Microsoft Device Authentication Works:</span>
                      </div>
                      <ol className="text-[10px] space-y-1 text-slate-700 list-decimal list-inside font-medium leading-relaxed">
                        <li><strong>Step 1:</strong> On Microsoft, enter code <span className="font-mono font-bold text-slate-900 bg-slate-200 px-1 py-0.5 rounded">{discoveryDeviceCode.userCode}</span> and click Allow access.</li>
                        <li><strong>Step 2:</strong> Microsoft will then ask you to sign in with your Minecraft email &amp; password.</li>
                        <li><strong>Step 3:</strong> Once signed in, this window will detect your gamertag and save it permanently!</li>
                      </ol>
                    </div>

                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left space-y-1">
                      <div className="flex items-center space-x-1.5 text-amber-800 font-black text-[11px]">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>Adding an Alt or Second Account?</span>
                      </div>
                      <p className="text-[10px] text-amber-900/90 leading-relaxed font-medium">
                        Click <strong>Copy for Incognito Tab</strong> and open a <strong>Private / Incognito window</strong>. Microsoft will prompt you for code first, then let you sign in with your other account!
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
                      resetDiscovery();
                    }}
                    className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : discoveryStatus === 'success' && discoveryProfiles ? (
              /* Success View */
              <div className="py-6 px-2 space-y-4">
                <div className="flex items-center space-x-2 text-emerald-800 font-black text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Account Linked Successfully!</span>
                </div>
                <div className="space-y-2">
                  {discoveryProfiles.java?.name && (
                    <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={`https://mc-heads.net/avatar/${discoveryProfiles.java.name}/48`}
                          alt=""
                          className="w-8 h-8 rounded-lg border border-slate-200"
                        />
                        <div>
                          <span className="font-black text-slate-900 text-xs block">{discoveryProfiles.java.name}</span>
                          <span className="text-[10px] text-emerald-700 font-bold">☕ Java Edition Profile</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Saved ✅
                      </span>
                    </div>
                  )}

                  {discoveryProfiles.bedrock?.gamertag && (
                    <div className="p-3 bg-sky-50/50 border border-sky-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={`https://mc-heads.net/avatar/${discoveryProfiles.bedrock.gamertag}/48`}
                          alt=""
                          className="w-8 h-8 rounded-lg border border-slate-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/48';
                          }}
                        />
                        <div>
                          <span className="font-black text-slate-900 text-xs block">{discoveryProfiles.bedrock.gamertag}</span>
                          <span className="text-[10px] text-sky-700 font-bold">🧱 Bedrock Gamertag</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                        Saved ✅
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
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition"
                >
                  Done & View in Vault
                </button>
              </div>
            ) : discoveryStatus === 'error' ? (
              /* Error View */
              <div className="py-6 space-y-3">
                <div className="p-3.5 bg-rose-50 border-2 border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{discoveryError || 'Failed to authenticate with Microsoft'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => resetDiscovery()}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => discoverMicrosoftAccount(accountInput.trim())}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              /* Form View */
              <div className="mt-4 space-y-4">
                {/* Account Type dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Account type
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  >
                    <option value="both">Java & Bedrock (Official Microsoft)</option>
                    <option value="java">Java Edition Only (Official Microsoft)</option>
                    <option value="bedrock">Bedrock Edition Only (Xbox Live)</option>
                    <option value="offline">Offline / Cracked (Custom Username)</option>
                  </select>
                </div>

                {accountType !== 'offline' ? (
                  /* Direct 1-Click Microsoft Connect: Zero Email Required */
                  <div className="space-y-4 pt-1">
                    <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-medium leading-relaxed">
                      ✨ <strong>Direct Microsoft Sign-In:</strong> No need to enter an email. Clicking below generates your secure Microsoft code and links your Minecraft account automatically.
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddAccountSubmit()}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-700/25 flex items-center justify-center space-x-2 transition"
                    >
                      <ShieldCheck className="h-5 w-5" />
                      <span>Connect Microsoft Account</span>
                    </button>

                    <div className="flex items-center justify-end pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
                          setIsAddAccountModalOpen(false);
                          resetDiscovery();
                        }}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Offline / Cracked Username Form */
                  <form onSubmit={handleAddAccountSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Username
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="h-4 w-4" />
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Player123"
                          value={accountInput}
                          onChange={(e) => setAccountInput(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Edition</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setOfflineEdition('java')}
                          className={`p-2.5 rounded-xl border-2 text-center text-xs font-bold transition ${
                            offlineEdition === 'java' ? 'bg-emerald-50 border-emerald-600 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          ☕ Java Edition
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfflineEdition('bedrock')}
                          className={`p-2.5 rounded-xl border-2 text-center text-xs font-bold transition ${
                            offlineEdition === 'bedrock' ? 'bg-emerald-50 border-emerald-600 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          🧱 Bedrock Edition
                        </button>
                      </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddAccountModalOpen(false);
                          resetDiscovery();
                        }}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-700/20 transition flex items-center space-x-1.5"
                      >
                        <span>Add Account</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Deploy Account to Server Modal */}
      {isDeployModalOpen && selectedAccountForDeploy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDeployModalOpen(false);
              setSelectedAccountForDeploy(null);
            }
          }}
        >
          <div
            className="bg-white border-4 border-t-white border-l-white border-b-slate-400 border-r-slate-400 rounded-3xl w-full max-w-lg shadow-2xl my-auto max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b-2 border-slate-200 gap-2 shrink-0 bg-white">
              <div className="flex items-center space-x-2.5 min-w-0">
                <img
                  src={`https://mc-heads.net/avatar/${selectedAccountForDeploy.name}/48`}
                  alt=""
                  className="w-8 h-8 rounded-lg border border-slate-300 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-black text-slate-900 text-base truncate">
                      Deploy <span className="text-emerald-700">{selectedAccountForDeploy.name}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const newEd = selectedAccountForDeploy.edition === 'bedrock' ? 'java' : 'bedrock';
                        setSelectedAccountForDeploy({ ...selectedAccountForDeploy, edition: newEd });
                        if (newEd === 'bedrock' && targetServerPort === 25565) setTargetServerPort(19132);
                        if (newEd === 'java' && targetServerPort === 19132) setTargetServerPort(25565);
                      }}
                      title="Click to toggle between Bedrock and Java"
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border transition hover:scale-105 cursor-pointer shrink-0 ${
                        selectedAccountForDeploy.edition === 'bedrock'
                          ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      {selectedAccountForDeploy.edition === 'bedrock' ? '🧱 Bedrock' : '☕ Java'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">Select a server to launch this bot instance</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDeployModalOpen(false);
                  setSelectedAccountForDeploy(null);
                }}
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 active:scale-95 transition shrink-0"
                title="Close (Esc)"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
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
        </div>
      )}

      {/* Live Inventory & Lore Modal */}
      {inventoryModalBot && (
        <BotInventoryModal
          config={inventoryModalBot}
          telemetry={telemetry[inventoryModalBot.id]}
          onClose={() => setInventoryModalBot(null)}
        />
      )}

      {/* Bedrock & Fleet Diagnostics Modal */}
      {isDiagnosticsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDiagnosticsModalOpen(false);
          }}
        >
          <div
            className="bg-white border-4 border-t-white border-l-white border-b-slate-400 border-r-slate-400 rounded-3xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl my-auto max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b-2 border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Bedrock & Account Diagnostics</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Real-time connection details, RakNet handshake, and protocol status</p>
                </div>
              </div>
              <button
                onClick={() => setIsDiagnosticsModalOpen(false)}
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 active:scale-95 transition shrink-0"
                title="Close (Esc)"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Daemon Status</span>
                  <span className={`font-black text-sm ${isConnected ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Saved Accounts</span>
                  <span className="font-black text-sm text-slate-800">{savedAccounts.length}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Bedrock Deployed</span>
                  <span className="font-black text-sm text-sky-700">
                    {configs.filter((c) => c.edition === 'bedrock').length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Online Bots</span>
                  <span className="font-black text-sm text-emerald-700">
                    {Object.values(telemetry).filter((t) => t.status === 'online').length}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase text-slate-700 mb-2">Live Deployments State</h4>
                <div className="space-y-2">
                  {configs.length === 0 ? (
                    <p className="text-slate-500 text-xs italic">No active server deployments running.</p>
                  ) : (
                    configs.map((c) => {
                      const tel = telemetry[c.id];
                      return (
                        <div key={c.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-900 text-sm flex items-center space-x-1.5">
                              <span>{c.name}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-200 uppercase">
                                {c.edition || 'java'}
                              </span>
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              tel?.status === 'online'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tel?.status === 'authenticating'
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {tel?.status || 'offline'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-600 flex flex-wrap gap-x-4">
                            <span>Target: {c.host}:{c.port}</span>
                            <span>Version: {c.version || 'Auto-negotiated (1.26.51 / protocol 2193)'}</span>
                            <span>Auth: {c.authType}</span>
                          </div>
                          {tel?.statusMessage && (
                            <p className="text-[11px] text-amber-700 font-medium bg-amber-50/80 p-1.5 rounded-lg border border-amber-200">
                              ℹ️ Status details: {tel.statusMessage}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDiagnosticsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Toast Notifications */}
      <NotificationToast
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </div>
  );
}

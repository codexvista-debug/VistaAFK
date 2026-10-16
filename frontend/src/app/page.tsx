'use client';

import React, { useState, useEffect } from 'react';
import { useVistaWebSocket } from '../hooks/useVistaWebSocket';
import { Navbar } from '../components/Navbar';
import { StatsOverview } from '../components/StatsOverview';
import { BotCard } from '../components/BotCard';
import { DeployServerModal } from '../components/DeployServerModal';
import { NotificationToast } from '../components/NotificationToast';
import { AdminFleetWidget } from '../components/AdminFleetWidget';
import { SavedAccount } from '../types';
import { Plus, Server, AlertTriangle, RefreshCw, Layers, Users, Play, Leaf } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../context/VistaAuthContext';

function ServerBrandMark({ presetId }: { presetId: string }) {
  if (presetId === 'donutsmp') {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-rose-100 text-orange-600 shadow-inner">
        <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
          <path d="M16 4.5a11.5 11.5 0 1 0 0 23 11.5 11.5 0 0 0 0-23Zm0 6.1a5.4 5.4 0 1 1 0 10.8 5.4 5.4 0 0 1 0-10.8Z" fill="currentColor" fillRule="evenodd" />
          <path d="m8.3 8.9 2.1 1.1m11.8-.8 1.5-1.5M7 18l2.2-.4m11.2 7 .7-2.2m-6-16.9.4 2.3" stroke="#fff7ed" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  if (presetId === 'freshsmp') {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 shadow-inner">
        <Leaf className="h-7 w-7 stroke-[2.2]" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-600 shadow-inner">
      <Server className="h-6 w-6" aria-hidden="true" />
    </div>
  );
}

export default function Dashboard() {
  const { user, token, openAuthModal } = useAuth();
  const isVista = user?.username?.toLowerCase() === 'vista';
  const [adminWidgetEnabled, setAdminWidgetEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (isVista) {
      const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('vistaafk_auth_token') : null);
      if (activeToken) {
        fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${activeToken}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.settings && typeof data.settings.adminWidgetEnabled === 'boolean') {
              setAdminWidgetEnabled(data.settings.adminWidgetEnabled);
            }
          })
          .catch(() => {});
      }
    }
  }, [isVista, token]);

  const showAdminWidget = isVista && adminWidgetEnabled;

  const {
    daemonUrl,
    secretToken,
    isConnected,
    isConnecting,
    retryConnection,
    authError,
    configs,
    telemetry,
    chatLogs,
    activityLogs,
    notifications,
    savedAccounts,
    serverPresets,
    deployAccountToServer,
    updateDaemonConfig,
    updateBot,
    removeBot,
    startBot,
    stopBot,
    dismissNotification,
  } = useVistaWebSocket();

  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [selectedDeployAccounts, setSelectedDeployAccounts] = useState<Record<string, string>>({});
  const handleDismissNotification = (id: string) => {
    dismissNotification(id);
  };

  const onlineCount = isConnected ? Object.values(telemetry).filter((t) => t.status === 'online').length : 0;

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800">
      {/* Navigation Bar */}
      <Navbar
        isConnected={isConnected}
        isConnecting={isConnecting}
        onOpenAddModal={() => setIsDeployModalOpen(true)}
        onRetryConnection={retryConnection}
        botCount={configs.length}
        onlineCount={onlineCount}
        savedAccountCount={savedAccounts.length}
      />

      {/* Main Content Area */}
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all ${showAdminWidget ? 'max-w-[1700px]' : 'max-w-7xl'}`}>
        {/* Auth Error Banner */}
        {authError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span className="font-medium">Authentication Error: {authError}</span>
            </div>
            <Link
              href="/settings"
              className="font-bold underline hover:text-rose-900"
            >
              Open Settings
            </Link>
          </div>
        )}




        {/* Stats Overview */}
        <StatsOverview configs={configs} telemetry={telemetry} savedAccountsCount={savedAccounts.length} isDaemonConnected={isConnected} />

        {/* Server Fleet Deployments Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <Layers className="h-4 w-4 text-emerald-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight uppercase">Server Fleet Deployments</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono border border-slate-200 shrink-0">
                {configs.length} active
              </span>
            </div>

            {configs.length > 0 && (
              <button
                onClick={() => setIsDeployModalOpen(true)}
                disabled={!isConnected}
                className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-3.5 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95"
              >
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
                <span>Deploy Another Server</span>
              </button>
            )}
          </div>

          <div className={showAdminWidget ? 'flex flex-col xl:flex-row gap-6 items-start' : ''}>
            <div className={showAdminWidget ? 'flex-1 min-w-0 w-full' : 'w-full'}>
              {configs.length === 0 ? (
            /* Contextual Empty State */
            savedAccounts.length > 0 ? (
              /* User HAS accounts in Vault - Offer Quick Server Connect */
              <div className="p-8 sm:p-10 border-2 border-slate-300 rounded-3xl bg-white shadow-sm flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-2xl bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center text-emerald-800 mb-4 shadow-sm">
                  <Server className="h-8 w-8 stroke-[2.2]" />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">No Active Server Connections</h3>
                <p className="text-xs text-slate-600 max-w-lg mt-2 font-medium leading-relaxed">
                  You have <span className="font-bold text-emerald-700">{savedAccounts.length} Minecraft account{savedAccounts.length > 1 ? 's' : ''}</span> saved in your Accounts Vault ({savedAccounts.map((a) => a.name).join(', ')}). Choose which server you want to deploy to:
                </p>

                {/* Quick Server Preset Launch Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl mt-6">
                  {serverPresets.map((preset) => {
                    const isCustom = !preset.host || preset.id === 'custom';
                    const isDonut = preset.host.toLowerCase().includes('donut');
                    const defaultAccount = savedAccounts.find((account) => account.edition === 'java') || savedAccounts[0];
                    const selectedAccount = savedAccounts.find((account) => account.id === selectedDeployAccounts[preset.id]) || defaultAccount;
                    const selectedEdition = selectedAccount?.edition === 'bedrock' ? 'BEDROCK' : 'JAVA';

                    return (
                      <div
                        key={preset.id}
                        className="group overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                      >
                        <div className="flex items-center gap-3">
                          <ServerBrandMark presetId={preset.id} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black text-sm text-slate-900">{preset.name}</span>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isDonut ? 'border-orange-200 bg-orange-50 text-orange-700' : isCustom ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                {isDonut ? 'Safe AFK' : isCustom ? 'Custom IP' : 'Network'}
                              </span>
                            </div>
                            <span className="mt-1 block truncate font-mono text-[11px] text-slate-500">
                              {preset.host || 'Any custom IP & port'}{preset.host && preset.port ? ` · ${preset.port}` : ''}
                            </span>
                          </div>
                        </div>

                        {!isCustom && (
                          <label className="mt-4 block">
                            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Account to deploy</span>
                            <select
                              value={selectedAccount?.id || ''}
                              onChange={(event) => setSelectedDeployAccounts((current) => ({ ...current, [preset.id]: event.target.value }))}
                              aria-label={`Account to deploy to ${preset.name}`}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            >
                              {savedAccounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {(account.edition === 'bedrock' ? 'BEDROCK' : 'JAVA')} · {account.gamertag || account.name}
                                </option>
                              ))}
                            </select>
                            <span className="mt-1.5 block text-[10px] text-slate-500">{selectedEdition} account · {selectedAccount?.gamertag || selectedAccount?.name}</span>
                          </label>
                        )}

                        <button
                          onClick={() => {
                            if (isCustom) {
                              setIsDeployModalOpen(true);
                            } else if (selectedAccount) {
                              deployAccountToServer(selectedAccount, {
                                host: preset.host,
                                port: preset.port,
                                version: preset.version || undefined,
                              });
                            }
                          }}
                          disabled={!isConnected || (!isCustom && !selectedAccount)}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-900/10 transition hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>{isCustom ? 'Enter IP & Deploy' : `Deploy ${selectedEdition} · ${selectedAccount?.gamertag || selectedAccount?.name || 'account'}`}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setIsDeployModalOpen(true)}
                    disabled={!isConnected}
                    className="px-5 py-2.5 bg-[#1b2637] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" />
                    <span>Deploy Custom Server</span>
                  </button>
                  <Link
                    href="/accounts"
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border-2 border-slate-300 transition flex items-center space-x-1.5"
                  >
                    <Users className="h-4 w-4" />
                    <span>Manage Accounts Vault</span>
                  </Link>
                </div>
              </div>
            ) : (
              /* User has NO accounts in Vault */
              <div className="p-10 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center text-center bg-white shadow-sm">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-slate-600 mb-4 shadow-sm">
                  <Users className="h-8 w-8 stroke-[2.2]" />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {!user ? 'Sign In to Deploy Server Bots' : 'No Accounts Saved in Vault'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mt-2 font-medium leading-relaxed">
                  {!user
                    ? 'Log in to connect your phone daemon, add your Minecraft accounts, and sync your bot fleet seamlessly across all devices.'
                    : 'Save your Minecraft Java account once in the Accounts Vault, then deploy it across any server fleet with one click.'}
                </p>
                {!user ? (
                  <button
                    onClick={openAuthModal}
                    className="mt-6 flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                  >
                    <Users className="h-4 w-4 stroke-[2.5]" />
                    <span>Sign In / Create Account</span>
                  </button>
                ) : (
                  <Link
                    href="/accounts"
                    className="mt-6 flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" />
                    <span>Go to Accounts Vault (+ Add Account)</span>
                  </Link>
                )}
              </div>
            )
          ) : (
            <div className={`grid grid-cols-1 ${showAdminWidget ? 'lg:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'} gap-5`}>
              {configs.map((cfg) => (
                <BotCard
                  key={cfg.id}
                  config={cfg}
                  telemetry={telemetry[cfg.id]}
                  activityLogs={activityLogs[cfg.id] || []}
                  logs={chatLogs[cfg.id] || []}
                  isDaemonConnected={isConnected}
                  onStart={startBot}
                  onStop={stopBot}
                  onDelete={removeBot}
                  onEdit={updateBot}
                  onUpdate={updateBot}
                />
              ))}
            </div>
          )}
            </div>

            {/* Right-Side Admin Fleet & Users Monitor Widget (Vista only) */}
            {showAdminWidget && (
              <div className="w-full xl:w-80 2xl:w-96 shrink-0 xl:sticky xl:top-24">
                <AdminFleetWidget
                  token={token}
                  currentUser={user?.username}
                  localTelemetry={telemetry}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Deploy Server Bot Modal (Vault-aware) */}
      {isDeployModalOpen && (
        <DeployServerModal
          onClose={() => setIsDeployModalOpen(false)}
          savedAccounts={savedAccounts}
          serverPresets={serverPresets}
          onDeploy={deployAccountToServer}
        />
      )}

      {/* Live Toast Notifications */}
      <NotificationToast
        notifications={notifications}
        onDismiss={handleDismissNotification}
      />
    </div>
  );
}

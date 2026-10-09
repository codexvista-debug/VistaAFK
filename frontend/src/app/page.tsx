'use client';

import React, { useState } from 'react';
import { useVistaWebSocket } from '../hooks/useVistaWebSocket';
import { Navbar } from '../components/Navbar';
import { StatsOverview } from '../components/StatsOverview';
import { BotCard } from '../components/BotCard';
import { AddBotModal } from '../components/AddBotModal';
import { DeployServerModal } from '../components/DeployServerModal';
import { LiveChatTerminal } from '../components/LiveChatTerminal';
import { DaemonSettingsModal } from '../components/DaemonSettingsModal';
import { NotificationToast } from '../components/NotificationToast';
import { BotVisualControlModal } from '../components/BotVisualControlModal';
import { BotInventoryModal } from '../components/BotInventoryModal';
import { BotConfig, SavedAccount } from '../types';
import { Plus, Server, AlertTriangle, RefreshCw, Layers, Users, Play, Smartphone, Copy, Check, ExternalLink, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../context/VistaAuthContext';

export default function Dashboard() {
  const { user, token: authToken, openAuthModal } = useAuth();
  const [copiedTermux, setCopiedTermux] = useState(false);
  const termuxCommand = user?.username
    ? `pkg update -y && pkg install -y git nodejs cloudflared && if [ -d "$HOME/VistaAFK" ]; then cd "$HOME/VistaAFK" && git pull origin main; else git clone https://github.com/codexvista-debug/VistaAFK.git "$HOME/VistaAFK" && cd "$HOME/VistaAFK"; fi && bash start.sh ${user.username} ${authToken || ''}`
    : '';
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
    connect,
    addBot,
    updateBot,
    removeBot,
    startBot,
    stopBot,
    sendChat,
    moveBot,
    togglePatrol,
    lookAt,
    dismissNotification,
  } = useVistaWebSocket();

  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isAddBotModalOpen, setIsAddBotModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<BotConfig | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [chatBotId, setChatBotId] = useState<string | null>(null);
  const [sightModalBot, setSightModalBot] = useState<BotConfig | null>(null);
  const [inventoryModalBot, setInventoryModalBot] = useState<BotConfig | null>(null);

  const activeChatConfig = configs.find((c) => c.id === chatBotId);
  const activeChatTelemetry = chatBotId ? telemetry[chatBotId] : undefined;

  const handleSaveBot = (config: BotConfig) => {
    if (editingBot) {
      updateBot(config);
    } else {
      addBot(config);
    }
    setEditingBot(null);
  };

  const handleEditBot = (config: BotConfig) => {
    setEditingBot(config);
    setIsAddBotModalOpen(true);
  };

  const handleDismissNotification = (id: string) => {
    dismissNotification(id);
  };

  const onlineCount = Object.values(telemetry).filter((t) => t.status === 'online').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800">
      {/* Navigation Bar */}
      <Navbar
        isConnected={isConnected}
        isConnecting={isConnecting}
        onOpenAddModal={() => setIsDeployModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onRetryConnection={retryConnection}
        botCount={configs.length}
        onlineCount={onlineCount}
        savedAccountCount={savedAccounts.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Auth Error Banner */}
        {authError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span className="font-medium">Authentication Error: {authError}</span>
            </div>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="font-bold underline hover:text-rose-900"
            >
              Configure Token
            </button>
          </div>
        )}

        {/* Sign In Required / Sync Notice when logged out */}
        {!user && (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-white border-2 border-emerald-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl shrink-0">
                <Users className="h-5 w-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm tracking-tight">
                  Sign In to Access Your Fleet &amp; Sync Across Devices
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-medium">
                  Log in to your VistaAFK account to link your 24/7 mobile daemon, deploy Minecraft accounts, and sync your bot fleet across all your devices.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <button
                onClick={openAuthModal}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition active:scale-95 text-center"
              >
                Sign In / Register
              </button>
            </div>
          </div>
        )}

        {/* Termux Daemon Quick Start Banner for Logged-In User with Offline Daemon (Stable without flashing) */}
        {user && !isConnected && (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white border-2 border-emerald-500/40 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base tracking-tight text-white flex items-center space-x-2">
                    <span>Step 1: Start your 24/7 Bot Daemon</span>
                    <span className="text-[10px] font-mono uppercase bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">Termux</span>
                  </h3>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">
                    Paste this command into Termux on your phone to connect your 24/7 bots and authenticate Minecraft accounts.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={retryConnection}
                  disabled={isConnecting}
                  className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition flex items-center space-x-1 disabled:opacity-50"
                  title="Retry connecting to daemon"
                >
                  <RefreshCw className={`h-3 w-3 ${isConnecting ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>{isConnecting ? 'Connecting...' : 'Retry'}</span>
                </button>
                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <span>Settings</span>
                </button>
                <a
                  href="https://play.google.com/store/apps/details?id=com.termux"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <span>Google Play</span>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>
                <a
                  href="https://f-droid.org/en/packages/com.termux/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <span>F-Droid APK</span>
                  <ExternalLink className="h-3 w-3 text-emerald-200" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between bg-black/60 border border-slate-700 p-2.5 sm:p-3 rounded-xl font-mono text-[11px] gap-2">
              <code className="text-emerald-400 break-all select-all line-clamp-2">
                {termuxCommand}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(termuxCommand);
                  setCopiedTermux(true);
                  setTimeout(() => setCopiedTermux(false), 2500);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shrink-0 transition flex items-center space-x-1.5 shadow-sm active:scale-95"
              >
                {copiedTermux ? (
                  <>
                    <Check className="h-4 w-4 text-white" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-white" />
                    <span>Copy Command</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <StatsOverview configs={configs} telemetry={telemetry} savedAccountsCount={savedAccounts.length} />

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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-2xl mt-6">
                  {serverPresets.map((preset) => {
                    const isCustom = !preset.host || preset.id === 'custom';
                    const isDonut = preset.host.toLowerCase().includes('donut');

                    return (
                      <div
                        key={preset.id}
                        className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 text-left hover:border-emerald-500 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900">{preset.name}</span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                                isDonut
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : isCustom
                                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {isDonut ? 'Safe AFK' : isCustom ? 'Custom IP' : 'Auto'}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-slate-500 mt-1 block truncate">
                            {preset.host || 'Any custom IP & port'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            if (isCustom) {
                              setIsDeployModalOpen(true);
                            } else if (savedAccounts.length > 0) {
                              deployAccountToServer(savedAccounts[0], {
                                host: preset.host,
                                port: preset.port,
                                version: preset.version || undefined,
                              });
                            }
                          }}
                          disabled={!isConnected}
                          className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center space-x-1.5"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>{isCustom ? 'Enter IP & Deploy' : `Deploy ${savedAccounts[0]?.name || 'Bot'}`}</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {configs.map((cfg) => (
                <BotCard
                  key={cfg.id}
                  config={cfg}
                  telemetry={telemetry[cfg.id]}
                  activityLogs={activityLogs[cfg.id] || []}
                  logs={chatLogs[cfg.id] || []}
                  onStart={startBot}
                  onStop={stopBot}
                  onDelete={removeBot}
                  onOpenChat={(id) => setChatBotId(id)}
                  onOpenSightModal={(c) => setSightModalBot(c)}
                  onOpenInventory={(c) => setInventoryModalBot(c)}
                  onEdit={handleEditBot}
                />
              ))}
            </div>
          )}
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

      {/* Edit Bot Modal */}
      {isAddBotModalOpen && (
        <AddBotModal
          onClose={() => {
            setIsAddBotModalOpen(false);
            setEditingBot(null);
          }}
          onSave={handleSaveBot}
          initialConfig={editingBot}
        />
      )}

      {/* Tactical Sight Radar & Movement Modal */}
      {sightModalBot && (
        <BotVisualControlModal
          config={sightModalBot}
          telemetry={telemetry[sightModalBot.id]}
          onClose={() => setSightModalBot(null)}
          onMove={moveBot}
          onTogglePatrol={togglePatrol}
          onLook={lookAt}
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

      {/* Live Chat Terminal Modal */}
      {chatBotId && activeChatConfig && (
        <LiveChatTerminal
          botConfig={activeChatConfig}
          chatLogs={chatLogs[chatBotId] || []}
          onClose={() => setChatBotId(null)}
          onSendMessage={sendChat}
          isOnline={activeChatTelemetry?.status === 'online'}
        />
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
        onDismiss={handleDismissNotification}
      />
    </div>
  );
}

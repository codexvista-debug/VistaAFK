'use client';

import React, { useState } from 'react';
import { useVistaWebSocket } from '../hooks/useVistaWebSocket';
import { Navbar } from '../components/Navbar';
import { StatsOverview } from '../components/StatsOverview';
import { BotCard } from '../components/BotCard';
import { AddBotModal } from '../components/AddBotModal';
import { LiveChatTerminal } from '../components/LiveChatTerminal';
import { DaemonSettingsModal } from '../components/DaemonSettingsModal';
import { NotificationToast } from '../components/NotificationToast';
import { BotConfig } from '../types';
import { Plus, Bot, AlertTriangle, RefreshCw, Layers } from 'lucide-react';

export default function Dashboard() {
  const {
    daemonUrl,
    secretToken,
    isConnected,
    isConnecting,
    authError,
    configs,
    telemetry,
    chatLogs,
    notifications,
    updateDaemonConfig,
    connect,
    addBot,
    updateBot,
    removeBot,
    startBot,
    stopBot,
    startAll,
    stopAll,
    sendChat,
  } = useVistaWebSocket();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<BotConfig | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [chatBotId, setChatBotId] = useState<string | null>(null);

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
    setIsAddModalOpen(true);
  };

  const handleDismissNotification = (id: string) => {
    // handled by notification toast
  };

  const onlineCount = Object.values(telemetry).filter((t) => t.status === 'online').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800">
      {/* Navigation Bar */}
      <Navbar
        isConnected={isConnected}
        isConnecting={isConnecting}
        onOpenAddModal={() => {
          setEditingBot(null);
          setIsAddModalOpen(true);
        }}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onStartAll={startAll}
        onStopAll={stopAll}
        botCount={configs.length}
        onlineCount={onlineCount}
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

        {/* Daemon Disconnected Notice */}
        {!isConnected && !isConnecting && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Bot Daemon is currently offline or unreachable.</p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  Start the daemon on your PC or VPS (<code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-semibold">npm run dev</code> in <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-semibold">daemon/</code>).
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={connect}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Connection</span>
              </button>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold rounded-xl transition shadow-sm"
              >
                Settings
              </button>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <StatsOverview configs={configs} telemetry={telemetry} />

        {/* Bot Accounts Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Active Accounts</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono border border-slate-200">
                {configs.length}
              </span>
            </div>
          </div>

          {configs.length === 0 ? (
            /* Empty State */
            <div className="p-12 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center text-center bg-white shadow-sm">
              <div className="h-16 w-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
                <Bot className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Minecraft Accounts Configured</h3>
              <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed font-medium">
                Add your first Minecraft Java account to start chunk-loading your mob farms, monitoring health/inventory, and bypassing AFK kicks.
              </p>
              <button
                onClick={() => {
                  setEditingBot(null);
                  setIsAddModalOpen(true);
                }}
                disabled={!isConnected}
                className="mt-6 flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/25 transition"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Add Your First Account</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {configs.map((cfg) => (
                <BotCard
                  key={cfg.id}
                  config={cfg}
                  telemetry={telemetry[cfg.id]}
                  onStart={startBot}
                  onStop={stopBot}
                  onDelete={removeBot}
                  onOpenChat={(id) => setChatBotId(id)}
                  onEdit={handleEditBot}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Bot Modal */}
      {isAddModalOpen && (
        <AddBotModal
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingBot(null);
          }}
          onSave={handleSaveBot}
          initialConfig={editingBot}
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

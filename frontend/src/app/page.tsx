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
import { Plus, Bot, Shield, AlertTriangle, RefreshCw, Layers } from 'lucide-react';

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
    clearNotifications,
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
    // Notifications auto-manage, or dismiss
  };

  const onlineCount = Object.values(telemetry).filter((t) => t.status === 'online').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-gray-100">
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
          <div className="mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Authentication Error: {authError}</span>
            </div>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="underline hover:text-white"
            >
              Configure Token
            </button>
          </div>
        )}

        {/* Daemon Disconnected Notice */}
        {!isConnected && !isConnecting && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">Bot Daemon is currently offline or unreachable.</p>
                <p className="text-amber-300/80 mt-0.5">
                  Start the daemon on your PC or VPS (<code className="bg-black/40 px-1 py-0.5 rounded">npm run dev</code> in <code className="bg-black/40 px-1 py-0.5 rounded">daemon/</code>).
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={connect}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-semibold rounded-lg transition flex items-center space-x-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Connection</span>
              </button>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition"
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
              <Layers className="h-4 w-4 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">Active Accounts</h2>
              <span className="text-xs text-gray-400 font-mono">({configs.length})</span>
            </div>
          </div>

          {configs.length === 0 ? (
            /* Empty State */
            <div className="p-12 border-2 border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center text-center bg-gray-900/20">
              <div className="h-16 w-16 rounded-2xl bg-emerald-950/40 border border-emerald-800 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-900/10">
                <Bot className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-white">No Minecraft Accounts Configured</h3>
              <p className="text-xs text-gray-400 max-w-md mt-1.5 leading-relaxed">
                Add your first Minecraft Java account to start chunk-loading your farms, monitoring health/inventory, and bypassing AFK kick plugins.
              </p>
              <button
                onClick={() => {
                  setEditingBot(null);
                  setIsAddModalOpen(true);
                }}
                disabled={!isConnected}
                className="mt-6 flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-700/25 transition"
              >
                <Plus className="h-4 w-4" />
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

'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useVistaWebSocket } from '../../hooks/useVistaWebSocket';
import {
  Send,
  Terminal,
  ArrowLeft,
  Heart,
  Utensils,
  MapPin,
  MessageSquare,
  Settings2,
  Eye,
  Package,
  Activity,
  Server,
  Pencil,
  Play,
  Square,
  Users,
  Gamepad2,
  ArrowDown,
  Copy,
  Check,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { MinecraftChatMessage } from '../../components/MinecraftChatMessage';
import { BotInventoryModal } from '../../components/BotInventoryModal';
import { BotPlayerPov } from '../../components/BotPlayerPov';
import { AddBotModal } from '../../components/AddBotModal';
import { BotVisualControlModal } from '../../components/BotVisualControlModal';

type ChatTab = 'settings' | 'logs' | 'chat' | 'pov' | 'movement' | 'inventory';

function ChatContent() {
  const searchParams = useSearchParams();
  const botIdParam = searchParams.get('bot');
  const tabParam = searchParams.get('tab') as ChatTab | null;

  const {
    configs,
    telemetry,
    chatLogs,
    activityLogs,
    isConnected: daemonConnected,
    updateBot,
    startBot,
    stopBot,
    sendChat,
    moveBot,
    togglePatrol,
    lookAt,
    attackBot,
    clickGuiWindowSlot,
    closeGuiWindow,
    respondGuiForm,
  } = useVistaWebSocket();

  const [selectedBotId, setSelectedBotId] = useState<string>(botIdParam || '');
  const [inputMessage, setInputMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'chat' | 'system'>('all');
  const [activeTab, setActiveTab] = useState<ChatTab>(() => {
    if (tabParam && ['settings', 'logs', 'chat', 'pov', 'movement', 'inventory'].includes(tabParam)) {
      return tabParam;
    }
    return 'chat';
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const playerLogsRef = useRef<HTMLDivElement | null>(null);
  const [playerLogsAutoScroll, setPlayerLogsAutoScroll] = useState(true);

  useEffect(() => {
    if (tabParam && ['settings', 'logs', 'chat', 'pov', 'movement', 'inventory'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (botIdParam && configs.some((c) => c.id === botIdParam)) {
      setSelectedBotId(botIdParam);
    } else if (configs.length > 0 && !selectedBotId) {
      setSelectedBotId(configs[0].id);
    }
  }, [botIdParam, configs, selectedBotId]);

  const currentConfig = configs.find((c) => c.id === selectedBotId);
  const currentTelemetry = selectedBotId ? telemetry[selectedBotId] : undefined;
  const isOnline = currentTelemetry?.status === 'online';
  const logs = selectedBotId ? chatLogs[selectedBotId] || [] : [];
  const playerLogs = selectedBotId ? activityLogs[selectedBotId] || [] : [];
  const isConnecting = ['connecting', 'authenticating', 'reconnecting'].includes(currentTelemetry?.status || '');

  const isBedrock = currentConfig ? (currentConfig.edition === 'bedrock' || currentConfig.port === 19132) : false;
  const [customVersionInput, setCustomVersionInput] = useState('');
  const [versionSavedNotice, setVersionSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (currentConfig) {
      setCustomVersionInput(currentConfig.version || '');
    }
  }, [currentConfig?.id, currentConfig?.version]);

  const handleUpdateVersion = (newVer: string) => {
    if (!currentConfig) return;
    const cleanVer = newVer.trim();
    const updated = { ...currentConfig, version: cleanVer || undefined };
    updateBot(updated);
    setCustomVersionInput(cleanVer);
    setVersionSavedNotice(
      cleanVer
        ? `Version updated to ${cleanVer}.`
        : `Version set to Auto (${isBedrock ? 'Best working: 1.26.51' : 'Auto-detect'}).`
    );
    setTimeout(() => setVersionSavedNotice(null), 5000);
  };

  const handleQuickReconnect = () => {
    if (!currentConfig) return;
    stopBot(currentConfig.id);
    setTimeout(() => {
      startBot(currentConfig.id);
    }, 600);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (playerLogsAutoScroll && activeTab === 'logs' && playerLogsRef.current) {
      playerLogsRef.current.scrollTop = playerLogsRef.current.scrollHeight;
    }
  }, [playerLogs, playerLogsAutoScroll, activeTab]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isOnline || !selectedBotId) return;
    sendChat(selectedBotId, inputMessage.trim());
    setInputMessage('');
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'chat') return !log.isSystem;
    if (filter === 'system') return log.isSystem;
    return true;
  });

  const sendQuickCommand = (cmd: string) => {
    if (!isOnline || !selectedBotId) return;
    sendChat(selectedBotId, cmd);
  };

  const currentHealth = currentTelemetry?.health ?? 0;
  const rawHearts = currentTelemetry?.hearts !== undefined ? currentTelemetry.hearts : Math.round((currentHealth / 2) * 10) / 10;
  let rawMaxHearts = currentTelemetry?.maxHearts !== undefined ? currentTelemetry.maxHearts : Math.round(((currentTelemetry?.maxHealth || 20) / 2) * 10) / 10;
  if (isOnline && (currentTelemetry?.food ?? 0) >= 18 && rawHearts > 0 && rawHearts < 10 && rawMaxHearts === 10) {
    rawMaxHearts = rawHearts;
  }
  const displayHearts = rawHearts;
  const displayMaxHearts = Math.max(rawHearts, rawMaxHearts || 10);

  const tabs: Array<{ id: ChatTab; label: string; shortLabel: string; icon: React.ReactNode }> = [
    { id: 'settings', label: 'Connection Settings', shortLabel: 'Settings', icon: <Settings2 className="h-4 w-4" /> },
    { id: 'logs', label: 'Player Logs', shortLabel: 'Logs', icon: <Activity className="h-4 w-4" /> },
    { id: 'chat', label: 'Chat', shortLabel: 'Chat', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'pov', label: 'POV', shortLabel: 'POV', icon: <Eye className="h-4 w-4" /> },
    { id: 'movement', label: 'Movement', shortLabel: 'Move', icon: <Gamepad2 className="h-4 w-4" /> },
    { id: 'inventory', label: 'Inventory', shortLabel: 'Items', icon: <Package className="h-4 w-4" /> },
  ];

  const formatLogTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="h-[100dvh] min-h-[100svh] flex flex-col bg-transparent text-slate-800 font-sans">
      {/* Light-Themed Top Bar */}
      <header className="shrink-0 px-3 py-2 sm:h-16 sm:px-6 border-b border-white/80 bg-white/85 backdrop-blur-xl flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shadow-[0_8px_28px_-20px_rgba(15,23,42,0.45)]">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="shrink-0 flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 border border-slate-300 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          <div className="hidden sm:block h-5 w-px bg-slate-200" />

          {/* Account Selector */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden sm:inline text-xs font-bold text-slate-600">Account:</span>
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              className="min-w-0 w-full sm:w-auto max-w-full bg-white border-2 border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-2 sm:px-3 py-1.5 focus:outline-none focus:border-emerald-600 shadow-xs"
            >
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.host})
                </option>
              ))}
            </select>
          </div>
          {currentConfig && (
            <div
              title={`${isOnline ? 'Connected' : currentTelemetry?.status || 'Offline'} · ${currentConfig.name} · ${currentConfig.host}:${currentConfig.port}`}
              className={`hidden lg:flex min-w-0 items-center gap-2 rounded-xl border px-3 py-1.5 ${isOnline ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.12)]' : isConnecting ? 'animate-pulse bg-amber-500' : 'bg-slate-400'}`} />
              <span className={`truncate text-[10px] font-bold ${isOnline ? 'text-emerald-800' : 'text-slate-600'}`}>
                {isOnline ? 'Connected to' : isConnecting ? 'Connecting to' : 'Not connected'} {currentConfig.host.toLowerCase().includes('donut') ? 'DonutSMP' : currentConfig.host.toLowerCase().includes('freshsmp') ? 'FreshSMP' : currentConfig.host}
              </span>
              <span className="shrink-0 rounded-md border border-white/80 bg-white/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500">
                {currentConfig.edition === 'bedrock' || currentConfig.port === 19132 ? 'Bedrock' : 'Java'}
              </span>
            </div>
          )}
        </div>

        {/* Live Bot Stats in Header */}
        {currentConfig && (
          <div className="flex w-full items-center justify-between gap-2 text-[10px] font-mono sm:w-auto sm:justify-end sm:gap-4 sm:text-xs">
            <div className="flex items-center space-x-1.5 text-rose-600 font-bold">
              <Heart className="h-4 w-4 fill-current" />
              <span>{isOnline ? `${displayHearts} / ${displayMaxHearts} HP` : '--'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-amber-600 font-bold">
              <Utensils className="h-4 w-4" />
              <span>{isOnline ? `${Math.round(currentTelemetry?.food || 0)}/20` : '--'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-600 font-bold hidden sm:flex">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span>
                {isOnline
                  ? `${currentTelemetry?.coordinates?.x || 0}, ${currentTelemetry?.coordinates?.y || 0}, ${currentTelemetry?.coordinates?.z || 0}`
                  : 'Offline'}
              </span>
            </div>
            <span
              className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        )}
      </header>

      {/* Workspace with persistent left navigation */}
      <main className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden max-w-7xl w-full mx-auto p-2 sm:p-5 gap-2 sm:gap-4">
        <nav aria-label="Bot workspace sections" className="mobile-scrollbar-hidden shrink-0 md:w-60 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto p-1.5 sm:p-2 bg-white/75 backdrop-blur-xl border border-white/90 rounded-2xl md:rounded-[1.5rem] shadow-[0_18px_48px_-26px_rgba(15,23,42,0.34)] ring-1 ring-slate-900/5">
          <div className="hidden md:flex items-center gap-3 px-3 py-4 mb-1 border-b border-slate-200/70">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/15"><Terminal className="h-4 w-4" /></div>
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-800">Bot Workspace</p><p className="truncate text-[10px] text-slate-500">{currentConfig?.name || 'Select an account'}</p></div>
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`group shrink-0 md:w-full flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/15 ring-1 ring-emerald-500/50' : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-950 hover:translate-x-0.5'}`}
            >
              <span className={`grid h-7 w-7 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-lg transition-colors ${activeTab === tab.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-emerald-700'}`}>{tab.icon}</span><span className="whitespace-nowrap"><span className="md:hidden">{tab.shortLabel}</span><span className="hidden md:inline">{tab.label}</span></span>
              {tab.id === 'logs' && playerLogs.length > 0 && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{playerLogs.length}</span>}
            </button>
          ))}
          <div className="hidden md:flex items-center gap-2 mt-auto p-3 border-t border-slate-200/70 text-[10px] text-slate-500">
            <span className={`inline-block w-2 h-2 rounded-full ${daemonConnected ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]' : 'bg-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]'}`} />
            Daemon {daemonConnected ? 'connected' : 'disconnected'}
          </div>
        </nav>

        <section className="flex-1 min-w-0 min-h-0 flex flex-col bg-white/90 backdrop-blur-xl border border-white rounded-[1.5rem] overflow-hidden shadow-[0_20px_56px_-30px_rgba(15,23,42,0.34)] ring-1 ring-slate-900/5">
          {activeTab === 'chat' && <>
          {/* Sub Header */}
          <div className="px-2.5 py-2 sm:px-5 sm:py-3 border-b border-slate-200 bg-slate-50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <Terminal className="h-4 w-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <span className="block truncate font-black text-slate-900 text-xs uppercase tracking-wide">
                  {currentConfig?.name || 'No Bot Selected'} &bull; Live Game Console
                </span>
                <p className="text-[10px] text-slate-500 font-mono font-medium truncate">
                  {currentConfig ? `${currentConfig.host}:${currentConfig.port}` : ''}
                </p>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs flex font-bold self-start sm:self-auto">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 sm:px-3 py-1 rounded-md transition text-xs ${
                  filter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('chat')}
                className={`px-2.5 sm:px-3 py-1 rounded-md transition text-xs ${
                  filter === 'chat' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Players
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-2.5 sm:px-3 py-1 rounded-md transition text-xs ${
                  filter === 'system' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                System
              </button>
            </div>
          </div>

          {/* Quick Commands */}
          <div className="mobile-scrollbar-hidden px-2.5 sm:px-5 py-1.5 sm:py-2 bg-slate-100/70 border-b border-slate-200 flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider shrink-0">Quick:</span>
            {['/afk', '/afkrewards', '/lifesteal', '/home', '/spawn', '/tpa accept', '/help', '/resourcepack', '/tpahereaccept', '/tpdeny'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => sendQuickCommand(cmd)}
                disabled={!isOnline}
                className="px-2 sm:px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white disabled:opacity-40 text-slate-800 font-mono text-[10px] sm:text-[11px] font-bold rounded-lg border border-slate-300 shadow-2xs transition whitespace-nowrap"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Light-Mode Chat Terminal Box */}
          <div className="flex-1 min-h-0 min-w-0 p-1.5 sm:p-4 overflow-y-auto bg-[#f8fafc] flex flex-col space-y-0.5 sm:space-y-1">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <MessageSquare className="h-10 w-10 stroke-[1.5]" />
                <p className="font-mono text-xs text-slate-500">No chat messages received yet.</p>
                {!isOnline && <p className="text-amber-600 font-mono text-xs font-bold">Bot is offline.</p>}
              </div>
            ) : (
              filteredLogs.map((msg, idx) => (
                <MinecraftChatMessage key={idx} message={msg} currentBotName={currentConfig?.name} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send Input Bar */}
          <form onSubmit={handleSend} className="p-2 sm:p-3 border-t border-slate-200 bg-slate-50 flex min-w-0 items-center gap-1.5 sm:gap-2">
            <span className="text-emerald-600 font-mono font-bold text-sm px-0.5 sm:px-1">&gt;</span>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={!isOnline}
              placeholder={isOnline ? 'Message or command…' : 'Connect bot to chat'}
              className="min-w-0 flex-1 bg-white border border-slate-300 focus:border-emerald-600 focus:outline-none rounded-xl px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 disabled:opacity-50 shadow-xs"
            />
            <button
              type="submit"
              disabled={!isOnline || !inputMessage.trim()}
              className="px-3 sm:px-5 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 sm:gap-2 shadow-sm font-mono"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
          </>}

          {activeTab === 'settings' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-7 bg-slate-50">
              <div className="max-w-3xl mx-auto space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div><h1 className="text-lg font-black text-slate-900">Connection Settings</h1><p className="mt-1 text-xs text-slate-500">Manage this bot’s server connection and behavior.</p></div>
                  {currentConfig && <button onClick={() => setIsEditingSettings(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /> Edit settings</button>}
                </div>
                {!currentConfig ? <EmptyWorkspace message="Select an account to view its connection settings." /> : <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <InfoCard label="Account" value={currentConfig.name} icon={<Users className="h-4 w-4" />} />
                    <InfoCard label="Server" value={`${currentConfig.host}:${currentConfig.port}`} icon={<Server className="h-4 w-4" />} />
                    <InfoCard label="Edition" value={`${currentConfig.edition || 'java'} · ${currentConfig.authType}`} icon={<Terminal className="h-4 w-4" />} />
                    <InfoCard label="Version" value={currentConfig.version && currentConfig.version.toLowerCase() !== 'auto' ? currentConfig.version : (isBedrock ? 'Auto (Best: 1.26.51)' : 'Auto-detect')} icon={<Layers className="h-4 w-4" />} />
                    <InfoCard label="Reconnect" value={currentConfig.autoReconnect ? `On · ${Math.round(currentConfig.reconnectDelayMs / 1000)}s delay` : 'Off'} icon={<Activity className="h-4 w-4" />} />
                  </div>

                  {/* Dedicated Interactive Version Settings Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Layers className="h-4 w-4 stroke-[2.5]" />
                        </div>
                        <div>
                          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Connection Version & Protocol
                          </h2>
                          <p className="text-[11px] text-slate-500">
                            {isBedrock
                              ? 'Change Bedrock protocol or use "Auto" for verified compatibility.'
                              : 'Change Java version or use Auto-detect to match the server.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Current:</span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-mono text-xs font-bold border border-emerald-300">
                          {currentConfig.version && currentConfig.version.toLowerCase() !== 'auto'
                            ? currentConfig.version
                            : (isBedrock ? 'Auto (Best: 1.26.51)' : 'Auto-detect')}
                        </span>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-2">
                        Quick Select Version:
                      </span>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {/* Auto (Best working) */}
                        <button
                          type="button"
                          onClick={() => handleUpdateVersion('')}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 border shadow-2xs ${
                            !currentConfig.version || currentConfig.version.toLowerCase() === 'auto'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Auto (Best: {isBedrock ? '1.26.51' : 'Detect'})</span>
                        </button>

                        {/* Presets */}
                        {(isBedrock
                          ? [
                              { label: '1.26.51 (FreshSMP / Latest)', val: '1.26.51' },
                              { label: '1.26.40', val: '1.26.40' },
                              { label: '1.26.0', val: '1.26.0' },
                              { label: '1.21.130', val: '1.21.130' },
                              { label: '1.21.100', val: '1.21.100' },
                              { label: '1.20.80', val: '1.20.80' },
                            ]
                          : [
                              { label: '1.21.4 (Latest)', val: '1.21.4' },
                              { label: '1.21.1', val: '1.21.1' },
                              { label: '1.20.4', val: '1.20.4' },
                              { label: '1.19.4', val: '1.19.4' },
                              { label: '1.18.2', val: '1.18.2' },
                              { label: '1.16.5', val: '1.16.5' },
                            ]
                        ).map((preset) => (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => handleUpdateVersion(preset.val)}
                            className={`px-2.5 py-1.5 rounded-xl font-bold font-mono text-xs transition border ${
                              currentConfig.version === preset.val
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Input */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleUpdateVersion(customVersionInput);
                      }}
                      className="flex items-center gap-2 pt-1"
                    >
                      <input
                        type="text"
                        placeholder="Custom version (e.g. 1.26.51, 1.20.4)"
                        value={customVersionInput}
                        onChange={(e) => setCustomVersionInput(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-900 font-mono shadow-2xs"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition shadow-xs"
                      >
                        Apply
                      </button>
                    </form>

                    {/* Feedback and Reconnect prompt */}
                    {versionSavedNotice && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900">
                        <span className="font-semibold">{versionSavedNotice}</span>
                        {(isOnline || isConnecting) && (
                          <button
                            type="button"
                            onClick={handleQuickReconnect}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition shadow-xs"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Reconnect Bot Now</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
                    <div><p className="text-sm font-bold text-slate-900">Bot status</p><p className="mt-1 text-xs text-slate-500">{currentTelemetry?.statusMessage || currentTelemetry?.status || 'Offline'} · Daemon {daemonConnected ? 'connected' : 'disconnected'}</p></div>
                    {isOnline || isConnecting ? <button onClick={() => stopBot(currentConfig.id)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100"><Square className="h-3.5 w-3.5 fill-current" /> {isConnecting ? 'Cancel connection' : 'Disconnect'}</button> : <button onClick={() => startBot(currentConfig.id)} disabled={!daemonConnected} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40"><Play className="h-3.5 w-3.5 fill-current" /> Connect</button>}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3">Automation</h2>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <StatusPill label="Anti-AFK" enabled={currentConfig.antiAfk.enabled} />
                      <StatusPill label="Auto-eat" enabled={currentConfig.survival.autoEat} />
                      <StatusPill label="Auto-totem" enabled={currentConfig.survival.autoTotem} />
                      <StatusPill label="Farming" enabled={Boolean(currentConfig.farming?.enabled)} />
                    </div>
                    <p className="mt-4 text-[11px] text-slate-500">Daemon connection URL and authentication are managed in <Link className="font-bold text-emerald-700 hover:underline" href="/settings">global Settings</Link>.</p>
                  </div>
                </>}
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex-1 min-h-0 flex flex-col bg-[#f8fafc]">
              <div className="px-3 py-3 sm:px-5 sm:py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><h1 className="text-sm font-black text-slate-900">Player Logs & Activity</h1><p className="text-[10px] text-slate-500">Live connection, survival, and command events</p></div><div className="flex items-center gap-2 sm:gap-3"><span className="text-[10px] font-mono text-slate-500">{playerLogs.length} events</span><button type="button" onClick={() => setPlayerLogsAutoScroll((value) => !value)} aria-pressed={playerLogsAutoScroll} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${playerLogsAutoScroll ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'}`} title={playerLogsAutoScroll ? 'Pause automatic scrolling' : 'Resume automatic scrolling'}><ArrowDown className="h-3 w-3" /> Auto-scroll {playerLogsAutoScroll ? 'On' : 'Off'}</button></div></div>
              <div ref={playerLogsRef} className="flex-1 min-w-0 overflow-y-auto p-2.5 sm:p-4 space-y-2">
                {playerLogs.length === 0 ? <EmptyWorkspace message={isOnline ? 'Waiting for player activity…' : 'Connect the bot to start collecting logs.'} /> : playerLogs.map((log) => (
                  <article key={log.id} className="flex flex-wrap sm:flex-nowrap items-start gap-2 sm:gap-3 rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-xs">
                    <time className="shrink-0 pt-0.5 text-[10px] font-mono text-slate-400">{formatLogTime(log.timestamp)}</time>
                    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600">{log.type.replace('_', ' ')}</span>
                    <p className="min-w-0 flex-1 basis-full break-words [overflow-wrap:anywhere] text-xs text-slate-700 sm:basis-auto">{log.message}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'pov' && (
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-2.5 sm:p-6 bg-slate-50">
              <div className="w-full max-w-6xl mx-auto space-y-4">
                {currentConfig
                  ? <BotPlayerPov telemetry={currentTelemetry} isOnline={isOnline} onClickGuiSlot={(slot, mouseButton) => clickGuiWindowSlot(currentConfig.id, slot, mouseButton)} onCloseWindow={() => closeGuiWindow(currentConfig.id)} onRespondForm={(response) => respondGuiForm(currentConfig.id, response)} />
                  : <EmptyWorkspace message="Select an account to view its POV." />}
              </div>
            </div>
          )}

          {activeTab === 'movement' && (currentConfig
            ? <BotVisualControlModal embedded config={currentConfig} telemetry={currentTelemetry} daemonConnected={daemonConnected} onClose={() => setActiveTab('pov')} onMove={moveBot} onTogglePatrol={togglePatrol} onLook={lookAt} onAttack={attackBot} />
            : <div className="flex-1 min-h-0"><EmptyWorkspace message="Select an account to open its movement controls." /></div>)}

          {activeTab === 'inventory' && (currentConfig
            ? <BotInventoryModal embedded config={currentConfig} telemetry={currentTelemetry} />
            : <div className="flex-1 min-h-0"><EmptyWorkspace message="Select an account to view its inventory." /></div>)}
        </section>
      </main>
      {isEditingSettings && currentConfig && <AddBotModal initialConfig={currentConfig} onSave={updateBot} onClose={() => setIsEditingSettings(false)} />}
    </div>
  );
}

function EmptyWorkspace({ message }: { message: string }) {
  return <div className="h-full min-h-40 flex items-center justify-center p-6 text-center text-xs text-slate-500">{message}</div>;
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
      <p className="mt-2 break-all text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatusPill({ label, enabled }: { label: string; enabled: boolean }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{label}: {enabled ? 'On' : 'Off'}</span>;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-slate-400 font-mono">Loading Chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}

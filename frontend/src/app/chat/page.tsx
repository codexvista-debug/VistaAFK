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
} from 'lucide-react';
import Link from 'next/link';
import { MinecraftChatMessage } from '../../components/MinecraftChatMessage';
import { BotInventoryModal } from '../../components/BotInventoryModal';
import { BotPlayerPov } from '../../components/BotPlayerPov';
import { AddBotModal } from '../../components/AddBotModal';
import { BotVisualControlModal } from '../../components/BotVisualControlModal';

type ChatTab = 'settings' | 'logs' | 'chat' | 'raw_chat' | 'pov' | 'movement' | 'inventory';

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
    if (tabParam && ['settings', 'logs', 'chat', 'raw_chat', 'pov', 'movement', 'inventory'].includes(tabParam)) {
      return tabParam;
    }
    return 'chat';
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const playerLogsRef = useRef<HTMLDivElement | null>(null);
  const [playerLogsAutoScroll, setPlayerLogsAutoScroll] = useState(true);

  const rawPacketsRef = useRef<HTMLDivElement | null>(null);
  const [rawPacketsAutoScroll, setRawPacketsAutoScroll] = useState(true);
  const [rawPacketFilter, setRawPacketFilter] = useState<'all' | 'translation' | 'chat' | 'with_xuid' | 'with_source'>('all');
  const [rawPacketSearch, setRawPacketSearch] = useState('');
  const [expandedJsonIndices, setExpandedJsonIndices] = useState<Record<number, boolean>>({});
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (tabParam && ['settings', 'logs', 'chat', 'raw_chat', 'pov', 'movement', 'inventory'].includes(tabParam)) {
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

  useEffect(() => {
    if (rawPacketsAutoScroll && activeTab === 'raw_chat' && rawPacketsRef.current) {
      rawPacketsRef.current.scrollTop = rawPacketsRef.current.scrollHeight;
    }
  }, [logs, rawPacketsAutoScroll, activeTab]);

  const filteredRawPackets = logs.filter((log) => {
    const raw = log.raw;
    if (rawPacketFilter === 'translation' && raw?.type !== 'translation') return false;
    if (rawPacketFilter === 'chat' && raw?.type !== 'chat') return false;
    if (rawPacketFilter === 'with_xuid' && !raw?.xuid) return false;
    if (rawPacketFilter === 'with_source' && !raw?.source_name) return false;
    if (rawPacketSearch.trim()) {
      const q = rawPacketSearch.toLowerCase();
      const matchMsg = (raw?.raw_message || log.message || '').toLowerCase().includes(q);
      const matchSrc = (raw?.source_name || log.sender || '').toLowerCase().includes(q);
      const matchXuid = (raw?.xuid || '').toLowerCase().includes(q);
      const matchUser = (raw?.resolved_username || '').toLowerCase().includes(q);
      const matchParams = (raw?.parameters || []).some((p) => p.toLowerCase().includes(q));
      if (!matchMsg && !matchSrc && !matchXuid && !matchUser && !matchParams) return false;
    }
    return true;
  });

  const tabs: Array<{ id: ChatTab; label: string; shortLabel: string; icon: React.ReactNode }> = [
    { id: 'settings', label: 'Connection Settings', shortLabel: 'Settings', icon: <Settings2 className="h-4 w-4" /> },
    { id: 'logs', label: 'Player Logs', shortLabel: 'Logs', icon: <Activity className="h-4 w-4" /> },
    { id: 'chat', label: 'Chat', shortLabel: 'Chat', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'raw_chat', label: 'Raw Packets', shortLabel: 'Raw', icon: <Terminal className="h-4 w-4" /> },
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
              {tab.id === 'raw_chat' && logs.length > 0 && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{logs.length}</span>}
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
            {['/afk', '/lifesteal', '/home', '/spawn', '/tpa accept', '/help', '/resourcepack', '/tpahereaccept', '/tpdeny'].map((cmd) => (
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
                <MinecraftChatMessage key={idx} message={msg} />
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
                    <InfoCard label="Reconnect" value={currentConfig.autoReconnect ? `On · ${Math.round(currentConfig.reconnectDelayMs / 1000)}s delay` : 'Off'} icon={<Activity className="h-4 w-4" />} />
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

          {activeTab === 'raw_chat' && (
            <div className="flex-1 min-h-0 flex flex-col bg-[#f8fafc] text-slate-800">
              {/* Sub Header */}
              <div className="px-3 py-2.5 sm:px-5 sm:py-3 border-b border-slate-200 bg-slate-50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200">
                    <Terminal className="h-4 w-4 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-xs uppercase tracking-wide">
                        {currentConfig?.name || 'Bot'} &bull; Raw Bedrock Chat Packets
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                        {logs.length} captured
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      Direct server packet fields: source_name, xuid, parameters, message
                    </p>
                  </div>
                </div>

                {/* Auto-scroll & quick actions */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setRawPacketsAutoScroll((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold font-mono transition ${
                      rawPacketsAutoScroll
                        ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowDown className="h-3 w-3" />
                    Auto-scroll: {rawPacketsAutoScroll ? 'ON' : 'OFF'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
                      setCopiedIdx(-1);
                      setTimeout(() => setCopiedIdx(null), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-1 text-[10px] font-bold font-mono text-slate-700 shadow-2xs transition cursor-pointer"
                    title="Copy all raw packets as JSON"
                  >
                    {copiedIdx === -1 ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-slate-500" />}
                    <span>{copiedIdx === -1 ? 'Copied All!' : 'Copy All JSON'}</span>
                  </button>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="px-3 sm:px-5 py-2 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Filter pills */}
                <div className="flex items-center gap-1 font-mono text-[10px] flex-wrap">
                  {(['all', 'translation', 'chat', 'with_xuid', 'with_source'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setRawPacketFilter(mode)}
                      className={`px-2 py-0.5 rounded-md transition font-bold uppercase cursor-pointer ${
                        rawPacketFilter === mode
                          ? 'bg-cyan-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-300 shadow-2xs'
                      }`}
                    >
                      {mode.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative min-w-[180px] sm:w-64">
                  <input
                    type="text"
                    value={rawPacketSearch}
                    onChange={(e) => setRawPacketSearch(e.target.value)}
                    placeholder="Filter by text, xuid, or src…"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 shadow-2xs"
                  />
                  {rawPacketSearch && (
                    <button
                      type="button"
                      onClick={() => setRawPacketSearch('')}
                      className="absolute right-2 top-1.5 text-[10px] text-slate-400 hover:text-slate-700"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {/* Packets Stream */}
              <div ref={rawPacketsRef} className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-5 space-y-2.5 scrollbar-thin bg-[#f8fafc]">
                {filteredRawPackets.length === 0 ? (
                  <div className="h-full min-h-48 flex flex-col items-center justify-center text-slate-400 space-y-2 font-mono text-xs">
                    <Terminal className="h-10 w-10 stroke-[1.5] text-slate-400" />
                    <p>
                      {logs.length === 0
                        ? (isOnline ? 'Waiting for incoming chat packets from the server…' : 'Bot is offline. Connect to start streaming packets.')
                        : 'No packets match the current filter or search criteria.'}
                    </p>
                  </div>
                ) : (
                  filteredRawPackets.map((msg, idx) => {
                    const raw = msg.raw;
                    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const isExpanded = Boolean(expandedJsonIndices[idx]);
                    return (
                      <article
                        key={idx}
                        className="bg-white border border-slate-200 rounded-2xl p-3 font-mono text-xs shadow-xs transition hover:border-slate-300 hover:shadow-sm"
                      >
                        {/* Header: Timestamp, Type, Source, XUID, Username */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-slate-400 text-[10px] font-mono">{time}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                              raw?.type === 'translation'
                                ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                : raw?.type === 'chat'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              type: {raw?.type || 'packet'}
                            </span>

                            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                              raw?.source_name
                                ? 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
                                : 'bg-slate-50 text-slate-400 border-slate-200 italic'
                            }`}>
                              source_name: {raw?.source_name ? `"${raw.source_name}"` : '<empty>'}
                            </span>

                            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                              raw?.xuid
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}>
                              xuid: {raw?.xuid || '<none>'}
                            </span>

                            {raw?.resolved_username && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-800 border border-teal-200 font-bold">
                                user_list: {raw.resolved_username}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify({
                                  botId: msg.botId,
                                  timestamp: msg.timestamp,
                                  time,
                                  sender: msg.sender,
                                  message: msg.message,
                                  isSystem: msg.isSystem,
                                  raw: msg.raw,
                                }, null, 2));
                                setCopiedIdx(idx);
                                setTimeout(() => setCopiedIdx(null), 1500);
                              }}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                              title="Copy packet JSON"
                            >
                              {copiedIdx === idx ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => setExpandedJsonIndices((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer font-bold border border-slate-200"
                            >
                              {isExpanded ? 'Hide JSON' : 'JSON'}
                            </button>
                          </div>
                        </div>

                        {/* Parameters section if present */}
                        {raw?.parameters && raw.parameters.length > 0 && (
                          <div className="mt-2 p-2 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                              Parameters ({raw.parameters.length}):
                            </span>
                            <div className="space-y-0.5">
                              {raw.parameters.map((param, pIdx) => (
                                <div key={pIdx} className="text-[11px] text-cyan-800 flex items-start gap-1">
                                  <span className="text-slate-400 font-mono select-none">[{pIdx}]:</span>
                                  <span className="break-words [overflow-wrap:anywhere]">{param}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Raw Message String */}
                        <div className="mt-2 text-[11px]">
                          <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block">Raw message:</span>
                          <p className="mt-0.5 text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 break-words [overflow-wrap:anywhere] font-medium">
                            {raw?.raw_message !== undefined ? raw.raw_message : msg.message}
                          </p>
                        </div>

                        {/* Parsed / Rendered Message in Console */}
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-bold text-slate-400 uppercase tracking-wider">Rendered as:</span>
                          <span className="text-slate-700 font-bold break-words [overflow-wrap:anywhere]">
                            {msg.sender ? `[${msg.sender}] ${msg.message}` : msg.message}
                          </span>
                        </div>

                        {/* Collapsible JSON View */}
                        {isExpanded && (
                          <div className="mt-2 p-2.5 bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 overflow-x-auto text-[10px]">
                            <pre>{JSON.stringify(raw || msg, null, 2)}</pre>
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
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

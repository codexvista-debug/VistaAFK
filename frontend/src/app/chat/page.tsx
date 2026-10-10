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
  Compass,
  Package,
  Activity,
  Server,
  Pencil,
  Play,
  Square,
  Users,
  Bug,
} from 'lucide-react';
import Link from 'next/link';
import { MinecraftChatMessage } from '../../components/MinecraftChatMessage';
import { XaerosMinimap } from '../../components/XaerosMinimap';
import { BotInventoryModal } from '../../components/BotInventoryModal';
import { AddBotModal } from '../../components/AddBotModal';
import { BotVisualControlModal } from '../../components/BotVisualControlModal';

type ChatTab = 'settings' | 'logs' | 'chat' | 'map' | 'inventory';

function ChatContent() {
  const searchParams = useSearchParams();
  const botIdParam = searchParams.get('bot');

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
  } = useVistaWebSocket();

  const [selectedBotId, setSelectedBotId] = useState<string>(botIdParam || '');
  const [inputMessage, setInputMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'chat' | 'system'>('all');
  const [activeTab, setActiveTab] = useState<ChatTab>('chat');
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [showMapControls, setShowMapControls] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const tabs: Array<{ id: ChatTab; label: string; icon: React.ReactNode }> = [
    { id: 'settings', label: 'Connection Settings', icon: <Settings2 className="h-4 w-4" /> },
    { id: 'logs', label: 'Player Logs', icon: <Activity className="h-4 w-4" /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'map', label: 'Map', icon: <Compass className="h-4 w-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <Package className="h-4 w-4" /> },
  ];

  const formatLogTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="h-screen flex flex-col bg-transparent text-slate-800 font-sans">
      {/* Light-Themed Top Bar */}
      <header className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          <div className="h-5 w-px bg-slate-200" />

          {/* Account Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-600">Account:</span>
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              className="bg-white border-2 border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-600 shadow-xs"
            >
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.host})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Bot Stats in Header */}
        {currentConfig && (
          <div className="flex items-center space-x-4 text-xs font-mono">
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
      <main className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden max-w-7xl w-full mx-auto p-3 sm:p-5 gap-4">
        <nav aria-label="Bot workspace sections" className="shrink-0 md:w-56 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto p-1 bg-white/90 border border-slate-200 rounded-2xl shadow-sm">
          <div className="hidden md:flex items-center gap-2 px-3 py-3 mb-1 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200"><Terminal className="h-4 w-4" /></div>
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-800">Bot Workspace</p><p className="truncate text-[10px] text-slate-500">{currentConfig?.name || 'Select an account'}</p></div>
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`shrink-0 md:w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              {tab.icon}<span className="whitespace-nowrap">{tab.label}</span>
              {tab.id === 'logs' && playerLogs.length > 0 && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{playerLogs.length}</span>}
            </button>
          ))}
          <div className="hidden md:block mt-auto p-3 border-t border-slate-100 text-[10px] text-slate-500">
            <span className={`inline-block w-2 h-2 mr-1.5 rounded-full ${daemonConnected ? 'bg-emerald-500' : 'bg-rose-400'}`} />
            Daemon {daemonConnected ? 'connected' : 'disconnected'}
          </div>
        </nav>

        <section className="flex-1 min-w-0 min-h-0 flex flex-col bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {activeTab === 'chat' && <>
          {/* Sub Header */}
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Terminal className="h-4 w-4 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-black text-slate-900 text-xs uppercase tracking-wide">
                  {currentConfig?.name || 'No Bot Selected'} &bull; Live Game Console
                </span>
                <p className="text-[10px] text-slate-500 font-mono font-medium">
                  {currentConfig ? `${currentConfig.host}:${currentConfig.port}` : ''}
                </p>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs flex font-bold">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-md transition ${
                  filter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('chat')}
                className={`px-3 py-1 rounded-md transition ${
                  filter === 'chat' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Players
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-3 py-1 rounded-md transition ${
                  filter === 'system' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                System
              </button>
            </div>
          </div>

          {/* Quick Commands */}
          <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Quick:</span>
            {['/afk', '/lifesteal', '/home', '/spawn', '/tpa accept', '/help', '/tpahereaccept', '/tpdeny'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => sendQuickCommand(cmd)}
                disabled={!isOnline}
                className="px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white disabled:opacity-40 text-slate-800 font-mono text-[11px] font-bold rounded-lg border border-slate-300 shadow-2xs transition whitespace-nowrap"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Light-Mode Chat Terminal Box */}
          <div className="flex-1 p-5 overflow-y-auto bg-[#f8fafc] flex flex-col space-y-0.5">
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
          <form onSubmit={handleSend} className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center space-x-2">
            <span className="text-emerald-600 font-mono font-bold text-sm px-1">&gt;</span>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={!isOnline}
              placeholder={isOnline ? 'Type a chat message or server command (e.g. /spawn, /lifesteal)...' : 'Connect bot to chat'}
              className="flex-1 bg-white border border-slate-300 focus:border-emerald-600 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 disabled:opacity-50 shadow-xs"
            />
            <button
              type="submit"
              disabled={!isOnline || !inputMessage.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center space-x-2 shadow-sm font-mono"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
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
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3"><div><h1 className="text-sm font-black text-slate-900">Player Logs & Activity</h1><p className="text-[10px] text-slate-500">Live connection, survival, and command events</p></div><span className="text-[10px] font-mono text-slate-500">{playerLogs.length} events</span></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {playerLogs.length === 0 ? <EmptyWorkspace message={isOnline ? 'Waiting for player activity…' : 'Connect the bot to start collecting logs.'} /> : playerLogs.slice().reverse().map((log) => (
                  <article key={log.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                    <time className="shrink-0 pt-0.5 text-[10px] font-mono text-slate-400">{formatLogTime(log.timestamp)}</time>
                    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600">{log.type.replace('_', ' ')}</span>
                    <p className="min-w-0 break-words text-xs text-slate-700">{log.message}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-slate-50">
              <div className="max-w-5xl mx-auto space-y-4">
                <div className="flex items-center justify-between gap-3"><div><h1 className="text-sm font-black text-slate-900">World Map</h1><p className="text-[10px] text-slate-500">Terrain, nearby players, and mobs update with live telemetry.</p></div>{currentConfig && <button onClick={() => setShowMapControls(true)} disabled={!daemonConnected || !isOnline} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40">Open movement controls</button>}</div>
                {currentConfig ? <div className="grid lg:grid-cols-[minmax(400px,520px)_1fr] gap-5 items-start"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><XaerosMinimap telemetry={currentTelemetry} botName={currentConfig.name} large /></div><div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-xs font-black uppercase text-slate-700 mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-sky-600" /> Nearby players <span className="text-slate-400">({currentTelemetry?.nearbyPlayers?.length || 0})</span></h2><div className="space-y-2 max-h-64 overflow-y-auto">{(currentTelemetry?.nearbyPlayers || []).length ? currentTelemetry!.nearbyPlayers!.map((player) => <div key={player.username} className="flex justify-between gap-2 text-xs border-b border-slate-100 pb-2"><span className="font-semibold text-slate-800">{player.username}</span><span className="font-mono text-slate-500">{player.distance}m</span></div>) : <p className="text-xs text-slate-400">No nearby players.</p>}</div></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-xs font-black uppercase text-slate-700 mb-3 flex items-center gap-2"><Bug className="h-4 w-4 text-rose-600" /> Nearby mobs <span className="text-slate-400">({currentTelemetry?.nearbyMobs?.length || 0})</span></h2><div className="space-y-2 max-h-64 overflow-y-auto">{(currentTelemetry?.nearbyMobs || []).length ? currentTelemetry!.nearbyMobs!.map((mob) => <div key={mob.id} className="flex justify-between gap-2 text-xs border-b border-slate-100 pb-2"><span className={`font-semibold ${mob.isHostile ? 'text-rose-700' : 'text-emerald-700'}`}>{mob.name}{mob.isHostile ? ' · Hostile' : ''}</span><span className="font-mono text-slate-500">{mob.distance}m</span></div>) : <p className="text-xs text-slate-400">No nearby mobs.</p>}</div></div>
                </div></div> : <EmptyWorkspace message="Select an account to view its map." />}
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (currentConfig
            ? <BotInventoryModal embedded config={currentConfig} telemetry={currentTelemetry} />
            : <div className="flex-1 min-h-0"><EmptyWorkspace message="Select an account to view its inventory." /></div>)}
        </section>
      </main>
      {isEditingSettings && currentConfig && <AddBotModal initialConfig={currentConfig} onSave={updateBot} onClose={() => setIsEditingSettings(false)} />}
      {showMapControls && currentConfig && <BotVisualControlModal config={currentConfig} telemetry={currentTelemetry} daemonConnected={daemonConnected} onClose={() => setShowMapControls(false)} onMove={moveBot} onTogglePatrol={togglePatrol} onLook={lookAt} onAttack={attackBot} />}
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

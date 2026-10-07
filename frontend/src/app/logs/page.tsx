'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useVistaWebSocket } from '../../hooks/useVistaWebSocket';
import {
  Terminal,
  ArrowLeft,
  Heart,
  Utensils,
  MapPin,
  Search,
  Filter,
  ArrowDown,
  RotateCcw,
  Shield,
  Zap,
  Swords,
  Clock,
  Sparkles,
  Server,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

function PlayerLogsContent() {
  const searchParams = useSearchParams();
  const botIdParam = searchParams.get('bot');

  const {
    configs,
    telemetry,
    activityLogs,
    isConnected,
  } = useVistaWebSocket();

  const [selectedBotId, setSelectedBotId] = useState<string>(botIdParam || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

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
  const botLogs = selectedBotId ? activityLogs[selectedBotId] || [] : [];

  // Filter logs by type and search query (Strictly NO server chat)
  const filteredLogs = botLogs.filter((log) => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!log.message.toLowerCase().includes(q)) return false;
    }

    // Type filter
    if (filterType === 'survival') {
      return log.type === 'survival' || log.message.toLowerCase().includes('eat') || log.message.toLowerCase().includes('totem') || log.message.toLowerCase().includes('hp');
    }
    if (filterType === 'combat') {
      return log.message.toLowerCase().includes('farm') || log.message.toLowerCase().includes('sword') || log.message.toLowerCase().includes('attack') || log.message.toLowerCase().includes('kill');
    }
    if (filterType === 'connection') {
      return log.type === 'connect' || log.type === 'disconnect' || log.type === 'reconnect' || log.type === 'status';
    }
    if (filterType === 'command') {
      return log.type === 'command' || log.message.includes('/') || log.message.toLowerCase().includes('command');
    }
    if (filterType === 'spawn') {
      return log.type === 'spawn' || log.message.toLowerCase().includes('spawn');
    }

    return true;
  });

  // Auto scroll to latest log
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const getLogBadgeStyle = (log: typeof botLogs[0]) => {
    const msg = log.message.toLowerCase();
    if (msg.includes('eat') || msg.includes('healing') || msg.includes('hp')) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    if (msg.includes('totem') || msg.includes('shield')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
    if (msg.includes('farm') || msg.includes('sword') || msg.includes('attack')) {
      return 'bg-purple-100 text-purple-800 border-purple-300';
    }
    if (msg.includes('spawn') || msg.includes('joined') || msg.includes('connect')) {
      return 'bg-sky-100 text-sky-800 border-sky-300';
    }
    if (msg.includes('disconnect') || msg.includes('died') || msg.includes('kick')) {
      return 'bg-rose-100 text-rose-800 border-rose-300';
    }
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const currentHealth = currentTelemetry?.health ?? 0;
  const rawHearts = currentTelemetry?.hearts !== undefined ? currentTelemetry.hearts : Math.round((currentHealth / 2) * 10) / 10;
  let rawMaxHearts = currentTelemetry?.maxHearts !== undefined ? currentTelemetry.maxHearts : Math.round(((currentTelemetry?.maxHealth || 20) / 2) * 10) / 10;
  if (isOnline && (currentTelemetry?.food ?? 0) >= 18 && rawHearts > 0 && rawHearts < 10 && rawMaxHearts === 10) {
    rawMaxHearts = rawHearts;
  }
  const displayHearts = rawHearts;
  const displayMaxHearts = Math.max(rawHearts, rawMaxHearts || 10);

  return (
    <div className="h-screen flex flex-col bg-[#f1f5f9] text-slate-800 font-sans">
      {/* Top Header Bar */}
      <header className="h-16 px-4 sm:px-6 border-b border-slate-200 bg-white flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Fleet Dashboard</span>
          </Link>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Account Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-600 hidden sm:inline">Account:</span>
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
          <div className="flex items-center space-x-2 sm:space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-1.5 text-rose-600 font-bold">
              <Heart className="h-4 w-4 fill-current" />
              <span>{isOnline ? `${displayHearts} / ${displayMaxHearts} HP` : '--'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-amber-600 font-bold">
              <Utensils className="h-4 w-4" />
              <span>{isOnline ? `${Math.round(currentTelemetry?.food || 0)}/20` : '--'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-600 font-bold hidden md:flex">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span>
                {isOnline
                  ? `${currentTelemetry?.coordinates?.x || 0}, ${currentTelemetry?.coordinates?.y || 0}, ${currentTelemetry?.coordinates?.z || 0}`
                  : 'Offline'}
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
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

      {/* Action / Filter Bar */}
      <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Category Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: `All Logs (${botLogs.length})` },
            { id: 'survival', label: 'Survival & Eating' },
            { id: 'combat', label: 'Farming & Combat' },
            { id: 'spawn', label: 'Spawns & World' },
            { id: 'command', label: 'Commands' },
            { id: 'connection', label: 'Connections' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap border ${
                filterType === cat.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Right Tools: Search & Auto-Scroll Toggle */}
        <div className="flex items-center space-x-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:bg-white focus:border-emerald-500 w-36 sm:w-48"
            />
          </div>

          {/* Auto-Scroll Toggle Button */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition ${
              autoScroll
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-slate-100 text-slate-500 border-slate-300'
            }`}
            title={autoScroll ? 'Auto-scroll is active' : 'Auto-scroll is paused'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${autoScroll ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}</span>
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Main Terminal Activity Stream */}
      <div
        ref={logsContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0a0f1d] font-mono text-xs select-text scrollbar-thin scroll-smooth"
      >
        <div className="max-w-6xl mx-auto space-y-1.5">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-24 text-slate-500 space-y-3">
              <Terminal className="h-10 w-10 mx-auto text-slate-600 stroke-[1.5]" />
              <p className="font-bold text-sm">No player activity logs match the selected filter.</p>
              <p className="text-xs text-slate-600">
                {isOnline
                  ? 'The bot is online. Logs will automatically populate and scroll as actions occur.'
                  : 'Start this bot from the dashboard to begin streaming live player events.'}
              </p>
            </div>
          ) : (
            filteredLogs.map((log, idx) => (
              <div
                key={log.id || idx}
                className="flex items-start space-x-2.5 py-1 px-2 rounded-lg hover:bg-slate-900/90 transition text-slate-200 border-l-2 border-transparent hover:border-emerald-500"
              >
                {/* Timestamp */}
                <span className="text-slate-500 text-[11px] shrink-0 select-none">
                  [{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                </span>

                {/* Event Type Badge */}
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase shrink-0 border ${getLogBadgeStyle(log)}`}>
                  {log.type || 'activity'}
                </span>

                {/* Message */}
                <span className="break-words font-medium leading-relaxed">
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="h-9 px-4 sm:px-6 bg-[#070b14] border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Pure Player Activity Stream &bull; Server chat excluded</span>
        </div>

        <div>
          <span>Showing {filteredLogs.length} of {botLogs.length} events</span>
        </div>
      </div>
    </div>
  );
}

export default function PlayerLogsPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center font-mono text-sm text-slate-500">Loading Player Activity Stream...</div>}>
      <PlayerLogsContent />
    </Suspense>
  );
}

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
} from 'lucide-react';
import Link from 'next/link';
import { MinecraftChatMessage } from '../../components/MinecraftChatMessage';

function ChatContent() {
  const searchParams = useSearchParams();
  const botIdParam = searchParams.get('bot');

  const {
    configs,
    telemetry,
    chatLogs,
    sendChat,
  } = useVistaWebSocket();

  const [selectedBotId, setSelectedBotId] = useState<string>(botIdParam || '');
  const [inputMessage, setInputMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'chat' | 'system'>('all');
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

  return (
    <div className="h-screen flex flex-col bg-[#0b0f19] text-slate-100 font-sans">
      {/* Dark-Themed Top Bar */}
      <header className="h-16 px-6 border-b border-slate-800 bg-[#11192e] flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          <div className="h-5 w-px bg-slate-800" />

          {/* Account Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400">Account:</span>
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              className="bg-[#0c1220] border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 shadow-inner"
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
            <div className="flex items-center space-x-1.5 text-rose-400 font-bold">
              <Heart className="h-4 w-4 fill-current" />
              <span>{isOnline ? `${displayHearts} / ${displayMaxHearts} HP` : '--'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
              <Utensils className="h-4 w-4" />
              <span>{isOnline ? `${Math.round(currentTelemetry?.food || 0)}/20` : '--'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-400 font-bold hidden sm:flex">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <span>
                {isOnline
                  ? `${currentTelemetry?.coordinates?.x || 0}, ${currentTelemetry?.coordinates?.y || 0}, ${currentTelemetry?.coordinates?.z || 0}`
                  : 'Offline'}
              </span>
            </div>
            <span
              className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isOnline
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        )}
      </header>

      {/* Main Terminal Window */}
      <main className="flex-1 flex flex-col overflow-hidden max-w-6xl w-full mx-auto p-4 sm:p-6">
        <div className="flex-1 flex flex-col bg-[#0c1220] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
          {/* Sub Header */}
          <div className="px-5 py-3 border-b border-slate-800 bg-[#11192e] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-700/60">
                <Terminal className="h-4 w-4 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-black text-white text-xs uppercase tracking-wide">
                  {currentConfig?.name || 'No Bot Selected'} &bull; Live Game Console
                </span>
                <p className="text-[10px] text-slate-400 font-mono font-medium">
                  {currentConfig ? `${currentConfig.host}:${currentConfig.port}` : ''}
                </p>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="bg-slate-900 p-0.5 rounded-lg border border-slate-700/80 text-xs flex font-bold">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-md transition ${
                  filter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('chat')}
                className={`px-3 py-1 rounded-md transition ${
                  filter === 'chat' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Players
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-3 py-1 rounded-md transition ${
                  filter === 'system' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                System
              </button>
            </div>
          </div>

          {/* Quick Commands */}
          <div className="px-5 py-2.5 bg-[#090e1a] border-b border-slate-800 flex items-center space-x-2 overflow-x-auto text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quick:</span>
            {['/afk', '/lifesteal', '/home', '/spawn', '/tpa accept', '/help'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => sendQuickCommand(cmd)}
                disabled={!isOnline}
                className="px-2.5 py-1 bg-[#131d33] hover:bg-emerald-600 hover:text-white disabled:opacity-40 text-slate-200 font-mono text-[11px] font-bold rounded-lg border border-slate-700/80 shadow-xs transition"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Dark-Mode Chat Terminal Box */}
          <div className="flex-1 p-5 overflow-y-auto bg-[#060911] flex flex-col space-y-0.5 shadow-inner">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <MessageSquare className="h-10 w-10 stroke-[1.5]" />
                <p className="font-mono text-xs text-slate-400">No chat messages received yet.</p>
                {!isOnline && <p className="text-amber-400 font-mono text-xs font-bold">Bot is offline.</p>}
              </div>
            ) : (
              filteredLogs.map((msg, idx) => (
                <MinecraftChatMessage key={idx} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send Input Bar */}
          <form onSubmit={handleSend} className="p-3.5 border-t border-slate-800 bg-[#0e1628] flex items-center space-x-2">
            <span className="text-emerald-400 font-mono font-bold text-sm px-1">&gt;</span>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={!isOnline}
              placeholder={isOnline ? 'Type a chat message or server command (e.g. /spawn, /lifesteal)...' : 'Connect bot to chat'}
              className="flex-1 bg-[#070b14] border border-slate-700 focus:border-emerald-500 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder-slate-500 disabled:opacity-50 shadow-inner"
            />
            <button
              type="submit"
              disabled={!isOnline || !inputMessage.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center space-x-2 shadow-lg shadow-emerald-950/50 font-mono"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-slate-400 font-mono">Loading Chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}

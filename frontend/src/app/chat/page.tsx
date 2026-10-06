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
  Bot,
  Volume2,
  VolumeX,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

function ChatContent() {
  const searchParams = useSearchParams();
  const botIdParam = searchParams.get('bot');

  const {
    configs,
    telemetry,
    chatLogs,
    sendChat,
    isConnected,
  } = useVistaWebSocket();

  const [selectedBotId, setSelectedBotId] = useState<string>(botIdParam || '');
  const [inputMessage, setInputMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'chat' | 'system'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
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

  return (
    <div className="h-screen flex flex-col bg-[#0b111a] text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="h-16 px-6 border-b border-[#1f2d42] bg-[#101826] flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#1b2637] hover:bg-[#25354d] text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          <div className="h-5 w-px bg-slate-700" />

          {/* Account Selector Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium">Account:</span>
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              className="bg-[#1b2637] border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.host})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Bot Quick Stats */}
        {currentConfig && (
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-1.5 text-rose-400">
              <Heart className="h-3.5 w-3.5 fill-current" />
              <span>{isOnline ? `${Math.round(currentTelemetry?.health || 0)}/20` : '--'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-amber-400">
              <Utensils className="h-3.5 w-3.5" />
              <span>{isOnline ? `${Math.round(currentTelemetry?.food || 0)}/20` : '--'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-400 hidden sm:flex">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {isOnline
                  ? `${currentTelemetry?.coordinates?.x || 0}, ${currentTelemetry?.coordinates?.y || 0}, ${currentTelemetry?.coordinates?.z || 0}`
                  : 'Offline'}
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        )}
      </header>

      {/* Main Terminal Window */}
      <main className="flex-1 flex flex-col overflow-hidden max-w-6xl w-full mx-auto p-4 sm:p-6">
        <div className="flex-1 flex flex-col bg-[#070b12] border-2 border-[#1a2638] rounded-3xl overflow-hidden shadow-2xl">
          {/* Terminal Sub-Header */}
          <div className="px-5 py-3 border-b border-[#1a2638] bg-[#0e1624] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-1.5 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                <Terminal className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-white text-xs">
                  {currentConfig?.name || 'No Bot Selected'} &mdash; Live Server Console
                </span>
                <p className="text-[10px] text-slate-400 font-mono">
                  {currentConfig ? `${currentConfig.host}:${currentConfig.port}` : ''}
                </p>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center space-x-2">
              <div className="bg-[#172233] p-0.5 rounded-xl border border-slate-700 text-xs flex">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filter === 'all' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Logs
                </button>
                <button
                  onClick={() => setFilter('chat')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filter === 'chat' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Players
                </button>
                <button
                  onClick={() => setFilter('system')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filter === 'system' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  System
                </button>
              </div>
            </div>
          </div>

          {/* Quick Commands Bar */}
          <div className="px-5 py-2.5 bg-[#090f1a] border-b border-[#1a2638] flex items-center space-x-2 overflow-x-auto text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Quick:</span>
            {['/afk', '/lifesteal', '/home', '/spawn', '/tpa accept', '/help'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => sendQuickCommand(cmd)}
                disabled={!isOnline}
                className="px-2.5 py-1 bg-[#152030] hover:bg-emerald-600 hover:text-white disabled:opacity-40 text-slate-300 font-mono text-[11px] font-semibold rounded-lg border border-slate-700 transition"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Scrollable Chat Terminal */}
          <div className="flex-1 p-5 overflow-y-auto font-mono text-xs space-y-2.5 bg-[#070b12]">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Terminal className="h-10 w-10 stroke-[1.5]" />
                <p className="font-sans">No messages yet. Any game chat or whispers will stream here live.</p>
                {!isOnline && <p className="text-amber-500/80 text-xs font-sans">Bot is currently offline.</p>}
              </div>
            ) : (
              filteredLogs.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-xl transition ${
                    msg.isSystem ? 'bg-[#0d1522]/60 text-slate-400' : 'bg-[#101b2c]/80 text-slate-100 hover:bg-[#132035]'
                  }`}
                >
                  <span className="text-slate-500 mr-2 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`font-bold mr-2 ${msg.isSystem ? 'text-teal-400' : 'text-emerald-400'}`}>
                    [{msg.sender}]:
                  </span>
                  <span className="whitespace-pre-wrap break-words">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-4 border-t border-[#1a2638] bg-[#0e1624] flex items-center space-x-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={!isOnline}
              placeholder={isOnline ? 'Type a chat message or server command (e.g. /spawn)...' : 'Connect bot to chat'}
              className="flex-1 bg-black/60 border border-slate-700 focus:border-emerald-500 focus:outline-none rounded-2xl px-5 py-3 text-xs text-white placeholder-slate-500 disabled:opacity-50 transition"
            />
            <button
              type="submit"
              disabled={!isOnline || !inputMessage.trim()}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-2xl transition flex items-center space-x-2 shadow-lg shadow-emerald-600/25"
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
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-slate-400">Loading Chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}

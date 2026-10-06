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
  Box,
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

  return (
    <div className="h-screen flex flex-col bg-[#e2e8f0] text-slate-800 font-sans">
      {/* Minecraft Themed Top Bar */}
      <header className="h-16 px-6 border-b-2 border-slate-300 bg-white flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          <div className="h-5 w-px bg-slate-300" />

          {/* Account Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-600">Account:</span>
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              className="bg-white border-2 border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-600 shadow-xs"
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
              <span>{isOnline ? `${Math.round(currentTelemetry?.health || 0)}/20` : '--'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-amber-600 font-bold">
              <Utensils className="h-4 w-4" />
              <span>{isOnline ? `${Math.round(currentTelemetry?.food || 0)}/20` : '--'}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-600 font-bold hidden sm:flex">
              <MapPin className="h-4 w-4 text-slate-500" />
              <span>
                {isOnline
                  ? `${currentTelemetry?.coordinates?.x || 0}, ${currentTelemetry?.coordinates?.y || 0}, ${currentTelemetry?.coordinates?.z || 0}`
                  : 'Offline'}
              </span>
            </div>
            <span
              className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isOnline
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-slate-200 text-slate-600 border-slate-300'
              }`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        )}
      </header>

      {/* Main Terminal Window */}
      <main className="flex-1 flex flex-col overflow-hidden max-w-6xl w-full mx-auto p-4 sm:p-6">
        <div className="flex-1 flex flex-col bg-white border-4 border-t-white border-l-white border-b-slate-400 border-r-slate-400 rounded-2xl overflow-hidden shadow-lg">
          {/* Sub Header */}
          <div className="px-5 py-3 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
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
          <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto text-xs">
            <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Quick:</span>
            {['/afk', '/lifesteal', '/home', '/spawn', '/tpa accept', '/help'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => sendQuickCommand(cmd)}
                disabled={!isOnline}
                className="px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white disabled:opacity-40 text-slate-800 font-mono text-[11px] font-bold rounded-md border border-slate-300 shadow-2xs transition"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Chat Terminal Box */}
          <div className="flex-1 p-5 overflow-y-auto font-mono text-xs space-y-2 bg-[#fcfcfc]">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Terminal className="h-10 w-10 stroke-[1.5]" />
                <p className="font-sans font-medium text-xs">No chat messages received yet.</p>
                {!isOnline && <p className="text-amber-600 font-sans text-xs font-bold">Bot is offline.</p>}
              </div>
            ) : (
              filteredLogs.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border transition ${
                    msg.isSystem ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white border-slate-100 text-slate-900 hover:bg-slate-50 shadow-2xs'
                  }`}
                >
                  <span className="text-slate-400 mr-2 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`font-black mr-2 ${msg.isSystem ? 'text-teal-700' : 'text-emerald-700'}`}>
                    [{msg.sender}]:
                  </span>
                  <span className="whitespace-pre-wrap break-words font-medium">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send Input Bar */}
          <form onSubmit={handleSend} className="p-3.5 border-t-2 border-slate-200 bg-slate-50 flex items-center space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={!isOnline}
              placeholder={isOnline ? 'Type a chat message or server command (e.g. /spawn)...' : 'Connect bot to chat'}
              className="flex-1 bg-white border-2 border-slate-300 focus:border-emerald-600 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-slate-900 font-medium placeholder-slate-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!isOnline || !inputMessage.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center space-x-2 shadow-sm"
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
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-slate-600">Loading Chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}

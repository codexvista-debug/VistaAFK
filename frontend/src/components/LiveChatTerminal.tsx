'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Terminal, MessageSquare, ExternalLink } from 'lucide-react';
import { BotConfig, ChatMessage } from '../types';
import { MinecraftChatMessage } from './MinecraftChatMessage';

interface LiveChatTerminalProps {
  botConfig: BotConfig;
  chatLogs: ChatMessage[];
  onClose: () => void;
  onSendMessage: (botId: string, message: string) => void;
  isOnline: boolean;
}

export const LiveChatTerminal: React.FC<LiveChatTerminalProps> = ({
  botConfig,
  chatLogs,
  onClose,
  onSendMessage,
  isOnline,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'chat' | 'system'>('all');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLogs]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isOnline) return;
    onSendMessage(botConfig.id, inputMessage.trim());
    setInputMessage('');
  };

  const filteredLogs = chatLogs.filter((log) => {
    if (filter === 'chat') return !log.isSystem;
    if (filter === 'system') return log.isSystem;
    return true;
  });

  const sendQuickCommand = (cmd: string) => {
    if (!isOnline) return;
    onSendMessage(botConfig.id, cmd);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#0f1422] border-2 border-slate-700/80 rounded-2xl w-full max-w-3xl h-[600px] flex flex-col shadow-2xl overflow-hidden">
        {/* Terminal Header */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-[#161d2f]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Terminal className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-white text-sm uppercase tracking-wide">{botConfig.name}</span>
                <span className="text-xs text-slate-400 font-semibold">&bull; Minecraft In-Game Chat HUD</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono font-medium">
                {botConfig.host}:{botConfig.port}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Filter buttons */}
            <div className="flex items-center bg-[#0d121d] rounded-lg p-0.5 border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md transition ${filter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('chat')}
                className={`px-2.5 py-1 rounded-md transition ${filter === 'chat' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                Players
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-2.5 py-1 rounded-md transition ${filter === 'system' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                System
              </button>
            </div>

            {/* Open in Dedicated Page */}
            <a
              href={`/chat?bot=${botConfig.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition border border-transparent hover:border-slate-700"
              title="Open chat in dedicated full new page"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Commands Bar */}
        <div className="px-4 py-2 bg-[#121826] border-b border-slate-800/80 flex items-center space-x-2 overflow-x-auto text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quick:</span>
          {['/afk', '/lifesteal', '/home', '/spawn', '/tpa accept', '/help'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => sendQuickCommand(cmd)}
              disabled={!isOnline}
              className="px-2.5 py-1 bg-[#1a2234] hover:bg-emerald-600 hover:text-white disabled:opacity-40 text-slate-200 font-mono text-[11px] font-bold rounded border border-slate-700/80 shadow-2xs transition"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Authentic In-Game Minecraft Chat Terminal Screen */}
        <div className="flex-1 p-4 overflow-y-auto bg-black/75 backdrop-blur-xs flex flex-col space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
              <MessageSquare className="h-8 w-8 stroke-[1.5]" />
              <p className="font-mono text-xs text-slate-400">No chat messages received yet.</p>
              {!isOnline && <p className="text-amber-500 font-mono text-xs font-bold">Bot is currently offline.</p>}
            </div>
          ) : (
            filteredLogs.map((msg, idx) => (
              <MinecraftChatMessage key={idx} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Minecraft In-Game Chat Input Prompt */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-[#121826] flex items-center space-x-2">
          <span className="text-emerald-400 font-mono font-bold text-sm px-1">&gt;</span>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={!isOnline}
            placeholder={isOnline ? 'Type message or command (/spawn, /lifesteal)...' : 'Connect bot to send chat messages'}
            className="flex-1 bg-black/50 border border-slate-700 focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isOnline || !inputMessage.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition flex items-center space-x-1.5 shadow-sm font-bold text-xs font-mono"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

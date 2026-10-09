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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-3xl h-[600px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 gap-2">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <Terminal className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-black text-slate-900 text-sm uppercase tracking-wide truncate">{botConfig.name}</span>
                <span className="text-xs text-slate-500 font-semibold hidden sm:inline">&bull; Live Game Console</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono font-medium block truncate">
                {botConfig.host}:{botConfig.port}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Filter buttons */}
            <div className="flex items-center bg-slate-200/80 rounded-lg p-0.5 border border-slate-300 text-xs font-bold">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 sm:px-2.5 py-1 rounded-md transition ${filter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('chat')}
                className={`px-2 sm:px-2.5 py-1 rounded-md transition ${filter === 'chat' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Players
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-2 sm:px-2.5 py-1 rounded-md transition ${filter === 'system' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                System
              </button>
            </div>

            {/* Open in Dedicated Page */}
            <a
              href={`/chat?bot=${botConfig.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition border border-transparent hover:border-slate-300"
              title="Open chat in dedicated full new page"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 active:scale-95 transition"
              title="Close Console (Esc)"
            >
              <X className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Quick Commands Bar */}
        <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Quick:</span>
          {['/afk', '/lifesteal', '/home', '/spawn', '/tpa accept', '/help'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => sendQuickCommand(cmd)}
              disabled={!isOnline}
              className="px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white disabled:opacity-40 text-slate-800 font-mono text-[11px] font-bold rounded-lg border border-slate-300 shadow-2xs transition"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Light-Mode Chat Terminal Screen */}
        <div className="flex-1 m-3 p-3 overflow-y-auto bg-[#f8fafc] border border-slate-200 rounded-xl flex flex-col space-y-0.5">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
              <MessageSquare className="h-8 w-8 stroke-[1.5]" />
              <p className="font-mono text-xs text-slate-500">No chat messages received yet.</p>
              {!isOnline && <p className="text-amber-600 font-mono text-xs font-bold">Bot is currently offline.</p>}
            </div>
          ) : (
            filteredLogs.map((msg, idx) => (
              <MinecraftChatMessage key={idx} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Prompt */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-slate-50 flex items-center space-x-2">
          <span className="text-emerald-600 font-mono font-bold text-sm px-1">&gt;</span>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={!isOnline}
            placeholder={isOnline ? 'Type message or command (e.g. /spawn, /lifesteal)...' : 'Connect bot to send chat messages'}
            className="flex-1 bg-white border border-slate-300 focus:border-emerald-600 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono placeholder-slate-400 disabled:opacity-50 shadow-xs"
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

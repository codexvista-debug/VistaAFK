'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Terminal, MessageSquare, ExternalLink } from 'lucide-react';
import { BotConfig, ChatMessage } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border-4 border-t-white border-l-white border-b-slate-400 border-r-slate-400 rounded-2xl w-full max-w-2xl h-[560px] flex flex-col shadow-2xl overflow-hidden">
        {/* Terminal Header */}
        <div className="px-5 py-3.5 border-b-2 border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Terminal className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-slate-900 text-sm uppercase tracking-wide">{botConfig.name}</span>
                <span className="text-xs text-slate-500 font-semibold">&bull; Live Chat & Console</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono font-medium">
                {botConfig.host}:{botConfig.port}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Filter buttons */}
            <div className="flex items-center bg-slate-200/80 rounded-lg p-0.5 border border-slate-300 text-xs font-bold">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md transition ${filter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('chat')}
                className={`px-2.5 py-1 rounded-md transition ${filter === 'chat' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Players
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-2.5 py-1 rounded-md transition ${filter === 'system' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                System
              </button>
            </div>

            {/* Open in Dedicated Page */}
            <a
              href={`/chat?bot=${botConfig.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition border border-transparent hover:border-slate-300"
              title="Open chat in dedicated full new page"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Commands Bar */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto text-xs">
          <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Quick:</span>
          {['/afk', '/lifesteal', '/home', '/spawn', '/tpa accept', '/help'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => sendQuickCommand(cmd)}
              disabled={!isOnline}
              className="px-2.5 py-0.5 bg-white hover:bg-emerald-600 hover:text-white disabled:opacity-40 text-slate-800 font-mono text-[11px] font-bold rounded border border-slate-300 shadow-2xs transition"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Message Log Body */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2 bg-[#fcfcfc]">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
              <MessageSquare className="h-8 w-8 stroke-[1.5]" />
              <p className="font-sans font-medium text-xs">No chat messages received yet.</p>
              {!isOnline && <p className="text-amber-600 font-sans text-xs font-bold">Bot is currently offline.</p>}
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
                <span className={`font-black mr-1.5 ${msg.isSystem ? 'text-teal-700' : 'text-emerald-700'}`}>
                  [{msg.sender}]:
                </span>
                <span className="whitespace-pre-wrap break-words font-medium">{msg.message}</span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 border-t-2 border-slate-200 bg-slate-50 flex items-center space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={!isOnline}
            placeholder={isOnline ? 'Type a chat message or server command (e.g. /spawn)...' : 'Connect bot to send chat messages'}
            className="flex-1 bg-white border-2 border-slate-300 focus:border-emerald-600 focus:outline-none rounded-xl px-4 py-2 text-xs text-slate-900 font-medium placeholder-slate-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isOnline || !inputMessage.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition flex items-center space-x-1.5 shadow-sm font-bold"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="text-xs">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

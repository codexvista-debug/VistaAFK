'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Terminal, MessageSquare, Shield, Clock } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0e1626] border border-gray-800 rounded-2xl w-full max-w-2xl h-[560px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Terminal Header */}
        <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between bg-gray-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm">{botConfig.name}</span>
                <span className="text-xs text-gray-400">Live Chat & Console</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">
                {botConfig.host}:{botConfig.port}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Filter buttons */}
            <div className="flex items-center bg-gray-800/80 rounded-lg p-0.5 border border-gray-700/60 text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-0.5 rounded-md ${filter === 'all' ? 'bg-emerald-600 text-white font-medium' : 'text-gray-400'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('chat')}
                className={`px-2 py-0.5 rounded-md ${filter === 'chat' ? 'bg-emerald-600 text-white font-medium' : 'text-gray-400'}`}
              >
                Players
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-2 py-0.5 rounded-md ${filter === 'system' ? 'bg-emerald-600 text-white font-medium' : 'text-gray-400'}`}
              >
                System
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Commands Bar */}
        <div className="px-4 py-2 bg-gray-900/40 border-b border-gray-800/60 flex items-center space-x-2 overflow-x-auto text-xs">
          <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Quick:</span>
          {['/afk', '/home', '/spawn', '/tpa accept', '/help'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => sendQuickCommand(cmd)}
              disabled={!isOnline}
              className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 font-mono text-[11px] rounded border border-gray-700 transition"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Message Log Body */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2 bg-[#080d1a]">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
              <MessageSquare className="h-8 w-8 stroke-1" />
              <p>No chat messages received yet.</p>
              {!isOnline && <p className="text-amber-500/80 text-xs">Bot is currently offline.</p>}
            </div>
          ) : (
            filteredLogs.map((msg, idx) => (
              <div
                key={idx}
                className={`p-1.5 rounded transition ${
                  msg.isSystem ? 'text-gray-400 bg-gray-900/30' : 'text-gray-200 hover:bg-gray-900/50'
                }`}
              >
                <span className="text-gray-500 mr-2 text-[10px]">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`font-semibold mr-1.5 ${msg.isSystem ? 'text-teal-400' : 'text-emerald-400'}`}>
                  [{msg.sender}]:
                </span>
                <span className="whitespace-pre-wrap break-words">{msg.message}</span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-gray-800 bg-gray-900/80 flex items-center space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={!isOnline}
            placeholder={isOnline ? 'Type a chat message or server command (e.g. /spawn)...' : 'Connect bot to send chat messages'}
            className="flex-1 bg-black/50 border border-gray-700/80 focus:border-emerald-500 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isOnline || !inputMessage.trim()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition flex items-center space-x-1.5 shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

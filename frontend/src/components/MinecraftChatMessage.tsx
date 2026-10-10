'use client';

import React from 'react';
import { ChatMessage } from '../types';

interface MinecraftChatMessageProps {
  message: ChatMessage;
  showTimestamp?: boolean;
}

// High-contrast Minecraft Rank colors for Dark Console
const RANK_COLORS: Record<string, string> = {
  TITAN: '#38bdf8',     // Sky 400
  KING: '#fbbf24',      // Amber 400
  CHAMPION: '#fb923c',  // Orange 400
  KNIGHT: '#60a5fa',    // Blue 400
  EMPEROR: '#c084fc',   // Purple 400
  MEMBER: '#94a3b8',    // Slate 400
  VIP: '#34d399',       // Emerald 400
  'VIP+': '#34d399',
  MVP: '#22d3ee',       // Cyan 400
  'MVP+': '#38bdf8',
  ADMIN: '#f87171',     // Red 400
  OWNER: '#f87171',
  MOD: '#34d399',
};

// Authentic Minecraft Color Codes for Dark Mode
const MC_COLORS: Record<string, string> = {
  '0': '#475569', // Black -> slate-600 for visibility
  '1': '#2563eb', // Dark Blue
  '2': '#16a34a', // Dark Green
  '3': '#0891b2', // Dark Aqua
  '4': '#dc2626', // Dark Red
  '5': '#9333ea', // Dark Purple
  '6': '#f59e0b', // Gold
  '7': '#94a3b8', // Gray
  '8': '#64748b', // Dark Gray
  '9': '#60a5fa', // Blue
  'a': '#4ade80', // Green
  'b': '#38bdf8', // Aqua
  'c': '#f87171', // Red
  'd': '#f472b6', // Light Purple
  'e': '#fde047', // Yellow
  'f': '#f8fafc', // White
};

function parseMinecraftColorCodes(text: string): React.ReactNode {
  if (!text.includes('§')) return text;

  const parts = text.split(/(§[0-9a-fk-or])/gi);
  let currentColor = '#f8fafc';
  let isBold = false;
  let isItalic = false;

  return parts.map((part, index) => {
    if (part.startsWith('§')) {
      const code = part.charAt(1).toLowerCase();
      if (MC_COLORS[code]) {
        currentColor = MC_COLORS[code];
      } else if (code === 'l') {
        isBold = true;
      } else if (code === 'o') {
        isItalic = true;
      } else if (code === 'r') {
        currentColor = '#f8fafc';
        isBold = false;
        isItalic = false;
      }
      return null;
    }
    return (
      <span
        key={index}
        style={{
          color: currentColor,
          fontWeight: isBold ? 'bold' : 'normal',
          fontStyle: isItalic ? 'italic' : 'normal',
        }}
      >
        {part}
      </span>
    );
  });
}

export const MinecraftChatMessage: React.FC<MinecraftChatMessageProps> = ({
  message,
  showTimestamp = true,
}) => {
  let rawText = message.message || '';

  // Clean out Unicode replacement diamonds frequently sent by custom server resource packs
  rawText = rawText.replace(/[\uFFFD\u25C6\u25C7]/g, '').trim();

  // If text has § color codes
  if (rawText.includes('§')) {
    return (
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-slate-800/60 rounded transition">
        {showTimestamp && (
          <span className="text-slate-500 text-[10px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text text-slate-100">{parseMinecraftColorCodes(rawText)}</span>
      </div>
    );
  }

  // 1. Death Messages (Red/Rose)
  const deathKeywords = [
    'was slain by',
    'was obliterated',
    'blew up',
    'fell from a great height',
    'has died',
    'burned to death',
    'drowned',
    'suffocated',
    'hit the ground too hard',
    'fell off a scaffold',
    'was shot by',
    'starved to death',
    'experienced kinetic energy',
    'was pummeled by',
  ];

  const isDeath = deathKeywords.some((k) => rawText.toLowerCase().includes(k));
  if (isDeath) {
    const formattedDeath = rawText.replace(/(using\s+)(.+)/i, '$1<CYAN>$2</CYAN>');
    const parts = formattedDeath.split(/(<CYAN>.*?<\/CYAN>)/g);

    return (
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-rose-950/40 rounded transition text-rose-400 font-medium">
        {showTimestamp && (
          <span className="text-slate-500 text-[10px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text">
          <span className="mr-1 text-rose-400 font-bold">☠</span>
          {parts.map((p, i) => {
            if (p.startsWith('<CYAN>')) {
              const weapon = p.replace('<CYAN>', '').replace('</CYAN>', '');
              return (
                <span key={i} className="text-cyan-300 font-black underline">
                  {weapon}
                </span>
              );
            }
            return <span key={i}>{p}</span>;
          })}
        </span>
      </div>
    );
  }

  // 2. Economy & Orders (Green with Amber amounts)
  const isEconomy = /You sold|has ordered|ordered|balance|\$[0-9,]+/i.test(rawText);
  if (isEconomy) {
    const parts = rawText.split(/(\$[0-9,]+(?:\/each)?)/g);
    return (
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-emerald-950/40 rounded transition text-emerald-300 font-medium">
        {showTimestamp && (
          <span className="text-slate-500 text-[10px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text">
          <span className="mr-1 text-amber-400 font-bold">$</span>
          {parts.map((p, i) => {
            if (p.startsWith('$')) {
              return (
                <span key={i} className="text-amber-300 font-black">
                  {p}
                </span>
              );
            }
            return <span key={i}>{p}</span>;
          })}
        </span>
      </div>
    );
  }

  // 3. Vault & System Actions (Amber/Gold)
  const isVault = /Successfully (?:opened|closed) vault|teleported|warp/i.test(rawText);
  if (isVault) {
    return (
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-amber-950/40 rounded transition text-amber-300 font-medium">
        {showTimestamp && (
          <span className="text-slate-500 text-[10px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text">
          <span className="mr-1">📦</span>
          {rawText}
        </span>
      </div>
    );
  }

  // 4. VistaAFK / System Bot Events (Emerald Green)
  if (message.sender === 'VistaAFK' || message.sender === 'AutoCommand') {
    return (
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-emerald-950/40 rounded transition text-emerald-400 font-medium">
        {showTimestamp && (
          <span className="text-slate-500 text-[10px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text font-bold">{rawText}</span>
      </div>
    );
  }

  // 5. Player Chat with Rank Badges
  // Matches: "TITAN ANK_PATRICK ▶ Check Ank2 orders" or "EMPEROR PluhWalkk ▶ Selling..."
  const rankMatch = rawText.match(/^(?:\[?(TITAN|KING|CHAMPION|KNIGHT|EMPEROR|MEMBER|VIP\+?|MVP\+?|ADMIN|OWNER|MOD)\]?)\s+([a-zA-Z0-9_]{3,16})\s*(?:▶|>|:)\s*(.*)$/i);
  if (rankMatch) {
    const rank = rankMatch[1].toUpperCase();
    const username = rankMatch[2];
    const chatContent = rankMatch[3];
    const rankColor = RANK_COLORS[rank] || '#94a3b8';

    return (
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-slate-800/60 rounded transition">
        {showTimestamp && (
          <span className="text-slate-500 text-[10px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <div className="break-words select-text text-slate-200">
          <span
            className="font-black mr-1.5 px-1.5 py-0.5 rounded text-[11px]"
            style={{
              color: rankColor,
              backgroundColor: `${rankColor}20`,
              border: `1px solid ${rankColor}50`,
            }}
          >
            {rank}
          </span>
          <span className="mr-1.5 font-bold text-white">
            {username}
          </span>
          <span className="text-slate-500 mr-1.5 font-bold">▶</span>
          <span className="text-slate-200 font-normal">{chatContent}</span>
        </div>
      </div>
    );
  }

  // 6. Default Server / Player Message
  const isServer = message.sender === 'Server';
  const senderColor = isServer ? '#f59e0b' : RANK_COLORS[message.sender.toUpperCase()] || '#38bdf8';

  return (
    <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-slate-800/60 rounded transition text-slate-200">
      {showTimestamp && (
        <span className="text-slate-500 text-[10px] shrink-0 select-none">
          [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
        </span>
      )}
      <div className="break-words select-text">
        {message.sender && (
          <span
            className="font-bold mr-1.5"
            style={{ color: senderColor }}
          >
            {message.isSystem ? `[${message.sender}]` : `<${message.sender}>`}
          </span>
        )}
        <span className="text-slate-200 font-normal">{rawText}</span>
      </div>
    </div>
  );
};

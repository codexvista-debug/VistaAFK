'use client';

import React from 'react';
import { ChatMessage } from '../types';

interface MinecraftChatMessageProps {
  message: ChatMessage;
  showTimestamp?: boolean;
}

// Light-mode optimized high-contrast Minecraft Rank colors
const LIGHT_RANK_COLORS: Record<string, string> = {
  TITAN: '#0284c7',     // Sky 600
  KING: '#d97706',      // Amber 600
  CHAMPION: '#b45309',  // Amber 700
  KNIGHT: '#2563eb',    // Blue 600
  EMPEROR: '#7c3aed',   // Purple 600
  MEMBER: '#475569',    // Slate 600
  VIP: '#059669',       // Emerald 600
  'VIP+': '#059669',
  MVP: '#0891b2',       // Cyan 600
  'MVP+': '#0284c7',
  ADMIN: '#dc2626',     // Red 600
  OWNER: '#dc2626',
  MOD: '#059669',
};

// Light-mode Minecraft Color Codes
const LIGHT_MC_COLORS: Record<string, string> = {
  '0': '#0f172a', // Black -> slate-900
  '1': '#1e3a8a', // Dark Blue
  '2': '#15803d', // Dark Green
  '3': '#0e7490', // Dark Aqua
  '4': '#b91c1c', // Dark Red
  '5': '#6b21a8', // Dark Purple
  '6': '#d97706', // Gold
  '7': '#64748b', // Gray
  '8': '#334155', // Dark Gray
  '9': '#2563eb', // Blue
  'a': '#16a34a', // Green
  'b': '#0284c7', // Aqua
  'c': '#dc2626', // Red
  'd': '#c026d3', // Light Purple
  'e': '#ca8a04', // Yellow
  'f': '#0f172a', // White -> dark slate on light mode
};

function parseLightMinecraftColorCodes(text: string): React.ReactNode {
  if (!text.includes('§')) return text;

  const parts = text.split(/(§[0-9a-fk-or])/gi);
  let currentColor = '#0f172a';
  let isBold = false;
  let isItalic = false;

  return parts.map((part, index) => {
    if (part.startsWith('§')) {
      const code = part.charAt(1).toLowerCase();
      if (LIGHT_MC_COLORS[code]) {
        currentColor = LIGHT_MC_COLORS[code];
      } else if (code === 'l') {
        isBold = true;
      } else if (code === 'o') {
        isItalic = true;
      } else if (code === 'r') {
        currentColor = '#0f172a';
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
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-slate-100/70 rounded transition">
        {showTimestamp && (
          <span className="text-slate-400 text-[10px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text">{parseLightMinecraftColorCodes(rawText)}</span>
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
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-rose-50/50 rounded transition text-rose-600 font-medium">
        {showTimestamp && (
          <span className="text-slate-400 text-[10px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text">
          <span className="mr-1 text-rose-500 font-bold">☠</span>
          {parts.map((p, i) => {
            if (p.startsWith('<CYAN>')) {
              const weapon = p.replace('<CYAN>', '').replace('</CYAN>', '');
              return (
                <span key={i} className="text-sky-600 font-black underline">
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
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-emerald-50/50 rounded transition text-emerald-700 font-medium">
        {showTimestamp && (
          <span className="text-slate-400 text-[10px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text">
          <span className="mr-1 text-amber-600 font-bold">$</span>
          {parts.map((p, i) => {
            if (p.startsWith('$')) {
              return (
                <span key={i} className="text-amber-600 font-black">
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
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-amber-50/50 rounded transition text-amber-700 font-medium">
        {showTimestamp && (
          <span className="text-slate-400 text-[10px] shrink-0 select-none">
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
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-emerald-50/50 rounded transition text-emerald-700 font-medium">
        {showTimestamp && (
          <span className="text-slate-400 text-[10px] shrink-0 select-none">
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
    const rankColor = LIGHT_RANK_COLORS[rank] || '#475569';

    return (
      <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-slate-100/70 rounded transition">
        {showTimestamp && (
          <span className="text-slate-400 text-[10px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <div className="break-words select-text text-slate-800">
          <span
            className="font-black mr-1 px-1.5 py-0.5 rounded text-[11px]"
            style={{
              color: rankColor,
              backgroundColor: `${rankColor}15`,
              border: `1px solid ${rankColor}30`,
            }}
          >
            {rank}
          </span>
          <span className="mr-1 font-bold text-slate-900">
            {username}
          </span>
          <span className="text-slate-400 mr-1.5 font-bold">▶</span>
          <span className="text-slate-800 font-medium">{chatContent}</span>
        </div>
      </div>
    );
  }

  // 6. Default Server / Player Message
  const isServer = message.sender === 'Server';
  const senderColor = isServer ? '#d97706' : LIGHT_RANK_COLORS[message.sender.toUpperCase()] || '#0284c7';

  return (
    <div className="font-mono text-xs leading-normal flex items-start space-x-1.5 py-1 px-1.5 hover:bg-slate-100/70 rounded transition text-slate-800">
      {showTimestamp && (
        <span className="text-slate-400 text-[10px] shrink-0 select-none">
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
        <span className="text-slate-800 font-medium">{rawText}</span>
      </div>
    </div>
  );
};

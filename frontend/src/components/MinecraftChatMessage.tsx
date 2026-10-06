'use client';

import React from 'react';
import { ChatMessage } from '../types';

interface MinecraftChatMessageProps {
  message: ChatMessage;
  showTimestamp?: boolean;
}

// Authentic Minecraft Color Map
const MC_COLOR_CODES: Record<string, string> = {
  '0': '#000000', // Black
  '1': '#0000AA', // Dark Blue
  '2': '#00AA00', // Dark Green
  '3': '#00AAAA', // Dark Aqua
  '4': '#AA0000', // Dark Red
  '5': '#AA00AA', // Dark Purple
  '6': '#FFAA00', // Gold
  '7': '#AAAAAA', // Gray
  '8': '#555555', // Dark Gray
  '9': '#5555FF', // Blue
  'a': '#55FF55', // Green
  'b': '#55FFFF', // Aqua
  'c': '#FF5555', // Red
  'd': '#FF55FF', // Light Purple
  'e': '#FFFF55', // Yellow
  'f': '#FFFFFF', // White
};

const RANK_COLORS: Record<string, string> = {
  TITAN: '#55FFFF',     // Aqua
  KING: '#FFAA00',      // Gold
  CHAMPION: '#FFAA00',  // Gold
  KNIGHT: '#5555FF',    // Blue
  EMPEROR: '#AA00AA',   // Dark Purple
  MEMBER: '#AAAAAA',    // Gray
  VIP: '#55FF55',       // Green
  'VIP+': '#55FF55',
  MVP: '#00AAAA',       // Dark Aqua
  'MVP+': '#55FFFF',
  ADMIN: '#FF5555',     // Red
  OWNER: '#FF5555',
  MOD: '#55FF55',
};

// Parse standard Minecraft formatting codes (§a, §c, etc.)
function parseMinecraftColorCodes(text: string): React.ReactNode {
  if (!text.includes('§')) {
    return text;
  }

  const parts = text.split(/(§[0-9a-fk-or])/gi);
  let currentColor = '#FFFFFF';
  let isBold = false;
  let isItalic = false;

  return parts.map((part, index) => {
    if (part.startsWith('§')) {
      const code = part.charAt(1).toLowerCase();
      if (MC_COLOR_CODES[code]) {
        currentColor = MC_COLOR_CODES[code];
      } else if (code === 'l') {
        isBold = true;
      } else if (code === 'o') {
        isItalic = true;
      } else if (code === 'r') {
        currentColor = '#FFFFFF';
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

  // Clean out Unicode replacement characters and weird diamonds often sent by custom resource packs
  rawText = rawText.replace(/[\uFFFD\u25C6\u25C7]/g, '').trim();

  // If text has Minecraft § codes, parse directly
  if (rawText.includes('§')) {
    return (
      <div className="font-minecraft text-[13px] leading-tight flex items-start space-x-1.5 py-0.5 tracking-wide">
        {showTimestamp && (
          <span className="text-slate-500 text-[11px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text">{parseMinecraftColorCodes(rawText)}</span>
      </div>
    );
  }

  // 1. Detect Death Messages (Red with Aqua weapons / white victims)
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
    // Format weapon/killer in cyan
    const formattedDeath = rawText.replace(/(using\s+)(.+)/i, '$1<CYAN>$2</CYAN>');
    const parts = formattedDeath.split(/(<CYAN>.*?<\/CYAN>)/g);

    return (
      <div className="font-minecraft text-[13px] leading-tight flex items-start space-x-1.5 py-0.5 tracking-wide text-[#FF5555]">
        {showTimestamp && (
          <span className="text-slate-500 text-[11px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text">
          <span className="mr-1">☠</span>
          {parts.map((p, i) => {
            if (p.startsWith('<CYAN>')) {
              const weapon = p.replace('<CYAN>', '').replace('</CYAN>', '');
              return (
                <span key={i} className="text-[#55FFFF] font-bold">
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

  // 2. Economy & Orders (Green with Gold amounts)
  const isEconomy = /You sold|has ordered|ordered|balance|\$[0-9,]+/i.test(rawText);
  if (isEconomy) {
    const parts = rawText.split(/(\$[0-9,]+(?:\/each)?)/g);
    return (
      <div className="font-minecraft text-[13px] leading-tight flex items-start space-x-1.5 py-0.5 tracking-wide text-[#55FF55]">
        {showTimestamp && (
          <span className="text-slate-500 text-[11px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text">
          <span className="mr-1 text-[#FFAA00]">$</span>
          {parts.map((p, i) => {
            if (p.startsWith('$')) {
              return (
                <span key={i} className="text-[#FFAA00] font-bold">
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

  // 3. Vault & System Actions (Orange/Gold)
  const isVault = /Successfully (?:opened|closed) vault|teleported|warp/i.test(rawText);
  if (isVault) {
    return (
      <div className="font-minecraft text-[13px] leading-tight flex items-start space-x-1.5 py-0.5 tracking-wide text-[#FFAA00]">
        {showTimestamp && (
          <span className="text-slate-500 text-[11px] shrink-0 select-none">
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

  // 4. VistaAFK / System Bot Events (Green / Lime)
  if (message.sender === 'VistaAFK' || message.sender === 'AutoCommand') {
    return (
      <div className="font-minecraft text-[13px] leading-tight flex items-start space-x-1.5 py-0.5 tracking-wide text-[#55FF55]">
        {showTimestamp && (
          <span className="text-slate-500 text-[11px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <span className="break-words select-text">{rawText}</span>
      </div>
    );
  }

  // 5. Player Chat with Rank Badges
  // Matches: "TITAN ANK_PATRICK ▶ Check Ank2 orders" or "[KING] Sophie_Drain: hello"
  const rankMatch = rawText.match(/^(?:\[?(TITAN|KING|CHAMPION|KNIGHT|EMPEROR|MEMBER|VIP\+?|MVP\+?|ADMIN|OWNER|MOD)\]?)\s+([a-zA-Z0-9_]{3,16})\s*(?:▶|>|:)\s*(.*)$/i);
  if (rankMatch) {
    const rank = rankMatch[1].toUpperCase();
    const username = rankMatch[2];
    const chatContent = rankMatch[3];
    const rankColor = RANK_COLORS[rank] || '#AAAAAA';

    return (
      <div className="font-minecraft text-[13px] leading-tight flex items-start space-x-1.5 py-0.5 tracking-wide">
        {showTimestamp && (
          <span className="text-slate-500 text-[11px] shrink-0 select-none">
            [{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
          </span>
        )}
        <div className="break-words select-text text-white">
          <span
            className="font-bold mr-1.5"
            style={{ color: rankColor }}
          >
            {rank}
          </span>
          <span className="mr-1.5 font-bold" style={{ color: rankColor === '#AAAAAA' ? '#FFFFFF' : rankColor }}>
            {username}
          </span>
          <span className="text-[#AAAAAA] mr-1.5 font-bold">▶</span>
          <span className="text-[#FFFFFF]">{chatContent}</span>
        </div>
      </div>
    );
  }

  // 6. Default Player / Server Chat
  const senderColor =
    message.sender === 'Server'
      ? '#FFAA00'
      : RANK_COLORS[message.sender.toUpperCase()] || '#55FFFF';

  return (
    <div className="font-minecraft text-[13px] leading-tight flex items-start space-x-1.5 py-0.5 tracking-wide text-white">
      {showTimestamp && (
        <span className="text-slate-500 text-[11px] shrink-0 select-none">
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
        <span className="text-[#FFFFFF]">{rawText}</span>
      </div>
    </div>
  );
};

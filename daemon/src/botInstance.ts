import mineflayer, { Bot } from 'mineflayer';
import { randomUUID } from 'node:crypto';
import { SocksProxyAgent } from 'socks-proxy-agent';
// @ts-ignore
import nbt from 'prismarine-nbt';
import { BotConfig, BotTelemetry, ChatMessage, RawChatPacketInfo, ActivityLog, InventoryItem, ItemEnchantment, MinimapPlayer, MinimapMob, TerrainGridData, BotGuiWindow } from './types.js';
import { sampleTerrainGrid } from './terrainMapper.js';
import path from 'path';

const BEDROCK_PLAYER_CONTAINERS = new Set(['armor', 'hotbar_and_inventory', 'hotbar', 'inventory', 'offhand']);

export interface BotInstanceCallbacks {
  onTelemetryUpdate: (telemetry: BotTelemetry) => void;
  onChatMessage: (message: ChatMessage) => void;
  onActivityLog?: (log: ActivityLog) => void;
  onNotification: (level: 'info' | 'warn' | 'error' | 'success', message: string, botId?: string) => void;
  onConfigUpdated?: (config: BotConfig) => void;
}

function romanNumeral(num: number): string {
  const romanMap: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  let n = num;
  for (const [val, str] of romanMap) {
    while (n >= val) {
      result += str;
      n -= val;
    }
  }
  return result || String(num);
}

function formatEnchantName(rawId: string, lvl: number): string {
  const cleanId = String(rawId || '').replace(/^minecraft:/, '');
  const title = cleanId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  if (lvl > 1) {
    return `${title} ${romanNumeral(lvl)}`;
  }
  // Single-level max enchants like Mending, Infinity, Silk Touch, Flame
  if (['mending', 'flame', 'infinity', 'silk_touch', 'aqua_affinity', 'channeling', 'multishot', 'curse_of_binding', 'curse_of_vanishing'].includes(cleanId)) {
    return title;
  }
  return `${title} I`;
}

function parseEnchantmentsFromLore(lines: string[]): ItemEnchantment[] {
  const knownNames = new Set([
    'protection', 'fire_protection', 'feather_falling', 'blast_protection', 'projectile_protection',
    'respiration', 'aqua_affinity', 'thorns', 'depth_strider', 'frost_walker', 'sharpness', 'smite',
    'bane_of_arthropods', 'knockback', 'fire_aspect', 'looting', 'sweeping_edge', 'efficiency',
    'silk_touch', 'unbreaking', 'fortune', 'power', 'punch', 'flame', 'infinity', 'luck_of_the_sea',
    'lure', 'loyalty', 'impaling', 'riptide', 'channeling', 'multishot', 'quick_charge', 'piercing',
    'mending', 'soul_speed', 'swift_sneak', 'wind_burst', 'density', 'breach', 'binding_curse',
    'vanishing_curse', 'curse_of_binding', 'curse_of_vanishing', 'sweeping',
  ]);
  const romanLevels: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
  const found = new Map<string, ItemEnchantment>();

  for (const line of lines) {
    const match = line.replace(/§[0-9a-fk-orxghijpqstu]/gi, '').match(/^\s*([\w ]+?)\s+(X|IX|VIII|VII|VI|V|IV|III|II|I|\d+)\s*$/i);
    if (!match) continue;
    const name = match[1].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const rawLevel = match[2].toUpperCase();
    const level = romanLevels[rawLevel] || Number(rawLevel);
    if (!knownNames.has(name) || !Number.isFinite(level) || level < 1) continue;
    found.set(name, { name, level, displayName: formatEnchantName(name, level) });
  }

  return [...found.values()];
}

function cleanMinecraftJsonText(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') {
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        return cleanMinecraftJsonText(parsed);
      } catch (e) {}
    }
    return raw.replace(/§[0-9a-fk-orxghijpqstu]/gi, '').trim();
  }
  if (typeof raw === 'object') {
    let out = '';
    if (raw.text) out += raw.text;
    if (Array.isArray(raw.extra)) {
      for (const ex of raw.extra) {
        out += cleanMinecraftJsonText(ex);
      }
    }
    if (raw.value) {
      if (typeof raw.value === 'string') out += raw.value;
      else if (Array.isArray(raw.value)) out += raw.value.map(cleanMinecraftJsonText).join(' ');
    }
    return out.replace(/§[0-9a-fk-orxghijpqstu]/gi, '').trim();
  }
  return String(raw).replace(/§[0-9a-fk-orxghijpqstu]/gi, '').trim();
}

function extractBedrockItemData(item: any): { customName?: string; lore?: string[] } {
  if (!item) return {};

  let customName: string | undefined;
  let lore: string[] = [];

  const candidates = [
    item.extra?.nbt?.nbt,
    item.extra?.nbt,
    item.extra?.value,
    item.extra,
    item.nbt?.nbt,
    item.nbt,
  ];

  for (const c of candidates) {
    if (c && typeof c === 'object') {
      let simplified: any = null;
      if (c.type === 'compound') {
        try {
          simplified = nbt.simplify(c);
        } catch (e) {}
      } else if (c.value && typeof c.value === 'object') {
        try {
          simplified = nbt.simplify(c);
        } catch (e) {
          try {
            simplified = nbt.simplify({ type: 'compound', value: c.value });
          } catch (e2) {
            simplified = c.value;
          }
        }
      } else if (c.display || c.Name || c.Lore || c.display_name) {
        simplified = c;
      }

      if (simplified && typeof simplified === 'object') {
        const display = simplified.display || simplified;
        const rawName = display.Name || display.name || simplified.display_name || simplified.custom_name;
        if (rawName && !customName) {
          const nameVal = typeof rawName === 'object' && rawName.value ? rawName.value : rawName;
          const cleaned = cleanMinecraftJsonText(nameVal);
          if (cleaned) customName = cleaned;
        }

        const rawLore = display.Lore || display.lore;
        const loreList = Array.isArray(rawLore)
          ? rawLore
          : (rawLore && typeof rawLore === 'object' && Array.isArray(rawLore.value) ? rawLore.value : []);

        if (loreList.length > 0 && lore.length === 0) {
          lore = loreList
            .map((line: any) => {
              const lineVal = typeof line === 'object' && line.value !== undefined ? line.value : line;
              return cleanMinecraftJsonText(lineVal);
            })
            .filter(Boolean);
        }
      }
    }
  }

  // Fallback for raw prismarine structures
  if (!customName || lore.length === 0) {
    const rawExtra = item?.extra?.value || item?.extra || {};
    const displayVal = rawExtra?.display?.value || rawExtra?.display || {};
    if (!customName) {
      const nameVal = displayVal?.Name?.value || displayVal?.Name || rawExtra?.display_name;
      if (nameVal) {
        const cleaned = cleanMinecraftJsonText(nameVal);
        if (cleaned) customName = cleaned;
      }
    }
    if (lore.length === 0) {
      const loreVal = displayVal?.Lore?.value?.value || displayVal?.Lore?.value || displayVal?.Lore;
      if (Array.isArray(loreVal)) {
        lore = loreVal.map((line: any) => cleanMinecraftJsonText(line)).filter(Boolean);
      }
    }
  }

  return {
    customName: customName || undefined,
    lore: lore.length ? lore : undefined,
  };
}

function serializeGuiWindow(window: any): BotGuiWindow | null {
  if (!window || !Array.isArray(window.slots)) return null;
  const slots: Array<InventoryItem | null> = window.slots.map((item: any, slot: number) => {
    if (!item) return null;
    const lore = Array.isArray(item.customLore)
      ? item.customLore.map((line: any) => cleanMinecraftJsonText(line)).filter(Boolean)
      : [];
    return {
      slot,
      name: String(item.name || 'unknown'),
      displayName: cleanMinecraftJsonText(item.customName) || cleanMinecraftJsonText(item.displayName) || String(item.name || 'Unknown item'),
      count: Number(item.count) || 1,
      maxStackSize: Number(item.stackSize) || undefined,
      customName: cleanMinecraftJsonText(item.customName) || undefined,
      lore: lore.length ? lore : undefined,
    };
  });
  const numericOrUndefined = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : undefined;
  return {
    id: numericOrUndefined(window.id) ?? 0,
    title: cleanMinecraftJsonText(window.title) || 'Server Menu',
    type: String(window.type || 'container'),
    slots,
    inventoryStart: numericOrUndefined(window.inventoryStart),
    inventoryEnd: numericOrUndefined(window.inventoryEnd),
  };
}

function parseBedrockForm(packet: any): BotGuiWindow | null {
  const formId = Number(packet?.form_id);
  if (!Number.isInteger(formId)) return null;

  let form: any;
  try {
    form = typeof packet.data === 'string' ? JSON.parse(packet.data) : packet.data;
  } catch {
    return null;
  }
  if (!form || typeof form !== 'object' || Array.isArray(form)) return null;

  const formType = form.type === 'form' || form.type === 'simple_form'
    ? 'simple'
    : form.type === 'modal'
      ? 'modal'
      : form.type === 'custom_form'
        ? 'custom'
        : 'unknown';
  const maxText = (value: unknown, fallback = '') => typeof value === 'string' ? value.slice(0, 2000) : fallback;
  const formButtons = formType === 'simple' && Array.isArray(form.buttons)
    ? form.buttons.slice(0, 64).map((button: any) => ({
      text: maxText(button?.text, 'Select'),
      image: typeof button?.image?.data === 'string' ? button.image.data.slice(0, 1000) : undefined,
    }))
    : undefined;
  const supportedFields = new Set(['label', 'input', 'toggle', 'slider', 'step_slider', 'dropdown']);
  const formElements = formType === 'custom' && Array.isArray(form.content)
    ? form.content.slice(0, 64).filter((element: any) => supportedFields.has(element?.type)).map((element: any) => ({
      type: element.type,
      text: maxText(element?.text),
      placeholder: maxText(element?.placeholder, ''),
      default: typeof element?.default === 'string' || typeof element?.default === 'number' || typeof element?.default === 'boolean' ? element.default : undefined,
      min: Number.isFinite(Number(element?.min)) ? Number(element.min) : undefined,
      max: Number.isFinite(Number(element?.max)) ? Number(element.max) : undefined,
      step: Number.isFinite(Number(element?.step)) ? Number(element.step) : undefined,
      options: Array.isArray(element?.options) ? element.options.slice(0, 64).map((option: unknown) => maxText(option)) : Array.isArray(element?.steps) ? element.steps.slice(0, 64).map((option: unknown) => maxText(option)) : undefined,
    }))
    : undefined;

  return {
    id: formId,
    title: maxText(form.title, 'Server Menu') || 'Server Menu',
    type: 'bedrock_form',
    kind: 'form',
    formType,
    formContent: maxText(form.content),
    formButtons,
    formButton1: maxText(form.button1, 'Yes'),
    formButton2: maxText(form.button2, 'No'),
    formElements,
    slots: [],
  };
}

function parseMinecraftChat(raw: any): string {
  if (!raw) return 'Unknown reason';
  if (typeof raw === 'string') {
    if (raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        return parseMinecraftChat(parsed);
      } catch {
        return raw;
      }
    }
    return raw;
  }
  // Check Bedrock rawtext format
  if (Array.isArray(raw.rawtext)) {
    let text = '';
    for (const part of raw.rawtext) {
      if (typeof part === 'string') {
        text += part;
      } else if (part && typeof part === 'object') {
        if (part.text) text += part.text;
        else if (part.translate) {
          text += part.translate;
          if (Array.isArray(part.with)) text += ' ' + part.with.join(' ');
        }
      }
    }
    if (text.trim()) {
      return text.replace(/\n+/g, ' ').trim();
    }
  }
  // Check NBT compound format
  if (raw.type === 'compound' && raw.value) {
    let text = '';
    if (raw.value.text?.value) text += raw.value.text.value;
    if (raw.value.extra?.value?.value) {
      const extraList = raw.value.extra.value.value;
      for (const item of extraList) {
        if (Array.isArray(item)) {
          for (const sub of item) {
            if (sub.text?.value) text += sub.text.value;
          }
        } else if (item.text?.value) {
          text += item.text.value;
        }
      }
    }
    return text.replace(/\n+/g, ' ').trim() || JSON.stringify(raw);
  }
  // Standard Mojang Chat component or extra array
  if (raw.text !== undefined || raw.extra) {
    let text = raw.text || '';
    if (Array.isArray(raw.extra)) {
      for (const part of raw.extra) {
        if (typeof part === 'string') {
          text += part;
        } else if (part && typeof part === 'object') {
          text += part.text || '';
        }
      }
    }
    if (text.trim()) {
      return text.replace(/\n+/g, ' ').trim();
    }
  }
  return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
}

function parseBedrockChatPacket(packet: any, usernameForIdentity?: (xuid: string, platformChatId: string) => string | undefined): Pick<ChatMessage, 'sender' | 'message' | 'isSystem' | 'raw'> {
  const type = String(packet?.type || 'system');
  const source = typeof packet?.source_name === 'string' ? packet.source_name.trim() : '';
  const cleanSource = cleanBedrockFormatting(source);
  const xuid = normalizeBedrockIdentity(packet?.xuid);
  const platformChatId = normalizeBedrockIdentity(packet?.platform_chat_id);
  const rawMessage = typeof packet?.message === 'string' ? packet.message : '';
  const parameters = Array.isArray(packet?.parameters)
    ? packet.parameters.map((value: unknown) => String(value ?? ''))
    : [];

  let sender = source || 'Server';
  let message = rawMessage;
  let translatedPlayerChat = false;

  // Bedrock servers often send JSON components (rawtext) in the message field
  if (rawMessage.startsWith('{') || rawMessage.startsWith('[') || type.startsWith('json')) {
    try {
      const extracted = parseMinecraftChat(rawMessage);
      if (extracted && extracted !== 'Unknown reason') {
        message = extracted;
      }
    } catch (_) {}
  }

  // Bedrock servers commonly encode player chat or popups with translation/parameter arrays
  if (parameters.length > 0) {
    if ((rawMessage === 'chat.type.text' || rawMessage === 'chat.type.emote') && parameters.length >= 2) {
      sender = parameters[0] || sender;
      message = parameters.slice(1).join(' ');
      translatedPlayerChat = true;
    } else if (rawMessage === 'commands.message.display.incoming' && parameters.length >= 2) {
      sender = parameters[0] || sender;
      message = `whispers to you: ${parameters.slice(1).join(' ')}`;
      translatedPlayerChat = true;
    } else if (rawMessage === 'commands.message.display.outgoing' && parameters.length >= 2) {
      sender = 'You';
      message = `whisper to ${parameters[0]}: ${parameters.slice(1).join(' ')}`;
      translatedPlayerChat = true;
    } else {
      let formatted = rawMessage;
      for (let i = 0; i < parameters.length; i++) {
        formatted = formatted.replace(new RegExp(`%${i + 1}\\$s|%${i + 1}`, 'g'), parameters[i]);
        formatted = formatted.replace('%s', parameters[i]);
      }
      if (formatted !== rawMessage) {
        message = formatted;
      } else if (rawMessage) {
        message = `${rawMessage}: ${parameters.join(' ')}`.trim();
      } else {
        message = parameters.join(' ').trim();
      }
    }
  }

  // Preserve the actual chat text for regular Bedrock chat/whisper packets.
  const isPopupOrTip = type === 'popup' || type === 'tip' || type === 'jukebox_popup';
  let isPlayerChat = !isPopupOrTip && (translatedPlayerChat || type === 'chat' || type === 'whisper' || type === 'announcement' || Boolean(xuid));
  if (isPopupOrTip && (!sender || sender === source)) sender = 'Server';
  if (!message && parameters.length) message = parameters.join(' ');
  if (!message) message = ' '; // Keep an otherwise valid empty chat event visible.

  // Some server chat formats send the rank as source_name and the text as
  // message, omitting the actual gamertag from the rendered line. Bedrock's
  // player_list records map that packet XUID back to the player's username.
  let username = usernameForIdentity?.(xuid, platformChatId);
  const rankPattern = '(?:TITAN|KING|CHAMPION|KNIGHT|EMPEROR|OVERLORD\\+{0,2}|LORD|JESTER|MEMBER|VIP\\+?|MVP\\+?|ADMIN|OWNER|MOD)';
  const rankOnly = new RegExp(`^\\[?${rankPattern}\\]?$`, 'i');
  const rankMessage = new RegExp(`^\\[?(${rankPattern})\\]?\\s*(?:▶|>|:)\\s*(.*)$`, 'i');
  const rankChatWithPlayerRegex = new RegExp(`^\\[?(${rankPattern})\\]?\\s+([a-zA-Z0-9_]{3,16})(?:\\s+\\[[^\\]]{1,12}\\])?\\s*(?:▶|>|:)\\s*(.*)$`, 'i');
  const standardPlayerChatRegex = /^<([a-zA-Z0-9_]{3,16})>\s*(.*)$/;

  const cleanSender = cleanBedrockFormatting(sender);
  const cleanMessage = cleanBedrockFormatting(message);

  // Check if message itself contains player chat (e.g. FreshSMP: "MEMBER PlayerName ▶ message")
  const playerRankMatch = cleanMessage.match(rankChatWithPlayerRegex);
  const standardMatch = cleanMessage.match(standardPlayerChatRegex);

  if (playerRankMatch) {
    const extractedUser = playerRankMatch[2];
    if (!username) username = extractedUser;
    if (sender === 'Server' || !sender || rankOnly.test(cleanSender)) {
      sender = extractedUser;
    }
    isPlayerChat = true;
  } else if (standardMatch) {
    const extractedUser = standardMatch[1];
    if (!username) username = extractedUser;
    if (sender === 'Server' || !sender) {
      sender = extractedUser;
    }
    isPlayerChat = true;
  } else {
    const knownRank = rankOnly.test(cleanSource) ? cleanSource : (rankOnly.test(cleanSender) ? cleanSender : null);
    const formattedRankMessage = cleanMessage.match(rankMessage);
    if (isPlayerChat && username && (knownRank || formattedRankMessage)) {
      const rank = knownRank || formattedRankMessage?.[1] || '';
      const body = knownRank ? cleanMessage.replace(/^\s*(?:▶|>|:)\s*/, '') : (formattedRankMessage?.[2] || '');
      sender = username;
      message = `${rank} ${username} ▶ ${body}`.trim();
    }
  }

  const raw: RawChatPacketInfo = {
    type,
    source_name: source || (username ? username : undefined),
    xuid: xuid || undefined,
    platform_chat_id: platformChatId || undefined,
    raw_message: rawMessage || undefined,
    parameters: parameters.length ? parameters : undefined,
    resolved_username: username || undefined,
    filtered_message: typeof packet?.filtered_message === 'string' ? packet.filtered_message : undefined,
  };

  return {
    sender: sender || 'Server',
    message,
    isSystem: !isPlayerChat,
    raw,
  };
}

function cleanBedrockFormatting(value: string): string {
  return value
    .replace(/§[0-9a-fk-orxghijpqstu]/gi, '')
    .replace(/§/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function normalizeBedrockIdentity(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || /^0+$/.test(normalized)) return '';
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, '') : normalized;
}

function pingBedrockJsp(host: string, port: number, timeoutMs = 2500): Promise<{ version?: string; motd?: string; protocol?: string } | null> {
  return new Promise((resolve) => {
    let resolved = false;
    let timer: NodeJS.Timeout | null = null;
    let rakClient: any = null;
    try {
      const jspRaknet = (eval('require'))('jsp-raknet');
      rakClient = new jspRaknet.Client(host, port);
      timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { rakClient?.close(); } catch (_) {}
          resolve(null);
        }
      }, timeoutMs);
      rakClient.ping((data: any) => {
        if (resolved) return;
        resolved = true;
        if (timer) clearTimeout(timer);
        try { rakClient?.close(); } catch (_) {}
        try {
          const str = typeof data === 'string' ? data : (data?.toString?.() || '');
          const parts = str.split(';');
          if (parts.length >= 4) {
            resolve({ motd: parts[1], protocol: parts[2], version: parts[3] });
            return;
          }
        } catch (_) {}
        resolve(null);
      });
    } catch (_) {
      if (timer) clearTimeout(timer);
      resolve(null);
    }
  });
}

function getBedrockSupportedVersions(): { versions: Record<string, number>; currentVersion: string } {
  try {
    const opts = (eval('require'))('bedrock-protocol/src/options');
    if (opts && opts.Versions && opts.CURRENT_VERSION) {
      return { versions: opts.Versions, currentVersion: opts.CURRENT_VERSION };
    }
  } catch (_) {}
  try {
    const mcData = (eval('require'))('minecraft-data');
    const versions = Object.fromEntries(
      (mcData.versions?.bedrock || [])
        .filter((e: any) => e.releaseType === 'release')
        .map((e: any) => [e.minecraftVersion, e.version])
    );
    return { versions, currentVersion: Object.keys(versions)[0] || '1.26.51' };
  } catch (_) {}
  return { versions: { '1.26.51': 2193 }, currentVersion: '1.26.51' };
}

function resolveBedrockTargetVersion(
  userVersion?: string,
  pingProtocol?: string | number,
  pingVersion?: string
): { version: string; isFallback: boolean; note?: string } {
  const { versions, currentVersion } = getBedrockSupportedVersions();

  const trimmed = userVersion?.trim();
  const isAuto = !trimmed || trimmed.toLowerCase() === 'auto' || trimmed.toLowerCase() === 'default';

  // 1. If user explicitly specified a version
  if (!isAuto && trimmed) {
    let candidate = trimmed;
    if (candidate.startsWith('26.')) {
      candidate = `1.${candidate}`;
    }
    if (versions[candidate]) {
      return { version: candidate, isFallback: false };
    }
    if (versions[trimmed]) {
      return { version: trimmed, isFallback: false };
    }
    // Explicit override not supported by library; fall back safely rather than crash with "Unsupported version"
    return {
      version: currentVersion,
      isFallback: true,
      note: `Version "${trimmed}" is not directly supported by the Bedrock library; automatically using best verified working version ${currentVersion}.`,
    };
  }

  // 2. Auto-negotiation via server protocol number (e.g. 2193 -> '1.26.51')
  if (pingProtocol != null) {
    const protoNum = Number(pingProtocol);
    if (Number.isFinite(protoNum)) {
      const match = Object.keys(versions).find((v) => versions[v] === protoNum);
      if (match) {
        return { version: match, isFallback: false, note: `Auto-negotiated protocol ${protoNum} -> ${match}` };
      }
    }
  }

  // 3. Auto-negotiation via server version string
  if (pingVersion) {
    let candidate = pingVersion.trim();
    if (candidate.startsWith('26.')) {
      candidate = `1.${candidate}`;
    }
    if (versions[candidate]) {
      return { version: candidate, isFallback: false, note: `Auto-negotiated version string ${candidate}` };
    }
    if (versions[pingVersion]) {
      return { version: pingVersion, isFallback: false, note: `Auto-negotiated version string ${pingVersion}` };
    }
  }

  // 4. Default / Fallback to best working version (currentVersion, currently 1.26.51)
  return {
    version: currentVersion,
    isFallback: false,
    note: `Using best working Bedrock version (${currentVersion})`,
  };
}

export class BotInstance {
  public config: BotConfig;
  private bot: Bot | null = null;
  private callbacks: BotInstanceCallbacks;
  private isManuallyStopped: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private antiAfkInterval: NodeJS.Timeout | null = null;
  private antiAfkMovementTimeouts = new Set<NodeJS.Timeout>();
  private telemetryInterval: NodeJS.Timeout | null = null;
  private connectStartTime: number = 0;
  private currentStatus: BotTelemetry['status'] = 'offline';
  private statusMessage: string = 'Offline';
  private authCodeInfo?: BotTelemetry['authCodeInfo'];
  private reconnectAttempts: number = 0;
  private patrolInterval: NodeJS.Timeout | null = null;
  private isPatrolling: boolean = false;
  private movementTimeouts = new Map<'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', NodeJS.Timeout>();
  private movementTelemetryIntervals = new Map<'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', NodeJS.Timeout>();
  private manualMovementControls = new Set<'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak'>();
  private assistedJumpTimeouts = new Set<NodeJS.Timeout>();
  private farmingInterval: NodeJS.Timeout | null = null;
  private lastSwordEquipCheck: number = 0;
  private lastMobAttackLogTime: number = 0;
  private recurringCommandInterval: NodeJS.Timeout | null = null;
  private spawnCommandTimeout: NodeJS.Timeout | null = null;
  private lastChatText: string = '';
  private lastChatTimestamp: number = 0;
  private lastAntiAfkLogTime: number = 0;
  private isEatingFood: boolean = false;
  private lastJavaGuiWindowId: number | null = null;
  private customMaxHealth: number = 0;
  private terrainGridCache: TerrainGridData | null = null;
  private terrainGridSampledAt = 0;
  private terrainGridCenter: { x: number; y: number; z: number } | null = null;
  private recordedMaxHealth: number = 0;
  private bedrockClient: any = null;
  private bedrockPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  private bedrockHealth: number = 20;
  private bedrockMaxHealth: number = 20;
  private bedrockFood: number = 20;
  private bedrockXuidToUsername = new Map<string, string>();
  private bedrockPlatformChatIdToUsername = new Map<string, string>();
  private bedrockChatPacketStats = { text: 0, player: 0, system: 0 };
  private bedrockChatStatsLastLoggedAt = 0;
  private bedrockInventoryDiagnosticsLogged = false;
  private bedrockSelectedSlot: number = 0;
  private bedrockInventorySlots: any[] = Array(46).fill(null);
  private bedrockLastEatAt = 0;
  private bedrockHandshakeTimeout: NodeJS.Timeout | null = null;
  private bedrockTickSyncInterval: NodeJS.Timeout | null = null;
  private bedrockGuiWindow: BotGuiWindow | null = null;
  private bedrockItemNames = new Map<number, string>();
  private bedrockGuiRawSlots: any[] = [];
  private bedrockGuiContainer: { container_id: string; dynamic_container_id?: number } = { container_id: 'container' };
  private bedrockGuiRequestId = 0;
  private tokenFolder: string;
  private afkRewardsAvailable: number = 0;
  private recentSentMessages: Array<{ text: string; time: number }> = [];

  private recordSentChatMessage(text: string) {
    const clean = cleanBedrockFormatting(text).trim().toLowerCase();
    if (!clean) return;
    const now = Date.now();
    this.recentSentMessages = this.recentSentMessages.filter(m => now - m.time < 5000);
    this.recentSentMessages.push({ text: clean, time: now });
  }

  private isDuplicateSentMessage(sender: string, message: string): boolean {
    const clean = cleanBedrockFormatting(message).trim().toLowerCase();
    const cleanSender = cleanBedrockFormatting(sender).trim().toLowerCase();
    const myName = (this.config.name || '').trim().toLowerCase();
    if (!clean || (cleanSender !== myName && cleanSender !== 'you')) return false;
    const now = Date.now();
    this.recentSentMessages = this.recentSentMessages.filter(m => now - m.time < 5000);
    const index = this.recentSentMessages.findIndex(m => m.text === clean);
    if (index >= 0) {
      this.recentSentMessages.splice(index, 1);
      return true;
    }
    return false;
  }

  constructor(config: BotConfig, callbacks: BotInstanceCallbacks, tokenFolder?: string) {
    this.config = config;
    this.callbacks = callbacks;
    this.tokenFolder = tokenFolder || path.resolve(process.cwd(), 'tokens');
  }

  private lastActivityMsg: string = '';
  private lastActivityTime: number = 0;

  private emitActivity(type: ActivityLog['type'], message: string) {
    const now = Date.now();
    if (message === this.lastActivityMsg && (now - this.lastActivityTime) < 2500) {
      return;
    }
    this.lastActivityMsg = message;
    this.lastActivityTime = now;

    if (this.callbacks.onActivityLog) {
      this.callbacks.onActivityLog({
        id: Math.random().toString(36).substring(2, 9),
        botId: this.config.id,
        timestamp: now,
        type,
        message,
      });
    }
  }

  private formatUptime(seconds: number): string {
    if (!seconds || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  private getSessionUptime(): string {
    const sec = this.connectStartTime ? Math.floor((Date.now() - this.connectStartTime) / 1000) : 0;
    return this.formatUptime(sec);
  }


  public updateConfig(newConfig: BotConfig) {
    this.config = newConfig;
    if (this.bot && this.currentStatus === 'online') {
      this.setupAntiAfk();
      this.setupAutoCommands();
      this.setupFarming();
      this.emitTelemetry();
    }
  }

  public start() {
    if (this.bot || this.bedrockClient) {
      this.callbacks.onNotification('info', `Bot ${this.config.name} is already starting or running.`, this.config.id);
      return;
    }

    const isBedrock = this.config.edition === 'bedrock' || this.config.port === 19132;
    if (isBedrock) {
      if (this.config.edition !== 'bedrock') {
        this.config.edition = 'bedrock';
      }
      this.startBedrock();
      return;
    }

    this.isManuallyStopped = false;
    this.clearTimers();
    this.updateStatus('connecting', 'Connecting to Minecraft server...');
    this.emitActivity('connect', `Connecting to ${this.config.host}:${this.config.port || 25565}...`);

    const tokenFolder = this.tokenFolder;

    const options: mineflayer.BotOptions = {
      host: this.config.host,
      port: this.config.port || 25565,
      username: this.config.name,
      auth: this.config.authType === 'microsoft' ? 'microsoft' : 'offline',
      profilesFolder: tokenFolder,
      version: this.config.version || undefined,
      hideErrors: true,
      onMsaCode: (data: { user_code: string; verification_uri: string; expires_in: number }) => {
        this.authCodeInfo = {
          userCode: data.user_code,
          verificationUri: data.verification_uri,
          expiresIn: data.expires_in,
        };
        this.updateStatus('authenticating', `Device Code: ${data.user_code}`);
        this.emitActivity('status', `Microsoft Auth Required: Visit ${data.verification_uri} (Code: ${data.user_code})`);
        this.callbacks.onNotification(
          'warn',
          `Microsoft Auth required for ${this.config.name}: Visit ${data.verification_uri} and enter code ${data.user_code}`,
          this.config.id
        );
      },
    };

    // Proxy support if configured
    if (this.config.proxyUrl) {
      try {
        const agent = new SocksProxyAgent(this.config.proxyUrl);
        (options as any).agent = agent;
      } catch (err: any) {
        this.callbacks.onNotification('error', `Invalid proxy URL for ${this.config.name}: ${err.message}`, this.config.id);
      }
    }

    try {
      this.lastJavaGuiWindowId = null;
      this.bot = mineflayer.createBot(options);
      this.bindBotEvents();
    } catch (err: any) {
      this.updateStatus('error', err.message || 'Initialization failed');
      this.handleReconnect();
    }
  }

  private applyBedrockRaknetFastPath(client: any) {
    if (!client) return;
    try {
      if (!client._immediateSendPatched) {
        client._immediateSendPatched = true;
        const origSendMCPE = client.sendMCPE?.bind(client);
        if (origSendMCPE) {
          client.sendMCPE = (buffer: any, immediate?: boolean) => {
            return origSendMCPE(buffer, true);
          };
        }
      }

      const conn = client.connection;
      if (conn && !conn._immediateSendReliablePatched) {
        conn._immediateSendReliablePatched = true;
        if (typeof conn.plainSendReliable === 'function') {
          const origPlain = conn.plainSendReliable.bind(conn);
          conn.plainSendReliable = (buffer: any, immediate?: boolean) => {
            const res = origPlain(buffer, true);
            try { conn.raknet?.connection?.sendQueue(); } catch (_) {}
            return res;
          };
          conn.sendReliable = conn.plainSendReliable;
        }
      }

      const rakClient = conn?.raknet;
      const innerConn = rakClient?.connection;
      if (innerConn && !innerConn._fastQueuePatched) {
        innerConn._fastQueuePatched = true;

        const origAdd = innerConn.addEncapsulatedToQueue?.bind(innerConn);
        if (origAdd) {
          innerConn.addEncapsulatedToQueue = function (pk: any, flags: any) {
            const res = origAdd(pk, flags);
            try { innerConn.sendQueue(); } catch (_) {}
            return res;
          };
        }

        const origUpdate = innerConn.update?.bind(innerConn);
        if (origUpdate) {
          innerConn.update = function (timestamp: number) {
            while (innerConn.recvQueue && innerConn.recvQueue.length > 0) {
              const chunk = innerConn.recvQueue.splice(0, 32);
              for (const msg of chunk) {
                try { innerConn.receiveOnline(msg); } catch (_) {}
              }
            }
            return origUpdate(timestamp);
          };
        }
      }
    } catch (_) {}
  }

  private async startBedrock() {
    this.isManuallyStopped = false;
    this.clearTimers();

    const nodeMajorVersion = Number(process.versions.node.split('.')[0]);
    if (nodeMajorVersion < 24) {
      const message = `Bedrock connections require Node.js 24 or newer (this daemon is using ${process.versions.node}). Update Node.js on this device, then restart the daemon.`;
      this.updateStatus('error', message);
      this.emitActivity('status', `⚠️ ${message}`);
      this.callbacks.onNotification('error', `[${this.config.name}] ${message}`, this.config.id);
      return;
    }

    this.updateStatus('connecting', 'Connecting to Bedrock server...');

    let host = (this.config.host || '').trim();
    let port = this.config.port || 19132;

    // DonutSMP's official Bedrock endpoint is donutsmp.net:19132. Normalize
    // older saved configs that used bedrock.donutsmp.net as well.
    if (host.toLowerCase().includes('donutsmp.net')) {
      host = 'donutsmp.net';
      port = 19132;
    } else if (host.toLowerCase().includes('freshsmp') && port === 25565) {
      port = 19132;
    }

    this.emitActivity('connect', `Connecting to Bedrock server ${host}:${port}...`);

    // Pre-resolve hostname to IPv4 address to avoid mobile UDP socket DNS lookup delays/failures
    try {
      const dns = (eval('require'))('dns').promises;
      const lookupRes = await dns.lookup(host, { family: 4 });
      if (lookupRes?.address) {
        host = lookupRes.address;
      }
    } catch (_) {}

    const tokenFolder = this.tokenFolder;

    try {
      let bedrock: any = null;
      let importErr: any = null;
      try {
        // @ts-ignore
        bedrock = await import('bedrock-protocol');
      } catch (err: any) {
        importErr = err;
        try {
          bedrock = (eval('require'))('bedrock-protocol');
        } catch (e: any) {
          importErr = e;
        }
      }

      if (!bedrock) {
        const reason = importErr?.message || String(importErr || 'Not found');
        this.updateStatus('error', 'Bedrock module not installed');
        this.emitActivity('status', `⚠️ Bedrock package missing (${reason}). Run: cd ~/VistaAFK/daemon && npm install bedrock-protocol --no-optional`);
        this.callbacks.onNotification('error', `[${this.config.name}] Bedrock package missing: ${reason}`, this.config.id);
        return;
      }

      // Defensively clean up any previous client
      if (this.bedrockClient) {
        try {
          if (this.bedrockClient.connection && !(this.bedrockClient.connection as any).raknet) {
            (this.bedrockClient.connection as any).close = () => {};
          }
          this.bedrockClient.close();
        } catch (e) {}
        this.bedrockClient = null;
      }
      this.bedrockGuiWindow = null;
      this.bedrockItemNames.clear();
      this.bedrockGuiRawSlots = [];
      this.bedrockGuiContainer = { container_id: 'container' };
      this.bedrockInventorySlots = Array(46).fill(null);
      this.bedrockSelectedSlot = 0;
      this.bedrockFood = 20;
      this.bedrockHealth = 20;
      this.bedrockMaxHealth = 20;
      this.bedrockXuidToUsername.clear();
      this.bedrockPlatformChatIdToUsername.clear();
      this.bedrockChatPacketStats = { text: 0, player: 0, system: 0 };
      this.bedrockChatStatsLastLoggedAt = Date.now();
      this.bedrockInventoryDiagnosticsLogged = false;

      const isMobileDaemon = process.env.VISTAAFK_DEVICE_TYPE === 'mobile';
      let mobileRaknetBackend: 'raknet-native' | 'jsp-raknet' = 'jsp-raknet';
      if (isMobileDaemon) {
        try {
          // Prefer the same native RakNet backend used on Windows when the
          // Termux launcher has built its Android binding. Keep the patched JS
          // transport as a fallback on devices where native compilation fails.
          (eval('require'))('raknet-native');
          mobileRaknetBackend = 'raknet-native';
        } catch (error: any) {
          console.warn(`[VistaAFK Mobile] Native RakNet is unavailable; using JSP RakNet fallback: ${error?.message || error}`);
        }
        console.log(`[VistaAFK Mobile] Bedrock RakNet backend: ${mobileRaknetBackend}`);
      }

      // Safe Bedrock protocol version resolution (auto best-working + ping probe fallback)
      let pingRes: { motd?: string; protocol?: string; version?: string } | null = null;
      const rawUserVersion = this.config.version?.trim();
      const isAutoVersion = !rawUserVersion || rawUserVersion.toLowerCase() === 'auto' || rawUserVersion.toLowerCase() === 'default';

      if (isAutoVersion) {
        try {
          pingRes = await pingBedrockJsp(host, port, 2500);
          if (pingRes) {
            console.log(`[VistaAFK Bedrock] Server ping response from ${host}:${port}: protocol=${pingRes.protocol}, version=${pingRes.version}, motd=${pingRes.motd}`);
          }
        } catch (_) {}
      }

      const resolved = resolveBedrockTargetVersion(
        rawUserVersion,
        pingRes?.protocol,
        pingRes?.version
      );

      const targetVersion = resolved.version;
      if (resolved.note) {
        console.log(`[VistaAFK Bedrock] ${resolved.note}`);
        this.emitActivity('status', `ℹ️ Bedrock version: ${targetVersion} (${resolved.note})`);
      }

      const clientOptions: Record<string, unknown> = {
        host,
        port,
        username: this.config.name,
        offline: this.config.authType === 'offline',
        transport: 'raknet',
        version: targetVersion,
        // Termux prefers the native backend to match the desktop transport.
        // When unavailable, use the launcher's protocol-fixed JSP fallback and
        // skip discovery because bedrock-protocol hard-wires ping to native.
        ...(isMobileDaemon ? {
          raknetBackend: mobileRaknetBackend,
          useRaknetWorkers: false,
          ...(mobileRaknetBackend === 'jsp-raknet' ? { skipPing: true } : {}),
        } : {}),
        profilesFolder: tokenFolder,
        connectTimeout: 45000,
        onMsaCode: (data: any) => {
          const userCode = data.user_code || data.userCode;
          const verificationUri = userCode ? `https://www.microsoft.com/link?otc=${encodeURIComponent(userCode)}&prompt=select_account` : (data.verification_uri || 'https://microsoft.com/link');
          this.authCodeInfo = {
            userCode,
            verificationUri,
            expiresIn: data.expires_in || data.expiresIn || 900,
          };
          this.updateStatus('authenticating', `Device Code: ${userCode}`);
          this.emitActivity('status', `🔑 Microsoft Auth Required for Bedrock: Visit ${verificationUri} (Code: ${userCode})`);
          this.callbacks.onNotification(
            'warn',
            `Microsoft Auth required for Bedrock ${this.config.name}: Visit ${verificationUri} and enter code ${userCode}`,
            this.config.id
          );
          this.emitTelemetry();
        },
      };

      const client = (bedrock as any).createClient(clientOptions);

      this.bedrockClient = client;
      this.applyBedrockRaknetFastPath(client);

      client.once('connect_allowed', () => {
        this.applyBedrockRaknetFastPath(client);
      });

      // bedrock-protocol's default helper sends "completed" immediately after
      // resource_packs_info. Bedrock servers expect HAVE_ALL_PACKS at this stage,
      // then COMPLETED after resource_pack_stack. The helper has no pack-downloader,
      // so acknowledge the offer as accepted without pretending the headless daemon
      // has rendered/applied any textures.
      const writeBedrockPacket = client.write.bind(client);
      let initialPackOfferHandled = false;
      client.write = (packetName: string, params: any) => {
        if (
          packetName === 'resource_pack_client_response' &&
          params?.response_status === 'completed' &&
          !initialPackOfferHandled
        ) {
          initialPackOfferHandled = true;
          this.emitActivity('status', '📦 Accepted the Bedrock server resource-pack offer (headless client; textures are not rendered).');
          return writeBedrockPacket(packetName, {
            ...params,
            response_status: 'have_all_packs',
            response_status_name: 'downloadingfinished',
          });
        }
        return writeBedrockPacket(packetName, params);
      };

      // Reset pack state on new pack offers (e.g. world or server transfer)
      client.on('resource_packs_info', () => {
        initialPackOfferHandled = false;
      });

      // bedrock-protocol emits `session` once Microsoft/Xbox authentication has
      // completed and it is ready to negotiate with the game server. Clearing
      // the device code here prevents a later server/network error from being
      // mistaken for an OAuth flow that is still waiting for approval.
      client.once('session', () => {
        this.applyBedrockRaknetFastPath(client);
        if (this.bedrockHandshakeTimeout) clearTimeout(this.bedrockHandshakeTimeout);
        this.bedrockHandshakeTimeout = setTimeout(() => {
          if (this.bedrockClient !== client || this.currentStatus === 'online') return;
          const reason = 'Bedrock server handshake timed out after Microsoft sign-in';
          this.emitActivity('status', `⏱️ ${reason}; reconnecting...`);
          this.updateStatus('error', reason);
          client.close();
        }, 90000);
        if (this.authCodeInfo) {
          this.authCodeInfo = undefined;
          this.updateStatus('connecting', 'Microsoft sign-in complete; joining Bedrock server...');
          this.emitActivity('status', '✅ Microsoft sign-in complete; joining the Bedrock server...');
        }
      });

      client.on('join', () => {
        this.applyBedrockRaknetFastPath(client);
        if (this.bedrockHandshakeTimeout) clearTimeout(this.bedrockHandshakeTimeout);
        this.bedrockHandshakeTimeout = null;
        if ((client as any).username && (client as any).username !== this.config.name) {
          console.log(`[VistaAFK Bedrock] In-game gamertag updated: ${this.config.name} -> ${(client as any).username}`);
          this.config.name = (client as any).username;
          this.callbacks.onConfigUpdated?.(this.config);
        }
        this.reconnectAttempts = 0;
        this.connectStartTime = Date.now();
        this.authCodeInfo = undefined;
        this.updateStatus('online', 'Connected (Bedrock)');
        this.emitActivity('connect', `🎮 Successfully joined Bedrock server ${host}:${port}`);
        this.emitTelemetry();
      });

      client.on('spawn', () => {
        this.applyBedrockRaknetFastPath(client);
        if (this.bedrockHandshakeTimeout) clearTimeout(this.bedrockHandshakeTimeout);
        this.bedrockHandshakeTimeout = null;
        if ((client as any).username && (client as any).username !== this.config.name) {
          this.config.name = (client as any).username;
          this.callbacks.onConfigUpdated?.(this.config);
        }
        this.reconnectAttempts = 0;
        if (!this.connectStartTime) this.connectStartTime = Date.now();
        this.authCodeInfo = undefined;
        this.updateStatus('online', 'Spawned in world (Bedrock)');
        this.emitActivity('spawn', '🌍 Spawned into Bedrock world');
        this.callbacks.onChatMessage({
          botId: this.config.id,
          timestamp: Date.now(),
          sender: 'SessionDivider',
          message: `New Session Started · Connected to ${host}:${port}`,
          isSystem: true,
        });

        // Maintain Bedrock tick synchronization heartbeat so server treats the client as active with zero input latency
        if (this.bedrockTickSyncInterval) clearInterval(this.bedrockTickSyncInterval);
        let bedrockClientTick = 0n;
        this.bedrockTickSyncInterval = setInterval(() => {
          if (this.bedrockClient !== client || this.currentStatus !== 'online') return;
          try {
            client.write('tick_sync', { request_time: bedrockClientTick, response_time: 0n });
            bedrockClientTick += 10n;
          } catch (_) {}
        }, 500);

        client.on('tick_sync', (packet: any) => {
          if (packet?.response_time) {
            bedrockClientTick = BigInt(packet.response_time);
          }
        });

        this.setupTelemetryLoop();
        this.setupAntiAfk();
        this.emitTelemetry();
      });

      client.on('start_game', (packet: any) => {
        this.registerBedrockItemNames(packet?.itemstates);
        if (packet?.player_position) {
          this.bedrockPosition = {
            x: Math.round(packet.player_position.x * 10) / 10,
            y: Math.round(packet.player_position.y * 10) / 10,
            z: Math.round(packet.player_position.z * 10) / 10,
          };
          this.emitTelemetry();
        }
      });

      client.on('item_registry', (packet: any) => {
        this.registerBedrockItemNames(packet?.itemstates);
      });

      client.on('player_list', (packet: any) => {
        const records = Array.isArray(packet?.records) ? packet.records : [];
        for (const record of records) {
          const xuid = normalizeBedrockIdentity(record?.xbox_user_id ?? record?.xuid);
          const platformChatId = normalizeBedrockIdentity(record?.platform_chat_id ?? record?.platform_online_id);
          const username = String(record?.username ?? record?.player_name ?? record?.name ?? '').trim();
          if (String(record?.type).toLowerCase() === 'remove') {
            if (xuid) this.bedrockXuidToUsername.delete(xuid);
            if (platformChatId) this.bedrockPlatformChatIdToUsername.delete(platformChatId);
          } else if (username) {
            if (xuid) this.bedrockXuidToUsername.set(xuid, username);
            if (platformChatId) this.bedrockPlatformChatIdToUsername.set(platformChatId, username);
          }
        }
      });



      client.on('player_hotbar', (packet: any) => {
        const selectedSlot = Number(packet?.selected_slot);
        if (packet?.select_slot !== false && Number.isInteger(selectedSlot) && selectedSlot >= 0 && selectedSlot <= 8) {
          this.bedrockSelectedSlot = selectedSlot;
          this.emitTelemetry();
        }
      });

      client.on('update_attributes', (packet: any) => {
        if (!Array.isArray(packet?.attributes)) return;
        const playerRuntimeId = client.entityId ?? client.startGameData?.runtime_entity_id;
        const packetRuntimeId = packet?.runtime_entity_id;
        if (playerRuntimeId != null && packetRuntimeId != null && String(playerRuntimeId) !== String(packetRuntimeId)) return;

        const normalizedName = (attribute: any) => String(attribute?.name || '')
          .toLowerCase()
          .replace(/^minecraft:/, '')
          .replace(/^player\./, '');
        const health = packet.attributes.find((attribute: any) => normalizedName(attribute) === 'health');
        const healthValue = Number(health?.current);
        const maxHealth = Number(health?.max);
        let changed = false;
        if (Number.isFinite(maxHealth) && maxHealth > 0 && maxHealth <= 2048 && maxHealth !== this.bedrockMaxHealth) {
          this.bedrockMaxHealth = maxHealth;
          this.bedrockHealth = Math.min(this.bedrockHealth, maxHealth);
          changed = true;
        }
        if (Number.isFinite(healthValue)) {
          const nextHealth = Math.round(Math.max(0, Math.min(this.bedrockMaxHealth, healthValue)) * 10) / 10;
          if (nextHealth !== this.bedrockHealth) {
            this.bedrockHealth = nextHealth;
            changed = true;
          }
        }

        const hunger = packet.attributes.find((attribute: any) => normalizedName(attribute) === 'hunger');
        const foodValue = Number(hunger?.current);
        if (Number.isFinite(foodValue)) {
          const nextFood = Math.max(0, Math.min(20, foodValue));
          if (nextFood !== this.bedrockFood) {
            this.bedrockFood = nextFood;
            changed = true;
          }
        }
        if (changed) {
          this.emitTelemetry();
          this.checkSurvivalActions();
        }
      });

      client.on('container_open', (packet: any) => {
        const windowId = Number(packet?.window_id);
        if (!Number.isInteger(windowId)) return;
        const type = String(packet?.window_type || 'container');
        const title = type === 'container' ? 'Server Menu' : type.replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase());
        this.bedrockGuiWindow = {
          id: windowId,
          title,
          type,
          kind: 'container',
          readOnly: false,
          slots: [],
        };
        this.emitTelemetry();
      });

      client.on('inventory_content', (packet: any) => {
        const windowId = Number(packet?.window_id);
        const containerId = packet?.container?.container_id;
        const items = Array.isArray(packet?.input) ? packet.input : [];
        const playerInventoryUpdated = this.updateBedrockPlayerInventory(containerId, items, windowId);
        if (playerInventoryUpdated && !this.bedrockInventoryDiagnosticsLogged) {
          this.bedrockInventoryDiagnosticsLogged = true;
        }
        if (this.bedrockGuiWindow?.kind !== 'container' || this.bedrockGuiWindow.id !== windowId) {
          if (playerInventoryUpdated) this.emitTelemetry();
          return;
        }
        this.bedrockGuiRawSlots = [...items];
        const container = packet?.container;
        if (container && typeof container.container_id === 'string') {
          const dynamicContainerId = container.dynamic_container_id;
          this.bedrockGuiContainer = {
            container_id: container.container_id,
            ...(dynamicContainerId !== undefined && dynamicContainerId !== null && Number.isInteger(Number(dynamicContainerId)) ? { dynamic_container_id: Number(dynamicContainerId) } : {}),
          };
        }
        let detectedAfkRewards: number | undefined;
        const slots = items.map((item: any, slot: number) => {
          const serialized = this.serializeBedrockItem(item, slot);
          if (serialized?.lore) {
            for (const line of serialized.lore) {
              const match = line.match(/(\d+)\s*afk reward/i);
              if (match && Number.isInteger(Number(match[1]))) {
                detectedAfkRewards = Number(match[1]);
              }
            }
          }
          return serialized;
        });
        if (detectedAfkRewards !== undefined) {
          this.afkRewardsAvailable = detectedAfkRewards;
        }
        this.bedrockGuiWindow = {
          ...this.bedrockGuiWindow,
          slots,
        };
        this.emitTelemetry();
      });

      client.on('inventory_slot', (packet: any) => {
        const windowId = Number(packet?.window_id);
        const slot = Number(packet?.slot);
        const containerId = packet?.container?.container_id;
        const playerInventoryUpdated = this.updateBedrockPlayerInventorySlot(containerId, slot, packet?.item, windowId);
        if (playerInventoryUpdated && !this.bedrockInventoryDiagnosticsLogged) {
          this.bedrockInventoryDiagnosticsLogged = true;
        }
        if (this.bedrockGuiWindow?.kind !== 'container' || this.bedrockGuiWindow.id !== windowId || !Number.isInteger(slot) || slot < 0) {
          if (playerInventoryUpdated) this.emitTelemetry();
          return;
        }
        const slots = [...this.bedrockGuiWindow.slots];
        while (this.bedrockGuiRawSlots.length <= slot) this.bedrockGuiRawSlots.push(null);
        this.bedrockGuiRawSlots[slot] = packet?.item || null;
        while (slots.length <= slot) slots.push(null);
        slots[slot] = this.serializeBedrockItem(packet?.item, slot);
        this.bedrockGuiWindow = { ...this.bedrockGuiWindow, slots };
        this.emitTelemetry();
      });

      client.on('container_close', (packet: any) => {
        if (this.bedrockGuiWindow?.kind === 'container' && this.bedrockGuiWindow.id === Number(packet?.window_id)) {
          this.bedrockGuiWindow = null;
          this.bedrockGuiRawSlots = [];
          this.emitTelemetry();
        }
      });

      client.on('modal_form_request', (packet: any) => {
        const form = parseBedrockForm(packet);
        if (!form) return;
        this.bedrockGuiWindow = form;
        this.emitTelemetry();

        // Check if server is prompting to accept/download a resource pack or texture pack
        const titleAndBody = `${form.title} ${form.formContent || ''}`.toLowerCase();
        const isResourcePrompt = (
          (titleAndBody.includes('resource') && titleAndBody.includes('pack')) ||
          (titleAndBody.includes('texture') && titleAndBody.includes('pack')) ||
          titleAndBody.includes('server pack') ||
          Boolean(form.formButtons?.some((b: any) => /accept|download|enable/i.test(b.text)))
        );

        if (isResourcePrompt) {
          if (form.formType === 'modal') {
            this.emitActivity('status', `📦 Automatically accepted Bedrock resource-pack prompt: ${form.title}`);
            setTimeout(() => this.respondGuiForm(true), 200);
          } else if (form.formType === 'simple' && form.formButtons && form.formButtons.length > 0) {
            let targetIdx = form.formButtons.findIndex((b: any) => /accept|download|enable|yes/i.test(b.text));
            if (targetIdx < 0) {
              targetIdx = form.formButtons.findIndex((b: any) => !/decline|cancel|no/i.test(b.text));
            }
            if (targetIdx < 0) targetIdx = 0;
            this.emitActivity('status', `📦 Automatically accepted Bedrock resource-pack prompt: ${form.formButtons[targetIdx].text}`);
            setTimeout(() => this.respondGuiForm(targetIdx), 200);
          }
        }
      });

      client.on('transfer', (packet: any) => {
        const address = packet?.server_address;
        const port = Number(packet?.port) || 19132;
        if (address) {
          this.emitActivity('status', `🔄 Server transferred bot to ${address}:${port}`);
          this.config.host = address;
          this.config.port = port;
          setTimeout(() => {
            this.stop();
            setTimeout(() => this.start(), 800);
          }, 500);
        }
      });

      client.on('move_player', (packet: any) => {
        const myId = (client as any).entityId || (client as any).startGameData?.runtime_entity_id;
        if (packet?.runtime_entity_id === myId || packet?.runtime_id === myId) {
          if (packet?.position) {
            this.bedrockPosition = {
              x: Math.round(packet.position.x * 10) / 10,
              y: Math.round(packet.position.y * 10) / 10,
              z: Math.round(packet.position.z * 10) / 10,
            };
            this.emitTelemetry();
          }
        }
      });

      client.on('set_health', (packet: any) => {
        const health = Number(packet?.health);
        if (Number.isFinite(health)) {
          this.bedrockHealth = Math.round(Math.max(0, Math.min(this.bedrockMaxHealth, health)) * 10) / 10;
          this.emitTelemetry();
          this.checkSurvivalActions();
        }
      });

      client.on('text', (packet: any) => {
        const parsed = parseBedrockChatPacket(packet, (xuid, platformChatId) =>
          (xuid ? this.bedrockXuidToUsername.get(xuid) : undefined)
          || (platformChatId ? this.bedrockPlatformChatIdToUsername.get(platformChatId) : undefined)
        );
        if (!parsed.isSystem && this.isDuplicateSentMessage(parsed.sender, parsed.message)) {
          return;
        }
        this.bedrockChatPacketStats.text++;
        if (parsed.isSystem) this.bedrockChatPacketStats.system++;
        else this.bedrockChatPacketStats.player++;
        this.callbacks.onChatMessage({
          botId: this.config.id,
          timestamp: Date.now(),
          ...parsed,
        });
      });

      client.on('command_output', (packet: any) => {
        try {
          const messages = packet?.output_messages || [];
          for (const msgObj of messages) {
            let msgText = typeof msgObj?.message === 'string' ? msgObj.message : '';
            const params = Array.isArray(msgObj?.parameters) ? msgObj.parameters : [];
            if (msgText.trim().startsWith('{') || msgText.trim().startsWith('[')) {
              try {
                const extracted = parseMinecraftChat(msgText);
                if (extracted && extracted !== 'Unknown reason') msgText = extracted;
              } catch (_) {}
            }
            for (let i = 0; i < params.length; i++) {
              msgText = msgText.replace(new RegExp(`%${i + 1}\\$s|%${i + 1}`, 'g'), String(params[i]));
              msgText = msgText.replace('%s', String(params[i]));
            }
            if (params.length > 0 && !msgText.includes(String(params[0]))) {
              msgText = `${msgText} ${params.join(' ')}`.trim();
            }
            const clean = cleanBedrockFormatting(msgText);
            if (clean) {
              this.emitActivity('command', `⚡ [Command Output] ${clean}`);
              this.callbacks.onChatMessage({
                botId: this.config.id,
                timestamp: Date.now(),
                sender: 'Server',
                message: clean,
                isSystem: true,
              });
            }
          }
        } catch (_) {}
      });

      client.on('set_title', (packet: any) => {
        try {
          const type = String(packet?.type ?? '');
          const isTitleOrActionbar = (
            type.includes('action_bar') ||
            type.includes('title') ||
            type.includes('subtitle') ||
            type === '2' || type === '3' || type === '4' || type === '6' || type === '7' || type === '8'
          );
          if (!isTitleOrActionbar) return;

          let rawText = typeof packet?.text === 'string' ? packet.text : '';
          if (rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
            try {
              const extracted = parseMinecraftChat(rawText);
              if (extracted && extracted !== 'Unknown reason') rawText = extracted;
            } catch (_) {}
          }
          const text = cleanBedrockFormatting(rawText);
          if (text) {
            this.callbacks.onChatMessage({
              botId: this.config.id,
              timestamp: Date.now(),
              sender: 'Server',
              message: text,
              isSystem: true,
            });
          }
        } catch (_) {}
      });

      client.on('toast_request', (packet: any) => {
        try {
          const rawTitle = typeof packet?.title === 'string' ? packet.title : '';
          const rawMsg = typeof packet?.message === 'string' ? packet.message : '';
          const title = cleanBedrockFormatting(rawTitle.trim().startsWith('{') ? parseMinecraftChat(rawTitle) : rawTitle);
          const msg = cleanBedrockFormatting(rawMsg.trim().startsWith('{') ? parseMinecraftChat(rawMsg) : rawMsg);
          const text = title && msg ? `${title}: ${msg}` : (msg || title);
          if (text) {
            this.callbacks.onChatMessage({
              botId: this.config.id,
              timestamp: Date.now(),
              sender: 'Server',
              message: text,
              isSystem: true,
            });
          }
        } catch (_) {}
      });

      client.on('boss_event', (packet: any) => {
        try {
          const type = String(packet?.type ?? '');
          if (type === 'show_bar' || type === 'set_bar_title' || type === '0' || type === '5') {
            const rawTitle = typeof packet?.title === 'string' ? packet.title : '';
            if (!rawTitle) return;
            const title = cleanBedrockFormatting(rawTitle.trim().startsWith('{') ? parseMinecraftChat(rawTitle) : rawTitle);
            if (title && (/teleport|countdown|afk|warp|seconds|in \d/i.test(title))) {
              this.callbacks.onChatMessage({
                botId: this.config.id,
                timestamp: Date.now(),
                sender: 'Server',
                message: title,
                isSystem: true,
              });
            }
          }
        } catch (_) {}
      });

      // Boar's transaction watchdog uses negative NetworkStackLatency timestamps
      // as transaction IDs and expects the Bedrock client to echo them. The
      // stock bedrock-protocol helper only echoes packets with needs_response,
      // so answer these negative-ID probes explicitly without echoing ordinary
      // latency replies (which would create a ping-pong loop).
      client.on('network_stack_latency', (packet: any) => {
        try {
          const timestamp = BigInt(packet?.timestamp);
          const isNegativeTransactionId = timestamp > (1n << 63n) - 1n;
          if (isNegativeTransactionId && !packet?.needs_response) {
            client.write('network_stack_latency', {
              timestamp: packet.timestamp,
              needs_response: false,
            });
          }
        } catch (error) {
          // Ignore malformed latency packets; the library handles normal pings.
        }
      });

      let bedrockDisconnectReason = '';
      client.on('disconnect', (packet: any) => {
        const rawReason = typeof packet === 'string' ? packet : packet?.message;
        bedrockDisconnectReason = (typeof rawReason === 'string' ? rawReason : JSON.stringify(rawReason || packet || 'Unknown reason'))
          .replace(/§[0-9a-fk-orxghijpqstu]/gi, '')
          .trim();
        this.emitActivity('disconnect', `❌ Server disconnected this Bedrock session: ${bedrockDisconnectReason}`);
        this.callbacks.onNotification('warn', `[${this.config.name}] Server disconnected the Bedrock session: ${bedrockDisconnectReason}`, this.config.id);
      });

      client.on('close', () => {
        if (this.bedrockTickSyncInterval) {
          clearInterval(this.bedrockTickSyncInterval);
          this.bedrockTickSyncInterval = null;
        }
        if (this.bedrockHandshakeTimeout) clearTimeout(this.bedrockHandshakeTimeout);
        this.bedrockHandshakeTimeout = null;
        this.bedrockClient = null;
        this.bedrockGuiWindow = null;
        this.bedrockGuiRawSlots = [];
        this.emitTelemetry();
        if (!this.isManuallyStopped) {
          // Don't start another OAuth flow while the current device code is
          // awaiting approval, even if an error event changed the status first.
          if (this.authCodeInfo) {
            this.emitActivity('status', `⏳ Awaiting Microsoft authorization: Visit ${this.authCodeInfo.verificationUri} and enter ${this.authCodeInfo.userCode}`);
            return;
          }
          if (!bedrockDisconnectReason) {
            this.emitActivity('disconnect', '🔴 Disconnected from Bedrock server (no kick reason received; likely network close)');
          }
          this.handleReconnect();
        } else {
          this.updateStatus('offline', 'Disconnected');
        }
      });

      client.on('error', (err: any) => {
        if (this.bedrockHandshakeTimeout) clearTimeout(this.bedrockHandshakeTimeout);
        this.bedrockHandshakeTimeout = null;
        const errorMsg = err?.message || 'Bedrock connection error';
        console.error(`[VistaAFK Bedrock] Connection error for ${this.config.name} (${host}:${port}):`, err);
        this.updateStatus('error', errorMsg);
        this.emitActivity('status', `⚠️ Bedrock Error: ${errorMsg}`);
      });
    } catch (err: any) {
      console.error(`[VistaAFK] Bedrock init error for ${this.config.name}:`, err.message);
      this.updateStatus('error', err?.message || 'Failed to initialize Bedrock client');
      this.emitActivity('status', `⚠️ Bedrock Init Error: ${err?.message || 'Initialization failed'}`);
      this.callbacks.onNotification('error', `[${this.config.name}] Bedrock error: ${err?.message}`, this.config.id);
      this.handleReconnect();
    }
  }

  public stop() {
    const uptime = this.getSessionUptime();
    this.isManuallyStopped = true;
    this.clearTimers();
    this.authCodeInfo = undefined;
    if (this.bedrockClient) {
      try {
        if (this.bedrockClient.connection && !(this.bedrockClient.connection as any).raknet) {
          (this.bedrockClient.connection as any).close = () => {};
        }
        this.bedrockClient.close();
      } catch (e) {}
      this.bedrockClient = null;
    }
    if (this.bot) {
      try {
        this.bot.quit('VistaAFK: Disconnected by user');
      } catch (e) {
        // ignore
      }
      this.bot = null;
    }
    this.lastJavaGuiWindowId = null;
    this.updateStatus('offline', 'Disconnected');
    if (this.connectStartTime) {
      this.emitActivity('disconnect', `⏹️ Disconnected by user (Session Uptime: ${uptime})`);
      this.sendDiscordAlert(`🔴 **${this.config.name}** disconnected from \`${this.config.host}:${this.config.port || 25565}\` (Session Uptime: ${uptime})`);
      this.connectStartTime = 0;
    }
  }

  public sendChat(message: string) {
    if (this.bedrockClient && this.currentStatus === 'online') {
      try {
        this.applyBedrockRaknetFastPath(this.bedrockClient);
        if (message.startsWith('/')) {
          const uuid = randomUUID();
          const playerEid = (this.bedrockClient as any).entityId ?? (this.bedrockClient as any).startGameData?.runtime_entity_id ?? 0n;
          const commandOrigin: Record<string, unknown> = {
            type: 'player',
            uuid,
            request_id: uuid,
          };
          const isModernCommandProtocol = this.bedrockClient.versionGreaterThanOrEqualTo('1.21.130');
          const hasCommandVersion = this.bedrockClient.versionGreaterThanOrEqualTo('1.19.62');
          if (isModernCommandProtocol) {
            commandOrigin.player_entity_id = typeof playerEid === 'bigint' ? playerEid : BigInt(playerEid);
          }

          const commandRequest: Record<string, unknown> = {
            command: message,
            origin: commandOrigin,
            internal: false,
          };
          if (hasCommandVersion) commandRequest.version = isModernCommandProtocol ? 'latest' : 52;
          this.bedrockClient.write('command_request', commandRequest);
          this.emitActivity('command', `⚡ Sent Bedrock command: ${message}`);
        } else {
          this.bedrockClient.write('text', {
            category: 'authored',
            type: 'chat',
            needs_translation: false,
            source_name: this.config.name,
            message,
            xuid: String(this.bedrockClient.profile?.xuid || '0'),
            platform_chat_id: '',
            has_filtered_message: false,
            filtered_message: '',
          });
          this.emitActivity('chat', `💬 Sent chat: "${message}"`);
          this.recordSentChatMessage(message);
          this.callbacks.onChatMessage({
            botId: this.config.id,
            timestamp: Date.now(),
            sender: this.config.name,
            message,
            isSystem: false,
          });
        }
        if (message.startsWith('/')) {
          this.callbacks.onChatMessage({
            botId: this.config.id,
            timestamp: Date.now(),
            sender: 'VistaAFK',
            message: `⚡ Sent command: ${message}`,
            isSystem: true,
          });
        }
      } catch (e: any) {
        const error = e?.message || 'Unknown Bedrock send error';
        this.callbacks.onNotification('error', `Failed to send Bedrock message: ${error}`, this.config.id);
      }
      return;
    }

    if (!this.bot || this.currentStatus !== 'online') {
      this.callbacks.onNotification('error', `Cannot send chat: ${this.config.name} is offline.`, this.config.id);
      return;
    }
    try {
      this.bot.chat(message);
      if (message.startsWith('/')) {
        this.emitActivity('command', `⚡ Executed command: ${message}`);
        this.sendDiscordAlert(`⚡ **${this.config.name}** typed command: \`${message}\``);
        this.callbacks.onChatMessage({
          botId: this.config.id,
          timestamp: Date.now(),
          sender: 'VistaAFK',
          message: `⚡ Sent command: ${message}`,
          isSystem: true,
        });
      } else {
        this.emitActivity('chat', `💬 Sent chat: "${message}"`);
        this.recordSentChatMessage(message);
        this.callbacks.onChatMessage({
          botId: this.config.id,
          timestamp: Date.now(),
          sender: this.config.name,
          message,
          isSystem: false,
        });
      }
    } catch (err: any) {
      this.callbacks.onNotification('error', `Failed to send chat: ${err.message}`, this.config.id);
    }
  }

  private bindBotEvents() {
    if (!this.bot) return;

    this.bot.on('windowOpen', (window: any) => {
      // Mineflayer's window events carry the real server menu (including custom
      // inventory GUIs); expose it so the web control panel can display it.
      this.lastJavaGuiWindowId = Number.isInteger(window?.id) ? window.id : null;
      const updateTelemetry = () => this.emitTelemetry();
      window?.on?.('updateSlot', updateTelemetry);
      window?.on?.('update', updateTelemetry);
      this.emitTelemetry();
    });
    this.bot.on('windowClose', () => this.emitTelemetry());

    this.bot.on('actionBar' as any, (jsonMsg: any) => {
      try {
        const raw = typeof jsonMsg === 'string' ? jsonMsg : (jsonMsg?.toString?.() || parseMinecraftChat(jsonMsg));
        const text = cleanBedrockFormatting(raw);
        if (text) {
          this.callbacks.onChatMessage({
            botId: this.config.id,
            timestamp: Date.now(),
            sender: 'Server',
            message: text,
            isSystem: true,
          });
        }
      } catch (_) {}
    });

    this.bot.on('title' as any, (text: any) => {
      try {
        const raw = typeof text === 'string' ? text : (text?.toString?.() || '');
        const clean = cleanBedrockFormatting(raw);
        if (clean) {
          this.callbacks.onChatMessage({
            botId: this.config.id,
            timestamp: Date.now(),
            sender: 'Server',
            message: clean,
            isSystem: true,
          });
        }
      } catch (_) {}
    });

    this.bot.once('spawn', () => {
      if (this.bot?.username && this.bot.username !== this.config.name) {
        console.log(`[VistaAFK Java] Verified player username updated: ${this.config.name} -> ${this.bot.username}`);
        this.config.name = this.bot.username;
        this.callbacks.onConfigUpdated?.(this.config);
      }
      this.connectStartTime = Date.now();
      this.reconnectAttempts = 0;
      this.authCodeInfo = undefined;
      this.updateStatus('online', 'Connected and spawned in world');
      this.callbacks.onNotification('success', `${this.config.name} has entered the world!`, this.config.id);

      const dimension = (this.bot?.game as any)?.dimension || 'Overworld';
      this.emitActivity('spawn', `🟢 Spawned in ${dimension} at [${this.getCoordinatesString()}]`);
      this.sendDiscordAlert(`🟢 **${this.config.name}** joined lobby/world on \`${this.config.host}:${this.config.port || 25565}\` (${dimension})`);

      this.setupAntiAfk();
      this.setupFarming();
      this.setupTelemetryLoop();
      this.checkSurvivalActions();
      this.setupAutoCommands();

      this.callbacks.onChatMessage({
        botId: this.config.id,
        timestamp: Date.now(),
        sender: 'SessionDivider',
        message: `New Session Started · Connected to ${this.config.host} (${dimension})`,
        isSystem: true,
      });
    });

    this.bot.on('chat', (username: string, message: string) => {
      if (this.isDuplicateSentMessage(username, message)) return;
      if (username === this.bot?.username) return;

      const cleanMsg = message.trim();
      if (cleanMsg === this.lastChatText && (Date.now() - this.lastChatTimestamp) < 1500) {
        return;
      }
      this.lastChatText = cleanMsg;
      this.lastChatTimestamp = Date.now();

      this.callbacks.onChatMessage({
        botId: this.config.id,
        timestamp: Date.now(),
        sender: username,
        message,
        isSystem: false,
        raw: {
          type: 'chat',
          source_name: username,
          raw_message: message,
          resolved_username: username,
        },
      });

      // Notify if whispered
      if (message.toLowerCase().includes('whisper') || message.toLowerCase().includes('-> me')) {
        this.emitActivity('chat', `💬 Received whisper from ${username}: "${message}"`);
        this.sendDiscordAlert(`💬 **${this.config.name}** received a whisper from **${username}**: "${message}"`);
      }
    });

    this.bot.on('messagestr', (message: string, position: string) => {
      if (position === 'system' || position === 'game_info') {
        const cleanMsg = message.trim();
        if (!cleanMsg || (cleanMsg === this.lastChatText && (Date.now() - this.lastChatTimestamp) < 1500)) {
          return;
        }
        this.lastChatText = cleanMsg;
        this.lastChatTimestamp = Date.now();

        this.callbacks.onChatMessage({
          botId: this.config.id,
          timestamp: Date.now(),
          sender: 'Server',
          message: cleanMsg,
          isSystem: true,
          raw: {
            type: position || 'system',
            raw_message: cleanMsg,
          },
        });
      }
    });

    this.bot.on('health', () => {
      this.emitTelemetry();
      this.checkSurvivalActions();
    });

    this.bot.on('entityAttributes', (entity) => {
      if (this.bot && entity === this.bot.entity) {
        this.emitTelemetry();
        this.checkSurvivalActions();
      }
    });

    const handleAttrPacket = (packet: any) => {
      if (!this.bot) return;
      const myId = this.bot.entity?.id;
      if (myId === undefined || packet?.entityId === myId) {
        if (Array.isArray(packet?.properties)) {
          for (const prop of packet.properties) {
            const attrKey = prop?.key || prop?.name || '';
            if (attrKey.includes('max_health')) {
              let val = typeof prop.value === 'number' ? prop.value : 20;
              if (Array.isArray(prop.modifiers) && prop.modifiers.length > 0) {
                let op0 = 0, op1 = 0, op2 = 1;
                for (const mod of prop.modifiers) {
                  if (mod.operation === 0) op0 += (mod.amount || 0);
                  else if (mod.operation === 1) op1 += (mod.amount || 0);
                  else if (mod.operation === 2) op2 *= (1 + (mod.amount || 0));
                }
                val = Math.max(1, (val + op0) * (1 + op1) * op2);
              }
              this.customMaxHealth = Math.round(val * 10) / 10;
              this.recordedMaxHealth = Math.max(this.recordedMaxHealth, this.customMaxHealth);
              this.emitTelemetry();
              this.checkSurvivalActions();
            }
          }
        }
      }
    };

    (this.bot as any)._client?.on('entity_update_attributes', handleAttrPacket);
    (this.bot as any)._client?.on('update_attributes', handleAttrPacket);

    // Auto accept resource packs (critical for SMP sub-servers like Lifesteal with custom packs)
    const acceptJavaPack = () => {
      try {
        this.bot?.acceptResourcePack();
        this.emitActivity('status', '📦 Accepted server custom resource pack');
        this.callbacks.onChatMessage({
          botId: this.config.id,
          timestamp: Date.now(),
          sender: 'VistaAFK',
          message: '📦 Accepted server custom resource pack',
          isSystem: true,
        });
      } catch (e) {
        // ignore
      }
    };
    (this.bot as any).on('resourcePack', acceptJavaPack);
    (this.bot as any)._client?.on('resource_pack_send', acceptJavaPack);
    (this.bot as any)._client?.on('add_resource_pack', acceptJavaPack);

    this.bot.on('respawn', () => {
      this.setupAntiAfk();
      this.setupFarming();
      this.checkSurvivalActions();
      this.emitActivity('spawn', '♻️ Respawned in world');
      this.callbacks.onChatMessage({
        botId: this.config.id,
        timestamp: Date.now(),
        sender: 'VistaAFK',
        message: '♻️ Respawned in world',
        isSystem: true,
      });
    });

    this.bot.on('death', () => {
      this.callbacks.onNotification('error', `${this.config.name} died in the world!`, this.config.id);
      this.emitActivity('status', `☠️ Bot died at [${this.getCoordinatesString()}] — Auto-respawning...`);
      this.callbacks.onChatMessage({
        botId: this.config.id,
        timestamp: Date.now(),
        sender: 'VistaAFK',
        message: `☠️ Died in world at [${this.getCoordinatesString()}]`,
        isSystem: true,
      });
      this.sendDiscordAlert(`☠️ **${this.config.name}** died at [${this.getCoordinatesString()}]`);
      setTimeout(() => {
        try {
          this.bot?.respawn();
        } catch (e) {
          // ignore
        }
      }, 1500);
    });

    this.bot.on('kicked', (reason: any) => {
      const cleanReason = parseMinecraftChat(reason);
      const uptime = this.getSessionUptime();
      this.updateStatus('offline', `Kicked: ${cleanReason}`);
      this.callbacks.onNotification('warn', `${this.config.name} was kicked: ${cleanReason}`, this.config.id);
      this.emitActivity('disconnect', `❌ Kicked: ${cleanReason} (Session Uptime: ${uptime})`);
      this.callbacks.onChatMessage({
        botId: this.config.id,
        timestamp: Date.now(),
        sender: 'Server',
        message: `❌ Kicked: ${cleanReason}`,
        isSystem: true,
      });
      this.sendDiscordAlert(`⚠️ **${this.config.name}** was kicked from \`${this.config.host}:${this.config.port || 25565}\` (Session Uptime: ${uptime})\n> **Reason:** \`${cleanReason}\``);
      this.connectStartTime = 0;
    });

    this.bot.on('error', (err: any) => {
      let friendlyMsg = err?.message || 'Connection failed';
      if (friendlyMsg.includes('Failed to obtain profile data') && process.env.VISTAAFK_DEVICE_TYPE === 'mobile') {
        friendlyMsg = `Java authentication failed for ${this.config.name}: Microsoft sign-in completed, but Minecraft did not return a usable Java profile token. Check that Termux is running the latest daemon, then retry the connection.`;
      } else if (friendlyMsg.includes('ECONNREFUSED')) {
        friendlyMsg = `Cannot connect to ${this.config.host}:${this.config.port} — no Minecraft server is running there.`;
      } else if (friendlyMsg.includes('ENOTFOUND')) {
        friendlyMsg = `Server address not found: ${this.config.host}`;
      } else if (friendlyMsg.includes('ETIMEDOUT')) {
        friendlyMsg = `Connection to ${this.config.host}:${this.config.port} timed out.`;
      }
      this.updateStatus('error', friendlyMsg);
      this.emitActivity('status', `⚠️ Error: ${friendlyMsg}`);
      this.callbacks.onNotification('error', `[${this.config.name}] ${friendlyMsg}`, this.config.id);
    });

    this.bot.on('end', () => {
      const uptime = this.getSessionUptime();
      this.clearTimers();
      this.bot = null;
      this.lastJavaGuiWindowId = null;
      if (!this.isManuallyStopped) {
        if (this.connectStartTime) {
          this.emitActivity('disconnect', `🔴 Disconnected from server (Session Uptime: ${uptime})`);
          this.sendDiscordAlert(`🔴 **${this.config.name}** disconnected from \`${this.config.host}:${this.config.port || 25565}\` (Session Uptime: ${uptime})`);
          this.connectStartTime = 0;
        }
        this.handleReconnect();
      } else {
        this.updateStatus('offline', 'Disconnected');
      }
    });
  }

  private setupAntiAfk() {
    if (this.antiAfkInterval) {
      clearInterval(this.antiAfkInterval);
      this.antiAfkInterval = null;
    }
    if (!this.config.antiAfk.enabled) return;

    const intervalMs = Math.max(3, this.config.antiAfk.intervalSeconds || 10) * 1000;

    // Log routine once initially or every 10 mins
    if (Date.now() - this.lastAntiAfkLogTime > 600000) {
      this.emitActivity('anti_afk', '🛡️ Anti-AFK routine active');
      this.lastAntiAfkLogTime = Date.now();
    }

    this.antiAfkInterval = setInterval(() => {
      // Manual input owns the movement controls until all held/stepped keys are released.
      if (this.manualMovementControls.size > 0) return;
      if (this.bedrockClient && this.currentStatus === 'online') {
        try {
          if (this.config.antiAfk.swingArm && Math.random() > 0.3) {
            const eid = (this.bedrockClient as any).entityId || (this.bedrockClient as any).startGameData?.runtime_entity_id || 1n;
            this.bedrockClient.queue('animate', {
              action_id: 1, // swing arm
              runtime_entity_id: eid,
            });
          }
        } catch (e) {}
        return;
      }

      if (!this.bot || !this.bot.entity) return;
      if (this.isEatingFood) return; // Never interrupt eating motion

      try {
        const { rotateHead, jump, sneak, swingArm } = this.config.antiAfk;

        // 1. Subtle head look rotation (natural motion)
        // If farming is active, NEVER rotate head so the bot's crosshair stays locked on the grinder/farm chute
        if (rotateHead && !this.config.farming?.enabled) {
          const deltaYaw = (Math.random() - 0.5) * 0.6;
          const deltaPitch = (Math.random() - 0.5) * 0.3;
          const newYaw = this.bot.entity.yaw + deltaYaw;
          const newPitch = Math.max(-1.4, Math.min(1.4, this.bot.entity.pitch + deltaPitch));
          this.bot.look(newYaw, newPitch, true);
        }

        // 2. Micro sneak
        if (sneak && Math.random() > 0.4) {
          this.bot.setControlState('sneak', true);
          const timeout = setTimeout(() => {
            this.antiAfkMovementTimeouts.delete(timeout);
            this.bot?.setControlState('sneak', false);
          }, 350);
          this.antiAfkMovementTimeouts.add(timeout);
        }

        // 3. Jump (if grounded)
        if (jump && (this.bot.entity as any).onGround && Math.random() > 0.6) {
          this.bot.setControlState('jump', true);
          const timeout = setTimeout(() => {
            this.antiAfkMovementTimeouts.delete(timeout);
            this.bot?.setControlState('jump', false);
          }, 250);
          this.antiAfkMovementTimeouts.add(timeout);
        }

        // 4. Arm swing
        if (swingArm && Math.random() > 0.3) {
          this.bot.swingArm('right');
        }
      } catch (err) {
        // Silently tolerate anti-afk action failure during chunk transitions
      }
    }, intervalMs);
  }

  public getMaxHealth(): number {
    if (!this.bot) return 20;

    // 0. Use explicitly captured customMaxHealth from packets
    if (this.customMaxHealth && this.customMaxHealth > 0) {
      return this.customMaxHealth;
    }

    // 1. Check entity attributes (minecraft:generic.max_health)
    const entityAny = this.bot.entity as any;
    if (entityAny?.attributes) {
      const attr =
        entityAny.attributes['minecraft:generic.max_health'] ||
        entityAny.attributes['generic.max_health'];

      if (attr && typeof attr.value === 'number' && attr.value > 0) {
        let finalVal = attr.value;
        if (Array.isArray(attr.modifiers) && attr.modifiers.length > 0) {
          let op0 = 0;
          let op1 = 0;
          let op2 = 1;
          for (const mod of attr.modifiers) {
            if (mod.operation === 0) op0 += (mod.amount || 0);
            else if (mod.operation === 1) op1 += (mod.amount || 0);
            else if (mod.operation === 2) op2 *= (1 + (mod.amount || 0));
          }
          finalVal = Math.max(1, (attr.value + op0) * (1 + op1) * op2);
        }
        const calculated = Math.round(finalVal * 10) / 10;
        this.recordedMaxHealth = Math.max(this.recordedMaxHealth, calculated);
        return calculated;
      }
    }

    // 2. Check scoreboard lines for "Hearts: X" (e.g. FreshSMP / Lifesteal)
    if ((this.bot as any).scoreboards) {
      try {
        const boards = Object.values((this.bot as any).scoreboards);
        for (const board of boards as any[]) {
          if (!board || !board.items) continue;
          const items = Object.values(board.items) as any[];
          for (const it of items) {
            const text = it.displayName || it.name || '';
            const match = text.match(/Hearts?:\s*([0-9]+)/i);
            if (match) {
              const hearts = parseInt(match[1], 10);
              if (hearts > 0 && hearts <= 100) {
                const calculated = hearts * 2;
                this.recordedMaxHealth = Math.max(this.recordedMaxHealth, calculated);
                return calculated;
              }
            }
          }
        }
      } catch (e) {}
    }

    // 3. Check tablist / player displayName for hearts (e.g. FreshSMP tab list)
    try {
      const p = (this.bot as any).players?.[this.bot.username];
      const name = p?.displayName ? cleanMinecraftJsonText(p.displayName) : '';
      const match = name.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:❤|hearts?)/i);
      if (match) {
        const parsedHearts = parseFloat(match[1]);
        if (parsedHearts > 0 && parsedHearts <= 100) {
          const calculated = Math.round(parsedHearts * 2);
          this.recordedMaxHealth = Math.max(this.recordedMaxHealth, calculated);
          return calculated;
        }
      }
    } catch (e) {}

    // 4. Remember previously observed peak max health (e.g. before taking damage)
    if (this.recordedMaxHealth > 0) {
      return this.recordedMaxHealth;
    }

    // 5. If bot is at full hunger (food >= 18) and health is stable, that is their max health (e.g. 16 HP = 8 hearts)
    if (this.bot.health && (this.bot.food ?? 0) >= 18 && this.bot.health > 0) {
      const current = Math.round(this.bot.health * 10) / 10;
      this.recordedMaxHealth = Math.max(this.recordedMaxHealth, current);
      return current;
    }

    // 6. Fallback: if bot.health is higher than 20
    if (this.bot.health && this.bot.health > 20) {
      const current = Math.round(this.bot.health);
      this.recordedMaxHealth = Math.max(this.recordedMaxHealth, current);
      return current;
    }

    return 20;
  }

  private checkSurvivalActions() {
    if (this.bedrockClient) {
      this.checkBedrockAutoEat();
      return;
    }
    if (!this.bot) return;

    // 1. Auto Totem
    if (this.config.survival.autoTotem && this.bot.inventory) {
      try {
        const offhand = (this.bot.inventory.slots as any)[45];
        if (!offhand || offhand.name !== 'totem_of_undying') {
          const totem = this.bot.inventory.items().find((i) => i.name === 'totem_of_undying');
          if (totem) {
            this.bot.equip(totem, 'off-hand').then(() => {
              this.emitActivity('survival', '🛡️ Auto-totem: Equipped Totem of Undying in off-hand');
            }).catch(() => {});
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // 2. Universal Auto Eat & Healing
    if (this.config.survival.autoEat && !this.isEatingFood && this.bot.inventory) {
      try {
        const currentHealth = Math.round((this.bot.health ?? 20) * 10) / 10;
        const currentFood = this.bot.food ?? 20;
        const maxHealth = this.getMaxHealth();
        const isInjured = currentHealth < maxHealth;
        const isHungry = currentFood < 20;
        const eatThreshold = this.config.survival.eatThreshold || (maxHealth - 2);
        const hungerBelowThreshold = currentFood <= eatThreshold;

        // In Minecraft:
        // - Golden apple can be eaten anytime (even when food is 20) and grants instant Absorption + Regeneration!
        // - Regular foods can be consumed whenever food < 20.
        // - Natural regeneration occurs when food >= 18.
        // If injured and hungry (or hunger below threshold), eating is urgent!
        const shouldEatRegular = isHungry && (isInjured || hungerBelowThreshold);
        const shouldEatGolden = isInjured || shouldEatRegular;

        if (shouldEatRegular || shouldEatGolden) {
          const items = this.bot.inventory.items();

          // 1. Check for golden apple if injured
          let selectedFood = items.find((i) => ['enchanted_golden_apple', 'golden_apple'].includes(i.name));

          // 2. If no golden apple or food is < 20, search all slots for any edible food
          if (!selectedFood && shouldEatRegular) {
            const FOOD_PRIORITY = [
              'golden_carrot',
              'cooked_beef', 'steak', 'cooked_porkchop', 'cooked_mutton', 'cooked_salmon', 'cooked_chicken',
              'baked_potato', 'bread', 'cooked_cod', 'cooked_rabbit',
              'apple', 'carrot', 'sweet_berries', 'glow_berries', 'melon_slice',
              'pumpkin_pie', 'honey_bottle', 'cookie', 'dried_kelp', 'beetroot',
              'mushroom_stew', 'rabbit_stew', 'beetroot_soup',
              'potato', 'beef', 'porkchop', 'mutton', 'chicken', 'salmon', 'cod', 'rabbit'
            ];

            for (const fname of FOOD_PRIORITY) {
              const match = items.find((i) => i.name === fname);
              if (match) {
                selectedFood = match;
                break;
              }
            }

            // Universal fallback: check minecraft-data foods registry
            if (!selectedFood) {
              selectedFood = items.find((i) =>
                Boolean((this.bot as any)?.registry?.foodsByName?.[i.name]) &&
                !['rotten_flesh', 'pufferfish', 'poisonous_potato', 'spider_eye'].includes(i.name)
              );
            }
          }

          if (selectedFood) {
            const previousHotbarSlot = Number.isInteger((this.bot as any).quickBarSlot)
              ? (this.bot as any).quickBarSlot as number
              : 0;
            this.isEatingFood = true;
            const foodToEat = selectedFood;
            const foodName = foodToEat.displayName || foodToEat.name;

            this.bot.equip(foodToEat, 'hand')
              .then(async () => {
                this.emitActivity('survival', `🍖 Auto-eat: Consuming ${foodName} (HP: ${Math.round(currentHealth)}/20, Hunger: ${currentFood}/20)`);
                try {
                  await this.bot?.consume();
                  this.emitActivity('survival', `✨ Finished eating ${foodName} (Now HP: ${Math.round(this.bot?.health || 0)}/20, Hunger: ${this.bot?.food || 0}/20)`);
                } catch (err: any) {
                  // Eating interrupted or failed
                } finally {
                  await this.restoreJavaMainHandAfterEating(previousHotbarSlot);
                  this.isEatingFood = false;
                  this.emitTelemetry();
                }
              })
              .catch(() => {
                void this.restoreJavaMainHandAfterEating(previousHotbarSlot);
                this.isEatingFood = false;
                this.emitTelemetry();
              });
          }
        }
      } catch (e) {
        this.isEatingFood = false;
      }
    }
  }

  private async restoreJavaMainHandAfterEating(previousHotbarSlot: number) {
    const bot = this.bot;
    if (!bot || this.currentStatus !== 'online' || !bot.inventory) return;

    try {
      if (this.config.farming?.enabled && this.config.farming.autoEquipSword) {
        const isWeapon = (item: any) => Boolean(item && (item.name?.includes('sword') || item.name?.includes('axe')));
        if (isWeapon(bot.heldItem)) return;

        const hotbarWeapon = Array.from({ length: 9 }, (_, slot) => bot.inventory.slots[36 + slot])
          .find(isWeapon);
        if (hotbarWeapon) {
          bot.setQuickBarSlot(hotbarWeapon.slot - 36);
          return;
        }

        const inventoryWeapon = bot.inventory.items().find(isWeapon);
        if (inventoryWeapon) {
          await bot.equip(inventoryWeapon, 'hand');
          return;
        }
      }

      bot.setQuickBarSlot(Math.max(0, Math.min(8, previousHotbarSlot)));
    } catch (err: any) {
      console.warn(`[VistaAFK] Could not restore the preferred main-hand item after eating: ${err?.message || err}`);
    }
  }

  private handleReconnect() {
    if (!this.config.autoReconnect || this.isManuallyStopped) {
      this.updateStatus('offline', 'Disconnected');
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff capped at 60 seconds
    const delay = Math.min(60000, (this.config.reconnectDelayMs || 5000) * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 5)));
    const delaySec = Math.round(delay / 1000);
    this.updateStatus('reconnecting', `Reconnecting in ${delaySec}s (attempt ${this.reconnectAttempts})...`);
    this.emitActivity('reconnect', `🔄 Reconnecting in ${delaySec}s (attempt #${this.reconnectAttempts})...`);

    this.reconnectTimeout = setTimeout(() => {
      this.start();
    }, delay);
  }

  private setupTelemetryLoop() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    this.telemetryInterval = setInterval(() => {
      this.emitTelemetry();
      this.checkSurvivalActions();
      this.logBedrockChatPacketStats();
    }, 2000);
  }

  private logBedrockChatPacketStats() {
    if (!this.bedrockClient) return;
    const now = Date.now();
    if (now - this.bedrockChatStatsLastLoggedAt < 30000) return;
    this.bedrockChatPacketStats = { text: 0, player: 0, system: 0 };
    this.bedrockChatStatsLastLoggedAt = now;
  }

  private emitTelemetry() {
    this.callbacks.onTelemetryUpdate(this.getTelemetry());
  }

  public togglePatrol(enabled: boolean) {
    this.isPatrolling = enabled;
    if (this.patrolInterval) {
      clearInterval(this.patrolInterval);
      this.patrolInterval = null;
    }
    if (!this.bot || this.currentStatus !== 'online') {
      this.isPatrolling = false;
      return;
    }

    if (!enabled) {
      this.bot.setControlState('forward', false);
      this.bot.setControlState('back', false);
      this.callbacks.onNotification('info', `Patrol mode stopped for ${this.config.name}`, this.config.id);
      this.emitTelemetry();
      return;
    }

    this.callbacks.onNotification('success', `Patrol mode started for ${this.config.name} (Walking back and forth)`, this.config.id);
    let step = 0;
    this.patrolInterval = setInterval(() => {
      if (!this.bot || !this.bot.entity) return;
      step++;
      const phase = step % 8;
      if (phase >= 0 && phase <= 2) {
        this.bot.setControlState('forward', true);
      } else if (phase === 3) {
        this.bot.setControlState('forward', false);
      } else if (phase === 4) {
        const currentYaw = this.bot.entity.yaw;
        this.bot.look(currentYaw + Math.PI, 0, true);
      } else if (phase >= 5 && phase <= 6) {
        this.bot.setControlState('forward', true);
      } else {
        this.bot.setControlState('forward', false);
        const currentYaw = this.bot.entity.yaw;
        this.bot.look(currentYaw + Math.PI, 0, true);
      }
    }, 1000);
    this.emitTelemetry();
  }

  public move(control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', state: boolean, durationMs?: number) {
    if (!this.bot || this.currentStatus !== 'online') {
      console.warn(`[VistaAFK Bot ${this.config.name}] Cannot move: bot is offline or not spawned`);
      this.callbacks.onNotification('warn', `Cannot move ${this.config.name}: bot is offline or not spawned.`, this.config.id);
      return;
    }
    try {
      const wasManualControlActive = this.manualMovementControls.has(control);

      const clearMovementTimers = (target: typeof control) => {
        const timeout = this.movementTimeouts.get(target);
        if (timeout) clearTimeout(timeout);
        this.movementTimeouts.delete(target);
        const interval = this.movementTelemetryIntervals.get(target);
        if (interval) clearInterval(interval);
        this.movementTelemetryIntervals.delete(target);
        this.manualMovementControls.delete(target);
      };

      // Every new command replaces the previous timed command for this control.
      // This prevents an old click timeout from stopping a later held key press.
      clearMovementTimers(control);

      if (state) {
        this.manualMovementControls.add(control);
        this.clearAntiAfkMovementTimeouts();
        if (control === 'jump') this.clearAssistedJumpTimeouts();
        if (!this.manualMovementControls.has('sneak')) this.bot.setControlState('sneak', false);
        if (!this.manualMovementControls.has('jump')) this.bot.setControlState('jump', false);
      } else {
        this.manualMovementControls.delete(control);
      }

      // 1. If user takes manual control, pause any automated patrol so they don't conflict
      if (state && this.isPatrolling) {
        this.togglePatrol(false);
      }

      // If engaging movement, clear opposite conflicting controls
      if (state) {
        if (control === 'forward') {
          clearMovementTimers('back');
          this.bot.setControlState('back', false);
          clearMovementTimers('sneak');
          this.bot.setControlState('sneak', false);
          try { this.bot.setControlState('sprint', true); } catch (e) {}
        } else if (control === 'back') {
          clearMovementTimers('forward');
          this.bot.setControlState('forward', false);
          this.bot.setControlState('sprint', false);
          clearMovementTimers('sneak');
          this.bot.setControlState('sneak', false);
        } else if (control === 'left') {
          clearMovementTimers('right');
          this.bot.setControlState('right', false);
        } else if (control === 'right') {
          clearMovementTimers('left');
          this.bot.setControlState('left', false);
        }
      }

      // 2. Set Mineflayer movement control
      this.bot.setControlState(control, state);
      if (state && !wasManualControlActive) {
        this.emitActivity('status', `🎮 Manual control received: ${control}`);
      }

      if (!state) {
        if (control === 'forward') {
          try { this.bot.setControlState('sprint', false); } catch (e) {}
        }
        this.emitTelemetry();
        return;
      }

      // Auto-jump assistance: If grounded and walking forward/back/strafing, check for collision
      if (state && (control === 'forward' || control === 'back' || control === 'left' || control === 'right')) {
        const entAny = this.bot.entity as any;
        if (entAny?.onGround && entAny?.isCollidedHorizontally) {
          this.bot.setControlState('jump', true);
          const timeout = setTimeout(() => {
            this.assistedJumpTimeouts.delete(timeout);
            try { this.bot?.setControlState('jump', false); } catch (e) {}
          }, 300);
          this.assistedJumpTimeouts.add(timeout);
        }
      }

      // 3. Emit telemetry repeatedly during sustained movements so coordinates update in real time
      if (state && durationMs && durationMs > 0) {
        const emitInterval = setInterval(() => {
          if (!this.bot || this.currentStatus !== 'online') return;
          this.emitTelemetry();
          // Periodically check if auto-jump is needed while walking
          const entAny = this.bot?.entity as any;
          if (entAny?.onGround && entAny?.isCollidedHorizontally && !this.manualMovementControls.has('jump')) {
            try {
              this.bot?.setControlState('jump', true);
              const timeout = setTimeout(() => {
                this.assistedJumpTimeouts.delete(timeout);
                try { this.bot?.setControlState('jump', false); } catch (e) {}
              }, 250);
              this.assistedJumpTimeouts.add(timeout);
            } catch (e) {}
          }
        }, 150);

        const stopTimeout = setTimeout(() => {
          clearInterval(emitInterval);
          this.movementTelemetryIntervals.delete(control);
          this.movementTimeouts.delete(control);
          this.manualMovementControls.delete(control);
          try {
            if (this.bot) {
              this.bot.setControlState(control, false);
              if (control === 'forward') this.bot.setControlState('sprint', false);
              this.emitTelemetry();
            }
          } catch (e) {}
        }, durationMs);
        this.movementTelemetryIntervals.set(control, emitInterval);
        this.movementTimeouts.set(control, stopTimeout);
      } else {
        setTimeout(() => this.emitTelemetry(), 60);
      }
    } catch (e) {
      console.warn(`[VistaAFK Bot ${this.config.name}] Movement error:`, e);
    }
  }

  public look(yaw: number, pitch: number) {
    if (!this.bot || this.currentStatus !== 'online') return;
    try {
      this.bot.look(yaw, pitch, true);
      setTimeout(() => this.emitTelemetry(), 50);
    } catch (e) {}
  }

  public setupFarming() {
    if (this.farmingInterval) {
      clearInterval(this.farmingInterval);
      this.farmingInterval = null;
    }
    if (!this.config.farming?.enabled || !this.bot || this.currentStatus !== 'online') return;

    // Safety grace period: Never swing within the first 8 seconds of connecting/spawning
    // to prevent server-side lobby packet crash on Paper / GrimAC servers (e.g. FreshSMP)
    const timeSinceConnect = this.connectStartTime ? Date.now() - this.connectStartTime : 0;
    const initialDelay = timeSinceConnect < 8000 ? (8000 - timeSinceConnect) : 0;

    const baseInterval = Math.max(900, this.config.farming.swingIntervalMs || 1100);
    this.emitActivity('survival', `⚔️ Mob Farm active: Auto-swinging every ${(baseInterval / 1000).toFixed(1)}s (Auto-equip sword: ${this.config.farming.autoEquipSword ? 'ON' : 'OFF'})`);

    const runFarmingTick = async () => {
      if (!this.bot || !this.bot.entity || this.currentStatus !== 'online') return;
      if (this.manualMovementControls.size > 0) return;
      if (this.isEatingFood) return; // Respect auto-eat priority

      // Ensure bot has been alive and in world for at least 8 seconds
      if (this.connectStartTime && (Date.now() - this.connectStartTime) < 8000) return;

      try {
        // 1. Safe Weapon Selection (Swords & Axes - Check Hotbar first, avoid inventory window desyncs)
        if (this.config.farming?.autoEquipSword && Date.now() - this.lastSwordEquipCheck > 3000) {
          this.lastSwordEquipCheck = Date.now();
          const heldItem = this.bot.heldItem;
          const isHoldingWeapon = heldItem && (heldItem.name.includes('sword') || heldItem.name.includes('axe'));

          if (!isHoldingWeapon && this.bot.inventory) {
            const WEAPON_NAMES = [
              'netherite_sword', 'diamond_sword', 'iron_sword', 'golden_sword', 'stone_sword', 'wooden_sword',
              'netherite_axe', 'diamond_axe', 'iron_axe', 'golden_axe', 'stone_axe', 'wooden_axe'
            ];
            // First check hotbar slots (36 to 44 in mineflayer inventory)
            let hotbarWeaponSlot: number | null = null;
            for (let i = 0; i < 9; i++) {
              const item = this.bot.inventory.slots[36 + i];
              if (item && (WEAPON_NAMES.includes(item.name) || item.name.endsWith('_sword') || item.name.endsWith('_axe'))) {
                hotbarWeaponSlot = i;
                break;
              }
            }

            if (hotbarWeaponSlot !== null) {
              this.bot.setQuickBarSlot(hotbarWeaponSlot);
            } else {
              // Not on hotbar, find in main inventory and equip safely
              const items = this.bot.inventory.items();
              const weapon = items.find((i) => WEAPON_NAMES.includes(i.name) || i.name.endsWith('_sword') || i.name.endsWith('_axe'));
              if (weapon) {
                await this.bot.equip(weapon, 'hand');
                this.emitActivity('survival', `⚔️ Equipped ${weapon.displayName || weapon.name} from inventory`);
              }
            }
          }
        }

        // 2. Mob Attack / Grinder Strike with real raycast line-of-sight & 3.8m survival reach
        const targetMode = this.config.farming?.targetMode || 'continuous';
        const eyePos = this.bot.entity.position.offset(0, this.bot.entity.height || 1.62, 0);
        const currentYaw = this.bot.entity.yaw;
        const currentPitch = this.bot.entity.pitch;
        const cosP = Math.cos(currentPitch);
        const lookDir = {
          x: -Math.sin(currentYaw) * cosP,
          y: -Math.sin(currentPitch),
          z: -Math.cos(currentYaw) * cosP,
        };

        const IGNORED_NAMES = new Set([
          'item', 'experience_orb', 'arrow', 'spectral_arrow', 'trident',
          'armor_stand', 'boat', 'chest_boat', 'minecart', 'chest_minecart',
          'furnace_minecart', 'tnt_minecart', 'hopper_minecart', 'spawner_minecart',
          'painting', 'item_frame', 'glow_item_frame', 'leash_knot',
          'area_effect_cloud', 'eye_of_ender', 'end_crystal', 'firework_rocket'
        ]);

        let bestTarget: any = null;
        let bestTargetPos: any = null;
        let bestScore = -999;
        let bestDist = 999;

        if (this.bot.entities) {
          for (const e of Object.values(this.bot.entities) as any[]) {
            if (!e || e === this.bot.entity || !e.position || e.isValid === false) continue;
            if (e.type === 'player') continue;
            const rawName = (e.name || '').toLowerCase();
            if (IGNORED_NAMES.has(rawName)) continue;
            if (['object', 'projectile', 'orb'].includes(e.type)) continue;

            const targetPos = e.position.offset(0, Math.min(1.0, (e.height || 1.8) * 0.5), 0);
            const dx = targetPos.x - eyePos.x;
            const dy = targetPos.y - eyePos.y;
            const dz = targetPos.z - eyePos.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > 3.8) continue; // Out of survival reach

            const dirX = dx / (dist || 1);
            const dirY = dy / (dist || 1);
            const dirZ = dz / (dist || 1);
            const dot = lookDir.x * dirX + lookDir.y * dirY + lookDir.z * dirZ;

            // Prioritize mobs aligned with where the bot is looking (dot > 0), then distance
            const score = dot * 2.5 - (dist / 3.8);
            if (score > bestScore) {
              bestScore = score;
              bestTarget = e;
              bestTargetPos = targetPos;
              bestDist = dist;
            }
          }
        }

        if (this.manualMovementControls.size > 0) return;

        if (bestTarget && bestTargetPos) {
          // Look directly at target hitbox center so the server validates line-of-sight raycast
          await this.bot.lookAt(bestTargetPos, true);
          this.bot.attack(bestTarget);

          if (Date.now() - this.lastMobAttackLogTime > 4000) {
            this.lastMobAttackLogTime = Date.now();
            const mobName = (bestTarget.name || 'mob').replace(/_/g, ' ');
            this.emitActivity('survival', `⚔️ Slashed ${mobName} in farm chute (${bestDist.toFixed(1)}m away)`);
          }
        } else if (targetMode === 'continuous') {
          // In mob farm chute: swing arm into chute
          this.bot.swingArm('right');
        }
      } catch (err: any) {
        // Safe catch
      }
    };

    if (initialDelay > 0) {
      setTimeout(() => {
        if (this.config.farming?.enabled && this.bot && this.currentStatus === 'online') {
          this.farmingInterval = setInterval(runFarmingTick, baseInterval);
        }
      }, initialDelay);
    } else {
      this.farmingInterval = setInterval(runFarmingTick, baseInterval);
    }
  }

  public async manualAttack() {
    if (!this.bot || this.currentStatus !== 'online') return;
    try {
      // Auto equip weapon if available
      const held = this.bot.heldItem;
      const isHoldingWeapon = held && (held.name.includes('sword') || held.name.includes('axe'));
      if (!isHoldingWeapon && this.bot.inventory) {
        const WEAPON_NAMES = ['netherite_sword', 'diamond_sword', 'iron_sword', 'golden_sword', 'stone_sword', 'wooden_sword', 'netherite_axe', 'diamond_axe', 'iron_axe', 'golden_axe', 'stone_axe', 'wooden_axe'];
        for (let i = 0; i < 9; i++) {
          const item = this.bot.inventory.slots[36 + i];
          if (item && (WEAPON_NAMES.includes(item.name) || item.name.endsWith('_sword') || item.name.endsWith('_axe'))) {
            this.bot.setQuickBarSlot(i);
            break;
          }
        }
      }

      const eyePos = this.bot.entity.position.offset(0, this.bot.entity.height || 1.62, 0);
      const currentYaw = this.bot.entity.yaw;
      const currentPitch = this.bot.entity.pitch;
      const cosP = Math.cos(currentPitch);
      const lookDir = {
        x: -Math.sin(currentYaw) * cosP,
        y: -Math.sin(currentPitch),
        z: -Math.cos(currentYaw) * cosP,
      };

      const IGNORED_NAMES = new Set([
        'item', 'experience_orb', 'arrow', 'spectral_arrow', 'trident',
        'armor_stand', 'boat', 'chest_boat', 'minecart', 'chest_minecart',
        'painting', 'item_frame', 'glow_item_frame', 'leash_knot',
        'area_effect_cloud', 'eye_of_ender', 'end_crystal', 'firework_rocket'
      ]);

      let bestTarget: any = null;
      let bestTargetPos: any = null;
      let bestScore = -999;

      if (this.bot.entities) {
        for (const e of Object.values(this.bot.entities) as any[]) {
          if (!e || e === this.bot.entity || !e.position || e.isValid === false) continue;
          if (e.type === 'player') continue;
          const rawName = (e.name || '').toLowerCase();
          if (IGNORED_NAMES.has(rawName)) continue;
          if (['object', 'projectile', 'orb'].includes(e.type)) continue;

          const targetPos = e.position.offset(0, Math.min(1.0, (e.height || 1.8) * 0.5), 0);
          const dx = targetPos.x - eyePos.x;
          const dy = targetPos.y - eyePos.y;
          const dz = targetPos.z - eyePos.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > 3.8) continue;

          const dirX = dx / (dist || 1);
          const dirY = dy / (dist || 1);
          const dirZ = dz / (dist || 1);
          const dot = lookDir.x * dirX + lookDir.y * dirY + lookDir.z * dirZ;

          const score = dot * 2.5 - (dist / 3.8);
          if (score > bestScore) {
            bestScore = score;
            bestTarget = e;
            bestTargetPos = targetPos;
          }
        }
      }

      if (bestTarget && bestTargetPos) {
        await this.bot.lookAt(bestTargetPos, true);
        this.bot.attack(bestTarget);
        this.emitActivity('survival', `⚔️ Manual attack: Hit ${(bestTarget.name || 'mob').replace(/_/g, ' ')}`);
      } else {
        this.bot.swingArm('right');
      }
      this.emitTelemetry();
    } catch (e) {
      console.warn(`[VistaAFK Bot ${this.config.name}] Manual attack error:`, e);
    }
  }

  public async moveSlotItem(sourceSlot: number, targetSlot: number) {
    if (this.bedrockClient && this.currentStatus === 'online') {
      const source = this.getBedrockInventoryAddress(sourceSlot);
      const destination = this.getBedrockInventoryAddress(targetSlot);
      if (!source || !destination || sourceSlot === targetSlot) return;
      if (!(this.bedrockClient.startGameData as any)?.server_authoritative_inventory) {
        this.callbacks.onNotification('warn', 'Bedrock inventory moves are not supported by this server inventory mode yet.', this.config.id);
        return;
      }
      try {
        const sourceItem = this.bedrockInventorySlots[sourceSlot];
        const destinationItem = this.bedrockInventorySlots[targetSlot];
        this.bedrockGuiRequestId = this.bedrockGuiRequestId >= 0x7ffffffe ? 1 : this.bedrockGuiRequestId + 1;
        this.bedrockClient.queue('item_stack_request', {
          requests: [{
            request_id: this.bedrockGuiRequestId,
            actions: [{
              type_id: 'swap',
              legacy_type_id: 0,
              source: { slot_type: { container_id: source.containerId }, slot: source.slot, stack_id: Number(sourceItem?.stack_id) || 0 },
              destination: { slot_type: { container_id: destination.containerId }, slot: destination.slot, stack_id: Number(destinationItem?.stack_id) || 0 },
            }],
            custom_names: [],
            cause: 'chat_public',
          }],
        });
        this.emitActivity('survival', `📦 Requested Bedrock inventory move from slot #${sourceSlot} to #${targetSlot}`);
      } catch (err: any) {
        console.error(`[VistaAFK] Failed to move Bedrock inventory item:`, err?.message || err);
        this.callbacks.onNotification('error', `Failed to move inventory item: ${err?.message || 'Unknown error'}`, this.config.id);
      }
      return;
    }
    if (!this.bot || this.currentStatus !== 'online') {
      this.callbacks.onNotification('warn', 'Bot is offline, cannot move items', this.config.id);
      return;
    }
    try {
      if (typeof (this.bot as any).moveSlotItem === 'function') {
        await (this.bot as any).moveSlotItem(sourceSlot, targetSlot);
      } else {
        await (this.bot as any).clickWindow(sourceSlot, 0, 0);
        await (this.bot as any).clickWindow(targetSlot, 0, 0);
        if (this.bot.inventory?.selectedItem) {
          await (this.bot as any).clickWindow(sourceSlot, 0, 0);
        }
      }
      this.callbacks.onNotification('success', `Moved item between slot #${sourceSlot} and #${targetSlot}`, this.config.id);
      this.emitActivity('survival', `📦 Moved item from slot #${sourceSlot} to #${targetSlot}`);
      this.emitTelemetry();
    } catch (err: any) {
      console.error(`[VistaAFK] Failed to move slot item from ${sourceSlot} to ${targetSlot}:`, err.message);
      this.callbacks.onNotification('error', `Failed to move item: ${err.message}`, this.config.id);
    }
  }

  public async setQuickBarSlot(slot: number) {
    if (this.bedrockClient && this.currentStatus === 'online') {
      this.selectBedrockHotbarSlot(slot);
      return;
    }
    if (!this.bot || this.currentStatus !== 'online') return;
    try {
      this.bot.setQuickBarSlot(slot);
      this.emitTelemetry();
    } catch (err: any) {
      console.error(`[VistaAFK] Failed to set quick bar slot ${slot}:`, err.message);
    }
  }

  private registerBedrockItemNames(itemStates: any) {
    if (!Array.isArray(itemStates)) return;
    for (const item of itemStates) {
      const runtimeId = Number(item?.runtime_id);
      if (Number.isInteger(runtimeId) && typeof item?.name === 'string') {
        this.bedrockItemNames.set(runtimeId, item.name.replace(/^minecraft:/, ''));
      }
    }
  }

  private normalizeBedrockContainerId(containerId: unknown, windowId?: unknown): string | null {
    if (typeof containerId === 'string') {
      const normalized = containerId.trim().toLowerCase();
      if (!/^\d+$/.test(normalized)) return BEDROCK_PLAYER_CONTAINERS.has(normalized) ? normalized : null;
      const mapped: Record<number, string> = { 6: 'armor', 12: 'hotbar_and_inventory', 28: 'hotbar', 29: 'inventory', 34: 'offhand' };
      return mapped[Number(normalized)] || null;
    }
    if (typeof containerId === 'number') {
      const mapped: Record<number, string> = { 6: 'armor', 12: 'hotbar_and_inventory', 28: 'hotbar', 29: 'inventory', 34: 'offhand' };
      return mapped[containerId] || null;
    }
    if (windowId === 0 || windowId === 'inventory') return 'hotbar_and_inventory';
    return null;
  }

  private bedrockLogicalSlot(containerId: string, slot: number): number | null {
    if (!Number.isInteger(slot) || slot < 0) return null;
    if (containerId === 'hotbar_and_inventory') {
      if (slot <= 8) return 36 + slot;
      if (slot <= 35) return slot;
      return null;
    }
    if (containerId === 'hotbar') return slot <= 8 ? 36 + slot : null;
    if (containerId === 'inventory') return slot <= 26 ? 9 + slot : null;
    if (containerId === 'armor') return slot <= 3 ? 5 + slot : null;
    if (containerId === 'offhand') return slot === 0 ? 45 : null;
    return null;
  }

  private updateBedrockPlayerInventory(containerId: unknown, items: unknown, windowId?: unknown): boolean {
    const normalized = this.normalizeBedrockContainerId(containerId, windowId);
    if (!normalized || !Array.isArray(items)) return false;
    for (let index = 0; index < items.length; index++) {
      const logicalSlot = this.bedrockLogicalSlot(normalized, index);
      if (logicalSlot !== null) this.bedrockInventorySlots[logicalSlot] = items[index] || null;
    }
    return true;
  }

  private updateBedrockPlayerInventorySlot(containerId: unknown, slot: number, item: unknown, windowId?: unknown): boolean {
    const normalized = this.normalizeBedrockContainerId(containerId, windowId);
    if (!normalized) return false;
    const logicalSlot = this.bedrockLogicalSlot(normalized, slot);
    if (logicalSlot === null) return false;
    this.bedrockInventorySlots[logicalSlot] = item || null;
    return true;
  }

  private getBedrockInventoryAddress(logicalSlot: number): { containerId: string; slot: number } | null {
    if (!Number.isInteger(logicalSlot)) return null;
    if (logicalSlot >= 9 && logicalSlot <= 35) return { containerId: 'hotbar_and_inventory', slot: logicalSlot };
    if (logicalSlot >= 36 && logicalSlot <= 44) return { containerId: 'hotbar_and_inventory', slot: logicalSlot - 36 };
    if (logicalSlot >= 5 && logicalSlot <= 8) return { containerId: 'armor', slot: logicalSlot - 5 };
    if (logicalSlot === 45) return { containerId: 'offhand', slot: 0 };
    return null;
  }

  private selectBedrockHotbarSlot(slot: number) {
    if (!this.bedrockClient || !Number.isInteger(slot) || slot < 0 || slot > 8) return;
    const rawItem = this.bedrockInventorySlots[36 + slot] || { network_id: 0, count: 0, metadata: 0, has_stack_id: false, block_runtime_id: 0, extra: { value: {} } };
    const runtimeId = Number((this.bedrockClient as any).entityId || (this.bedrockClient as any).startGameData?.runtime_entity_id);
    if (!Number.isFinite(runtimeId)) return;
    try {
      this.bedrockClient.queue('mob_equipment', {
        runtime_entity_id: runtimeId,
        item: rawItem,
        slot,
        selected_slot: slot,
        window_id: 'inventory',
      });
      this.bedrockSelectedSlot = slot;
      this.emitTelemetry();
    } catch (err: any) {
      console.warn(`[VistaAFK] Could not select Bedrock hotbar slot ${slot}:`, err?.message || err);
    }
  }

  private checkBedrockAutoEat() {
    if (!this.config.survival.autoEat || this.isEatingFood || !this.bedrockClient || this.currentStatus !== 'online') return;
    if (Date.now() - this.bedrockLastEatAt < 5000) return;

    const foodPriority = [
      'golden_carrot', 'cooked_beef', 'steak', 'cooked_porkchop', 'cooked_mutton', 'cooked_salmon', 'cooked_chicken',
      'baked_potato', 'bread', 'cooked_cod', 'cooked_rabbit', 'apple', 'carrot', 'sweet_berries', 'glow_berries',
      'melon_slice', 'pumpkin_pie', 'honey_bottle', 'cookie', 'dried_kelp', 'beetroot', 'mushroom_stew',
      'rabbit_stew', 'beetroot_soup', 'potato', 'beef', 'porkchop', 'mutton', 'chicken', 'salmon', 'cod', 'rabbit',
    ];
    const injured = this.bedrockHealth < this.bedrockMaxHealth;
    const hungry = this.bedrockFood < 20;
    if (!hungry && !injured) return;
    const canSwapInventory = Boolean((this.bedrockClient.startGameData as any)?.server_authoritative_inventory);
    const foodSlots = Array.from({ length: canSwapInventory ? 36 : 9 }, (_, offset) => offset + (canSwapInventory ? 9 : 36));

    let selectedIndex = -1;
    if (injured) {
      selectedIndex = foodSlots.find((index) => {
        const name = this.serializeBedrockItem(this.bedrockInventorySlots[index], index)?.name;
        return name === 'golden_apple' || name === 'enchanted_golden_apple';
      }) ?? -1;
    }
    if (selectedIndex < 0 && hungry) {
      for (const foodName of foodPriority) {
        selectedIndex = foodSlots.find((index) => this.serializeBedrockItem(this.bedrockInventorySlots[index], index)?.name === foodName) ?? -1;
        if (selectedIndex >= 0) break;
      }
    }
    if (selectedIndex < 0) return;

    const sourceSlot = selectedIndex < 36 ? selectedIndex : null;
    const selectedItem = this.serializeBedrockItem(this.bedrockInventorySlots[selectedIndex], selectedIndex);
    if (!selectedItem) return;
    const previousSlot = this.bedrockSelectedSlot;
    this.isEatingFood = true;
    this.bedrockLastEatAt = Date.now();
    if (sourceSlot !== null) {
      if (!this.requestBedrockInventorySwap(sourceSlot, 36 + previousSlot)) {
        this.isEatingFood = false;
        return;
      }
      setTimeout(() => this.beginBedrockEating(36 + previousSlot, previousSlot, previousSlot, sourceSlot, selectedItem.name), 450);
      return;
    }

    const hotbarSlot = selectedIndex - 36;
    this.selectBedrockHotbarSlot(hotbarSlot);
    this.beginBedrockEating(selectedIndex, hotbarSlot, previousSlot, null, selectedItem.name);
  }

  private requestBedrockInventorySwap(sourceSlot: number, targetSlot: number): boolean {
    if (!this.bedrockClient || !(this.bedrockClient.startGameData as any)?.server_authoritative_inventory) return false;
    const source = this.getBedrockInventoryAddress(sourceSlot);
    const destination = this.getBedrockInventoryAddress(targetSlot);
    if (!source || !destination || sourceSlot === targetSlot) return false;
    const sourceItem = this.bedrockInventorySlots[sourceSlot];
    const destinationItem = this.bedrockInventorySlots[targetSlot];
    this.bedrockGuiRequestId = this.bedrockGuiRequestId >= 0x7ffffffe ? 1 : this.bedrockGuiRequestId + 1;
    try {
      this.bedrockClient.queue('item_stack_request', {
        requests: [{
          request_id: this.bedrockGuiRequestId,
          actions: [{
            type_id: 'swap',
            legacy_type_id: 0,
            source: { slot_type: { container_id: source.containerId }, slot: source.slot, stack_id: Number(sourceItem?.stack_id) || 0 },
            destination: { slot_type: { container_id: destination.containerId }, slot: destination.slot, stack_id: Number(destinationItem?.stack_id) || 0 },
          }],
          custom_names: [],
          cause: 'chat_public',
        }],
      });
      return true;
    } catch (err: any) {
      console.warn('[VistaAFK] Bedrock inventory swap failed:', err?.message || err);
      return false;
    }
  }

  private beginBedrockEating(inventorySlot: number, hotbarSlot: number, previousSlot: number, swapBackToSlot: number | null, expectedName: string, retry = 0) {
    if (!this.bedrockClient || this.currentStatus !== 'online') {
      this.isEatingFood = false;
      return;
    }
    const rawItem = this.bedrockInventorySlots[inventorySlot];
    const item = this.serializeBedrockItem(rawItem, inventorySlot);
    if (!item || !rawItem || item.name !== expectedName) {
      if (retry < 5 && this.bedrockClient && this.currentStatus === 'online') {
        setTimeout(() => this.beginBedrockEating(inventorySlot, hotbarSlot, previousSlot, swapBackToSlot, expectedName, retry + 1), 200);
        return;
      }
      if (swapBackToSlot !== null && item?.name === expectedName) this.requestBedrockInventorySwap(36 + hotbarSlot, swapBackToSlot);
      this.isEatingFood = false;
      return;
    }
    const position = this.bedrockPosition;
    try {
      this.bedrockClient.queue('inventory_transaction', {
        transaction: {
          legacy: { legacy_request_id: 0, legacy_transactions: null },
          transaction_type: 'item_use',
          actions: [],
          transaction_data: {
            action_type: 'click_air',
            trigger_type: 'player_input',
            block_position: { x: 0, y: 0, z: 0 },
            face: 0xff,
            hotbar_slot: hotbarSlot,
            hand: 'main_hand',
            held_item: rawItem,
            player_pos: position,
            click_pos: { x: 0, y: 0, z: 0 },
            block_runtime_id: 0,
            client_prediction: 'success',
            client_cooldown_state: 'off',
          },
        },
      });
      this.emitActivity('survival', `🍖 Auto-eat: Using ${item.displayName} (HP: ${this.bedrockHealth}/${this.bedrockMaxHealth}, Hunger: ${this.bedrockFood}/20)`);
      setTimeout(() => {
        if (!this.bedrockClient || this.currentStatus !== 'online') {
          this.isEatingFood = false;
          return;
        }
        try {
          this.bedrockClient.queue('inventory_transaction', {
            transaction: {
              legacy: { legacy_request_id: 0, legacy_transactions: null },
              transaction_type: 'item_release',
              actions: [],
              transaction_data: {
                action_type: 'consume',
                hotbar_slot: hotbarSlot,
                held_item: rawItem,
                head_pos: { x: position.x, y: position.y + 1.62, z: position.z },
              },
            },
          });
        } catch (err: any) {
          console.warn('[VistaAFK] Bedrock auto-eat release failed:', err?.message || err);
        }
        if (swapBackToSlot !== null) this.requestBedrockInventorySwap(36 + hotbarSlot, swapBackToSlot);
        if (previousSlot !== hotbarSlot) this.selectBedrockHotbarSlot(previousSlot);
        setTimeout(() => {
          this.isEatingFood = false;
          this.emitTelemetry();
        }, 500);
      }, 1700);
    } catch (err: any) {
      this.isEatingFood = false;
      console.warn('[VistaAFK] Bedrock auto-eat failed:', err?.message || err);
    }
  }

  private serializeBedrockItem(item: any, slot: number): InventoryItem | null {
    const networkId = Number(item?.network_id);
    if (!Number.isInteger(networkId) || networkId === 0 || Number(item?.count) <= 0) return null;
    const name = this.bedrockItemNames.get(networkId) || `unknown_item_${Math.abs(networkId)}`;
    const cleanName = name.replace(/^minecraft:/, '');
    const isGeyserCustom = cleanName.toLowerCase().startsWith('geyser_custom:');

    let displayName = cleanName
      .replace(/^geyser_custom:/i, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

    if (isGeyserCustom && (cleanName.includes('cash') || cleanName.includes('reward') || cleanName.includes('fresh'))) {
      displayName = 'AFK Cash';
    }

    const { customName, lore } = extractBedrockItemData(item);

    // If item is bell in AFK menu and name is default, give it the proper title
    if (cleanName === 'bell' && !customName && lore && lore.some((l) => /afk reward/i.test(l))) {
      displayName = 'CLAIM AFK REWARD';
    }

    return {
      slot,
      name,
      displayName: customName || displayName,
      count: Number(item.count) || 1,
      customName: customName || undefined,
      lore: lore && lore.length ? lore : undefined,
    };
  }

  public respondGuiForm(response: boolean | number | Array<unknown>) {
    if (!this.bedrockClient || this.currentStatus !== 'online' || this.bedrockGuiWindow?.kind !== 'form') return;
    const window = this.bedrockGuiWindow;
    if (window.formType === 'modal' && typeof response !== 'boolean') return;
    if (window.formType === 'simple' && (!Number.isInteger(response) || Number(response) < 0 || Number(response) >= (window.formButtons?.length || 0))) return;
    if (window.formType === 'custom' && (!Array.isArray(response) || response.length !== (window.formElements?.length || 0))) return;

    try {
      this.bedrockClient.queue('modal_form_response', {
        form_id: window.id,
        has_response_data: true,
        data: JSON.stringify(response),
        has_cancel_reason: false,
      });
      this.bedrockGuiWindow = null;
      this.emitActivity('command', `🖱️ Responded to Bedrock server form: ${window.title}`);
      this.emitTelemetry();
    } catch (err: any) {
      console.error(`[VistaAFK] Failed to respond to Bedrock server form ${window.id}:`, err?.message || err);
      this.callbacks.onNotification('error', `Failed to respond to server form: ${err?.message || 'Unknown error'}`, this.config.id);
    }
  }

  public async closeGuiWindow() {
    if (this.bedrockClient && this.currentStatus === 'online') {
      const window = this.bedrockGuiWindow;
      if (!window) return;
      try {
        if (window.kind === 'form') {
          this.bedrockClient.queue('modal_form_response', {
            form_id: window.id,
            has_response_data: false,
            has_cancel_reason: true,
            cancel_reason: 0,
          });
        } else {
          this.bedrockClient.queue('container_close', {
            window_id: window.id,
            window_type: window.type || 'container',
            server: false,
          });
        }
        this.bedrockGuiWindow = null;
        this.bedrockGuiRawSlots = [];
        this.emitTelemetry();
      } catch (err: any) {
        console.error(`[VistaAFK] Failed to close Bedrock GUI for ${this.config.name}:`, err?.message || err);
        this.callbacks.onNotification('error', `Failed to close Bedrock menu: ${err?.message || 'Unknown error'}`, this.config.id);
      }
      return;
    }

    const bot = this.bot;
    if (!bot || this.currentStatus !== 'online') return;
    const window = bot.currentWindow;
    const windowId = window?.id ?? this.lastJavaGuiWindowId;
    if (typeof windowId !== 'number' || !Number.isInteger(windowId)) {
      this.emitTelemetry();
      return;
    }
    try {
      if (window && typeof bot.closeWindow === 'function') {
        await bot.closeWindow(window);
      } else {
        // The dashboard may still show an open-menu snapshot after Mineflayer
        // has cleared its local window. Send the protocol close using the last
        // server window id so the menu is closed in-game as well.
        bot._client.write('close_window', { windowId });
      }
      this.lastJavaGuiWindowId = null;
      this.emitTelemetry();
      this.emitActivity('status', 'Closed the open server menu');
    } catch (err: any) {
      try {
        bot._client.write('close_window', { windowId });
        if (window && bot.currentWindow === window) {
          bot.currentWindow = null;
          bot.emit('windowClose', window);
        }
        this.lastJavaGuiWindowId = null;
        this.emitTelemetry();
      } catch {}
      console.error(`[VistaAFK] Failed to close Java GUI for ${this.config.name}:`, err?.message || err);
      this.callbacks.onNotification('error', `Failed to close menu: ${err?.message || 'Unknown error'}`, this.config.id);
    }
  }

  public async clickGuiWindowSlot(slot: number, mouseButton = 0) {
    if (this.bedrockClient && this.currentStatus === 'online') {
      const window = this.bedrockGuiWindow;
      const item = this.bedrockGuiRawSlots[slot];
      if (!window || window.kind !== 'container' || !Number.isInteger(slot) || slot < 0 || !item || Number(item.network_id) === 0) return;
      if (!(this.bedrockClient.startGameData as any)?.server_authoritative_inventory) {
        this.callbacks.onNotification('warn', 'Bedrock menu clicks are not supported by this server inventory mode yet.', this.config.id);
        return;
      }
      try {
        const sourceContainer = {
          container_id: this.bedrockGuiContainer.container_id,
          ...(this.bedrockGuiContainer.dynamic_container_id !== undefined ? { dynamic_container_id: this.bedrockGuiContainer.dynamic_container_id } : {}),
        };
        this.bedrockGuiRequestId = this.bedrockGuiRequestId >= 0x7ffffffe ? 1 : this.bedrockGuiRequestId + 1;
        this.bedrockClient.queue('item_stack_request', {
          requests: [{
            request_id: this.bedrockGuiRequestId,
            actions: [{
              type_id: 'take',
              legacy_type_id: 0,
              count: mouseButton === 1 ? Math.max(1, Math.ceil(Number(item.count || 1) / 2)) : Math.max(1, Number(item.count) || 1),
              source: {
                slot_type: sourceContainer,
                slot,
                stack_id: Number(item.stack_id) || 0,
              },
              destination: {
                slot_type: { container_id: 'cursor' },
                slot: 0,
                stack_id: 0,
              },
            }],
            custom_names: [],
            cause: 'chat_public',
          }],
        });
        this.emitActivity('command', `🖱️ Clicked Bedrock server menu slot ${slot + 1}`);
      } catch (err: any) {
        console.error(`[VistaAFK] Failed to click Bedrock server GUI slot ${slot}:`, err?.message || err);
        this.callbacks.onNotification('error', `Failed to click Bedrock menu: ${err?.message || 'Unknown error'}`, this.config.id);
      }
      return;
    }
    if (!this.bot || this.currentStatus !== 'online') return;
    const window = this.bot.currentWindow;
    if (!window || !Number.isInteger(slot) || slot < 0 || slot >= window.slots.length) return;
    try {
      await this.bot.clickWindow(slot, mouseButton, 0);
      this.emitTelemetry();
      setTimeout(() => this.emitTelemetry(), 120);
    } catch (err: any) {
      console.error(`[VistaAFK] Failed to click server GUI slot ${slot}:`, err?.message || err);
      this.callbacks.onNotification('error', `Failed to click server menu: ${err?.message || 'Unknown error'}`, this.config.id);
    }
  }

  public getTelemetry(): BotTelemetry {
    if (this.bedrockClient) {
      const pos = this.bedrockPosition || { x: 0, y: 0, z: 0 };
      const hp = this.bedrockHealth ?? this.bedrockMaxHealth;
      const maxHp = this.bedrockMaxHealth ?? 20;
      const hearts = Math.round((hp / 2) * 10) / 10;
      return {
        id: this.config.id,
        name: this.config.name,
        status: this.currentStatus,
        statusMessage: this.statusMessage,
        authCodeInfo: this.authCodeInfo,
        health: hp,
        maxHealth: maxHp,
        hearts,
        maxHearts: Math.round((maxHp / 2) * 10) / 10,
        food: this.bedrockFood,
        coordinates: pos,
        dimension: 'overworld',
        ping: 0,
        gamemode: 'survival',
        uptimeSeconds: this.connectStartTime ? Math.floor((Date.now() - this.connectStartTime) / 1000) : 0,
        heldItem: this.serializeBedrockItem(this.bedrockInventorySlots[36 + this.bedrockSelectedSlot], 36 + this.bedrockSelectedSlot)?.name,
        offhandItem: this.serializeBedrockItem(this.bedrockInventorySlots[45], 45)?.name,
        inventoryCount: this.bedrockInventorySlots.reduce((count, item, slot) => count + (this.serializeBedrockItem(item, slot) ? 1 : 0), 0),
        inventory: this.bedrockInventorySlots.flatMap((item, slot) => {
          const serialized = this.serializeBedrockItem(item, slot);
          return serialized ? [serialized] : [];
        }),
        selectedSlot: this.bedrockSelectedSlot,
        openWindow: this.bedrockGuiWindow,
        facing: 'North',
        yaw: 0,
        pitch: 0,
        targetBlock: null,
        nearbyEntities: [],
        nearbyPlayers: [],
        nearbyMobs: [],
        currentBiome: 'Overworld',
        currentLandBlock: 'Bedrock',
        terrainGrid: null,
        isPatrolling: false,
        isFarming: false,
        afkRewardsAvailable: this.afkRewardsAvailable,
      };
    }

    if (!this.bot || !this.bot.entity) {
      return {
        id: this.config.id,
        name: this.config.name,
        status: this.currentStatus,
        statusMessage: this.statusMessage,
        authCodeInfo: this.authCodeInfo,
        health: 0,
        maxHealth: 20,
        hearts: 0,
        maxHearts: 10,
        food: 0,
        coordinates: { x: 0, y: 0, z: 0 },
        dimension: 'unknown',
        ping: 0,
        gamemode: 'survival',
        uptimeSeconds: 0,
        inventoryCount: 0,
        openWindow: null,
        facing: 'North',
        yaw: 0,
        pitch: 0,
        targetBlock: null,
        nearbyEntities: [],
        nearbyPlayers: [],
        nearbyMobs: [],
        currentBiome: undefined,
        currentLandBlock: undefined,
        terrainGrid: null,
        isPatrolling: false,
        afkRewardsAvailable: this.afkRewardsAvailable,
      };
    }

    const pos = this.bot.entity.position;
    const offhand = (this.bot.inventory.slots as any)[45];
    const held = this.bot.heldItem;
    const yaw = this.bot.entity.yaw || 0;
    const pitch = this.bot.entity.pitch || 0;

    // Calculate Cardinal direction
    const deg = (((180 - yaw * 180 / Math.PI) % 360) + 360) % 360;
    let facing = 'South';
    if (deg >= 315 || deg < 45) facing = 'South';
    else if (deg >= 45 && deg < 135) facing = 'West';
    else if (deg >= 135 && deg < 225) facing = 'North';
    else facing = 'East';

    // Target block in crosshair
    let targetBlock: { name: string; x: number; y: number; z: number } | null = null;
    try {
      const b = (this.bot as any).blockAtCursor ? (this.bot as any).blockAtCursor(6) : null;
      if (b) {
        targetBlock = { name: b.name, x: b.position.x, y: b.position.y, z: b.position.z };
      }
    } catch (e) {}

    // Nearby entities in radar range (up to 24 blocks)
    const nearbyEntities: Array<{ id: number; name: string; type: string; distance: number; x: number; z: number; isPlayer: boolean; isHostile: boolean }> = [];
    // Nearby players in radar range (up to 36 blocks) with usernames for Xaero's minimap
    const nearbyPlayers: MinimapPlayer[] = [];
    // Nearby mobs in radar range (up to 36 blocks)
    const nearbyMobs: MinimapMob[] = [];
    const HOSTILE_MOBS = new Set([
      'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'enderman', 'witch', 'blaze',
      'ghast', 'warden', 'phantom', 'drowned', 'husk', 'stray', 'silverfish', 'slime',
      'magma_cube', 'hoglin', 'zoglin', 'piglin_brute', 'pillager', 'ravager', 'vindicator',
      'evoker', 'vex', 'shulker', 'guardian', 'elder_guardian', 'wither', 'wither_skeleton', 'ender_dragon'
    ]);

    try {
      const myPos = this.bot.entity.position;
      const myId = this.bot.entity.id;
      const myUsername = (this.bot.username || this.config.name).toLowerCase();

      for (const ent of Object.values(this.bot.entities)) {
        if (!ent || ent.id === myId || !ent.position) continue;
        const dx = ent.position.x - myPos.x;
        const dz = ent.position.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const isPlayer = ent.type === 'player';

        // 1. Collect nearby players with accurate usernames
        if (isPlayer && dist <= 36) {
          let username = ent.username;
          if (!username) {
            const matchedPlayer = Object.values(this.bot.players || {}).find((p: any) => p?.entity?.id === ent.id);
            if (matchedPlayer) username = matchedPlayer.username;
          }
          if (!username) {
            username = (ent as any).displayName?.text || (ent as any).displayName || ent.name;
          }

          if (username && username.toLowerCase() !== myUsername) {
            const entYaw = ent.yaw || 0;
            const entDeg = (((180 - entYaw * 180 / Math.PI) % 360) + 360) % 360;
            let entFacing = 'South';
            if (entDeg >= 315 || entDeg < 45) entFacing = 'South';
            else if (entDeg >= 45 && entDeg < 135) entFacing = 'West';
            else if (entDeg >= 135 && entDeg < 225) entFacing = 'North';
            else entFacing = 'East';

            nearbyPlayers.push({
              username,
              x: Math.round(ent.position.x * 10) / 10,
              y: Math.round(ent.position.y * 10) / 10,
              z: Math.round(ent.position.z * 10) / 10,
              dx: Math.round(dx * 10) / 10,
              dz: Math.round(dz * 10) / 10,
              distance: Math.round(dist * 10) / 10,
              yaw: Math.round(entYaw * 100) / 100,
              facing: entFacing,
              health: (ent as any).health ? Math.round((ent as any).health) : undefined,
            });
          }
        }

        // 2. Collect nearby mobs (hostile or passive) up to 36 blocks
        const rawName = (ent.name || '').toLowerCase();
        const IGNORED_ENTITIES = new Set([
          'item', 'experience_orb', 'arrow', 'spectral_arrow', 'trident',
          'armor_stand', 'boat', 'chest_boat', 'minecart', 'chest_minecart',
          'furnace_minecart', 'tnt_minecart', 'hopper_minecart', 'spawner_minecart',
          'painting', 'item_frame', 'glow_item_frame', 'leash_knot',
          'area_effect_cloud', 'eye_of_ender', 'end_crystal', 'firework_rocket'
        ]);

        if (!isPlayer && dist <= 36 && !IGNORED_ENTITIES.has(rawName) && ent.type !== 'object' && ent.type !== 'projectile' && ent.type !== 'orb') {
          const isHostile = HOSTILE_MOBS.has(rawName) || ent.type === 'hostile';
          const rawDisplayName = (ent as any).displayName?.text || (ent as any).displayName || ent.name || 'Mob';
          const cleanName = typeof rawDisplayName === 'string'
            ? rawDisplayName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
            : 'Mob';

          nearbyMobs.push({
            id: ent.id,
            name: cleanName,
            type: ent.type || (isHostile ? 'hostile' : 'passive'),
            distance: Math.round(dist * 10) / 10,
            x: Math.round(ent.position.x * 10) / 10,
            y: Math.round(ent.position.y * 10) / 10,
            z: Math.round(ent.position.z * 10) / 10,
            dx: Math.round(dx * 10) / 10,
            dz: Math.round(dz * 10) / 10,
            isHostile,
          });
        }

        // 3. Collect general entities
        if (dist <= 24) {
          const entName = ent.username || ent.name || (ent as any).displayName || 'entity';
          const isHostile = HOSTILE_MOBS.has((ent.name || '').toLowerCase());
          nearbyEntities.push({
            id: ent.id,
            name: entName,
            type: ent.type || 'mob',
            distance: Math.round(dist * 10) / 10,
            x: Math.round(ent.position.x * 10) / 10,
            z: Math.round(ent.position.z * 10) / 10,
            isPlayer,
            isHostile,
          });
        }
      }
      nearbyEntities.sort((a, b) => a.distance - b.distance);
      nearbyPlayers.sort((a, b) => a.distance - b.distance);
      nearbyMobs.sort((a, b) => a.distance - b.distance);
    } catch (e) {}

    // Reuse the detailed surface grid between telemetry events. Movement can emit
    // telemetry several times per second, and rescanning thousands of blocks on
    // every event starves Mineflayer's own physics loop.
    const mapCenter = { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) };
    const movedFarEnough = !this.terrainGridCenter
      || Math.abs(mapCenter.x - this.terrainGridCenter.x) >= 3
      || Math.abs(mapCenter.y - this.terrainGridCenter.y) >= 3
      || Math.abs(mapCenter.z - this.terrainGridCenter.z) >= 3;
    if (!this.terrainGridCache || Date.now() - this.terrainGridSampledAt >= 2000 || movedFarEnough) {
      this.terrainGridCache = sampleTerrainGrid(this.bot, 24);
      this.terrainGridSampledAt = Date.now();
      this.terrainGridCenter = mapCenter;
    }
    const terrainGrid = this.terrainGridCache;

    // Inventory serialization with enchantments and lore
    const inventoryList: InventoryItem[] = [];
    try {
      if (this.bot.inventory && Array.isArray(this.bot.inventory.slots)) {
        for (let s = 0; s < this.bot.inventory.slots.length; s++) {
          const it = this.bot.inventory.slots[s];
          if (!it) continue;

          // Parse enchantments
          const enchants: ItemEnchantment[] = [];
          try {
            const rawEnchants: any = it.enchants;
            let enchantEntries: any[] = [];
            if (Array.isArray(rawEnchants)) {
              enchantEntries = rawEnchants;
            } else if (rawEnchants instanceof Map) {
              enchantEntries = Array.from(rawEnchants.entries()).map(([name, level]) => ({ name, level }));
            } else if (rawEnchants && typeof rawEnchants === 'object') {
              const levelMap = rawEnchants.levels ?? rawEnchants.enchantments ?? rawEnchants;
              if (levelMap instanceof Map) {
                enchantEntries = Array.from(levelMap.entries()).map(([name, level]) => ({ name, level }));
              } else if (levelMap && typeof levelMap === 'object' && !Array.isArray(levelMap)) {
                enchantEntries = Object.entries(levelMap).map(([name, level]) => ({ name, level }));
              }
            }

            for (const entry of enchantEntries) {
              const rawName = entry?.name ?? entry?.id ?? entry?.key;
              const enchantName = typeof rawName === 'string' ? rawName.replace(/^minecraft:/, '') : '';
              let rawLevel = entry?.lvl ?? entry?.level ?? entry?.value ?? entry;
              while (rawLevel && typeof rawLevel === 'object') {
                const nestedLevel = rawLevel.value ?? rawLevel.lvl ?? rawLevel.level;
                if (nestedLevel === undefined) break;
                rawLevel = nestedLevel;
              }
              const enchantLevel = Number(rawLevel);
              if (!enchantName || !Number.isFinite(enchantLevel) || enchantLevel < 1) continue;
              enchants.push({
                name: enchantName,
                level: enchantLevel,
                displayName: formatEnchantName(enchantName, enchantLevel),
              });
            }
          } catch (e) {
            // Some protocol versions expose enchantments through NBT instead of item components.
          }
          if (enchants.length === 0 && (it as any).nbt?.value) {
            const nbtVal = (it as any).nbt.value;
            const rawList = nbtVal.StoredEnchantments?.value?.value || nbtVal.Enchantments?.value?.value;
            if (Array.isArray(rawList)) {
              for (const itemEnch of rawList) {
                const rawId = itemEnch.id?.value || itemEnch.id || 'enchantment';
                const lvl = itemEnch.lvl?.value ?? itemEnch.lvl ?? 1;
                enchants.push({
                  name: String(rawId).replace(/^minecraft:/, ''),
                  level: Number(lvl),
                  displayName: formatEnchantName(String(rawId), Number(lvl)),
                });
              }
            }
          }

          // Parse Lore
          const loreLines: string[] = [];
          if (Array.isArray(it.customLore)) {
            for (const l of it.customLore) {
              const cleaned = cleanMinecraftJsonText(l);
              if (cleaned) loreLines.push(cleaned);
            }
          }
          if (loreLines.length === 0 && (it as any).nbt?.value?.display?.value?.Lore?.value?.value) {
            const rawLore = (it as any).nbt.value.display.value.Lore.value.value;
            if (Array.isArray(rawLore)) {
              for (const l of rawLore) {
                const cleaned = cleanMinecraftJsonText(typeof l === 'string' ? l : l?.value || String(l));
                if (cleaned) loreLines.push(cleaned);
              }
            }
          }

          if (enchants.length === 0 && loreLines.length > 0) {
            enchants.push(...parseEnchantmentsFromLore(loreLines));
          }

          // Custom Name
          let customName: string | undefined = undefined;
          if (it.customName) {
            customName = cleanMinecraftJsonText(it.customName);
          } else if ((it as any).nbt?.value?.display?.value?.Name?.value) {
            customName = cleanMinecraftJsonText((it as any).nbt.value.display.value.Name.value);
          }

          inventoryList.push({
            slot: s,
            name: it.name,
            displayName: customName || it.displayName || it.name,
            count: it.count,
            maxStackSize: it.stackSize,
            durabilityUsed: it.durabilityUsed,
            maxDurability: it.maxDurability,
            customName,
            lore: loreLines.length > 0 ? loreLines : undefined,
            enchantments: enchants.length > 0 ? enchants : undefined,
          });
        }
      }
    } catch (e) {}

    const currentHealth = Math.round((this.bot.health || 0) * 10) / 10;
    const maxHealth = this.getMaxHealth();
    const hearts = Math.round((currentHealth / 2) * 10) / 10;
    const maxHearts = Math.round((maxHealth / 2) * 10) / 10;

    return {
      id: this.config.id,
      name: this.config.name,
      status: this.currentStatus,
      statusMessage: this.statusMessage,
      authCodeInfo: this.authCodeInfo,
      health: currentHealth,
      maxHealth,
      hearts,
      maxHearts,
      food: this.bot.food || 0,
      coordinates: {
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
        z: Math.round(pos.z * 10) / 10,
      },
      dimension: (this.bot.game as any)?.dimension || 'overworld',
      ping: (this.bot.player as any)?.ping || 0,
      gamemode: (this.bot.game as any)?.gameMode || 'survival',
      uptimeSeconds: this.connectStartTime ? Math.floor((Date.now() - this.connectStartTime) / 1000) : 0,
      heldItem: held?.name,
      offhandItem: offhand?.name,
      inventoryCount: this.bot.inventory ? this.bot.inventory.items().length : 0,
      inventory: inventoryList,
      openWindow: serializeGuiWindow(this.bot.currentWindow),
      selectedSlot: (this.bot as any).quickBarSlot ?? 0,
      facing,
      yaw: Math.round(yaw * 100) / 100,
      pitch: Math.round(pitch * 100) / 100,
      targetBlock,
      nearbyEntities: nearbyEntities.slice(0, 15),
      nearbyPlayers,
      nearbyMobs: nearbyMobs.slice(0, 60),
      currentBiome: terrainGrid?.currentBiome,
      currentLandBlock: terrainGrid?.currentLandBlock,
      terrainGrid,
      isPatrolling: this.isPatrolling,
      isFarming: Boolean(this.config.farming?.enabled && this.currentStatus === 'online'),
      afkRewardsAvailable: this.afkRewardsAvailable,
    };
  }

  private updateStatus(status: BotTelemetry['status'], message?: string) {
    this.currentStatus = status;
    if (message) this.statusMessage = message;
    this.emitTelemetry();
  }

  private clearTimers() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.bedrockHandshakeTimeout) clearTimeout(this.bedrockHandshakeTimeout);
    if (this.antiAfkInterval) clearInterval(this.antiAfkInterval);
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    if (this.patrolInterval) clearInterval(this.patrolInterval);
    if (this.farmingInterval) clearInterval(this.farmingInterval);
    if (this.recurringCommandInterval) clearInterval(this.recurringCommandInterval);
    if (this.spawnCommandTimeout) clearTimeout(this.spawnCommandTimeout);
    if (this.bedrockTickSyncInterval) clearInterval(this.bedrockTickSyncInterval);
    this.clearAntiAfkMovementTimeouts();
    this.clearAssistedJumpTimeouts();
    this.movementTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.movementTelemetryIntervals.forEach((interval) => clearInterval(interval));
    this.movementTimeouts.clear();
    this.movementTelemetryIntervals.clear();
    this.manualMovementControls.clear();
    this.reconnectTimeout = null;
    this.bedrockHandshakeTimeout = null;
    this.bedrockTickSyncInterval = null;
    this.antiAfkInterval = null;
    this.telemetryInterval = null;
    this.patrolInterval = null;
    this.farmingInterval = null;
    this.recurringCommandInterval = null;
    this.spawnCommandTimeout = null;
  }

  private clearAntiAfkMovementTimeouts() {
    this.antiAfkMovementTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.antiAfkMovementTimeouts.clear();
  }

  private clearAssistedJumpTimeouts() {
    this.assistedJumpTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.assistedJumpTimeouts.clear();
  }

  private setupAutoCommands() {
    if (this.recurringCommandInterval) {
      clearInterval(this.recurringCommandInterval);
      this.recurringCommandInterval = null;
    }
    if (this.spawnCommandTimeout) {
      clearTimeout(this.spawnCommandTimeout);
      this.spawnCommandTimeout = null;
    }

    // On-Spawn Auto Command (e.g. /lifesteal)
    const onSpawnCmd = this.config.survival?.onSpawnCommand?.trim();
    if (onSpawnCmd) {
      const delayMs = (this.config.survival.onSpawnDelaySeconds || 2) * 1000;
      this.spawnCommandTimeout = setTimeout(() => {
        if (this.bot && this.currentStatus === 'online') {
          try {
            this.bot.chat(onSpawnCmd);
            this.emitActivity('command', `⚡ Executed spawn command: ${onSpawnCmd}`);
            this.sendDiscordAlert(`⚡ **${this.config.name}** executed spawn command: \`${onSpawnCmd}\``);
            this.callbacks.onChatMessage({
              botId: this.config.id,
              timestamp: Date.now(),
              sender: 'AutoCommand',
              message: `⚡ Executed spawn command: ${onSpawnCmd}`,
              isSystem: true,
            });
          } catch (e) {}
        }
      }, delayMs);
    }

    // Recurring Auto Command (e.g. /lifesteal every 300 seconds)
    const recurringCmd = this.config.survival?.recurringCommand?.trim();
    const intervalSec = this.config.survival?.recurringIntervalSeconds;
    if (recurringCmd && intervalSec && intervalSec > 0) {
      this.recurringCommandInterval = setInterval(() => {
        if (this.bot && this.currentStatus === 'online') {
          try {
            this.bot.chat(recurringCmd);
            this.emitActivity('command', `⏱️ Executed recurring command: ${recurringCmd}`);
            this.sendDiscordAlert(`⏱️ **${this.config.name}** executed recurring command: \`${recurringCmd}\``);
            this.callbacks.onChatMessage({
              botId: this.config.id,
              timestamp: Date.now(),
              sender: 'AutoCommand',
              message: `⏱️ Executed recurring command: ${recurringCmd}`,
              isSystem: true,
            });
          } catch (e) {}
        }
      }, intervalSec * 1000);
    }
  }

  private getCoordinatesString(): string {
    if (!this.bot?.entity?.position) return '0, 0, 0';
    const p = this.bot.entity.position;
    return `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
  }

  private async sendDiscordAlert(content: string) {
    const url = this.config.discordWebhookUrl?.trim();
    if (!url || !url.startsWith('http')) return;

    try {
      console.log(`[VistaAFK Discord Webhook] Sending: "${content}"`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'VistaAFK Monitor',
          avatar_url: `https://mc-heads.net/avatar/${this.config.name}/128`,
          content,
        }),
      });
      if (res.ok) {
        console.log(`[VistaAFK Discord Webhook] Alert delivered successfully!`);
      } else {
        console.warn(`[VistaAFK Discord Webhook] HTTP Error ${res.status}: ${res.statusText}`);
      }
    } catch (e: any) {
      console.error('[VistaAFK Discord Webhook Failed]:', e?.message);
    }
  }
}

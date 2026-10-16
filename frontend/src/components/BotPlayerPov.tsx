'use client';

import React, { useState } from 'react';
import { Camera, Crosshair, Eye, MousePointer2, Sparkles, X, Gift, Bell } from 'lucide-react';
import { BotTelemetry, InventoryItem } from '../types';

interface BotPlayerPovProps {
  telemetry?: BotTelemetry;
  isOnline: boolean;
  onClickGuiSlot: (slot: number, mouseButton?: number) => void;
  onCloseWindow: () => void;
  onRespondForm: (response: boolean | number | Array<unknown>) => void;
}

export function isCashItem(item?: InventoryItem | null): boolean {
  if (!item) return false;
  const n = (item.name || '').toLowerCase();
  const d = (item.displayName || '').toLowerCase();
  const c = (item.customName || '').toLowerCase();
  return (
    n.includes('cash') ||
    n.includes('money') ||
    n.includes('dollar') ||
    n.includes('geyser_custom') ||
    d.includes('cash') ||
    d.includes('money') ||
    c.includes('cash') ||
    c.includes('money') ||
    (n === 'paper' && (d.includes('afk') || c.includes('afk') || d.includes('reward')))
  );
}

export function CashBundleIcon({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} [image-rendering:pixelated] drop-shadow-sm`}
    >
      {/* Paper layers under for stack 3D thickness */}
      <rect x="7" y="11" width="18" height="10" rx="1" fill="#14532d" />
      <rect x="6" y="9" width="18" height="10" rx="1" fill="#166534" />
      <rect x="5.5" y="8" width="18" height="10" rx="1" fill="#15803d" />

      {/* Top banknote body */}
      <rect x="5" y="7" width="18" height="9.5" rx="1" fill="#22c55e" stroke="#14532d" strokeWidth="0.6" />
      <rect x="6" y="8" width="16" height="7.5" rx="0.5" fill="#86efac" />
      <rect x="7" y="8.8" width="14" height="6" rx="0.5" fill="#bbf7d0" stroke="#16a34a" strokeWidth="0.5" />

      {/* Center banknote currency stamp */}
      <circle cx="14" cy="11.8" r="1.8" fill="#15803d" />
      <path d="M14 10.8v2M13.2 11.2h1.4a.4.4 0 010 .8h-.6a.4.4 0 000 .8h1.4" stroke="#dcfce7" strokeWidth="0.5" strokeLinecap="round" />

      {/* Golden ribbon wrapped around center */}
      <rect x="11.5" y="6" width="5" height="13.5" rx="0.5" fill="#854d0e" />
      <rect x="12" y="6.5" width="4" height="12.5" fill="#eab308" />
      <rect x="12.8" y="7" width="2.4" height="11.5" fill="#fef08a" />
    </svg>
  );
}

function formatItemTitle(item: InventoryItem): string {
  if (item.customName) return item.customName;
  if (isCashItem(item)) {
    if (item.displayName.toLowerCase().includes('geyser') || item.displayName.toLowerCase().includes('unknown')) {
      return 'AFK Cash';
    }
  }
  return item.displayName;
}

const textureName = (name: string) => name.replace(/^minecraft:/, '').toLowerCase();
const blockTexture = (name: string) => `https://assets.mcasset.cloud/1.20.4/assets/minecraft/textures/block/${encodeURIComponent(textureName(name))}.png`;
const itemTexture = (name: string) => `https://assets.mcasset.cloud/1.20.4/assets/minecraft/textures/item/${encodeURIComponent(textureName(name))}.png`;
const guiTextureCandidates = (name: string) => {
  const cleanName = textureName(name);
  const blockName = cleanName.endsWith('_pane') ? cleanName.slice(0, -5) : cleanName;
  const candidates = [itemTexture(cleanName), blockTexture(cleanName), blockTexture(blockName)];
  return candidates.filter((url, index) => candidates.indexOf(url) === index);
};

function GuiSlot({ item, slot, onClick, readOnly }: { item: InventoryItem | null; slot: number; onClick: () => void; readOnly?: boolean }) {
  const [textureIndex, setTextureIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  React.useEffect(() => setTextureIndex(0), [item?.name]);

  const textures = item ? guiTextureCandidates(item.name) : [];
  const isCash = item ? isCashItem(item) : false;
  const displayTitle = item ? formatItemTitle(item) : '';
  const details = [displayTitle, item?.count && item.count > 1 ? `Count: ${item.count}` : '', ...(item?.lore || [])]
    .filter(Boolean)
    .join('\n');

  return (
    <div
      className="relative aspect-square"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!item || readOnly}
        title={details || `Empty slot ${slot + 1}`}
        aria-label={item ? `Click ${displayTitle}, slot ${slot + 1}${item.lore?.length ? `. ${item.lore.join('. ')}` : ''}` : `Empty slot ${slot + 1}`}
        className={`relative h-full w-full rounded-md border p-1 shadow-[inset_1px_1px_0_rgba(255,255,255,.9),inset_-1px_-1px_0_rgba(100,116,139,.28)] transition ${
          item && !readOnly
            ? 'border-slate-300 bg-[#d7d9d5] hover:border-emerald-400 hover:bg-white active:translate-y-px cursor-pointer'
            : 'border-slate-200 bg-[#e7e9e5]'
        } disabled:cursor-default`}
      >
        {item && (
          <>
            {isCash ? (
              <div className="mx-auto h-full w-full p-0.5">
                <CashBundleIcon />
              </div>
            ) : (
              <img
                src={textures[Math.min(textureIndex, textures.length - 1)]}
                alt=""
                aria-hidden="true"
                className="mx-auto h-full w-full object-contain [image-rendering:pixelated] drop-shadow-sm"
                onError={(event) => {
                  if (textureIndex < textures.length - 1) setTextureIndex(textureIndex + 1);
                  else event.currentTarget.style.visibility = 'hidden';
                }}
              />
            )}
            <span className="absolute inset-x-0 bottom-0 truncate bg-white/85 px-0.5 text-[8px] font-bold text-slate-800">
              {displayTitle}
            </span>
            {item.count > 1 && (
              <span className="absolute right-0.5 top-0.5 rounded bg-slate-900/85 px-1 font-mono text-[9px] font-bold text-white">
                {item.count}
              </span>
            )}
            {item.lore?.length ? (
              <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
            ) : null}
          </>
        )}
      </button>

      {/* Minecraft-Style Rich Tooltip on Hover */}
      {isHovered && item && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 min-w-[160px] max-w-[280px] rounded-lg border-2 border-[#2b0057] bg-[#100010]/95 p-2.5 text-left shadow-2xl backdrop-blur-md">
          <p className="font-black text-xs text-[#ffff55] drop-shadow-sm leading-tight">
            {displayTitle}
          </p>
          {item.lore && item.lore.length > 0 && (
            <div className="mt-1.5 space-y-0.5 border-t border-purple-900/60 pt-1 text-[11px] leading-snug">
              {item.lore.map((line, lIdx) => {
                const isStatus = /status:/i.test(line);
                const isAction = /click|claim/i.test(line);
                return (
                  <p
                    key={lIdx}
                    className={`drop-shadow-xs ${
                      isStatus
                        ? 'text-[#55ff55] font-semibold'
                        : isAction
                        ? 'text-[#ffff55] font-bold'
                        : 'text-[#aaaaaa]'
                    }`}
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          )}
          {item.count > 1 && (
            <p className="mt-1 text-[9px] text-[#55ffff] font-mono">Count: {item.count}</p>
          )}
        </div>
      )}
    </div>
  );
}

function BedrockFormView({ window, onRespond }: { window: NonNullable<BotTelemetry['openWindow']>; onRespond: (response: boolean | number | Array<unknown>) => void }) {
  const elements = window.formElements || [];
  const [values, setValues] = useState<Array<unknown>>(() => elements.map((element) => {
    if (element.type === 'toggle') return Boolean(element.default);
    if (element.type === 'slider' || element.type === 'dropdown' || element.type === 'step_slider') return Number(element.default ?? element.min ?? 0);
    return String(element.default ?? '');
  }));
  const setValue = (index: number, value: unknown) => setValues((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-[#e5e7eb] shadow-lg">
        <div className="border-b border-slate-300 bg-white px-5 py-4">
          <h3 className="text-base font-bold text-slate-800">{window.title}</h3>
          {window.formContent && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{window.formContent}</p>}
        </div>
        {window.formType === 'modal' ? (
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            <button type="button" onClick={() => onRespond(true)} className="min-h-12 rounded-lg border-2 border-slate-500 bg-slate-200 px-4 py-3 text-sm font-bold text-rose-700 shadow-sm transition hover:bg-white">{window.formButton1 || 'Yes'}</button>
            <button type="button" onClick={() => onRespond(false)} className="min-h-12 rounded-lg border-2 border-slate-500 bg-slate-200 px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-white">{window.formButton2 || 'No'}</button>
          </div>
        ) : window.formType === 'simple' ? (
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            {(window.formButtons || []).map((button, index) => <button key={`${index}-${button.text}`} type="button" onClick={() => onRespond(index)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50">{button.text}</button>)}
            {!window.formButtons?.length && <p className="text-xs text-slate-500">This server form did not include any displayable choices.</p>}
          </div>
        ) : window.formType === 'custom' ? (
          <form onSubmit={(event) => { event.preventDefault(); onRespond(values); }} className="space-y-4 p-4">
            {elements.map((element, index) => (
              <label key={`${element.type}-${index}`} className="block text-xs font-semibold text-slate-700">
                {element.type !== 'toggle' && element.type !== 'label' && <span className="mb-1.5 block">{element.text}</span>}
                {element.type === 'label' && <span className="block font-normal leading-relaxed text-slate-600">{element.text}</span>}
                {element.type === 'input' && <input value={String(values[index] ?? '')} placeholder={element.placeholder} onChange={(event) => setValue(index, event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500" />}
                {element.type === 'toggle' && <span className="flex items-center gap-2"><input type="checkbox" checked={Boolean(values[index])} onChange={(event) => setValue(index, event.target.checked)} className="h-4 w-4 accent-emerald-600" />{element.text}</span>}
                {element.type === 'slider' && <span className="flex items-center gap-3"><input type="range" min={element.min ?? 0} max={element.max ?? 100} step={element.step ?? 1} value={Number(values[index] ?? 0)} onChange={(event) => setValue(index, Number(event.target.value))} className="w-full accent-emerald-600" /><span className="min-w-8 text-right font-mono">{String(values[index] ?? 0)}</span></span>}
                {(element.type === 'dropdown' || element.type === 'step_slider') && <select value={Number(values[index] ?? 0)} onChange={(event) => setValue(index, Number(event.target.value))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500">{(element.options || []).map((option, optionIndex) => <option key={`${optionIndex}-${option}`} value={optionIndex}>{option}</option>)}</select>}
              </label>
            ))}
            <button type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">Submit</button>
          </form>
        ) : (
          <div className="p-5 text-sm text-slate-500">This Bedrock form type is not supported yet.</div>
        )}
      </div>
      <p className="mt-3 text-center text-[10px] text-slate-500">Choices are sent back to the server as a Bedrock form response.</p>
    </div>
  );
}

function TargetPreview({ telemetry, isOnline }: { telemetry?: BotTelemetry; isOnline: boolean }) {
  const target = telemetry?.targetBlock;
  const name = target?.name.replace(/_/g, ' ') || 'Open sky / air';

  return (
    <div className="relative flex min-h-[250px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-100 p-5 text-center shadow-inner">
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-emerald-300/70 to-emerald-200/0" />
      <div className="absolute left-[12%] top-[24%] h-5 w-16 rounded-sm bg-white/70 shadow-[16px_8px_0_-2px_rgba(255,255,255,.6)]" />
      <div className="absolute right-[15%] top-[16%] h-4 w-12 rounded-sm bg-white/60 shadow-[-14px_8px_0_-1px_rgba(255,255,255,.5)]" />
      <div className="absolute bottom-0 left-0 h-12 w-full bg-emerald-300/50 [clip-path:polygon(0_44%,14%_18%,27%_47%,41%_15%,56%_49%,72%_16%,87%_43%,100%_21%,100%_100%,0_100%)]" />
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 shadow-sm">
        <Eye className="h-3.5 w-3.5 text-emerald-700" /> Live look target
      </div>

      {isOnline && target ? (
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative grid h-32 w-32 place-items-center overflow-hidden rounded-2xl border-4 border-white/90 bg-white/75 p-2 shadow-xl shadow-emerald-900/15">
            <img
              src={blockTexture(target.name)}
              alt={`${name} texture`}
              className="h-full w-full object-contain [image-rendering:pixelated] drop-shadow-md"
              onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
            />
            <Crosshair className="pointer-events-none absolute h-6 w-6 text-slate-800/65 drop-shadow-[0_1px_2px_white]" strokeWidth={1.8} />
          </div>
          <span className="mt-3 rounded-full border border-white/80 bg-white/85 px-3 py-1 text-xs font-black capitalize text-slate-800 shadow-sm">{name}</span>
          <span className="mt-1 rounded-md bg-slate-900/75 px-2 py-1 font-mono text-[10px] text-white">{target.x}, {target.y}, {target.z}</span>
        </div>
      ) : (
        <div className="relative z-10 mt-5 rounded-2xl border border-white/80 bg-white/60 px-5 py-4 shadow-sm backdrop-blur-sm">
          <Sparkles className="mx-auto mb-2 h-7 w-7 text-sky-600" strokeWidth={1.8} />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Crosshair target</p>
          <p className="mt-1 text-lg font-black text-slate-800">{isOnline ? name : 'Bot is offline'}</p>
          {isOnline && <p className="mt-1 text-[10px] text-slate-600">No block texture under the crosshair</p>}
        </div>
      )}
      <p className="relative z-10 mt-3 text-[9px] font-medium text-slate-600">Block texture preview · not a rendered video feed</p>
    </div>
  );
}

export function BotPlayerPov({ telemetry, isOnline, onClickGuiSlot, onCloseWindow, onRespondForm }: BotPlayerPovProps) {
  const window = telemetry?.openWindow;
  const guiSlots = window?.inventoryStart !== undefined && window.inventoryStart > 0 && window.inventoryStart < window.slots.length
    ? window.slots.slice(0, window.inventoryStart)
    : window?.slots || [];
  const yaw = telemetry?.yaw;
  const pitch = telemetry?.pitch;

  // Detect AFK Rewards in server GUI
  const afkClaimSlot = guiSlots.findIndex((item) => {
    if (!item) return false;
    const n = item.name.toLowerCase();
    const d = (item.displayName || '').toLowerCase();
    const c = (item.customName || '').toLowerCase();
    const hasLore = (item.lore || []).some((l) => /afk reward/i.test(l) || /claim/i.test(l));
    return n === 'bell' || hasLore || /claim.*reward/i.test(d) || /claim.*reward/i.test(c);
  });

  let detectedAfkCount: number | null = null;
  let afkStatusText = '';

  for (const item of guiSlots) {
    if (!item?.lore) continue;
    for (const line of item.lore) {
      const m = line.match(/(?:you have\s+)?(\d+)\s*afk reward/i);
      if (m && Number.isInteger(Number(m[1]))) {
        detectedAfkCount = Number(m[1]);
        afkStatusText = line;
        break;
      }
    }
    if (detectedAfkCount !== null) break;
  }

  if (detectedAfkCount === null && typeof telemetry?.afkRewardsAvailable === 'number') {
    detectedAfkCount = telemetry.afkRewardsAvailable;
  }

  const isAfkMenu =
    afkClaimSlot !== -1 ||
    (window?.title && /afk/i.test(window.title)) ||
    guiSlots.some((it) => isCashItem(it));

  const resolvedWindowTitle =
    isAfkMenu && (window?.title === 'Server Menu' || !window?.title)
      ? 'Rewards | AFK'
      : window?.title || 'Server Menu';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm" aria-label="Player point of view and server menu">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-emerald-600" />
          <div>
            <h2 className="text-xs font-black uppercase tracking-wide text-slate-800">Player POV &amp; Server GUI</h2>
            <p className="text-[10px] text-slate-500">Live Bedrock forms and server inventory menus</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {window && (
            <button
              type="button"
              onClick={onCloseWindow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 cursor-pointer"
              title="Close the open game menu"
            >
              <X className="h-3.5 w-3.5" />
              Close GUI
            </button>
          )}
          <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${isOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
            {isOnline ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {window?.kind === 'form' ? (
        <BedrockFormView window={window} onRespond={onRespondForm} />
      ) : window ? (
        <div className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <MousePointer2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <h3 className="truncate text-sm font-bold text-slate-800">{resolvedWindowTitle}</h3>
            </div>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[9px] text-slate-500">{window.type}</span>
          </div>

          {/* Prominent AFK Rewards Banner */}
          {isAfkMenu && (
            <div className="mb-3.5 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-emerald-500/15 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center font-black text-xl shadow-sm shrink-0">
                  🔔
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-black text-sm text-slate-900 tracking-tight">
                      {detectedAfkCount !== null && detectedAfkCount > 0
                        ? `${detectedAfkCount} AFK Reward${detectedAfkCount === 1 ? '' : 's'} Collected & Available!`
                        : detectedAfkCount === 0
                        ? 'All AFK Rewards Claimed'
                        : 'AFK Rewards System'}
                    </h4>
                    {detectedAfkCount !== null && detectedAfkCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                        Ready to Claim
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                        AFK Menu
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-950 font-medium truncate mt-0.5">
                    {afkStatusText || (detectedAfkCount !== null && detectedAfkCount > 0 ? `You have ${detectedAfkCount} reward(s) ready to claim!` : 'Click the Bell below to claim your AFK rewards')}
                  </p>
                </div>
              </div>

              {afkClaimSlot !== -1 && (
                <button
                  type="button"
                  onClick={() => onClickGuiSlot(afkClaimSlot)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs shadow-md transition active:scale-95 shrink-0 flex items-center space-x-1.5 cursor-pointer"
                  title="Click the Bell in-game to claim your AFK rewards"
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>Claim AFK Reward</span>
                </button>
              )}
            </div>
          )}

          <p className="mb-3 text-[10px] text-slate-500">
            {window.readOnly
              ? 'Bedrock server inventory menu captured from live packets. Item textures use the default Minecraft assets.'
              : 'Click a menu item to press it in game. Hover or focus an item to read its lore.'}
          </p>

          <div className="rounded-xl border border-slate-300 bg-[#c6c8c4] p-2 shadow-inner sm:p-3">
            <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
              {guiSlots.map((item, slot) => (
                <React.Fragment key={`${window.id}-${slot}-${item?.name || 'empty'}`}>
                  <GuiSlot item={item} slot={slot} readOnly={window.readOnly} onClick={() => onClickGuiSlot(slot)} />
                </React.Fragment>
              ))}
            </div>
          </div>
          {!window.readOnly && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-700 font-bold">
              <MousePointer2 className="h-3.5 w-3.5" /> Menu slots are live and clickable.
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-5">
          <TargetPreview telemetry={telemetry} isOnline={isOnline} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Facing</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{isOnline ? telemetry?.facing || 'Unknown' : '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Yaw / Pitch</p>
              <p className="mt-1 font-mono text-sm font-bold text-slate-800">{isOnline ? `${yaw ?? '—'}° / ${pitch ?? '—'}°` : '—'}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Position</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-800">
                {isOnline && telemetry ? `${telemetry.coordinates.x}, ${telemetry.coordinates.y}, ${telemetry.coordinates.z}` : '—'}
              </p>
            </div>
            <div className="col-span-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-[10px] leading-relaxed text-emerald-900 sm:col-span-1">
              When a server opens a menu, its actual item slots and textures appear here for interaction.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

'use client';

import React from 'react';
import { Camera, Crosshair, Eye, MousePointer2 } from 'lucide-react';
import { BotTelemetry, InventoryItem } from '../types';

interface BotPlayerPovProps {
  telemetry?: BotTelemetry;
  isOnline: boolean;
  onClickGuiSlot: (slot: number, mouseButton?: number) => void;
}

function GuiSlot({ item, slot, onClick }: { item: InventoryItem | null; slot: number; onClick: () => void }) {
  const details = [item?.displayName, item?.count && item.count > 1 ? `Count: ${item.count}` : '', ...(item?.lore || [])]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!item}
      title={details || `Empty slot ${slot + 1}`}
      aria-label={item ? `Click ${item.displayName}, slot ${slot + 1}${item.lore?.length ? `. ${item.lore.join('. ')}` : ''}` : `Empty slot ${slot + 1}`}
      className={`relative aspect-square min-w-0 rounded-lg border p-1 text-left transition ${item ? 'border-slate-500 bg-slate-800 hover:border-emerald-400 hover:bg-slate-700 active:translate-y-px' : 'border-slate-700/80 bg-slate-950/70'} disabled:cursor-default`}
    >
      {item && <>
        <span className="block truncate text-[9px] font-bold leading-tight text-slate-100">{item.displayName}</span>
        {item.count > 1 && <span className="absolute bottom-1 right-1 rounded bg-slate-950/90 px-1 font-mono text-[9px] text-white">{item.count}</span>}
        {item.lore?.length ? <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true" /> : null}
      </>}
    </button>
  );
}

export function BotPlayerPov({ telemetry, isOnline, onClickGuiSlot }: BotPlayerPovProps) {
  const window = telemetry?.openWindow;
  const target = telemetry?.targetBlock;
  const yaw = telemetry?.yaw;
  const pitch = telemetry?.pitch;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-sm" aria-label="Player point of view and server menu">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-emerald-400" />
          <div>
            <h2 className="text-xs font-black uppercase tracking-wide">Player POV &amp; Server GUI</h2>
            <p className="text-[10px] text-slate-400">Live aim data and interactive menus from the bot</p>
          </div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${isOnline ? 'border-emerald-800 bg-emerald-950 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
          {isOnline ? 'Live' : 'Offline'}
        </span>
      </div>

      {window ? (
        <div className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2"><MousePointer2 className="h-4 w-4 shrink-0 text-emerald-400" /><h3 className="truncate text-sm font-bold">{window.title}</h3></div>
            <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[9px] text-slate-400">{window.type}</span>
          </div>
          <p className="mb-3 text-[10px] text-slate-400">Click a menu item to press it in game. Hover or focus an item to read its lore.</p>
          <div className="rounded-xl border border-slate-800 bg-[#171b24] p-2 sm:p-3">
            <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
              {window.slots.map((item, slot) => (
                <React.Fragment key={`${window.id}-${slot}`}>
                  {slot === window.inventoryStart && slot > 0 && <div className="col-span-9 h-1 border-t border-slate-600" aria-hidden="true" />}
                  <GuiSlot item={item} slot={slot} onClick={() => onClickGuiSlot(slot)} />
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-200"><MousePointer2 className="h-3.5 w-3.5" /> Server menu clicks are sent to the connected Java bot.</div>
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-5">
          <div className="relative flex min-h-48 flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-[radial-gradient(ellipse_at_50%_42%,rgba(32,82,70,.28),transparent_52%),linear-gradient(180deg,#111827,#080b12)] p-5 text-center">
            <div className="absolute left-3 top-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500"><Eye className="h-3.5 w-3.5" /> Aim telemetry</div>
            <Crosshair className="mb-3 h-7 w-7 text-emerald-400/80" strokeWidth={1.5} />
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Crosshair target</p>
            <p className="mt-1 max-w-full truncate text-lg font-black text-white">{isOnline ? (target?.name?.replace(/_/g, ' ') || 'Open sky / air') : 'Bot is offline'}</p>
            {target && <p className="mt-1 font-mono text-[10px] text-slate-400">{target.x}, {target.y}, {target.z}</p>}
            <p className="mt-4 max-w-md text-[10px] leading-relaxed text-slate-500">A rendered first-person video feed is not available from the current headless bot. Live facing, pitch, crosshair target, and any opened server GUI are shown here.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Facing</p><p className="mt-1 text-sm font-bold text-slate-100">{isOnline ? telemetry?.facing || 'Unknown' : '—'}</p></div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Yaw / Pitch</p><p className="mt-1 font-mono text-sm font-bold text-slate-100">{isOnline ? `${yaw ?? '—'}° / ${pitch ?? '—'}°` : '—'}</p></div>
            <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3 sm:col-span-1"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Position</p><p className="mt-1 break-all font-mono text-xs text-slate-100">{isOnline && telemetry ? `${telemetry.coordinates.x}, ${telemetry.coordinates.y}, ${telemetry.coordinates.z}` : '—'}</p></div>
            <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-[10px] leading-relaxed text-slate-400 sm:col-span-1">Open a server menu in game, and its clickable slots will appear here so you can use GUI flows such as teleport requests.</div>
          </div>
        </div>
      )}
    </section>
  );
}

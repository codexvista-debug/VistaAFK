'use client';

import React from 'react';
import { Camera, Crosshair, Eye, MousePointer2, Sparkles } from 'lucide-react';
import { BotTelemetry, InventoryItem } from '../types';

interface BotPlayerPovProps {
  telemetry?: BotTelemetry;
  isOnline: boolean;
  onClickGuiSlot: (slot: number, mouseButton?: number) => void;
  onRespondForm: (response: boolean | number | Array<unknown>) => void;
}

const textureName = (name: string) => name.replace(/^minecraft:/, '').toLowerCase();
const blockTexture = (name: string) => `https://assets.mcasset.cloud/1.20.4/assets/minecraft/textures/block/${encodeURIComponent(textureName(name))}.png`;
const itemTexture = (name: string) => `https://assets.mcasset.cloud/1.20.4/assets/minecraft/textures/item/${encodeURIComponent(textureName(name))}.png`;

function GuiSlot({ item, slot, onClick, readOnly }: { item: InventoryItem | null; slot: number; onClick: () => void; readOnly?: boolean }) {
  const details = [item?.displayName, item?.count && item.count > 1 ? `Count: ${item.count}` : '', ...(item?.lore || [])]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!item || readOnly}
      title={details || `Empty slot ${slot + 1}`}
      aria-label={item ? `Click ${item.displayName}, slot ${slot + 1}${item.lore?.length ? `. ${item.lore.join('. ')}` : ''}` : `Empty slot ${slot + 1}`}
      className={`relative aspect-square min-w-0 rounded-md border p-1 shadow-[inset_1px_1px_0_rgba(255,255,255,.9),inset_-1px_-1px_0_rgba(100,116,139,.28)] transition ${item && !readOnly ? 'border-slate-300 bg-[#d7d9d5] hover:border-emerald-400 hover:bg-white active:translate-y-px' : 'border-slate-200 bg-[#e7e9e5]'} disabled:cursor-default`}
    >
      {item && <>
        <img
          src={itemTexture(item.name)}
          alt=""
          aria-hidden="true"
          className="mx-auto h-full w-full object-contain [image-rendering:pixelated] drop-shadow-sm"
          onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
        />
        <span className="absolute inset-x-0 bottom-0 truncate bg-white/80 px-0.5 text-[8px] font-semibold text-slate-700">{item.displayName}</span>
        {item.count > 1 && <span className="absolute right-0.5 top-0.5 rounded bg-slate-900/85 px-1 font-mono text-[9px] font-bold text-white">{item.count}</span>}
        {item.lore?.length ? <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" /> : null}
      </>}
    </button>
  );
}

function BedrockFormView({ window, onRespond }: { window: NonNullable<BotTelemetry['openWindow']>; onRespond: (response: boolean | number | Array<unknown>) => void }) {
  const elements = window.formElements || [];
  const [values, setValues] = React.useState<Array<unknown>>(() => elements.map((element) => {
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

export function BotPlayerPov({ telemetry, isOnline, onClickGuiSlot, onRespondForm }: BotPlayerPovProps) {
  const window = telemetry?.openWindow;
  const yaw = telemetry?.yaw;
  const pitch = telemetry?.pitch;

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
        <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${isOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
          {isOnline ? 'Live' : 'Offline'}
        </span>
      </div>

      {window?.kind === 'form' ? (
        <BedrockFormView window={window} onRespond={onRespondForm} />
      ) : window ? (
        <div className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2"><MousePointer2 className="h-4 w-4 shrink-0 text-emerald-600" /><h3 className="truncate text-sm font-bold text-slate-800">{window.title}</h3></div>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[9px] text-slate-500">{window.type}</span>
          </div>
          <p className="mb-3 text-[10px] text-slate-500">{window.readOnly ? 'Bedrock server inventory menu captured from live packets. Item textures use the default Minecraft assets.' : 'Click a menu item to press it in game. Hover or focus an item to read its lore.'}</p>
          <div className="rounded-xl border border-slate-300 bg-[#c6c8c4] p-2 shadow-inner sm:p-3">
            <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
              {window.slots.map((item, slot) => (
                <React.Fragment key={`${window.id}-${slot}`}>
                  {slot === window.inventoryStart && slot > 0 && <div className="col-span-9 my-1 h-px bg-slate-400" aria-hidden="true" />}
                  <GuiSlot item={item} slot={slot} readOnly={window.readOnly} onClick={() => onClickGuiSlot(slot)} />
                </React.Fragment>
              ))}
            </div>
          </div>
          {!window.readOnly && <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-700"><MousePointer2 className="h-3.5 w-3.5" /> Menu slots are live and clickable.</div>}
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-5">
          <TargetPreview telemetry={telemetry} isOnline={isOnline} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Facing</p><p className="mt-1 text-sm font-bold text-slate-800">{isOnline ? telemetry?.facing || 'Unknown' : '—'}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Yaw / Pitch</p><p className="mt-1 font-mono text-sm font-bold text-slate-800">{isOnline ? `${yaw ?? '—'}° / ${pitch ?? '—'}°` : '—'}</p></div>
            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-1"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Position</p><p className="mt-1 break-all font-mono text-xs text-slate-800">{isOnline && telemetry ? `${telemetry.coordinates.x}, ${telemetry.coordinates.y}, ${telemetry.coordinates.z}` : '—'}</p></div>
            <div className="col-span-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-[10px] leading-relaxed text-emerald-900 sm:col-span-1">When a server opens a menu, its actual item slots and textures appear here for interaction.</div>
          </div>
        </div>
      )}
    </section>
  );
}

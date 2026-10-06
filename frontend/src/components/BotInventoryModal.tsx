'use client';

import React, { useState } from 'react';
import { X, Shield, Sparkles, Package, Info, Swords, ArrowRight } from 'lucide-react';
import { BotConfig, BotTelemetry, InventoryItem } from '../types';

interface BotInventoryModalProps {
  onClose: () => void;
  config: BotConfig;
  telemetry?: BotTelemetry;
}

export const BotInventoryModal: React.FC<BotInventoryModalProps> = ({
  onClose,
  config,
  telemetry,
}) => {
  const inventory = telemetry?.inventory || [];
  const selectedHotbarIndex = telemetry?.selectedSlot ?? 0;

  // Map slots for easy O(1) lookup
  const slotMap = React.useMemo(() => {
    const map = new Map<number, InventoryItem>();
    for (const item of inventory) {
      map.set(item.slot, item);
    }
    return map;
  }, [inventory]);

  // Selected item to display in the Lore & Details inspector
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    // Default to main hand item if present
    36 + selectedHotbarIndex
  );

  const activeItem = selectedSlotIndex !== null ? slotMap.get(selectedSlotIndex) : null;

  // Equipment slots
  const helmetItem = slotMap.get(5);
  const chestItem = slotMap.get(6);
  const legsItem = slotMap.get(7);
  const bootsItem = slotMap.get(8);
  const offhandItem = slotMap.get(45);
  const mainHandItem = slotMap.get(36 + selectedHotbarIndex);

  const getItemTextureUrl = (name: string) => {
    const cleanName = name.replace(/^minecraft:/, '');
    return `https://assets.mcasset.cloud/1.20.4/assets/minecraft/textures/item/${cleanName}.png`;
  };

  const getBlockTextureUrl = (name: string) => {
    const cleanName = name.replace(/^minecraft:/, '');
    return `https://assets.mcasset.cloud/1.20.4/assets/minecraft/textures/block/${cleanName}.png`;
  };

  const renderSlot = (slotNumber: number, label?: string, isHotbarActive?: boolean) => {
    const item = slotMap.get(slotNumber);
    const isSelected = selectedSlotIndex === slotNumber;
    const isEnchanted = Boolean(item?.enchantments && item.enchantments.length > 0);

    return (
      <div
        key={slotNumber}
        onClick={() => setSelectedSlotIndex(slotNumber)}
        className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all select-none ${
          isSelected
            ? 'bg-amber-100/90 border-amber-500 shadow-md ring-2 ring-amber-400/50 scale-105 z-10'
            : isHotbarActive
            ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
            : isEnchanted
            ? 'bg-purple-50/70 border-purple-400 hover:border-purple-500'
            : 'bg-slate-100/80 border-slate-300 hover:border-slate-400 hover:bg-slate-200/60'
        }`}
        title={item ? `${item.displayName} (x${item.count})` : label || `Slot ${slotNumber}`}
      >
        {/* Placeholder Slot Label if empty */}
        {!item && label && (
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter text-center leading-none px-0.5">
            {label}
          </span>
        )}

        {/* Item Icon */}
        {item && (
          <div className="relative w-full h-full flex items-center justify-center p-1">
            <img
              src={getItemTextureUrl(item.name)}
              alt={item.displayName}
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain pixelated drop-shadow-xs"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.triedBlock) {
                  target.dataset.triedBlock = 'true';
                  target.src = getBlockTextureUrl(item.name);
                } else {
                  target.style.display = 'none';
                }
              }}
            />

            {/* Enchantment Shimmer Dot */}
            {isEnchanted && (
              <span className="absolute top-0.5 right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
              </span>
            )}

            {/* Stack Count Badge */}
            {item.count > 1 && (
              <span
                className="absolute bottom-0 right-0.5 font-minecraft text-[11px] font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.9)] leading-none select-none"
              >
                {item.count}
              </span>
            )}

            {/* Durability Bar */}
            {typeof item.durabilityUsed === 'number' && typeof item.maxDurability === 'number' && item.maxDurability > 0 && (
              <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-slate-900/80 rounded-xs overflow-hidden">
                <div
                  className={`h-full ${
                    item.durabilityUsed / item.maxDurability > 0.8
                      ? 'bg-rose-500'
                      : item.durabilityUsed / item.maxDurability > 0.5
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.max(4, ((item.maxDurability - item.durabilityUsed) / item.maxDurability) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden my-auto max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-slate-200 flex items-center justify-between bg-slate-100/80">
          <div className="flex items-center space-x-3">
            <img
              src={`https://mc-heads.net/avatar/${config.name}/48`}
              alt={config.name}
              className="h-10 w-10 rounded-xl bg-slate-200 border-2 border-slate-300 shadow-xs"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  {config.name}&apos;s Live Inventory
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md">
                  {telemetry?.inventoryCount ?? 0} Stacks
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono font-medium">
                {config.host}:{config.port} &bull; Synchronized via Live Telemetry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body: Split into Equipment/Grid + Item Lore Inspector */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-5 overflow-y-auto">
          {/* Left 2 Cols: Minecraft Grid Layout */}
          <div className="md:col-span-2 space-y-4">
            {/* Equipment Row */}
            <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Armor & Hands Equipment
              </span>
              <div className="flex items-center justify-between gap-2">
                {/* 4 Armor Slots */}
                <div className="flex items-center space-x-1.5">
                  {renderSlot(5, 'Head')}
                  {renderSlot(6, 'Chest')}
                  {renderSlot(7, 'Legs')}
                  {renderSlot(8, 'Feet')}
                </div>

                {/* Hand & Offhand Slots */}
                <div className="flex items-center space-x-2 border-l-2 border-slate-200 pl-3">
                  <div className="flex flex-col items-center">
                    {renderSlot(36 + selectedHotbarIndex, 'Main', true)}
                    <span className="text-[9px] font-bold text-slate-500 mt-0.5">Main Hand</span>
                  </div>
                  <div className="flex flex-col items-center">
                    {renderSlot(45, 'Off')}
                    <span className="text-[9px] font-bold text-slate-500 mt-0.5">Off-Hand</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Storage (Slots 9 - 35, 3 Rows of 9) */}
            <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Main Inventory (27 Slots)
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Click any item to inspect lore</span>
              </div>

              <div className="grid grid-cols-9 gap-1 sm:gap-1.5 justify-items-center">
                {Array.from({ length: 27 }, (_, i) => renderSlot(9 + i))}
              </div>
            </div>

            {/* Hotbar (Slots 36 - 44, 9 Slots) */}
            <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5">
                  <Swords className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Hotbar (Active Slot: #{selectedHotbarIndex + 1})
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Equipped
                </span>
              </div>

              <div className="grid grid-cols-9 gap-1 sm:gap-1.5 justify-items-center">
                {Array.from({ length: 9 }, (_, i) => renderSlot(36 + i, undefined, i === selectedHotbarIndex))}
              </div>
            </div>
          </div>

          {/* Right Col: Detailed Item Lore & Enchantment Inspector */}
          <div className="md:col-span-1">
            <div className="bg-[#121622] border-2 border-slate-700 rounded-2xl p-4 text-white shadow-inner flex flex-col justify-between h-full min-h-[340px]">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Info className="h-4 w-4 text-cyan-400" />
                    <span className="font-mono font-bold text-xs uppercase text-cyan-300 tracking-wider">
                      Item Lore & Stats
                    </span>
                  </div>
                  {activeItem && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Slot #{activeItem.slot}
                    </span>
                  )}
                </div>

                {activeItem ? (
                  <div className="mt-4 space-y-3.5">
                    {/* Item Title and Image */}
                    <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 p-2 flex items-center justify-center shrink-0">
                        <img
                          src={getItemTextureUrl(activeItem.name)}
                          alt={activeItem.displayName}
                          className="w-8 h-8 object-contain pixelated"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.dataset.triedBlock) {
                              target.dataset.triedBlock = 'true';
                              target.src = getBlockTextureUrl(activeItem.name);
                            }
                          }}
                        />
                      </div>
                      <div className="truncate">
                        <h3 className={`font-black text-sm truncate ${
                          activeItem.enchantments && activeItem.enchantments.length > 0
                            ? 'text-cyan-300 drop-shadow-[0_1px_3px_rgba(6,182,212,0.4)]'
                            : 'text-white'
                        }`}>
                          {activeItem.displayName}
                        </h3>
                        <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                          minecraft:{activeItem.name}
                        </p>
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          Count: {activeItem.count}
                        </span>
                      </div>
                    </div>

                    {/* Durability */}
                    {typeof activeItem.durabilityUsed === 'number' && typeof activeItem.maxDurability === 'number' && activeItem.maxDurability > 0 && (
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-400 font-medium">Durability:</span>
                          <span className="text-emerald-400 font-bold">
                            {activeItem.maxDurability - activeItem.durabilityUsed} / {activeItem.maxDurability}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 transition-all rounded-full"
                            style={{
                              width: `${((activeItem.maxDurability - activeItem.durabilityUsed) / activeItem.maxDurability) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Enchantments Section */}
                    {activeItem.enchantments && activeItem.enchantments.length > 0 && (
                      <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl space-y-1.5">
                        <div className="flex items-center space-x-1.5 text-purple-300 font-bold text-xs">
                          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                          <span>Enchantments ({activeItem.enchantments.length})</span>
                        </div>
                        <div className="space-y-1 pt-1 font-mono text-xs">
                          {activeItem.enchantments.map((ench, idx) => (
                            <div key={idx} className="flex items-center justify-between text-cyan-300 font-semibold">
                              <span>&bull; {ench.displayName}</span>
                              <span className="text-[10px] text-purple-300 font-bold">Lvl {ench.level}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Item Custom Lore Section */}
                    {activeItem.lore && activeItem.lore.length > 0 && (
                      <div className="p-3 bg-slate-900/90 border border-purple-900/50 rounded-xl space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                          Item Lore
                        </span>
                        <div className="space-y-1 pt-0.5">
                          {activeItem.lore.map((line, idx) => (
                            <p key={idx} className="font-mono text-xs text-purple-200/90 italic leading-snug">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-16 text-center text-slate-500 font-mono text-xs space-y-2">
                    <Package className="h-8 w-8 mx-auto text-slate-600 stroke-[1.5]" />
                    <p>Select any item slot from the inventory grid to inspect its lore and enchantments.</p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-500 text-center">
                Updates in real-time as bot picks up or consumes items
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Inventory Stream</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

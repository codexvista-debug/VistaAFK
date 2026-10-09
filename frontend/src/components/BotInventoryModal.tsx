'use client';

import React, { useState, useEffect } from 'react';
import { X, Shield, Sparkles, Package, Info, Swords, ArrowRight, ArrowLeftRight, Check } from 'lucide-react';
import { BotConfig, BotTelemetry, InventoryItem } from '../types';
import { useVistaWebSocket } from '../hooks/useVistaWebSocket';

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
  const { moveInventoryItem, setQuickBarSlot } = useVistaWebSocket();
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Selected item to display in the Lore & Details inspector
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    36 + selectedHotbarIndex
  );

  // Moving slot state for interactive two-click swap or drag & drop
  const [movingSlot, setMovingSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const activeItem = selectedSlotIndex !== null ? slotMap.get(selectedSlotIndex) : null;
  const movingItem = movingSlot !== null ? slotMap.get(movingSlot) : null;

  const getItemTextureUrl = (name: string) => {
    const cleanName = name.replace(/^minecraft:/, '');
    return `https://assets.mcasset.cloud/1.20.4/assets/minecraft/textures/item/${cleanName}.png`;
  };

  const getBlockTextureUrl = (name: string) => {
    const cleanName = name.replace(/^minecraft:/, '');
    return `https://assets.mcasset.cloud/1.20.4/assets/minecraft/textures/block/${cleanName}.png`;
  };

  const handleSlotClick = (slotNumber: number) => {
    // If we are currently in move mode
    if (movingSlot !== null) {
      if (movingSlot === slotNumber) {
        // Cancel move if clicked same slot
        setMovingSlot(null);
      } else {
        // Execute move / swap
        moveInventoryItem(config.id, movingSlot, slotNumber);
        setSelectedSlotIndex(slotNumber);
        setMovingSlot(null);
      }
      return;
    }

    // Normal slot selection to inspect
    setSelectedSlotIndex(slotNumber);
  };

  const handleDragStart = (e: React.DragEvent, slotNumber: number) => {
    const item = slotMap.get(slotNumber);
    if (!item) return;
    e.dataTransfer.setData('text/plain', String(slotNumber));
    e.dataTransfer.effectAllowed = 'move';
    setMovingSlot(slotNumber);
  };

  const handleDragOver = (e: React.DragEvent, slotNumber: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSlot !== slotNumber) {
      setDragOverSlot(slotNumber);
    }
  };

  const handleDrop = (e: React.DragEvent, targetSlot: number) => {
    e.preventDefault();
    setDragOverSlot(null);
    const sourceSlotRaw = e.dataTransfer.getData('text/plain');
    const sourceSlot = parseInt(sourceSlotRaw, 10);
    if (!isNaN(sourceSlot) && sourceSlot !== targetSlot) {
      moveInventoryItem(config.id, sourceSlot, targetSlot);
      setSelectedSlotIndex(targetSlot);
    }
    setMovingSlot(null);
  };

  const renderSlot = (slotNumber: number, label?: string, isHotbarActive?: boolean) => {
    const item = slotMap.get(slotNumber);
    const isSelected = selectedSlotIndex === slotNumber;
    const isMovingThis = movingSlot === slotNumber;
    const isTargetOfMove = movingSlot !== null && movingSlot !== slotNumber;
    const isDragOver = dragOverSlot === slotNumber;
    const isEnchanted = Boolean(item?.enchantments && item.enchantments.length > 0);

    return (
      <div
        key={slotNumber}
        onClick={() => handleSlotClick(slotNumber)}
        draggable={Boolean(item)}
        onDragStart={(e) => handleDragStart(e, slotNumber)}
        onDragOver={(e) => handleDragOver(e, slotNumber)}
        onDragLeave={() => setDragOverSlot(null)}
        onDrop={(e) => handleDrop(e, slotNumber)}
        className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all select-none ${
          isMovingThis
            ? 'bg-emerald-100 border-emerald-500 ring-4 ring-emerald-400/60 scale-105 z-20 animate-pulse'
            : isDragOver
            ? 'bg-emerald-200/80 border-emerald-600 ring-2 ring-emerald-500 scale-105 z-10'
            : isSelected
            ? 'bg-amber-100/90 border-amber-500 shadow-md ring-2 ring-amber-400/50 scale-105 z-10'
            : isTargetOfMove
            ? 'bg-slate-100/90 border-dashed border-emerald-400 hover:border-emerald-600 hover:bg-emerald-50'
            : isHotbarActive
            ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
            : isEnchanted
            ? 'bg-purple-50/70 border-purple-400 hover:border-purple-500'
            : 'bg-slate-100/80 border-slate-300 hover:border-slate-400 hover:bg-slate-200/60'
        }`}
        title={item ? `${item.displayName} (x${item.count}) • Slot #${slotNumber}` : label || `Slot #${slotNumber}`}
      >
        {/* Placeholder Slot Label if empty */}
        {!item && label && (
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter text-center leading-none px-0.5">
            {label}
          </span>
        )}

        {/* Move Destination Pulse Hint */}
        {isTargetOfMove && !item && (
          <span className="text-[9px] font-mono font-bold text-emerald-600">
            #{slotNumber >= 36 && slotNumber <= 44 ? `H${slotNumber - 35}` : slotNumber}
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden my-auto max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b-2 border-slate-200 flex items-center justify-between bg-slate-100/80 gap-2">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <img
              src={`https://mc-heads.net/avatar/${config.name}/48`}
              alt={config.name}
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-200 border-2 border-slate-300 shadow-xs shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight truncate">
                  {config.name}&apos;s Live Inventory
                </h2>
                <span className="px-1.5 sm:px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md shrink-0">
                  {telemetry?.inventoryCount ?? 0} Stacks
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-mono font-medium truncate">
                {config.host}:{config.port} &bull; Drag & drop or click items to move
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 active:scale-95 transition shrink-0"
            title="Close (Esc)"
          >
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Interactive Move Instruction Banner */}
        {movingSlot !== null && (
          <div className="bg-emerald-600 px-4 py-2.5 text-white flex items-center justify-between shadow-inner animate-in slide-in-from-top-1 duration-150">
            <div className="flex items-center space-x-2 text-xs font-bold font-mono">
              <ArrowLeftRight className="h-4 w-4 animate-spin text-emerald-200" />
              <span>
                Moving {movingItem?.displayName || `Slot #${movingSlot}`} ➜ Click any destination slot or hotbar slot to move / swap!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMovingSlot(null)}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[11px] font-bold transition"
            >
              Cancel
            </button>
          </div>
        )}

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
                <span className="text-[10px] text-slate-400 font-medium">Click to inspect or drag to move</span>
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
                  Equipped in Hand
                </span>
              </div>

              <div className="grid grid-cols-9 gap-1 sm:gap-1.5 justify-items-center">
                {Array.from({ length: 9 }, (_, i) => renderSlot(36 + i, undefined, i === selectedHotbarIndex))}
              </div>
            </div>
          </div>

          {/* Right Col: Detailed Item Lore & Enchantment Inspector */}
          <div className="md:col-span-1">
            <div className="bg-[#121622] border-2 border-slate-700 rounded-2xl p-4 text-white shadow-inner flex flex-col justify-between h-full min-h-[360px]">
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
                  <div className="mt-4 space-y-3">
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

                    {/* Move & Quick Equip Actions */}
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-bold text-slate-200">Move / Swap Item:</span>
                        {movingSlot === activeItem.slot && (
                          <span className="text-[10px] text-emerald-400 font-bold animate-pulse">Pick target slot</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (movingSlot === activeItem.slot) {
                              setMovingSlot(null);
                            } else {
                              setMovingSlot(activeItem.slot);
                            }
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold font-mono transition flex items-center justify-center space-x-1 border ${
                            movingSlot === activeItem.slot
                              ? 'bg-emerald-600 border-emerald-400 text-white'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                          }`}
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                          <span>{movingSlot === activeItem.slot ? 'Cancel Move' : 'Move / Swap'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (activeItem.slot >= 36 && activeItem.slot <= 44) {
                              setQuickBarSlot(config.id, activeItem.slot - 36);
                            } else {
                              moveInventoryItem(config.id, activeItem.slot, 36 + selectedHotbarIndex);
                            }
                          }}
                          className="py-1.5 px-2 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 transition flex items-center justify-center space-x-1"
                        >
                          <Swords className="h-3 w-3" />
                          <span>Equip Main</span>
                        </button>
                      </div>

                      {/* Move to Hotbar 1-9 Quick Buttons */}
                      <div className="pt-1.5 border-t border-slate-800/80">
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                          Move to Hotbar Slot:
                        </span>
                        <div className="grid grid-cols-9 gap-1">
                          {Array.from({ length: 9 }, (_, i) => {
                            const targetHotbarSlot = 36 + i;
                            const isCurrentSlot = activeItem.slot === targetHotbarSlot;
                            return (
                              <button
                                key={i}
                                type="button"
                                disabled={isCurrentSlot}
                                onClick={() => {
                                  moveInventoryItem(config.id, activeItem.slot, targetHotbarSlot);
                                  setSelectedSlotIndex(targetHotbarSlot);
                                }}
                                className={`py-1 text-center font-mono text-[10px] font-bold rounded border transition ${
                                  isCurrentSlot
                                    ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                                    : 'bg-slate-800 hover:bg-emerald-600 hover:text-white border-slate-700 text-slate-300'
                                }`}
                                title={`Move to Hotbar Slot #${i + 1}`}
                              >
                                {i + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Move to Off-Hand */}
                      <button
                        type="button"
                        onClick={() => {
                          moveInventoryItem(config.id, activeItem.slot, 45);
                          setSelectedSlotIndex(45);
                        }}
                        className="w-full py-1.5 px-2 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 transition flex items-center justify-center space-x-1 mt-1"
                      >
                        <Shield className="h-3 w-3" />
                        <span>Move to Off-Hand (Slot #45)</span>
                      </button>
                    </div>

                    {/* Durability */}
                    {typeof activeItem.durabilityUsed === 'number' && typeof activeItem.maxDurability === 'number' && activeItem.maxDurability > 0 && (
                      <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
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
                      <div className="p-2.5 bg-purple-950/40 border border-purple-800/60 rounded-xl space-y-1">
                        <div className="flex items-center space-x-1.5 text-purple-300 font-bold text-xs">
                          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                          <span>Enchantments ({activeItem.enchantments.length})</span>
                        </div>
                        <div className="space-y-1 pt-0.5 font-mono text-xs">
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
                      <div className="p-2.5 bg-slate-900/90 border border-purple-900/50 rounded-xl space-y-1">
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
                    <p>Select or drag any item slot to inspect or move it.</p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-500 text-center">
                Updates in real-time as bot picks up, moves, or consumes items
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Interactive Inventory Manager</span>
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

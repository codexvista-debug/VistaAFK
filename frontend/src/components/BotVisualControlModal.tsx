'use client';

import React from 'react';
import {
  X,
  Compass,
  Eye,
  Footprints,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Shield,
  Target,
  Users,
  Crosshair,
  Flame,
} from 'lucide-react';
import { BotConfig, BotTelemetry } from '../types';

interface BotVisualControlModalProps {
  config: BotConfig;
  telemetry?: BotTelemetry;
  onClose: () => void;
  onMove: (botId: string, control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', state: boolean) => void;
  onTogglePatrol: (botId: string, enabled: boolean) => void;
  onLook: (botId: string, yaw: number, pitch: number) => void;
}

export const BotVisualControlModal: React.FC<BotVisualControlModalProps> = ({
  config,
  telemetry,
  onClose,
  onMove,
  onTogglePatrol,
  onLook,
}) => {
  const isOnline = telemetry?.status === 'online';
  const yaw = telemetry?.yaw || 0;
  const pitch = telemetry?.pitch || 0;
  const facing = telemetry?.facing || 'South';
  const targetBlock = telemetry?.targetBlock;
  const nearbyEntities = telemetry?.nearbyEntities || [];
  const isPatrolling = telemetry?.isPatrolling || false;

  // Convert yaw to compass rotation in degrees
  const compassDeg = (((-yaw * 180 / Math.PI) % 360) + 360) % 360;

  const handleStep = (control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak') => {
    if (!isOnline) return;
    onMove(config.id, control, true);
    setTimeout(() => {
      onMove(config.id, control, false);
    }, 450);
  };

  const handleTurn = (deltaYawDeg: number) => {
    if (!isOnline) return;
    const deltaRad = (deltaYawDeg * Math.PI) / 180;
    onLook(config.id, yaw + deltaRad, pitch);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900">{config.name}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Tactical Sight & Movement
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Live visual radar, crosshair raycast, and movement controls</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body: Left Radar / Right Controls */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[540px] overflow-y-auto">
          {/* LEFT: 2D Tactical Radar & What Bot Is Looking At */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Target className="h-4 w-4 text-emerald-600" />
                <span>24-Block Tactical Radar</span>
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                Facing: {facing} ({Math.round(compassDeg)}°)
              </span>
            </div>

            {/* Radar Screen Canvas Area */}
            <div className="relative w-full aspect-square bg-[#0b121e] rounded-2xl border-2 border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
              {/* Radar Grid Circles */}
              <div className="absolute inset-4 rounded-full border border-emerald-900/40" />
              <div className="absolute inset-12 rounded-full border border-emerald-900/50" />
              <div className="absolute inset-20 rounded-full border border-emerald-900/60" />
              <div className="absolute h-full w-px bg-emerald-900/30" />
              <div className="absolute w-full h-px bg-emerald-900/30" />

              {/* Cardinal Directions */}
              <span className="absolute top-2 text-[10px] font-mono font-bold text-emerald-500">N</span>
              <span className="absolute bottom-2 text-[10px] font-mono font-bold text-emerald-500">S</span>
              <span className="absolute left-2 text-[10px] font-mono font-bold text-emerald-500">W</span>
              <span className="absolute right-2 text-[10px] font-mono font-bold text-emerald-500">E</span>

              {/* Player Icon at Center with Field of View Cone */}
              <div
                className="absolute w-24 h-24 pointer-events-none transition-transform duration-300"
                style={{ transform: `rotate(${compassDeg}deg)` }}
              >
                {/* Viewing Vision Cone */}
                <div
                  className="w-full h-full opacity-35"
                  style={{
                    background: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 70%)',
                    clipPath: 'polygon(50% 50%, 15% 0%, 85% 0%)',
                  }}
                />
              </div>

              {/* Center Dot (Bot Character) */}
              <div className="relative z-10 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow-lg shadow-emerald-400/80 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-black" />
              </div>

              {/* Nearby Entities Plotted on Radar */}
              {nearbyEntities.map((ent) => {
                // Map dx, dz from [-24, 24] to percentage offset [-42%, 42%]
                const maxRange = 24;
                const botPos = telemetry?.coordinates || { x: 0, z: 0 };
                const dx = ent.x - botPos.x;
                const dz = ent.z - botPos.z;
                const pctX = 50 + (dx / maxRange) * 40;
                const pctY = 50 + (dz / maxRange) * 40;

                return (
                  <div
                    key={ent.id}
                    title={`${ent.name} (${ent.distance}m)`}
                    className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[8px] font-bold ${
                      ent.isPlayer
                        ? 'bg-cyan-400 text-black border border-white shadow-sm shadow-cyan-400'
                        : ent.isHostile
                        ? 'bg-rose-500 text-white animate-pulse border border-rose-300 shadow-sm shadow-rose-500'
                        : 'bg-emerald-400 text-black'
                    }`}
                    style={{ left: `${Math.max(8, Math.min(92, pctX))}%`, top: `${Math.max(8, Math.min(92, pctY))}%` }}
                  >
                    <span className="scale-75">{ent.isPlayer ? 'P' : ent.isHostile ? '!' : 'M'}</span>
                  </div>
                );
              })}
            </div>

            {/* Target Crosshair Block info */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center space-x-3 text-xs">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200">
                <Crosshair className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Crosshair Aiming At
                </span>
                <span className="font-bold text-slate-800 font-mono">
                  {targetBlock ? targetBlock.name.replace(/_/g, ' ') : 'Looking at open space / air'}
                </span>
                {targetBlock && (
                  <span className="text-[10px] text-slate-500 font-mono block">
                    Coordinates: {targetBlock.x}, {targetBlock.y}, {targetBlock.z}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Movement & Patrol Controls */}
          <div className="flex flex-col justify-between space-y-4">
            {/* Auto Walk Back & Forth (Patrol Mode) */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Footprints className="h-4 w-4 text-emerald-700" />
                  <span className="font-bold text-xs text-slate-900">Patrol (Walk Back & Forth)</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isPatrolling
                      ? 'bg-emerald-600 text-white border-emerald-700 animate-pulse'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {isPatrolling ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Makes the bot continuously walk forward a few steps, turn around, and walk back. Keeps chunks loaded and resets server AFK timer.
              </p>
              <button
                onClick={() => onTogglePatrol(config.id, !isPatrolling)}
                disabled={!isOnline}
                className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center justify-center space-x-2 ${
                  isPatrolling
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <Footprints className="h-4 w-4" />
                <span>{isPatrolling ? 'Stop Walking Back & Forth' : 'Start Walking Back & Forth'}</span>
              </button>
            </div>

            {/* Manual Movement D-Pad */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Manual Step Controls
              </span>
              <div className="flex flex-col items-center space-y-2">
                {/* Forward [W] */}
                <button
                  onClick={() => handleStep('forward')}
                  disabled={!isOnline}
                  className="w-14 h-12 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-sm flex flex-col items-center justify-center transition active:scale-95"
                >
                  <ArrowUp className="h-4 w-4" />
                  <span className="text-[10px] font-mono">W</span>
                </button>

                {/* Left [A], Back [S], Right [D] */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleStep('left')}
                    disabled={!isOnline}
                    className="w-14 h-12 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-sm flex flex-col items-center justify-center transition active:scale-95"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-[10px] font-mono">A</span>
                  </button>
                  <button
                    onClick={() => handleStep('back')}
                    disabled={!isOnline}
                    className="w-14 h-12 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-sm flex flex-col items-center justify-center transition active:scale-95"
                  >
                    <ArrowDown className="h-4 w-4" />
                    <span className="text-[10px] font-mono">S</span>
                  </button>
                  <button
                    onClick={() => handleStep('right')}
                    disabled={!isOnline}
                    className="w-14 h-12 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-sm flex flex-col items-center justify-center transition active:scale-95"
                  >
                    <ArrowRight className="h-4 w-4" />
                    <span className="text-[10px] font-mono">D</span>
                  </button>
                </div>

                {/* Jump & Sneak */}
                <div className="flex items-center space-x-2 pt-1 w-full justify-center">
                  <button
                    onClick={() => handleStep('jump')}
                    disabled={!isOnline}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-sm transition"
                  >
                    Jump (Space)
                  </button>
                  <button
                    onClick={() => handleStep('sneak')}
                    disabled={!isOnline}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-sm transition"
                  >
                    Sneak (Shift)
                  </button>
                </div>
              </div>
            </div>

            {/* Turn & Look controls */}
            <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-2xl">
              <span className="font-semibold text-slate-600">Turn Head:</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleTurn(-45)}
                  disabled={!isOnline}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 shadow-xs"
                >
                  ↺ -45°
                </button>
                <button
                  onClick={() => handleTurn(45)}
                  disabled={!isOnline}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 shadow-xs"
                >
                  ↻ +45°
                </button>
                <button
                  onClick={() => handleTurn(180)}
                  disabled={!isOnline}
                  className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold shadow-xs"
                >
                  180° Flip
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

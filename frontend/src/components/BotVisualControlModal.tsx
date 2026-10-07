'use client';

import React from 'react';
import {
  X,
  Compass,
  Footprints,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
} from 'lucide-react';
import { BotConfig, BotTelemetry } from '../types';

import { XaerosMinimap } from './XaerosMinimap';

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
  const targetBlock = telemetry?.targetBlock;
  const isPatrolling = telemetry?.isPatrolling || false;

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
      <div className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
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
                  Xaero's Minimap & Tactical Sight
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Topographic terrain, nearby player tags, crosshair raycast, and movement controls</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body: Left Minimap / Right Controls */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto">
          {/* LEFT: Xaero's Minimap & What Bot Is Looking At */}
          <div className="flex flex-col space-y-4">
            {/* Xaero's Minimap Component */}
            <XaerosMinimap telemetry={telemetry} botName={config.name} />

            {/* Target Crosshair Block info */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center space-x-3 text-xs">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200 flex-shrink-0">
                <Crosshair className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Crosshair Aiming At
                </span>
                <span className="font-bold text-slate-800 font-mono truncate block">
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

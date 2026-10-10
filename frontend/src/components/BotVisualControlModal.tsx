'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  X,
  Compass,
  Footprints,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Trees,
  Sun,
  Layers,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Eye,
  Activity,
  Wind,
} from 'lucide-react';
import { BotConfig, BotTelemetry } from '../types';
import { XaerosMinimap } from './XaerosMinimap';

interface BotVisualControlModalProps {
  config: BotConfig;
  telemetry?: BotTelemetry;
  onClose: () => void;
  onMove: (botId: string, control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', state: boolean, durationMs?: number) => void;
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
  const terrainGrid = telemetry?.terrainGrid;
  const coords = telemetry?.coordinates || { x: 0, y: 0, z: 0 };

  // Landscape & Environment Metrics
  const currentBiome = terrainGrid?.currentBiome || telemetry?.currentBiome || 'Plains';
  const currentLand = terrainGrid?.currentLandBlock || telemetry?.currentLandBlock || 'Grass Block';
  const timeOfDay = terrainGrid?.timeOfDay || 'Day (12:00)';
  const weather = terrainGrid?.weather || 'Clear ☀️';
  const lightLevel = terrainGrid?.lightLevel ?? 15;
  const groundElevation = terrainGrid?.groundElevation ?? Math.round(coords.y);
  const seaLevelDelta = terrainGrid?.seaLevelDelta ?? Math.round(coords.y - 63);
  const skyClearance = terrainGrid?.skyClearance || 'Open Sky 🌤️';
  const landscapeSummary = terrainGrid?.landscapeSummary || [];
  const hazards = terrainGrid?.hazards || ['🛡️ Area clear of immediate hazards'];

  // Movement Control States
  const [activeControls, setActiveControls] = useState<Record<string, boolean>>({});
  const activeControlRef = useRef<Record<string, boolean>>({});
  const stepTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  const startMove = useCallback((control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak') => {
    if (!isOnline) return;
    activeControlRef.current[control] = true;
    setActiveControls((prev) => ({ ...prev, [control]: true }));
    onMove(config.id, control, true);
  }, [isOnline, config.id, onMove]);

  const stopMove = useCallback((control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak') => {
    if (!isOnline) return;
    if (stepTimeoutsRef.current[control]) {
      clearTimeout(stepTimeoutsRef.current[control]);
      delete stepTimeoutsRef.current[control];
    }
    activeControlRef.current[control] = false;
    setActiveControls((prev) => ({ ...prev, [control]: false }));
    onMove(config.id, control, false);
  }, [isOnline, config.id, onMove]);

  const stepMove = useCallback((control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', durationMs = 1200) => {
    if (!isOnline) return;
    activeControlRef.current[control] = true;
    setActiveControls((prev) => ({ ...prev, [control]: true }));
    if (stepTimeoutsRef.current[control]) {
      clearTimeout(stepTimeoutsRef.current[control]);
    }
    onMove(config.id, control, true, durationMs);
    stepTimeoutsRef.current[control] = setTimeout(() => {
      activeControlRef.current[control] = false;
      setActiveControls((prev) => ({ ...prev, [control]: false }));
      delete stepTimeoutsRef.current[control];
    }, durationMs);
  }, [isOnline, config.id, onMove]);

  const createButtonHandlers = (control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak') => {
    let pressTimer: NodeJS.Timeout | null = null;
    let isContinuous = false;

    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!isOnline) return;
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (err) {}
        isContinuous = false;
        pressTimer = setTimeout(() => {
          isContinuous = true;
          startMove(control);
        }, 200);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!isOnline) return;
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        if (isContinuous) {
          stopMove(control);
          isContinuous = false;
        } else {
          stepMove(control, control === 'jump' ? 400 : 1200);
        }
      },
      onPointerCancel: () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        if (isContinuous) {
          stopMove(control);
          isContinuous = false;
        }
      },
    };
  };

  const handleTurn = (deltaYawDeg: number) => {
    if (!isOnline) return;
    const deltaRad = (deltaYawDeg * Math.PI) / 180;
    onLook(config.id, yaw + deltaRad, pitch);
  };

  const snapToCardinal = (targetDeg: number) => {
    if (!isOnline) return;
    const rad = (-targetDeg * Math.PI) / 180;
    onLook(config.id, rad, 0);
  };

  // Physical Keyboard Listener (WASD, Space, Shift, Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        startMove('forward');
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        startMove('back');
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        startMove('left');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        startMove('right');
      } else if (e.code === 'Space') {
        e.preventDefault();
        startMove('jump');
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        startMove('sneak');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        stopMove('forward');
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        stopMove('back');
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        stopMove('left');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        stopMove('right');
      } else if (e.code === 'Space') {
        stopMove('jump');
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        stopMove('sneak');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Clean up any moving state
      Object.keys(activeControlRef.current).forEach((ctrl) => {
        if (activeControlRef.current[ctrl]) {
          onMove(config.id, ctrl as any, false);
        }
      });
    };
  }, [isOnline, config.id, onClose, startMove, stopMove, onMove]);

  const activeMovementLabels: string[] = [];
  if (activeControls['forward']) activeMovementLabels.push('Walking Forward (W)');
  if (activeControls['back']) activeMovementLabels.push('Walking Back (S)');
  if (activeControls['left']) activeMovementLabels.push('Moving Left (A)');
  if (activeControls['right']) activeMovementLabels.push('Moving Right (D)');
  if (activeControls['jump']) activeMovementLabels.push('Jumping (Space)');
  if (activeControls['sneak']) activeMovementLabels.push('Sneaking (Shift)');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-5xl flex flex-col shadow-2xl overflow-hidden max-h-[94vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 gap-2">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
              <Compass className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">{config.name}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                  Tactical Sight & Landscape
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                Radar minimap, real-time terrain scanner & WASD controls
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

        {/* Content Body: Left Minimap & Landscape / Right Controls */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 overflow-y-auto">
          {/* LEFT: Xaero's Minimap & Target Block (5 cols) */}
          <div className="lg:col-span-6 flex flex-col space-y-4">
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

          {/* RIGHT: Detailed Landscape Analysis & Movement Controls (6 cols) */}
          <div className="lg:col-span-6 flex flex-col space-y-4">
            {/* 1. Comprehensive Landscape & Environment Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2">
                  <Trees className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                    Landscape & Environment
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {currentBiome}
                </span>
              </div>

              {/* Grid of Key Landscape Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {/* Surface Block */}
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Standing On</span>
                  <span className="font-bold text-slate-800 truncate block">{currentLand}</span>
                </div>

                {/* Ground Elevation */}
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Elevation</span>
                  <span className="font-bold text-slate-800 truncate block">
                    Y: {groundElevation} ({seaLevelDelta >= 0 ? `+${seaLevelDelta}m` : `${seaLevelDelta}m`})
                  </span>
                </div>

                {/* Sky Clearance */}
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Clearance</span>
                  <span className="font-bold text-slate-800 truncate block">{skyClearance}</span>
                </div>

                {/* Time of Day */}
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Time of Day</span>
                  <span className="font-bold text-slate-800 truncate block">{timeOfDay}</span>
                </div>

                {/* Weather */}
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Weather</span>
                  <span className="font-bold text-slate-800 truncate block">{weather}</span>
                </div>

                {/* Light Level */}
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Light Level</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {lightLevel} / 15 {lightLevel >= 8 ? '☀️ Safe' : '⚠️ Dim'}
                  </span>
                </div>
              </div>

              {/* Dominant Surrounding Landscape Materials */}
              {landscapeSummary.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Surrounding Terrain Composition (29x29 Scanner)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {landscapeSummary.map((block) => (
                      <span
                        key={block.name}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px] font-medium text-slate-700 shadow-2xs"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block shrink-0 border border-black/20"
                          style={{ backgroundColor: block.color }}
                        />
                        <span className="truncate max-w-[110px]">{block.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">({block.percentage}%)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Hazards Status */}
              <div className="pt-1">
                {hazards.map((hz, i) => (
                  <div
                    key={i}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-xl flex items-center space-x-1.5 border ${
                      hz.includes('⚠️')
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <span>{hz}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Manual Movement Controls (Hold to move, click to step, or press WASD) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Manual Movement (Click, Hold or WASD)
                </span>
                <span className="text-[10px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  Keyboard Enabled
                </span>
              </div>

              {/* Active Movement Toast */}
              {activeMovementLabels.length > 0 && (
                <div className="px-3 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-xl flex items-center justify-center space-x-2 animate-pulse shadow-sm">
                  <Activity className="h-3.5 w-3.5" />
                  <span>{activeMovementLabels.join(' + ')}</span>
                </div>
              )}

              <div className="flex flex-col items-center space-y-2 select-none">
                {/* Forward [W] */}
                <button
                  {...createButtonHandlers('forward')}
                  disabled={!isOnline}
                  className={`w-14 h-12 rounded-xl font-bold border shadow-sm flex flex-col items-center justify-center transition active:scale-95 touch-none select-none ${
                    activeControls['forward']
                      ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400'
                      : 'bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 border-slate-300'
                  }`}
                  title="Forward (Click for step, hold to walk, or press W / ↑)"
                >
                  <ArrowUp className="h-4 w-4" />
                  <span className="text-[10px] font-mono">W</span>
                </button>

                {/* Left [A], Back [S], Right [D] */}
                <div className="flex items-center space-x-2">
                  <button
                    {...createButtonHandlers('left')}
                    disabled={!isOnline}
                    className={`w-14 h-12 rounded-xl font-bold border shadow-sm flex flex-col items-center justify-center transition active:scale-95 touch-none select-none ${
                      activeControls['left']
                        ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400'
                        : 'bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 border-slate-300'
                    }`}
                    title="Strafe Left (Click for step, hold to strafe, or press A / ←)"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-[10px] font-mono">A</span>
                  </button>
                  <button
                    {...createButtonHandlers('back')}
                    disabled={!isOnline}
                    className={`w-14 h-12 rounded-xl font-bold border shadow-sm flex flex-col items-center justify-center transition active:scale-95 touch-none select-none ${
                      activeControls['back']
                        ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400'
                        : 'bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 border-slate-300'
                    }`}
                    title="Walk Back (Click for step, hold to walk, or press S / ↓)"
                  >
                    <ArrowDown className="h-4 w-4" />
                    <span className="text-[10px] font-mono">S</span>
                  </button>
                  <button
                    {...createButtonHandlers('right')}
                    disabled={!isOnline}
                    className={`w-14 h-12 rounded-xl font-bold border shadow-sm flex flex-col items-center justify-center transition active:scale-95 touch-none select-none ${
                      activeControls['right']
                        ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400'
                        : 'bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 border-slate-300'
                    }`}
                    title="Strafe Right (Click for step, hold to strafe, or press D / →)"
                  >
                    <ArrowRight className="h-4 w-4" />
                    <span className="text-[10px] font-mono">D</span>
                  </button>
                </div>

                {/* Jump & Sneak */}
                <div className="flex items-center space-x-2 pt-1 w-full justify-center">
                  <button
                    {...createButtonHandlers('jump')}
                    disabled={!isOnline}
                    className={`px-4 py-2 rounded-xl font-bold text-xs border shadow-sm transition touch-none select-none ${
                      activeControls['jump']
                        ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    title="Jump (Space / Tap)"
                  >
                    Jump (Space)
                  </button>
                  <button
                    {...createButtonHandlers('sneak')}
                    disabled={!isOnline}
                    className={`px-4 py-2 rounded-xl font-bold text-xs border shadow-sm transition touch-none select-none ${
                      activeControls['sneak']
                        ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    title="Sneak (Shift / Hold)"
                  >
                    Sneak (Shift)
                  </button>
                </div>
              </div>

              {/* Cardinal Orientations & Turn Controls */}
              <div className="pt-2 border-t border-slate-200 flex flex-col space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600 text-[11px]">Snap Facing:</span>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      onClick={() => snapToCardinal(0)}
                      disabled={!isOnline}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 shadow-2xs"
                    >
                      North (0°)
                    </button>
                    <button
                      onClick={() => snapToCardinal(90)}
                      disabled={!isOnline}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 shadow-2xs"
                    >
                      East (90°)
                    </button>
                    <button
                      onClick={() => snapToCardinal(180)}
                      disabled={!isOnline}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 shadow-2xs"
                    >
                      South (180°)
                    </button>
                    <button
                      onClick={() => snapToCardinal(270)}
                      disabled={!isOnline}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 shadow-2xs"
                    >
                      West (270°)
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold text-slate-600 text-[11px]">Turn Head:</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleTurn(-45)}
                      disabled={!isOnline}
                      className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 shadow-2xs"
                    >
                      ↺ -45°
                    </button>
                    <button
                      onClick={() => handleTurn(45)}
                      disabled={!isOnline}
                      className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 shadow-2xs"
                    >
                      ↻ +45°
                    </button>
                    <button
                      onClick={() => handleTurn(180)}
                      disabled={!isOnline}
                      className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold shadow-2xs"
                    >
                      180° Flip
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Auto Patrol Mode */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Footprints className="h-4 w-4 text-emerald-700" />
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Patrol (Walk Back & Forth)</span>
                  <span className="text-[10px] text-slate-500">Auto walks 3 steps & turns around</span>
                </div>
              </div>
              <button
                onClick={() => onTogglePatrol(config.id, !isPatrolling)}
                disabled={!isOnline}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center space-x-1.5 ${
                  isPatrolling
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <span>{isPatrolling ? 'Stop Patrol' : 'Start Patrol'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

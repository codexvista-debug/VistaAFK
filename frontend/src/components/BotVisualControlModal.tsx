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
  Activity,
  Swords,
} from 'lucide-react';
import { XaerosMinimap } from './XaerosMinimap';
import { BotLookControl } from './BotLookControl';
import { BotConfig, BotTelemetry } from '../types';

interface BotVisualControlModalProps {
  config: BotConfig;
  telemetry?: BotTelemetry;
  daemonConnected: boolean;
  onClose: () => void;
  onMove: (botId: string, control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', state: boolean, durationMs?: number) => void;
  onTogglePatrol: (botId: string, enabled: boolean) => void;
  onLook: (botId: string, yaw: number, pitch: number) => void;
  onAttack?: (botId: string) => void;
}

export const BotVisualControlModal: React.FC<BotVisualControlModalProps> = ({
  config,
  telemetry,
  daemonConnected,
  onClose,
  onMove,
  onTogglePatrol,
  onLook,
  onAttack,
}) => {
  const isOnline = telemetry?.status === 'online';
  const controlsAvailable = isOnline && daemonConnected;
  const yaw = telemetry?.yaw || 0;
  const pitch = telemetry?.pitch || 0;
  const targetBlock = telemetry?.targetBlock;
  const isPatrolling = telemetry?.isPatrolling || false;
  // Movement Control States
  const [activeControls, setActiveControls] = useState<Record<string, boolean>>({});
  const activeControlRef = useRef<Record<string, boolean>>({});
  const stepTimeoutsRef = useRef<Record<string, any>>({});
  const pressStartRef = useRef<Record<string, number>>({});
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const configIdRef = useRef(config.id);
  useEffect(() => {
    configIdRef.current = config.id;
  }, [config.id]);

  const isOnlineRef = useRef(controlsAvailable);
  useEffect(() => {
    isOnlineRef.current = controlsAvailable;
  }, [controlsAvailable]);

  const onAttackRef = useRef(onAttack);
  useEffect(() => {
    onAttackRef.current = onAttack;
  }, [onAttack]);

  const startMove = useCallback((control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak') => {
    if (!isOnlineRef.current) return;
    if (stepTimeoutsRef.current[control]) {
      clearTimeout(stepTimeoutsRef.current[control]);
      delete stepTimeoutsRef.current[control];
    }
    activeControlRef.current[control] = true;
    setActiveControls((prev) => ({ ...prev, [control]: true }));
    onMoveRef.current(configIdRef.current, control, true);
  }, []);

  const stopMove = useCallback((control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak') => {
    if (stepTimeoutsRef.current[control]) {
      clearTimeout(stepTimeoutsRef.current[control]);
      delete stepTimeoutsRef.current[control];
    }
    activeControlRef.current[control] = false;
    setActiveControls((prev) => ({ ...prev, [control]: false }));
    onMoveRef.current(configIdRef.current, control, false);
  }, []);

  const stepMove = useCallback((control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak', durationMs = 1500) => {
    if (!isOnlineRef.current) return;
    activeControlRef.current[control] = true;
    setActiveControls((prev) => ({ ...prev, [control]: true }));
    if (stepTimeoutsRef.current[control]) {
      clearTimeout(stepTimeoutsRef.current[control]);
    }
    onMoveRef.current(configIdRef.current, control, true, durationMs);
    stepTimeoutsRef.current[control] = setTimeout(() => {
      activeControlRef.current[control] = false;
      setActiveControls((prev) => ({ ...prev, [control]: false }));
      delete stepTimeoutsRef.current[control];
    }, durationMs);
  }, []);

  const handleControlDown = (control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak') => {
    if (!isOnlineRef.current) return;
    pressStartRef.current[control] = Date.now();
    startMove(control);
  };

  const handleControlUp = (control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak') => {
    if (!isOnlineRef.current) return;
    const duration = Date.now() - (pressStartRef.current[control] || 0);
    if (duration < 250) {
      // Tap or click: trigger a multi-block 1500ms step
      stepMove(control, control === 'jump' ? 400 : 1500);
    } else {
      // Sustained hold: stop now
      stopMove(control);
    }
  };

  const createButtonHandlers = (control: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      handleControlDown(control);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      handleControlUp(control);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (activeControlRef.current[control]) {
        stopMove(control);
      }
    },
  });

  // Keyboard listener: uses stable refs and does NOT cancel on telemetry updates
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.repeat) return;

      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        pressedKeysRef.current.add(e.code);
        e.preventDefault();
        handleControlDown('forward');
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        pressedKeysRef.current.add(e.code);
        e.preventDefault();
        handleControlDown('back');
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        pressedKeysRef.current.add(e.code);
        e.preventDefault();
        handleControlDown('left');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        pressedKeysRef.current.add(e.code);
        e.preventDefault();
        handleControlDown('right');
      } else if (e.code === 'Space') {
        pressedKeysRef.current.add(e.code);
        e.preventDefault();
        handleControlDown('jump');
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        pressedKeysRef.current.add(e.code);
        e.preventDefault();
        handleControlDown('sneak');
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        onAttackRef.current?.(configIdRef.current);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!pressedKeysRef.current.delete(e.code)) return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        handleControlUp('forward');
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        handleControlUp('back');
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        handleControlUp('left');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        handleControlUp('right');
      } else if (e.code === 'Space') {
        handleControlUp('jump');
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        handleControlUp('sneak');
      }
    };

    const handleWindowBlur = () => {
      const keyControls: Record<string, 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak'> = {
        KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
        KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
        Space: 'jump', ShiftLeft: 'sneak', ShiftRight: 'sneak',
      };
      const controls = new Set<'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak'>();
      pressedKeysRef.current.forEach((code) => {
        const control = keyControls[code];
        if (control) controls.add(control);
      });
      pressedKeysRef.current.clear();
      controls.forEach((control) => stopMove(control));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [onClose]);

  // Clean up movement ONLY on true component unmount
  useEffect(() => {
    return () => {
      Object.keys(activeControlRef.current).forEach((ctrl) => {
        if (activeControlRef.current[ctrl]) {
          onMoveRef.current(configIdRef.current, ctrl as any, false);
        }
      });
      Object.values(stepTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

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
                  Manual Controls
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                Radar minimap and real-time bot controls
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

        {/* Content Body: Left Minimap / Right Controls */}
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

          {/* RIGHT: Movement and look controls (6 cols) */}
          <div className="lg:col-span-6 flex flex-col space-y-4">
            {/* Manual Movement Controls (hold to move, click to step, or press WASD) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Manual Movement (Click, Hold or WASD)
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                  controlsAvailable
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                }`}>
                  {controlsAvailable ? 'Ready' : daemonConnected ? 'Bot Offline' : 'Daemon Disconnected'}
                </span>
              </div>

              {!controlsAvailable && (
                <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
                  {daemonConnected ? 'Connect the bot to enable movement.' : 'Reconnect the daemon to send movement commands.'}
                </p>
              )}

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
                  disabled={!controlsAvailable}
                  className={`w-14 h-12 rounded-xl font-bold border border-b-4 shadow-md flex flex-col items-center justify-center transition active:translate-y-0.5 active:border-b-2 touch-none select-none disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeControls['forward']
                      ? 'translate-y-0.5 bg-emerald-600 text-white border-emerald-800 border-b-2 ring-2 ring-emerald-400 shadow-sm'
                      : 'bg-gradient-to-b from-white to-slate-100 hover:from-emerald-50 hover:to-emerald-100 text-slate-800 border-slate-300 border-b-slate-400'
                  }`}
                  title="Forward (Click for step, hold to walk, or press W / ↑)"
                >
                  <ArrowUp className="h-4 w-4" />
                  <kbd className="min-w-5 px-1 rounded border border-slate-300 border-b-2 bg-white/90 text-[9px] leading-3 font-black font-mono text-slate-600 shadow-sm">W</kbd>
                </button>

                {/* Left [A], Back [S], Right [D] */}
                <div className="flex items-center space-x-2">
                  <button
                    {...createButtonHandlers('left')}
                    disabled={!controlsAvailable}
                    className={`w-14 h-12 rounded-xl font-bold border border-b-4 shadow-md flex flex-col items-center justify-center transition active:translate-y-0.5 active:border-b-2 touch-none select-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      activeControls['left']
                        ? 'translate-y-0.5 bg-emerald-600 text-white border-emerald-800 border-b-2 ring-2 ring-emerald-400 shadow-sm'
                        : 'bg-gradient-to-b from-white to-slate-100 hover:from-emerald-50 hover:to-emerald-100 text-slate-800 border-slate-300 border-b-slate-400'
                    }`}
                    title="Strafe Left (Click for step, hold to strafe, or press A / ←)"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <kbd className="min-w-5 px-1 rounded border border-slate-300 border-b-2 bg-white/90 text-[9px] leading-3 font-black font-mono text-slate-600 shadow-sm">A</kbd>
                  </button>
                  <button
                    {...createButtonHandlers('back')}
                    disabled={!controlsAvailable}
                    className={`w-14 h-12 rounded-xl font-bold border border-b-4 shadow-md flex flex-col items-center justify-center transition active:translate-y-0.5 active:border-b-2 touch-none select-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      activeControls['back']
                        ? 'translate-y-0.5 bg-emerald-600 text-white border-emerald-800 border-b-2 ring-2 ring-emerald-400 shadow-sm'
                        : 'bg-gradient-to-b from-white to-slate-100 hover:from-emerald-50 hover:to-emerald-100 text-slate-800 border-slate-300 border-b-slate-400'
                    }`}
                    title="Walk Back (Click for step, hold to walk, or press S / ↓)"
                  >
                    <ArrowDown className="h-4 w-4" />
                    <kbd className="min-w-5 px-1 rounded border border-slate-300 border-b-2 bg-white/90 text-[9px] leading-3 font-black font-mono text-slate-600 shadow-sm">S</kbd>
                  </button>
                  <button
                    {...createButtonHandlers('right')}
                    disabled={!controlsAvailable}
                    className={`w-14 h-12 rounded-xl font-bold border border-b-4 shadow-md flex flex-col items-center justify-center transition active:translate-y-0.5 active:border-b-2 touch-none select-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      activeControls['right']
                        ? 'translate-y-0.5 bg-emerald-600 text-white border-emerald-800 border-b-2 ring-2 ring-emerald-400 shadow-sm'
                        : 'bg-gradient-to-b from-white to-slate-100 hover:from-emerald-50 hover:to-emerald-100 text-slate-800 border-slate-300 border-b-slate-400'
                    }`}
                    title="Strafe Right (Click for step, hold to strafe, or press D / →)"
                  >
                    <ArrowRight className="h-4 w-4" />
                    <kbd className="min-w-5 px-1 rounded border border-slate-300 border-b-2 bg-white/90 text-[9px] leading-3 font-black font-mono text-slate-600 shadow-sm">D</kbd>
                  </button>
                </div>

                {/* Jump, Sneak & Attack */}
                <div className="flex flex-wrap items-center gap-2 pt-1 w-full justify-center">
                  <button
                    {...createButtonHandlers('jump')}
                    disabled={!controlsAvailable}
                    className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-xs border border-b-4 shadow-md transition active:translate-y-0.5 active:border-b-2 touch-none select-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      activeControls['jump']
                        ? 'translate-y-0.5 bg-emerald-600 text-white border-emerald-800 border-b-2 ring-2 ring-emerald-400 shadow-sm'
                        : 'bg-gradient-to-b from-white to-slate-100 hover:from-emerald-50 hover:to-emerald-100 text-slate-700 border-slate-300 border-b-slate-400'
                    }`}
                    title="Jump (Space / Tap)"
                  >
                  <kbd className="mr-1.5 px-1.5 py-0.5 rounded border border-slate-300 border-b-2 bg-white/90 text-[9px] font-black font-mono shadow-sm">SPACE</kbd> Jump
                  </button>
                  <button
                    {...createButtonHandlers('sneak')}
                    disabled={!controlsAvailable}
                    className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-xs border border-b-4 shadow-md transition active:translate-y-0.5 active:border-b-2 touch-none select-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      activeControls['sneak']
                        ? 'translate-y-0.5 bg-emerald-600 text-white border-emerald-800 border-b-2 ring-2 ring-emerald-400 shadow-sm'
                        : 'bg-gradient-to-b from-white to-slate-100 hover:from-emerald-50 hover:to-emerald-100 text-slate-700 border-slate-300 border-b-slate-400'
                    }`}
                    title="Sneak (Shift / Hold)"
                  >
                  <kbd className="mr-1.5 px-1.5 py-0.5 rounded border border-slate-300 border-b-2 bg-white/90 text-[9px] font-black font-mono shadow-sm">SHIFT</kbd> Sneak
                  </button>
                  <button
                    type="button"
                    onClick={() => onAttack?.(config.id)}
                    disabled={!controlsAvailable}
                    className="px-3 sm:px-4 py-2 rounded-xl font-bold text-xs border border-rose-200 border-b-4 bg-gradient-to-b from-rose-50 to-rose-100 hover:from-rose-100 hover:to-rose-200 active:translate-y-0.5 active:border-b-2 text-rose-700 shadow-md transition flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Attack target in crosshair / swing sword (F or Click)"
                  >
                    <Swords className="h-3.5 w-3.5 text-rose-600" />
                    <span>Attack</span><kbd className="ml-1 px-1 rounded border border-rose-200 border-b-2 bg-white text-[9px] font-black font-mono shadow-sm">F</kbd>
                  </button>
                </div>
              </div>

            </div>

            {/* Look and head rotation controls */}
            <BotLookControl
              botId={config.id}
              botName={config.name}
              yaw={yaw}
              pitch={pitch}
              onLook={onLook}
              disabled={!controlsAvailable}
            />

            {/* Auto Patrol Mode */}
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
                disabled={!controlsAvailable}
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

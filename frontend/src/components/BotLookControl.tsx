'use client';

import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw, Compass, ArrowDown, ArrowUp, Check } from 'lucide-react';

interface BotLookControlProps {
  botId: string;
  botName: string;
  yaw?: number; // radians
  pitch?: number; // radians
  onLook: (botId: string, yaw: number, pitch: number) => void;
  disabled?: boolean;
}

export const BotLookControl: React.FC<BotLookControlProps> = ({
  botId,
  botName,
  yaw = 0,
  pitch = 0,
  onLook,
  disabled = false,
}) => {
  // Convert radians to user-friendly degrees
  const currentPitchDeg = Math.round((pitch * 180) / Math.PI);
  // Minecraft Yaw: 0 = South, 90 = West, 180 = North, 270 = East
  const currentYawDeg = Math.round((((-yaw * 180) / Math.PI) % 360 + 360) % 360);

  const [inputPitch, setInputPitch] = useState<string>(String(currentPitchDeg));
  const [inputYaw, setInputYaw] = useState<string>(String(currentYawDeg));
  const [isAiming, setIsAiming] = useState<boolean>(false);
  const padRef = useRef<HTMLDivElement | null>(null);

  // Sync inputs with telemetry when not actively typing/aiming
  useEffect(() => {
    if (!isAiming) {
      setInputPitch(String(currentPitchDeg));
      setInputYaw(String(currentYawDeg));
    }
  }, [currentPitchDeg, currentYawDeg, isAiming]);

  // Determine active cardinal for highlight
  const isSouth = currentYawDeg >= 315 || currentYawDeg < 45;
  const isWest = currentYawDeg >= 45 && currentYawDeg < 135;
  const isNorth = currentYawDeg >= 135 && currentYawDeg < 225;
  const isEast = currentYawDeg >= 225 && currentYawDeg < 315;

  const handlePadInteraction = (clientX: number, clientY: number) => {
    if (disabled || !padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // Angle in screen space: 0 is East (+X), Math.PI/2 is South (+Y), -Math.PI/2 is North (-Y), Math.PI is West (-X)
    let screenDeg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180 to 180
    // Convert to Minecraft cardinal: 0 = South (+Y), 90 = West (-X), 180 = North (-Y), 270 = East (+X)
    let mcYawDeg = Math.round(((screenDeg - 90) % 360 + 360) % 360);
    // Convert mcYawDeg back to radians:
    const targetRad = (-mcYawDeg * Math.PI) / 180;
    onLook(botId, targetRad, pitch);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    setIsAiming(true);
    handlePadInteraction(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isAiming || disabled) return;
    handlePadInteraction(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    setIsAiming(false);
  };

  const handlePitchSubmit = () => {
    const val = parseFloat(inputPitch);
    if (!isNaN(val)) {
      const clamped = Math.max(-90, Math.min(90, val));
      const rad = (clamped * Math.PI) / 180;
      onLook(botId, yaw, rad);
    }
  };

  const handleYawSubmit = () => {
    const val = parseFloat(inputYaw);
    if (!isNaN(val)) {
      const norm = ((val % 360) + 360) % 360;
      const rad = (-norm * Math.PI) / 180;
      onLook(botId, rad, pitch);
    }
  };

  const resetPitch = () => {
    setInputPitch('0');
    onLook(botId, yaw, 0);
  };

  const resetYaw = () => {
    setInputYaw('0');
    // 0 deg is South
    onLook(botId, 0, pitch);
  };

  const snapDirection = (deg: number, newPitch?: number) => {
    const rad = (-deg * Math.PI) / 180;
    onLook(botId, rad, newPitch !== undefined ? newPitch : pitch);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 shadow-sm space-y-3 select-none">
      {/* Title & Account Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center space-x-2">
          <Compass className="h-4 w-4 text-emerald-600" />
          <span className="font-bold text-xs text-slate-900 tracking-wider uppercase">Look</span>
        </div>
        <div className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-700 shadow-2xs">
          {botName}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Left Side: Interactive Aim Compass Pad */}
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 self-start">
            Aim
          </span>
          <div
            ref={padRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`relative w-40 h-40 bg-white border-2 rounded-2xl shadow-inner cursor-crosshair flex items-center justify-center touch-none transition-all ${
              isAiming ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            {/* Cardinal Markers */}
            <span
              onClick={(e) => { e.stopPropagation(); snapDirection(180); }}
              className={`absolute top-1.5 left-1/2 -translate-x-1/2 text-xs font-black cursor-pointer transition select-none ${
                isNorth ? 'text-emerald-600 scale-110 drop-shadow-sm font-black' : 'text-slate-400 hover:text-slate-800 font-bold'
              }`}
            >
              N
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); snapDirection(0); }}
              className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 text-xs font-black cursor-pointer transition select-none ${
                isSouth ? 'text-emerald-600 scale-110 drop-shadow-sm font-black' : 'text-slate-400 hover:text-slate-800 font-bold'
              }`}
            >
              S
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); snapDirection(90); }}
              className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs font-black cursor-pointer transition select-none ${
                isWest ? 'text-emerald-600 scale-110 drop-shadow-sm font-black' : 'text-slate-400 hover:text-slate-800 font-bold'
              }`}
            >
              W
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); snapDirection(270); }}
              className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black cursor-pointer transition select-none ${
                isEast ? 'text-emerald-600 scale-110 drop-shadow-sm font-black' : 'text-slate-400 hover:text-slate-800 font-bold'
              }`}
            >
              E
            </span>

            {/* Corner Quick Tilt Labels: Up & Down */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onLook(botId, yaw, -Math.PI / 2); }}
              className={`absolute top-2 right-2 text-[10px] font-bold px-1 rounded transition select-none ${
                currentPitchDeg <= -45 ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-sky-600'
              }`}
              title="Look straight up (-90°)"
            >
              Up
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onLook(botId, yaw, Math.PI / 2); }}
              className={`absolute bottom-2 right-2 text-[10px] font-bold px-1 rounded transition select-none ${
                currentPitchDeg >= 45 ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-amber-600'
              }`}
              title="Look down at feet (+90°)"
            >
              Down
            </button>

            {/* Player Head in Center with Aim Pointer */}
            <div className="relative flex items-center justify-center pointer-events-none">
              {/* Aim Pointer Needle Line */}
              <div
                className="absolute w-16 h-16 flex items-center justify-center transition-transform duration-100"
                style={{
                  transform: `rotate(${currentYawDeg + 180}deg)`,
                }}
              >
                <div className="w-1.5 h-7 bg-gradient-to-t from-transparent via-emerald-600 to-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.5)] transform -translate-y-4" />
              </div>

              {/* Player Avatar */}
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-300 shadow-sm">
                <img
                  src={`https://mc-heads.net/avatar/${encodeURIComponent(botName)}/56`}
                  alt={botName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/MHF_Steve/56';
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Inputs & Reset Buttons */}
        <div className="flex-1 w-full space-y-3">
          {/* 1. Up / Down (Pitch) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Up / Down (Pitch)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="-90"
                max="90"
                value={inputPitch}
                onChange={(e) => setInputPitch(e.target.value)}
                onBlur={handlePitchSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handlePitchSubmit()}
                disabled={disabled}
                placeholder="0"
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-2xs"
              />
              <button
                type="button"
                onClick={resetPitch}
                disabled={disabled}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-2xs transition"
              >
                Reset
              </button>
            </div>
          </div>

          {/* 2. Left / Right (Yaw) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Left / Right (Yaw)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="360"
                value={inputYaw}
                onChange={(e) => setInputYaw(e.target.value)}
                onBlur={handleYawSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleYawSubmit()}
                disabled={disabled}
                placeholder="0"
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-2xs"
              />
              <button
                type="button"
                onClick={resetYaw}
                disabled={disabled}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-2xs transition"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Quick Aim Chips (Feet / Level / Sky) */}
          <div className="pt-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Quick Aim Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onLook(botId, yaw, Math.PI / 2)}
                disabled={disabled}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition shadow-2xs ${
                  currentPitchDeg >= 80
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Feet (+90°)
              </button>
              <button
                type="button"
                onClick={() => onLook(botId, yaw, 0)}
                disabled={disabled}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition shadow-2xs ${
                  currentPitchDeg === 0
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Level (0°)
              </button>
              <button
                type="button"
                onClick={() => onLook(botId, yaw, -Math.PI / 2)}
                disabled={disabled}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition shadow-2xs ${
                  currentPitchDeg <= -80
                    ? 'bg-sky-100 text-sky-800 border-sky-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Sky (-90°)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

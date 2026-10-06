'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertOctagon, Box, KeyRound } from 'lucide-react';

const CORRECT_PASSCODE = '3012';
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

interface PasscodeGateProps {
  children: React.ReactNode;
}

export const PasscodeGate: React.FC<PasscodeGateProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingTimeStr, setRemainingTimeStr] = useState<string>('');
  const [attemptsLeft, setAttemptsLeft] = useState<number>(MAX_ATTEMPTS);

  useEffect(() => {
    const authSession = localStorage.getItem('vistaafk_passcode_auth');
    if (authSession === 'authenticated') {
      setIsAuthenticated(true);
    }

    const savedLockout = localStorage.getItem('vistaafk_lockout');
    if (savedLockout) {
      try {
        const parsed = JSON.parse(savedLockout);
        if (parsed.lockedUntil && Date.now() < parsed.lockedUntil) {
          setLockedUntil(parsed.lockedUntil);
        } else if (parsed.lockedUntil && Date.now() >= parsed.lockedUntil) {
          localStorage.removeItem('vistaafk_lockout');
          setLockedUntil(null);
        } else if (typeof parsed.failedAttempts === 'number') {
          setAttemptsLeft(MAX_ATTEMPTS - parsed.failedAttempts);
        }
      } catch (e) {
        localStorage.removeItem('vistaafk_lockout');
      }
    }
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = lockedUntil - now;
      if (diff <= 0) {
        setLockedUntil(null);
        setAttemptsLeft(MAX_ATTEMPTS);
        localStorage.removeItem('vistaafk_lockout');
        setRemainingTimeStr('');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setRemainingTimeStr(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil) return;

    if (passcode.trim() === CORRECT_PASSCODE) {
      setIsAuthenticated(true);
      localStorage.setItem('vistaafk_passcode_auth', 'authenticated');
      localStorage.removeItem('vistaafk_lockout');
      setErrorMessage(null);
    } else {
      const savedLockout = localStorage.getItem('vistaafk_lockout');
      let failedAttempts = 1;
      if (savedLockout) {
        try {
          const parsed = JSON.parse(savedLockout);
          failedAttempts = (parsed.failedAttempts || 0) + 1;
        } catch (e) {
          failedAttempts = 1;
        }
      }

      if (failedAttempts >= MAX_ATTEMPTS) {
        const lockTime = Date.now() + LOCKOUT_DURATION_MS;
        localStorage.setItem(
          'vistaafk_lockout',
          JSON.stringify({ failedAttempts, lockedUntil: lockTime })
        );
        setLockedUntil(lockTime);
        setAttemptsLeft(0);
        setErrorMessage(`Too many failed attempts! Locked for 12 hours.`);
      } else {
        const remaining = MAX_ATTEMPTS - failedAttempts;
        localStorage.setItem(
          'vistaafk_lockout',
          JSON.stringify({ failedAttempts })
        );
        setAttemptsLeft(remaining);
        setErrorMessage(`Incorrect passcode! ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`);
      }
      setPasscode('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#4a3b2c] relative overflow-hidden font-sans">
      {/* Minecraft Classic Dirt Background Pattern */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h8v8H0V0zm8 8h8v8H8V8z' fill='%232e2217' fill-opacity='0.6' fill-rule='evenodd'/%3E%3Cpath d='M0 8h8v8H0V8zm8-8h8v8H8V0z' fill='%235c4935' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Classic Minecraft GUI Box (Light Stone with 3D Beveled Borders) */}
      <div className="relative z-10 w-full max-w-md bg-[#c6c6c6] border-4 border-t-white border-l-white border-b-[#555555] border-r-[#555555] rounded-xl p-8 shadow-2xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          {/* Minecraft Grass Block */}
          <div className="h-16 w-16 rounded-xl bg-[#22c55e] border-4 border-t-[#86efac] border-l-[#86efac] border-b-[#166534] border-r-[#166534] flex items-center justify-center text-white shadow-md relative overflow-hidden mb-3">
            <div className="absolute inset-x-0 bottom-0 h-6 bg-[#78350f] border-t-2 border-[#15803d]" />
            <Box className="h-8 w-8 text-white relative z-10 drop-shadow" />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-[#222222] font-mono uppercase">
            Vista<span className="text-[#16a34a]">AFK</span>
          </h1>
          <p className="text-xs text-[#555555] mt-1 font-semibold">
            Authentication Required &bull; Enter Access Code
          </p>
        </div>

        {/* Lockout Screen */}
        {lockedUntil ? (
          <div className="mt-6 p-4 bg-[#fecdd3] border-2 border-[#e11d48] rounded-lg text-[#881337] text-center space-y-2">
            <div className="flex items-center justify-center space-x-1.5 font-bold text-xs">
              <AlertOctagon className="h-4 w-4 text-[#e11d48]" />
              <span>LOCKOUT ACTIVE (12 HOURS)</span>
            </div>
            <p className="text-xs font-medium">3 incorrect attempts detected. Access blocked.</p>
            <div className="text-lg font-mono font-black tracking-wider text-[#9f1239]">
              {remainingTimeStr}
            </div>
          </div>
        ) : (
          /* Passcode Input Form */
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#333333] mb-1.5">
                <label htmlFor="passcode">Portal Passcode</label>
                <span className="text-[11px] text-[#666666] font-mono">
                  {attemptsLeft} / {MAX_ATTEMPTS} tries
                </span>
              </div>
              <div className="relative">
                <input
                  id="passcode"
                  type="password"
                  autoFocus
                  required
                  maxLength={10}
                  placeholder="Enter code"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-white border-4 border-t-[#555555] border-l-[#555555] border-b-white border-r-white px-4 py-3 text-center text-xl font-mono font-bold tracking-[0.4em] text-[#111111] focus:outline-none shadow-inner"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-[#fee2e2] border-2 border-[#ef4444] text-[#991b1b] text-xs rounded font-medium flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-[#dc2626]" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Classic Minecraft Button Style */}
            <button
              type="submit"
              className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] border-4 border-t-[#86efac] border-l-[#86efac] border-b-[#14532d] border-r-[#14532d] text-white font-black text-sm uppercase tracking-wider shadow-md transition active:border-t-[#14532d] active:border-l-[#14532d] active:border-b-[#86efac] active:border-r-[#86efac]"
            >
              Enter Portal
            </button>
          </form>
        )}

        <div className="mt-5 pt-3 border-t-2 border-[#aaaaaa] text-center">
          <p className="text-[10px] text-[#555555] font-semibold">
            Passcode Protected &bull; 3 fails = 12-hour lockout
          </p>
        </div>
      </div>
    </div>
  );
};

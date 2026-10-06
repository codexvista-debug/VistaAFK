'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, KeyRound, AlertOctagon, CheckCircle2 } from 'lucide-react';

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
    // Check existing auth session
    const authSession = localStorage.getItem('vistaafk_passcode_auth');
    if (authSession === 'authenticated') {
      setIsAuthenticated(true);
    }

    // Check lockout state
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

  // Update countdown timer while locked out
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
        setErrorMessage(`Incorrect passcode! ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining before 12-hour lockout.`);
      }
      setPasscode('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0d141e] text-slate-100 relative overflow-hidden font-sans">
      {/* Minecraft styled background ambient pattern */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#10b981 1px, transparent 1px), radial-gradient(#065f46 1px, #0d141e 1px)`,
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0, 16px 16px',
        }}
      />

      <div className="relative z-10 w-full max-w-md bg-[#162030] border-2 border-[#223348] rounded-3xl p-8 shadow-2xl backdrop-blur-md">
        {/* Brand Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 border border-emerald-400/40 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-4">
            <Lock className="h-8 w-8 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center space-x-2">
            <span>Vista<span className="text-emerald-400">AFK</span></span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
              Protected
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            Enter authorized access key to enter the command portal
          </p>
        </div>

        {/* Lockout Warning State */}
        {lockedUntil ? (
          <div className="mt-6 p-4 rounded-2xl bg-rose-950/70 border-2 border-rose-800 text-rose-200 text-center space-y-2 animate-in fade-in">
            <div className="flex items-center justify-center space-x-2 text-rose-400 font-bold text-sm">
              <AlertOctagon className="h-5 w-5" />
              <span>Security Lockout Active</span>
            </div>
            <p className="text-xs text-rose-300/90 leading-relaxed">
              Exceeded 3 incorrect attempts. This device is locked out for 12 hours from accessing the dashboard.
            </p>
            <div className="pt-2">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Remaining Lockout Time</span>
              <div className="text-xl font-mono font-bold text-white tracking-wider mt-0.5">
                {remainingTimeStr}
              </div>
            </div>
          </div>
        ) : (
          /* Passcode Input Form */
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                <label htmlFor="passcode">Portal Passcode</label>
                <span className={`text-[11px] ${attemptsLeft <= 1 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                  {attemptsLeft} / {MAX_ATTEMPTS} attempts
                </span>
              </div>
              <div className="relative">
                <input
                  id="passcode"
                  type="password"
                  autoFocus
                  required
                  maxLength={10}
                  placeholder="Enter 4-digit code"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-[#0b111a] border-2 border-[#2b3d54] focus:border-emerald-500 rounded-2xl px-4 py-3.5 text-center text-lg font-mono tracking-[0.5em] text-white placeholder-slate-600 focus:outline-none transition shadow-inner"
                />
                <KeyRound className="h-5 w-5 text-slate-500 absolute left-4 top-4 pointer-events-none" />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-700/30 transition transform active:scale-[0.98]"
            >
              Authenticate & Enter
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Protected with brute-force prevention: 3 failed attempts = 12-hour lockout
          </p>
        </div>
      </div>
    </div>
  );
};

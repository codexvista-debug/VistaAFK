'use client';

import React, { useState } from 'react';
import { X, Lock, User, Shield, CheckCircle2, AlertCircle, ArrowRight, Smartphone, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/VistaAuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const cleanUsername = username.trim();
  const isUsernameValid = cleanUsername.length >= 4 && /^[a-zA-Z0-9_-]+$/.test(cleanUsername);
  const isPasswordValid = password.length >= 4;
  const canSubmit = isUsernameValid && isPasswordValid && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isUsernameValid) {
      setError('Username must be at least 4 characters long (letters, numbers, hyphens, underscores).');
      return;
    }
    if (!isPasswordValid) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = mode === 'login'
        ? await login(cleanUsername, password)
        : await register(cleanUsername, password);

      if (!res.success) {
        setError(res.error || 'Authentication failed');
      } else {
        setUsername('');
        setPassword('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">VistaAFK Cloud Hub</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Universal Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Access your phone's bot daemon from any PC or device</p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1.5 mx-6 mt-5 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-xl transition ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 rounded-xl transition ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info Banner */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start space-x-2.5 text-xs text-slate-700">
            <Smartphone className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              {mode === 'login'
                ? 'Signing in connects this browser directly to your mobile Termux bot daemon and synchronizes your accounts.'
                : 'Create a username & password to link your mobile Termux daemon and access it seamlessly from your PC.'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center space-x-2 text-xs text-rose-800 animate-in fade-in duration-150">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">Username</label>
              <span className="text-[10px] text-slate-500 font-medium">Min. 4 characters</span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. sayan, kjchris"
                className={`w-full pl-10 pr-9 py-2.5 bg-slate-50 border-2 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition ${
                  username.length > 0 && isUsernameValid
                    ? 'border-emerald-500 focus:border-emerald-600'
                    : username.length > 0
                    ? 'border-rose-300 focus:border-rose-500'
                    : 'border-slate-200 focus:border-emerald-600'
                }`}
              />
              <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              {username.length > 0 && isUsernameValid && (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 absolute right-3 top-3" />
              )}
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">Password</label>
              <span className="text-[10px] text-slate-500 font-medium">Min. 4 characters</span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 4 characters"
                className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border-2 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition ${
                  password.length > 0 && isPasswordValid
                    ? 'border-emerald-500 focus:border-emerald-600'
                    : password.length > 0
                    ? 'border-rose-300 focus:border-rose-500'
                    : 'border-slate-200 focus:border-emerald-600'
                }`}
              />
              <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-3 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 ${
              canSubmit
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-[0.99]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {loading ? (
              <span className="animate-pulse">Authenticating...</span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In & Connect' : 'Create Account & Link'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

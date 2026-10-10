'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SavedAccount, ServerPreset, BotConfig } from '../types';

export interface UserProfile {
  id: string;
  username: string;
  daemonUrl?: string;
  daemonDeviceType?: 'pc' | 'mobile';
  daemonDeviceLabel?: string;
  secretToken?: string;
  lastHeartbeat?: number;
  savedAccounts?: SavedAccount[];
  serverPresets?: ServerPreset[];
  botConfigs?: BotConfig[];
}

interface VistaAuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  syncToCloud: (data: {
    savedAccounts?: SavedAccount[];
    serverPresets?: ServerPreset[];
    botConfigs?: BotConfig[];
    daemonUrl?: string;
    secretToken?: string;
  }) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const VistaAuthContext = createContext<VistaAuthContextType | null>(null);

export const VistaAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Load saved session on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('vistaafk_auth_token');
      const savedUserRaw = localStorage.getItem('vistaafk_auth_user');

      if (savedToken && savedUserRaw) {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUserRaw));
        } catch (e) {}
      }
      setIsLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('vistaafk_auth_token') : null);
    if (!activeToken) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser((prev) => {
            if (!prev) return data.user;
            // Never wipe out an active Cloudflare tunnel URL if server returned null/undefined
            if (!data.user.daemonUrl && prev.daemonUrl && !prev.daemonUrl.includes('localhost')) {
              data.user.daemonUrl = prev.daemonUrl;
            }
            if (!data.user.secretToken && prev.secretToken) {
              data.user.secretToken = prev.secretToken;
            }

            const accountsUnchanged = JSON.stringify(prev.savedAccounts || []) === JSON.stringify(data.user.savedAccounts || []);
            const presetsUnchanged = JSON.stringify(prev.serverPresets || []) === JSON.stringify(data.user.serverPresets || []);
            const configsUnchanged = JSON.stringify(prev.botConfigs || []) === JSON.stringify(data.user.botConfigs || []);

            const isUnchanged =
              prev.id === data.user.id &&
              prev.username === data.user.username &&
              prev.daemonUrl === data.user.daemonUrl &&
              prev.secretToken === data.user.secretToken &&
              accountsUnchanged &&
              presetsUnchanged &&
              configsUnchanged;

            if (isUnchanged) {
              return prev; // Same reference, 0 re-renders
            }
            if (typeof window !== 'undefined') {
              localStorage.setItem('vistaafk_auth_user', JSON.stringify(data.user));
              const uLower = data.user.username.toLowerCase();
              if (data.user.daemonUrl) {
                localStorage.setItem(`vistaafk_${uLower}_daemon_url`, data.user.daemonUrl);
              }
              if (Array.isArray(data.user.savedAccounts)) {
                localStorage.setItem(`vistaafk_${uLower}_saved_accounts`, JSON.stringify(data.user.savedAccounts));
              }
            }
            return data.user;
          });
        }
      } else if (res.status === 401) {
        // Token expired
        logout();
      }
    } catch (e) {}
  }, [token]);

  // Periodic profile refresh to catch updated daemon links from Termux
  useEffect(() => {
    if (!token) return;
    refreshProfile();
    const interval = setInterval(() => {
      refreshProfile();
    }, 20000);
    return () => clearInterval(interval);
  }, [token, refreshProfile]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setToken(data.token);
      setUser(data.user);

      if (typeof window !== 'undefined') {
        localStorage.setItem('vistaafk_auth_token', data.token);
        localStorage.setItem('vistaafk_auth_user', JSON.stringify(data.user));
        if (data.user.daemonUrl) {
          const uKey = `vistaafk_${data.user.username.toLowerCase()}_daemon_url`;
          localStorage.setItem(uKey, data.user.daemonUrl);
        }
        if (data.user.secretToken) {
          localStorage.setItem('vistaafk_secret_token', data.user.secretToken);
        }
      }

      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during login' };
    }
  };

  const register = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      setToken(data.token);
      setUser(data.user);

      if (typeof window !== 'undefined') {
        localStorage.setItem('vistaafk_auth_token', data.token);
        localStorage.setItem('vistaafk_auth_user', JSON.stringify(data.user));
      }

      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during registration' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vistaafk_auth_token');
      localStorage.removeItem('vistaafk_auth_user');
      localStorage.removeItem('vistaafk_last_known_daemon_url');
    }
  };

  const syncToCloud = async (data: {
    savedAccounts?: SavedAccount[];
    serverPresets?: ServerPreset[];
    botConfigs?: BotConfig[];
    daemonUrl?: string;
    secretToken?: string;
  }) => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('vistaafk_auth_token') : null);
    if (!activeToken) return;

    try {
      const res = await fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.user) {
          setUser(result.user);
          if (typeof window !== 'undefined') {
            localStorage.setItem('vistaafk_auth_user', JSON.stringify(result.user));
          }
        }
      }
    } catch (e) {}
  };

  return (
    <VistaAuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        login,
        register,
        logout,
        syncToCloud,
        refreshProfile,
      }}
    >
      {children}
    </VistaAuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(VistaAuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a VistaAuthProvider');
  }
  return context;
};

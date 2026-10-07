'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../context/VistaAuthContext';
import { useVistaWebSocket } from '../../hooks/useVistaWebSocket';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  KeyRound,
  Trash2,
  Search,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Server,
} from 'lucide-react';

interface UserSummary {
  id: string;
  username: string;
  createdAt: number;
  updatedAt: number;
  savedAccountsCount: number;
  serverPresetsCount: number;
  botConfigsCount: number;
  hasDaemon: boolean;
  role: 'admin' | 'user';
}

export default function ControlPanelPage() {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const {
    configs,
    telemetry,
    isConnected,
    isConnecting,
    savedAccounts,
  } = useVistaWebSocket();

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reset password modal state
  const [resetModalUser, setResetModalUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Delete confirm state
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const isVista = user?.username?.toLowerCase() === 'vista';

  const getActiveToken = useCallback(() => {
    return token || (typeof window !== 'undefined' ? localStorage.getItem('vistaafk_auth_token') : null);
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!isVista) return;
    setIsLoadingData(true);
    setFeedback(null);
    const activeToken = getActiveToken();

    try {
      // 1. Fetch Users
      const usersRes = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users || []);
      }

      // 2. Fetch Settings
      const settingsRes = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setRegistrationEnabled(sData.settings?.registrationEnabled ?? true);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load control panel data' });
    } finally {
      setIsLoadingData(false);
    }
  }, [isVista, getActiveToken]);

  useEffect(() => {
    if (!isAuthLoading && isVista) {
      fetchData();
    }
  }, [isAuthLoading, isVista, fetchData]);

  const handleToggleRegistration = async () => {
    const activeToken = getActiveToken();
    const nextState = !registrationEnabled;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ registrationEnabled: nextState }),
      });
      const data = await res.json();
      if (res.ok) {
        setRegistrationEnabled(nextState);
        setFeedback({
          type: 'success',
          message: nextState
            ? 'Account registration is now OPEN. New users may register.'
            : 'Account registration is now PAUSED. Public registration is locked.',
        });
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to update registration status' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Request failed' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPassword) return;
    setIsResetting(true);
    const activeToken = getActiveToken();

    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ username: resetModalUser, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: `Password for ${resetModalUser} was updated successfully!` });
        setResetModalUser(null);
        setNewPassword('');
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to reset password' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Request failed' });
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteUser = async (targetUsername: string) => {
    if (targetUsername.toLowerCase() === 'vista') {
      setFeedback({ type: 'error', message: 'You cannot delete the primary administrator account (vista).' });
      return;
    }
    setIsDeleting(true);
    const activeToken = getActiveToken();

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ username: targetUsername }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: `Account "${targetUsername}" has been deleted.` });
        setDeleteConfirmUser(null);
        setUsers((prev) => prev.filter((u) => u.username !== targetUsername));
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to delete account' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Request failed' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Auth Loading
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-emerald-600">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="font-bold text-sm">Authenticating session...</span>
        </div>
      </div>
    );
  }

  // Access Denied for Non-Vista
  if (!user || !isVista) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border-2 border-rose-200 rounded-3xl p-6 text-center shadow-lg space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 mx-auto flex items-center justify-center text-rose-600">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Access Denied</h1>
            <p className="text-xs text-slate-500 mt-1">
              The Control Panel is restricted to master administrator account <span className="font-bold text-amber-600">vista</span>.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800">
      <Navbar
        isConnected={isConnected}
        isConnecting={isConnecting}
        onOpenAddModal={() => {}}
        onOpenSettingsModal={() => {}}
        botCount={configs.length}
        onlineCount={Object.values(telemetry).filter((t) => t.status === 'online').length}
        savedAccountCount={savedAccounts.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Gateway</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mt-1">
              Control Panel
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Logged in as <span className="text-emerald-700 font-bold">vista</span> • Manage user registrations, account credentials, and system access.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchData}
              disabled={isLoadingData}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold rounded-xl transition shadow-sm text-xs"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
            <Link
              href="/"
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold rounded-xl transition shadow-sm text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Fleet</span>
            </Link>
          </div>
        </div>

        {/* Live Feedback Banner */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold transition shadow-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-700 text-xs ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 flex items-center space-x-3.5 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Accounts
              </span>
              <span className="text-2xl font-black text-slate-900">{users.length}</span>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 flex items-center space-x-3.5 shadow-sm">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                registrationEnabled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              {registrationEnabled ? <Unlock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Registration Gate
              </span>
              <span
                className={`text-sm font-black uppercase ${
                  registrationEnabled ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {registrationEnabled ? 'Open (Public)' : 'Paused (Locked)'}
              </span>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 flex items-center space-x-3.5 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Master Security
              </span>
              <span className="text-sm font-black text-slate-900 font-mono">HMAC SHA-256</span>
            </div>
          </div>
        </div>

        {/* Registration Gate Toggle Card */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-extrabold text-slate-900">Public Account Registration</h2>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                    registrationEnabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {registrationEnabled ? 'Active' : 'Stopped'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {registrationEnabled
                  ? 'Anyone can register an account from the login modal. Turn off to lock public registrations.'
                  : 'New registrations are rejected. Only existing accounts can sign in.'}
              </p>
            </div>

            <button
              onClick={handleToggleRegistration}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm flex items-center space-x-2 shrink-0 ${
                registrationEnabled
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {registrationEnabled ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              <span>{registrationEnabled ? 'Stop New Registrations' : 'Allow Registrations'}</span>
            </button>
          </div>
        </div>

        {/* Users Table Card */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Registered Accounts Directory</h2>
              <p className="text-xs text-slate-500">Manage user credentials or remove accounts</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition shadow-2xs"
              />
            </div>
          </div>

          {isLoadingData ? (
            <div className="py-12 flex items-center justify-center text-slate-500 space-x-2 text-xs">
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
              <span>Loading user directory...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No registered user accounts match your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 font-bold">User</th>
                    <th className="py-3 px-4 font-bold">Role</th>
                    <th className="py-3 px-4 font-bold">Saved MC Accounts</th>
                    <th className="py-3 px-4 font-bold">Presets</th>
                    <th className="py-3 px-4 font-bold">Created</th>
                    <th className="py-3 px-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((item) => {
                    const isItemVista = item.username.toLowerCase() === 'vista';
                    return (
                      <tr key={item.id || item.username} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] uppercase font-mono font-bold shadow-2xs">
                            {item.username.charAt(0)}
                          </div>
                          <span>{item.username}</span>
                        </td>
                        <td className="py-3 px-4">
                          {isItemVista ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                              Master Admin
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
                              User
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-mono">
                          {item.savedAccountsCount}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-mono">
                          {item.serverPresetsCount}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => {
                                setResetModalUser(item.username);
                                setNewPassword('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-bold transition flex items-center space-x-1 shadow-2xs"
                              title="Reset Password"
                            >
                              <KeyRound className="h-3 w-3 text-amber-600" />
                              <span>Reset Password</span>
                            </button>

                            {!isItemVista && (
                              <button
                                onClick={() => setDeleteConfirmUser(item.username)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold transition flex items-center space-x-1 shadow-2xs"
                                title="Delete User"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Reset Password Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border-2 border-slate-200 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-amber-600">
                <KeyRound className="h-5 w-5" />
                <h3 className="font-extrabold text-base text-slate-900">Reset Password</h3>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Set a new password for account <span className="font-bold text-emerald-700">{resetModalUser}</span>:
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting || newPassword.length < 6}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-xs font-bold text-white transition flex items-center space-x-1 shadow-sm"
                >
                  {isResetting && <RefreshCw className="h-3 w-3 animate-spin" />}
                  <span>Save Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border-2 border-rose-200 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-rose-600 pb-2 border-b border-slate-100">
              <Trash2 className="h-5 w-5" />
              <h3 className="font-extrabold text-base text-slate-900">Delete User Account</h3>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete account{' '}
              <span className="font-bold text-rose-600">{deleteConfirmUser}</span>? This will wipe their saved Minecraft accounts, server presets, and configurations.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteUser(deleteConfirmUser)}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-xs font-bold text-white transition flex items-center space-x-1 shadow-sm"
              >
                {isDeleting && <RefreshCw className="h-3 w-3 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

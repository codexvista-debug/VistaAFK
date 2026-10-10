'use client';

import React, { useState, useEffect } from 'react';
import { X, Bot, Server, Zap, Heart, Bell, Terminal, ShieldCheck, Swords } from 'lucide-react';
import { BotConfig } from '../types';

interface AddBotModalProps {
  onClose: () => void;
  onSave: (config: BotConfig) => void;
  initialConfig?: BotConfig | null;
}

export const AddBotModal: React.FC<AddBotModalProps> = ({ onClose, onSave, initialConfig }) => {
  const [formData, setFormData] = useState<BotConfig>({
    id: initialConfig?.id || Math.random().toString(36).substring(2, 9),
    name: initialConfig?.name || '',
    authType: initialConfig?.authType || 'microsoft',
    edition: initialConfig?.edition || (initialConfig?.port === 19132 ? 'bedrock' : 'java'),
    host: initialConfig?.host || 'localhost',
    port: initialConfig?.port || 25565,
    version: initialConfig?.version || '',
    proxyUrl: initialConfig?.proxyUrl || '',
    autoReconnect: initialConfig?.autoReconnect ?? true,
    reconnectDelayMs: initialConfig?.reconnectDelayMs || 5000,
    antiAfk: {
      enabled: initialConfig?.antiAfk?.enabled ?? true,
      rotateHead: initialConfig?.antiAfk?.rotateHead ?? true,
      jump: initialConfig?.antiAfk?.jump ?? true,
      sneak: initialConfig?.antiAfk?.sneak ?? true,
      swingArm: initialConfig?.antiAfk?.swingArm ?? true,
      intervalSeconds: initialConfig?.antiAfk?.intervalSeconds || 10,
    },
    survival: {
      autoEat: initialConfig?.survival?.autoEat ?? true,
      eatThreshold: initialConfig?.survival?.eatThreshold || 14,
      autoTotem: initialConfig?.survival?.autoTotem ?? true,
      onSpawnCommand: initialConfig?.survival?.onSpawnCommand || '',
      onSpawnDelaySeconds: initialConfig?.survival?.onSpawnDelaySeconds || 2,
      recurringCommand: initialConfig?.survival?.recurringCommand || '',
      recurringIntervalSeconds: initialConfig?.survival?.recurringIntervalSeconds || undefined,
    },
    farming: {
      enabled: initialConfig?.farming?.enabled ?? false,
      autoEquipSword: initialConfig?.farming?.autoEquipSword ?? true,
      swingIntervalMs: initialConfig?.farming?.swingIntervalMs || 900,
      targetMode: initialConfig?.farming?.targetMode || 'continuous',
    },
    discordWebhookUrl: initialConfig?.discordWebhookUrl || '',
  });

  const [activeTab, setActiveTab] = useState<'connection' | 'antiAfk' | 'survival' | 'farming' | 'alerts'>('connection');
  const [testWebhookStatus, setTestWebhookStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleTestWebhook = async () => {
    if (!formData.discordWebhookUrl?.trim()) return;
    setTestWebhookStatus('testing');
    try {
      await fetch(formData.discordWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'VistaAFK Monitor',
          avatar_url: `https://mc-heads.net/avatar/${formData.name || 'steve'}/128`,
          content: `🔔 **[Test Alert]** VistaAFK Discord Webhook is configured correctly for **${formData.name || 'Account'}**!`,
        }),
      });
      setTestWebhookStatus('success');
      setTimeout(() => setTestWebhookStatus('idle'), 3000);
    } catch (e: any) {
      setTestWebhookStatus('error');
      setTimeout(() => setTestWebhookStatus('idle'), 3000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.host.trim()) return;
    onSave(formData);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-900/65 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b-2 border-slate-200 flex items-center justify-between bg-slate-100/90 gap-2">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-100 border-2 border-emerald-300 text-emerald-800 shrink-0">
              <Bot className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight truncate">
                {initialConfig ? 'Edit Bot Account' : 'Add Minecraft AFK Account'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Configure connection & survival routines</p>
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

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 space-x-3 sm:space-x-4 text-xs font-semibold overflow-x-auto scrollbar-none shrink-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          <button
            type="button"
            onClick={() => setActiveTab('connection')}
            className={`py-3 flex items-center space-x-1.5 border-b-2 transition shrink-0 whitespace-nowrap ${
              activeTab === 'connection' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="h-3.5 w-3.5 shrink-0" />
            <span>Connection</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('antiAfk')}
            className={`py-3 flex items-center space-x-1.5 border-b-2 transition shrink-0 whitespace-nowrap ${
              activeTab === 'antiAfk' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>Anti-AFK</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('survival')}
            className={`py-3 flex items-center space-x-1.5 border-b-2 transition shrink-0 whitespace-nowrap ${
              activeTab === 'survival' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Heart className="h-3.5 w-3.5 shrink-0" />
            <span>Survival</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('farming')}
            className={`py-3 flex items-center space-x-1.5 border-b-2 transition shrink-0 whitespace-nowrap ${
              activeTab === 'farming' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Swords className="h-3.5 w-3.5 shrink-0" />
            <span>Farming</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`py-3 flex items-center space-x-1.5 border-b-2 transition shrink-0 whitespace-nowrap ${
              activeTab === 'alerts' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell className="h-3.5 w-3.5 shrink-0" />
            <span>Alerts</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[460px] overflow-y-auto">
          {/* Connection Tab */}
          {activeTab === 'connection' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Minecraft Gamertag / Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AFK_ChunkLoader_01"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Minecraft Edition</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, edition: 'java', port: formData.port === 19132 ? 25565 : formData.port })}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                      formData.edition !== 'bedrock'
                        ? 'bg-emerald-50/70 border-emerald-500 text-emerald-900 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900">☕ Java Edition</span>
                    <span className="text-[10px] text-slate-500 mt-1">Standard PC / Mac server protocol (Port 25565).</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, edition: 'bedrock', port: formData.port === 25565 ? 19132 : formData.port })}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                      formData.edition === 'bedrock'
                        ? 'bg-sky-50/70 border-sky-500 text-sky-900 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900">🧱 Bedrock Edition</span>
                    <span className="text-[10px] text-slate-500 mt-1">Mobile / Console / Geyser RakNet (Port 19132).</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Authentication Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, authType: 'microsoft' })}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                      formData.authType === 'microsoft'
                        ? 'bg-emerald-50/70 border-emerald-500 text-emerald-900 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900">Microsoft OAuth (Safe)</span>
                    <span className="text-[10px] text-slate-500 mt-1">Official Device Code. No passwords stored.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, authType: 'offline' })}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                      formData.authType === 'offline'
                        ? 'bg-emerald-50/70 border-emerald-500 text-emerald-900 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900">Offline / Cracked</span>
                    <span className="text-[10px] text-slate-500 mt-1">For test servers or offline-mode networks.</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Server Host / IP</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. donutsmp.net or play.freshsmp.fun"
                    value={formData.host}
                    onChange={(e) => {
                      const newHost = e.target.value;
                      const isDonut = newHost.toLowerCase().includes('donut');
                      if (isDonut && !initialConfig) {
                        setFormData((prev) => ({
                          ...prev,
                          host: newHost,
                          antiAfk: { ...prev.antiAfk, enabled: false, rotateHead: false, sneak: false, swingArm: false },
                          survival: { ...prev.survival, autoEat: false, autoTotem: false },
                        }));
                      } else {
                        setFormData((prev) => ({ ...prev, host: newHost }));
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) || 25565 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* DonutSMP Safety Banner */}
              {formData.host.toLowerCase().includes('donut') && (
                <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex flex-col space-y-2 text-xs text-emerald-950">
                  <div className="flex items-start space-x-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-900 block">DonutSMP Strict Anti-Cheat Detected</span>
                      <span className="text-[11px] text-emerald-800 leading-tight block mt-0.5">
                        DonutSMP enforces strict anti-cheat for any bot movements or automated actions. We strongly recommend keeping Anti-AFK, auto-eating, and auto-totem <strong>OFF</strong>.
                      </span>
                    </div>
                  </div>
                  {(formData.antiAfk.enabled || formData.survival.autoEat || formData.survival.autoTotem) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          antiAfk: { ...prev.antiAfk, enabled: false, rotateHead: false, sneak: false, swingArm: false },
                          survival: { ...prev.survival, autoEat: false, autoTotem: false },
                        }));
                      }}
                      className="self-start px-3 py-1.5 bg-emerald-700 text-white font-bold text-[11px] rounded-xl hover:bg-emerald-800 transition shadow-xs"
                    >
                      Turn Off All Auto-Actions Now (Safe Mode)
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Version Override <span className="text-slate-400 font-normal">(optional, e.g. 1.20.4)</span>
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for auto-detect"
                  value={formData.version || ''}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  SOCKS5 / HTTP Proxy <span className="text-slate-400 font-normal">(for 10+ accounts)</span>
                </label>
                <input
                  type="text"
                  placeholder="socks5://user:password@ip:port"
                  value={formData.proxyUrl || ''}
                  onChange={(e) => setFormData({ ...formData, proxyUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-xs font-semibold text-slate-800">Auto-Reconnect</span>
                  <p className="text-[11px] text-slate-500">Automatically reconnect if kicked or server restarts</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoReconnect}
                  onChange={(e) => setFormData({ ...formData, autoReconnect: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Anti-AFK Tab */}
          {activeTab === 'antiAfk' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-800">Enable Anti-AFK Routine</span>
                  <p className="text-[11px] text-slate-500">Randomized actions to bypass AFK kick plugins</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.antiAfk.enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      antiAfk: { ...formData.antiAfk, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between text-xs text-slate-700">
                  <span>Natural Head Rotation (Pitch/Yaw)</span>
                  <input
                    type="checkbox"
                    checked={formData.antiAfk.rotateHead}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        antiAfk: { ...formData.antiAfk, rotateHead: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-700">
                  <span>Micro-Sneak</span>
                  <input
                    type="checkbox"
                    checked={formData.antiAfk.sneak}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        antiAfk: { ...formData.antiAfk, sneak: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-700">
                  <span>Jump In Place</span>
                  <input
                    type="checkbox"
                    checked={formData.antiAfk.jump}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        antiAfk: { ...formData.antiAfk, jump: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-700">
                  <span>Hand Swing</span>
                  <input
                    type="checkbox"
                    checked={formData.antiAfk.swingArm}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        antiAfk: { ...formData.antiAfk, swingArm: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                  />
                </label>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Action Interval: {formData.antiAfk.intervalSeconds} seconds
                </label>
                <input
                  type="range"
                  min="3"
                  max="60"
                  step="1"
                  value={formData.antiAfk.intervalSeconds}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      antiAfk: { ...formData.antiAfk, intervalSeconds: parseInt(e.target.value, 10) },
                    })
                  }
                  className="w-full accent-emerald-600"
                />
              </div>
            </div>
          )}

          {/* Survival Tab */}
          {activeTab === 'survival' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-800">Auto-Eat Food</span>
                  <p className="text-[11px] text-slate-500">Consumes food from inventory when hunger drops</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.survival.autoEat}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      survival: { ...formData.survival, autoEat: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Eat Threshold: {formData.survival.eatThreshold} / 20 Food
                </label>
                <input
                  type="range"
                  min="6"
                  max="19"
                  step="1"
                  value={formData.survival.eatThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      survival: { ...formData.survival, eatThreshold: parseInt(e.target.value, 10) },
                    })
                  }
                  className="w-full accent-emerald-600"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-800">Auto-Equip Totem of Undying</span>
                  <p className="text-[11px] text-slate-500">Keeps totem equipped in off-hand from inventory</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.survival.autoTotem}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      survival: { ...formData.survival, autoTotem: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                />
              </div>

              {/* Auto Commands Section */}
              <div className="pt-4 border-t-2 border-slate-200 space-y-4">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                  <Terminal className="h-4 w-4 text-emerald-600" />
                  <span>Auto Commands (SMP Subserver Navigation & AFK Maintenance)</span>
                </div>

                {/* On-Spawn Command */}
                <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      On-Spawn Command <span className="font-normal text-slate-500">(e.g. /lifesteal)</span>
                    </label>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                      Runs on join
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="e.g. /lifesteal or /server lifesteal"
                        value={formData.survival.onSpawnCommand || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            survival: { ...formData.survival, onSpawnCommand: e.target.value },
                          })
                        }
                        className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        placeholder="Delay (s)"
                        value={formData.survival.onSpawnDelaySeconds || 2}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            survival: {
                              ...formData.survival,
                              onSpawnDelaySeconds: parseInt(e.target.value, 10) || 2,
                            },
                          })
                        }
                        className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                        title="Delay in seconds before running command on join"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Automatically typed into chat after entering the server lobby to enter the subserver.
                  </p>
                </div>

                {/* Recurring Command */}
                <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      Recurring Command <span className="font-normal text-slate-500">(Optional)</span>
                    </label>
                    <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 font-bold">
                      Repeats periodically
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="e.g. /lifesteal or /afk"
                        value={formData.survival.recurringCommand || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            survival: { ...formData.survival, recurringCommand: e.target.value },
                          })
                        }
                        className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="10"
                        max="3600"
                        placeholder="Every (s)"
                        value={formData.survival.recurringIntervalSeconds || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            survival: {
                              ...formData.survival,
                              recurringIntervalSeconds: parseInt(e.target.value, 10) || undefined,
                            },
                          })
                        }
                        className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                        title="Repeat interval in seconds (e.g. 180 = every 3 mins)"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Repeats this command every X seconds (e.g. 180s for 3 minutes) while chunk-loading.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Farming Tab */}
          {activeTab === 'farming' && (
            <div className="space-y-4">
              {/* Enable Mob Farming */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Swords className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Mob Farming & Auto-Swing</h4>
                      <p className="text-[11px] text-slate-500">
                        Automatically swings weapon to kill Endermen, Zombies, or XP farm mobs
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.farming?.enabled ?? false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        farming: {
                          enabled: e.target.checked,
                          autoEquipSword: formData.farming?.autoEquipSword ?? true,
                          swingIntervalMs: formData.farming?.swingIntervalMs || 900,
                          targetMode: formData.farming?.targetMode || 'continuous',
                        },
                      })
                    }
                    className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Auto Pick & Equip Sword */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Auto-Pick Sword from Any Inventory Slot</h4>
                    <p className="text-[11px] text-slate-500">
                      Searches any slot (main storage or hotbar) for Netherite, Diamond, or Iron swords and equips to main hand. Automatically replaces broken swords.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.farming?.autoEquipSword ?? true}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        farming: {
                          enabled: formData.farming?.enabled ?? false,
                          autoEquipSword: e.target.checked,
                          swingIntervalMs: formData.farming?.swingIntervalMs || 900,
                          targetMode: formData.farming?.targetMode || 'continuous',
                        },
                      })
                    }
                    className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Attack Speed / Swing Interval */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Swing Interval / Cooldown</h4>
                    <p className="text-[11px] text-slate-500">
                      Cooldown between swings (allows Minecraft sword sweep attack meter to charge for group kills)
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {((formData.farming?.swingIntervalMs || 900) / 1000).toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min="400"
                  max="2000"
                  step="100"
                  value={formData.farming?.swingIntervalMs || 900}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      farming: {
                        enabled: formData.farming?.enabled ?? false,
                        autoEquipSword: formData.farming?.autoEquipSword ?? true,
                        swingIntervalMs: Number(e.target.value),
                        targetMode: formData.farming?.targetMode || 'continuous',
                      },
                    })
                  }
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>Fast (0.4s)</span>
                  <span>Optimal Sweep (0.9s)</span>
                  <span>Slow (2.0s)</span>
                </div>
              </div>

              {/* Target Mode */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800">Grinder Attack Mode</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        farming: {
                          enabled: formData.farming?.enabled ?? false,
                          autoEquipSword: formData.farming?.autoEquipSword ?? true,
                          swingIntervalMs: formData.farming?.swingIntervalMs || 900,
                          targetMode: 'continuous',
                        },
                      })
                    }
                    className={`p-2.5 rounded-xl border text-left text-xs transition ${
                      formData.farming?.targetMode !== 'entity'
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>Continuous Swing</span>
                      {formData.farming?.targetMode !== 'entity' && (
                        <span className="text-[10px] text-emerald-600">✓</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Swings constantly into drop chute (Ideal for 1-hit Enderman farms & XP drop grinders)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        farming: {
                          enabled: formData.farming?.enabled ?? false,
                          autoEquipSword: formData.farming?.autoEquipSword ?? true,
                          swingIntervalMs: formData.farming?.swingIntervalMs || 900,
                          targetMode: 'entity',
                        },
                      })
                    }
                    className={`p-2.5 rounded-xl border text-left text-xs transition ${
                      formData.farming?.targetMode === 'entity'
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>Target Nearby Mobs</span>
                      {formData.farming?.targetMode === 'entity' && (
                        <span className="text-[10px] text-emerald-600">✓</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Only attacks when hostile mobs are within striking distance (3.5 blocks)
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Discord Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={formData.discordWebhookUrl || ''}
                  onChange={(e) => setFormData({ ...formData, discordWebhookUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Receives instant Discord alerts when this bot joins, types commands, dies, gets kicked, or disconnects (with session uptime).
                </p>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={!formData.discordWebhookUrl?.trim() || testWebhookStatus === 'testing'}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition border flex items-center space-x-1.5 shadow-2xs ${
                      testWebhookStatus === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : testWebhookStatus === 'error'
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 disabled:opacity-40'
                    }`}
                  >
                    <span>
                      {testWebhookStatus === 'testing'
                        ? 'Sending Test Alert...'
                        : testWebhookStatus === 'success'
                        ? '✓ Test Alert Sent to Discord!'
                        : testWebhookStatus === 'error'
                        ? '❌ Webhook Failed (Check URL)'
                        : '🔔 Send Test Alert to Discord'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition"
            >
              {initialConfig ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

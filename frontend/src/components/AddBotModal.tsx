'use client';

import React, { useState, useEffect } from 'react';
import { X, Bot, Shield, Server, Zap, Heart, Bell, Globe } from 'lucide-react';
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
    },
    discordWebhookUrl: initialConfig?.discordWebhookUrl || '',
  });

  const [activeTab, setActiveTab] = useState<'connection' | 'antiAfk' | 'survival' | 'alerts'>('connection');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.host.trim()) return;
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0e1626] border border-gray-800 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {initialConfig ? 'Edit Bot Account' : 'Add Minecraft AFK Account'}
              </h2>
              <p className="text-xs text-gray-400">Configure connection and autonomous survival routines</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 bg-gray-900/30 px-6 space-x-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('connection')}
            className={`py-3 flex items-center space-x-1.5 border-b-2 transition ${
              activeTab === 'connection' ? 'border-emerald-500 text-emerald-400 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>Connection</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('antiAfk')}
            className={`py-3 flex items-center space-x-1.5 border-b-2 transition ${
              activeTab === 'antiAfk' ? 'border-emerald-500 text-emerald-400 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Anti-AFK</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('survival')}
            className={`py-3 flex items-center space-x-1.5 border-b-2 transition ${
              activeTab === 'survival' ? 'border-emerald-500 text-emerald-400 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Heart className="h-3.5 w-3.5" />
            <span>Survival</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`py-3 flex items-center space-x-1.5 border-b-2 transition ${
              activeTab === 'alerts' ? 'border-emerald-500 text-emerald-400 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Alerts</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[460px] overflow-y-auto">
          {/* Connection Tab */}
          {activeTab === 'connection' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Minecraft Gamertag / Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AFK_ChunkLoader_01"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Authentication Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, authType: 'microsoft' })}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                      formData.authType === 'microsoft'
                        ? 'bg-emerald-950/40 border-emerald-600 text-emerald-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <span className="font-semibold text-xs text-white">Microsoft OAuth (Safe)</span>
                    <span className="text-[10px] text-gray-400 mt-1">Official Device Code. No passwords stored.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, authType: 'offline' })}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                      formData.authType === 'offline'
                        ? 'bg-emerald-950/40 border-emerald-600 text-emerald-300'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <span className="font-semibold text-xs text-white">Offline / Cracked</span>
                    <span className="text-[10px] text-gray-400 mt-1">For test servers or offline-mode networks.</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">Server Host / IP</label>
                  <input
                    type="text"
                    required
                    placeholder="play.myserver.com"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) || 25565 })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Version Override <span className="text-gray-500 font-normal">(optional, e.g. 1.20.4)</span>
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for auto-detect"
                  value={formData.version || ''}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  SOCKS5 / HTTP Proxy <span className="text-gray-500 font-normal">(recommended for 10+ accounts)</span>
                </label>
                <input
                  type="text"
                  placeholder="socks5://user:password@ip:port"
                  value={formData.proxyUrl || ''}
                  onChange={(e) => setFormData({ ...formData, proxyUrl: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-xs font-semibold text-gray-200">Auto-Reconnect</span>
                  <p className="text-[11px] text-gray-400">Automatically reconnect if kicked or server restarts</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoReconnect}
                  onChange={(e) => setFormData({ ...formData, autoReconnect: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-700 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Anti-AFK Tab */}
          {activeTab === 'antiAfk' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <div>
                  <span className="text-xs font-semibold text-gray-200">Enable Anti-AFK Routine</span>
                  <p className="text-[11px] text-gray-400">Randomized actions to bypass AFK kick plugins</p>
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
                  className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-700"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between text-xs text-gray-300">
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
                    className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-700"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-gray-300">
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
                    className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-700"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-gray-300">
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
                    className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-700"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-gray-300">
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
                    className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-700"
                  />
                </label>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
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
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Survival Tab */}
          {activeTab === 'survival' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <div>
                  <span className="text-xs font-semibold text-gray-200">Auto-Eat Food</span>
                  <p className="text-[11px] text-gray-400">Consumes food from inventory when hunger drops</p>
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
                  className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
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
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                <div>
                  <span className="text-xs font-semibold text-gray-200">Auto-Equip Totem of Undying</span>
                  <p className="text-[11px] text-gray-400">Keeps totem equipped in off-hand from inventory</p>
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
                  className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-700"
                />
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Discord Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={formData.discordWebhookUrl || ''}
                  onChange={(e) => setFormData({ ...formData, discordWebhookUrl: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Receives instant Discord pings if this bot dies, gets kicked, or receives whispers from staff/players.
                </p>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-4 border-t border-gray-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-700/20 transition"
            >
              {initialConfig ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

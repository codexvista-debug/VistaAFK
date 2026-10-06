'use client';

import React from 'react';
import { Users, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';
import { BotConfig, BotTelemetry } from '../types';

interface StatsOverviewProps {
  configs: BotConfig[];
  telemetry: Record<string, BotTelemetry>;
  savedAccountsCount?: number;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ configs, telemetry, savedAccountsCount }) => {
  const totalBots = configs.length;
  const onlineBots = Object.values(telemetry).filter((t) => t.status === 'online').length;
  const authenticatingBots = Object.values(telemetry).filter((t) => t.status === 'authenticating').length;
  
  const onlinePings = Object.values(telemetry)
    .filter((t) => t.status === 'online' && t.ping > 0)
    .map((t) => t.ping);
  const avgPing = onlinePings.length > 0 ? Math.round(onlinePings.reduce((a, b) => a + b, 0) / onlinePings.length) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Accounts in Vault */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Accounts in Vault</span>
          <div className="p-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-black text-slate-900">{savedAccountsCount ?? totalBots}</span>
          <span className="text-xs text-slate-400 font-medium">saved</span>
        </div>
      </div>

      {/* Online Bots */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Server Deployments</span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-black text-emerald-600">{onlineBots}</span>
          <span className="text-xs text-slate-400 font-medium">/ {totalBots} online</span>
        </div>
      </div>

      {/* Pending Auth */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Pending OAuth Code</span>
          <div className={`p-2 rounded-xl border ${authenticatingBots > 0 ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            <ShieldAlert className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className={`text-2xl font-black ${authenticatingBots > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {authenticatingBots}
          </span>
          <span className="text-xs text-slate-400 font-medium">action required</span>
        </div>
      </div>

      {/* Average Latency */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Average Latency</span>
          <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
            <Cpu className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-black text-slate-900">{onlineBots > 0 ? `${avgPing}ms` : '--'}</span>
          <span className="text-xs text-slate-400 font-medium">to server</span>
        </div>
      </div>
    </div>
  );
};

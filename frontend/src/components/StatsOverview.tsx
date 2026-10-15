'use client';

import React from 'react';
import { Users, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';
import { BotConfig, BotTelemetry } from '../types';

interface StatsOverviewProps {
  configs: BotConfig[];
  telemetry: Record<string, BotTelemetry>;
  savedAccountsCount?: number;
  isDaemonConnected?: boolean;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  configs,
  telemetry,
  savedAccountsCount,
  isDaemonConnected = true,
}) => {
  const totalBots = configs.length;
  const onlineBots = isDaemonConnected
    ? Object.values(telemetry).filter((t) => t.status === 'online').length
    : 0;
  const authenticatingBots = isDaemonConnected
    ? Object.values(telemetry).filter((t) => t.status === 'authenticating').length
    : 0;

  const onlinePings = isDaemonConnected
    ? Object.values(telemetry)
        .filter((t) => t.status === 'online' && t.ping > 0)
        .map((t) => t.ping)
    : [];
  const avgPing = onlinePings.length > 0 ? Math.round(onlinePings.reduce((a, b) => a + b, 0) / onlinePings.length) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6">
      {/* Accounts in Vault */}
      <div className="relative overflow-hidden bg-white/90 backdrop-blur-xl border border-white rounded-2xl p-3 sm:p-4 shadow-[0_14px_35px_-22px_rgba(15,23,42,0.38)] ring-1 ring-slate-900/5 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,0.4)] transition-all before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-emerald-400 before:via-teal-400 before:to-cyan-400 before:content-['']">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Vault Accounts</span>
          <div className="p-1.5 sm:p-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5 sm:space-x-2">
          <span className="text-xl sm:text-2xl font-black text-slate-900">{savedAccountsCount ?? totalBots}</span>
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium">saved</span>
        </div>
      </div>

      {/* Online Bots */}
      <div className="relative overflow-hidden bg-white/90 backdrop-blur-xl border border-white rounded-2xl p-3 sm:p-4 shadow-[0_14px_35px_-22px_rgba(15,23,42,0.38)] ring-1 ring-slate-900/5 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,0.4)] transition-all before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-emerald-400 before:via-teal-400 before:to-cyan-400 before:content-['']">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Deployments</span>
          <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5 sm:space-x-2">
          <span className="text-xl sm:text-2xl font-black text-emerald-600">{onlineBots}</span>
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium">/ {totalBots} online</span>
        </div>
      </div>

      {/* Pending Auth */}
      <div className="relative overflow-hidden bg-white/90 backdrop-blur-xl border border-white rounded-2xl p-3 sm:p-4 shadow-[0_14px_35px_-22px_rgba(15,23,42,0.38)] ring-1 ring-slate-900/5 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,0.4)] transition-all before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-amber-400 before:via-orange-400 before:to-rose-400 before:content-['']">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Pending OAuth</span>
          <div className={`p-1.5 sm:p-2 rounded-xl border ${authenticatingBots > 0 ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5 sm:space-x-2">
          <span className={`text-xl sm:text-2xl font-black ${authenticatingBots > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {authenticatingBots}
          </span>
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium">action needed</span>
        </div>
      </div>

      {/* Average Latency */}
      <div className="relative overflow-hidden bg-white/90 backdrop-blur-xl border border-white rounded-2xl p-3 sm:p-4 shadow-[0_14px_35px_-22px_rgba(15,23,42,0.38)] ring-1 ring-slate-900/5 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,0.4)] transition-all before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-sky-400 before:via-cyan-400 before:to-indigo-400 before:content-['']">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Avg Latency</span>
          <div className="p-1.5 sm:p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
            <Cpu className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5 sm:space-x-2">
          <span className="text-xl sm:text-2xl font-black text-slate-900">{onlineBots > 0 ? `${avgPing}ms` : '--'}</span>
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium">ping</span>
        </div>
      </div>
    </div>
  );
};

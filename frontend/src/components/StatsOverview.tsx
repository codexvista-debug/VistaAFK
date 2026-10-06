'use client';

import React from 'react';
import { Users, CheckCircle2, ShieldAlert, Cpu, HardDrive } from 'lucide-react';
import { BotConfig, BotTelemetry } from '../types';

interface StatsOverviewProps {
  configs: BotConfig[];
  telemetry: Record<string, BotTelemetry>;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ configs, telemetry }) => {
  const totalBots = configs.length;
  const onlineBots = Object.values(telemetry).filter((t) => t.status === 'online').length;
  const authenticatingBots = Object.values(telemetry).filter((t) => t.status === 'authenticating').length;
  
  // Calculate average ping of online bots
  const onlinePings = Object.values(telemetry)
    .filter((t) => t.status === 'online' && t.ping > 0)
    .map((t) => t.ping);
  const avgPing = onlinePings.length > 0 ? Math.round(onlinePings.reduce((a, b) => a + b, 0) / onlinePings.length) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Total Accounts */}
      <div className="bg-[#111827]/80 border border-gray-800/80 rounded-xl p-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Total Accounts</span>
          <Users className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white">{totalBots}</span>
          <span className="text-xs text-gray-500">configured</span>
        </div>
      </div>

      {/* Online Bots */}
      <div className="bg-[#111827]/80 border border-gray-800/80 rounded-xl p-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Online & Chunk-Loaded</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-emerald-400">{onlineBots}</span>
          <span className="text-xs text-gray-500">/ {totalBots} active</span>
        </div>
      </div>

      {/* Pending Auth */}
      <div className="bg-[#111827]/80 border border-gray-800/80 rounded-xl p-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Pending OAuth Code</span>
          <ShieldAlert className={`h-4 w-4 ${authenticatingBots > 0 ? 'text-amber-400 animate-pulse' : 'text-gray-500'}`} />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className={`text-2xl font-bold ${authenticatingBots > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
            {authenticatingBots}
          </span>
          <span className="text-xs text-gray-500">action required</span>
        </div>
      </div>

      {/* Average Ping */}
      <div className="bg-[#111827]/80 border border-gray-800/80 rounded-xl p-4 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Average Latency</span>
          <Cpu className="h-4 w-4 text-teal-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white">{onlineBots > 0 ? `${avgPing}ms` : '--'}</span>
          <span className="text-xs text-gray-500">to server</span>
        </div>
      </div>
    </div>
  );
};

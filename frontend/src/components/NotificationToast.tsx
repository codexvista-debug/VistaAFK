'use client';

import React from 'react';
import { VistaNotification } from '../types';
import { Info, AlertTriangle, AlertOctagon, CheckCircle2, X } from 'lucide-react';

interface NotificationToastProps {
  notifications: VistaNotification[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notifications, onDismiss }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
      {notifications.slice(0, 4).map((notif) => {
        const isSuccess = notif.level === 'success';
        const isWarn = notif.level === 'warn';
        const isError = notif.level === 'error';

        return (
          <div
            key={notif.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl backdrop-blur-md flex items-start space-x-3 text-xs transition-all animate-in slide-in-from-bottom-3 duration-200 ${
              isSuccess
                ? 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200'
                : isWarn
                ? 'bg-amber-950/90 border-amber-700/80 text-amber-200'
                : isError
                ? 'bg-rose-950/90 border-rose-700/80 text-rose-200'
                : 'bg-gray-900/90 border-gray-700/80 text-gray-200'
            }`}
          >
            <div className="mt-0.5">
              {isSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              {isWarn && <AlertTriangle className="h-4 w-4 text-amber-400" />}
              {isError && <AlertOctagon className="h-4 w-4 text-rose-400" />}
              {!isSuccess && !isWarn && !isError && <Info className="h-4 w-4 text-cyan-400" />}
            </div>

            <div className="flex-1 pr-2">
              <p className="font-medium leading-relaxed">{notif.message}</p>
            </div>

            <button
              onClick={() => onDismiss(notif.id)}
              className="text-gray-400 hover:text-white transition p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

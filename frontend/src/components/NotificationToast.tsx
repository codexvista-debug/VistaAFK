'use client';

import React, { useEffect } from 'react';
import { VistaNotification } from '../types';
import { Info, AlertTriangle, AlertOctagon, CheckCircle2, X } from 'lucide-react';

interface NotificationToastProps {
  notifications: VistaNotification[];
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<{ notif: VistaNotification; onDismiss: (id: string) => void }> = ({ notif, onDismiss }) => {
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismissRef.current(notif.id);
    }, 4500);

    return () => clearTimeout(timer);
  }, [notif.id]);

  const isSuccess = notif.level === 'success';
  const isWarn = notif.level === 'warn';
  const isError = notif.level === 'error';

  return (
    <div
      className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl backdrop-blur-md flex items-start space-x-3 text-xs transition-all animate-in slide-in-from-bottom-3 duration-200 relative overflow-hidden ${
        isSuccess
          ? 'bg-emerald-950/95 border-emerald-600/80 text-emerald-200'
          : isWarn
          ? 'bg-amber-950/95 border-amber-600/80 text-amber-200'
          : isError
          ? 'bg-rose-950/95 border-rose-600/80 text-rose-200'
          : 'bg-gray-900/95 border-gray-700/80 text-gray-200'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {isSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        {isWarn && <AlertTriangle className="h-4 w-4 text-amber-400" />}
        {isError && <AlertOctagon className="h-4 w-4 text-rose-400" />}
        {!isSuccess && !isWarn && !isError && <Info className="h-4 w-4 text-cyan-400" />}
      </div>

      <div className="flex-1 pr-2">
        <p className="font-semibold leading-relaxed">{notif.message}</p>
      </div>

      <button
        onClick={() => onDismiss(notif.id)}
        className="text-gray-400 hover:text-white transition p-0.5 shrink-0"
        title="Close notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* 4.5-Second Auto-dismiss Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
        <div
          className={`h-full ${
            isSuccess ? 'bg-emerald-400' : isWarn ? 'bg-amber-400' : isError ? 'bg-rose-400' : 'bg-cyan-400'
          }`}
          style={{
            animation: 'toastProgress 4.5s linear forwards',
          }}
        />
      </div>
      <style jsx>{`
        @keyframes toastProgress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
};

export const NotificationToast: React.FC<NotificationToastProps> = ({ notifications, onDismiss }) => {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex flex-col space-y-2 max-w-xs sm:max-w-sm w-full pointer-events-none">
      {notifications.slice(0, 3).map((notif) => (
        <ToastItem key={notif.id} notif={notif} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

import type { Metadata } from 'next';
import './globals.css';
import { VistaAuthProvider } from '../context/VistaAuthContext';
import { VistaWebSocketProvider } from '../context/VistaWebSocketContext';
import { AuthModal } from '../components/AuthModal';

export const metadata: Metadata = {
  title: 'VistaAFK | Minecraft Java Headless AFK Dashboard',
  description: 'Manage 1 to 15+ headless Minecraft Java accounts with real-time telemetry, auto-survival, and chunk loading.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <head>
        <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
      </head>
      <body className="min-h-screen bg-[#f8fafc] text-slate-800 antialiased selection:bg-emerald-500 selection:text-white overflow-x-hidden w-full max-w-[100vw]">
        <VistaAuthProvider>
          <VistaWebSocketProvider>
            {children}
            <AuthModal />
          </VistaWebSocketProvider>
        </VistaAuthProvider>
      </body>
    </html>
  );
}

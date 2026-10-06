import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-gray-100 antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}

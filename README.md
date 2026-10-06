# VistaAFK 🎮⚡

> **Modern, high-performance headless Minecraft Java AFK manager and real-time live monitoring portal.**

VistaAFK keeps Minecraft chunks loaded (mob farms, crop farms, redstone contraptions) across **1 to 15+ accounts simultaneously** without needing full Minecraft game clients running.

---

## 🌟 Key Features

- **Multi-Account Management:** Add, configure, and manage 1 to 15+ accounts with 1-click connect/disconnect.
- **Secure Microsoft OAuth:** Official Device Code flow (`microsoft.com/link`) with automatic token caching. No Minecraft passwords stored.
- **Real-Time Telemetry:** Live bot HP, hunger, coordinates, dimension, server latency, and 3D skin heads.
- **Live In-Game Chat Console:** Bidirectional real-time server chat with quick commands (`/afk`, `/home`, `/spawn`).
- **Autonomous Survival Autopilot:**
  - Non-teleporting Anti-AFK routine (subtle head rotation, micro-sneaks, arm swings, jumps).
  - Auto-eat from inventory when hunger falls below a threshold.
  - Auto-equip Totem of Undying to off-hand.
  - Auto-reconnect with exponential backoff on server restart or kick.
- **Proxy Support:** Optional SOCKS5/HTTP proxy per account to avoid IP throttling.
- **Alerts:** Instant Discord webhook notifications on death, kicks, or whispers from players/staff.

---

## 🏗️ Architecture

- **`frontend/`:** Next.js (App Router), Tailwind CSS, Lucide icons. Can be deployed on **Vercel** or self-hosted.
- **`daemon/`:** Node.js + TypeScript service using `mineflayer` and `prismarine-auth`, running a WebSocket server for real-time state synchronization.

---

## 🚀 Quick Start Guide

### 1. Run the Bot Daemon (Persistent Machine / PC / VPS)
```bash
cd daemon
npm install
npm run dev
```
The daemon runs on `ws://localhost:8080`.

### 2. Run the Web Dashboard
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploying Frontend to Vercel

1. Push this repository to GitHub.
2. Go to [Vercel](https://vercel.com/new) and click **Import** on `VistaAFK`.
3. In the Vercel project settings:
   - Set **Root Directory** to `frontend`.
4. Click **Deploy**.
5. In the deployed dashboard, open **Settings** (top-right daemon badge) and point the WebSocket URL to your persistent host (e.g., your VPS or a public tunnel like Cloudflare / ngrok).

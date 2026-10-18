import { exec } from 'child_process';

let lastNotificationContent = '';
let notificationTimer: ReturnType<typeof setInterval> | null = null;

export interface NotificationBotInfo {
  name: string;
  host: string;
  port?: number;
  status: string;
  uptimeSeconds?: number;
}

function formatUptime(uptimeSeconds?: number): string {
  if (!uptimeSeconds || uptimeSeconds <= 0) return '0m';
  const totalMins = Math.floor(uptimeSeconds / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function updateTermuxNotification(bots: NotificationBotInfo[]) {
  const isMobile = process.env.VISTAAFK_DEVICE_TYPE === 'mobile' || Boolean(process.env.TERMUX_VERSION);
  if (!isMobile) return;

  const onlineBots = bots.filter((b) => b.status === 'online');
  let title = '⚡ VistaAFK 24/7';
  let content = 'Daemon Online (Standby)';

  if (onlineBots.length === 1) {
    const b = onlineBots[0];
    const serverName = b.port && b.port !== 25565 && b.port !== 19132 ? `${b.host}:${b.port}` : b.host;
    const uptime = formatUptime(b.uptimeSeconds);
    content = `${b.name} @ ${serverName} (${uptime})`;
  } else if (onlineBots.length > 1) {
    title = `⚡ VistaAFK (${onlineBots.length} Bots Online)`;
    const first = onlineBots[0];
    const serverName = first.port && first.port !== 25565 && first.port !== 19132 ? `${first.host}:${first.port}` : first.host;
    const uptime = formatUptime(first.uptimeSeconds);
    content = `${first.name} @ ${serverName} (${uptime}) +${onlineBots.length - 1} more`;
  }

  // Avoid running exec if content hasn't changed
  if (content === lastNotificationContent) return;
  lastNotificationContent = content;

  // Escape double quotes for shell execution
  const safeTitle = title.replace(/"/g, '\\"');
  const safeContent = content.replace(/"/g, '\\"');

  const cmd = `termux-notification --id vistaafk --title "${safeTitle}" --content "${safeContent}" --ongoing --priority high`;
  exec(cmd, () => {
    // Silently ignore if termux-api is not installed
  });
}

export function removeTermuxNotification() {
  const isMobile = process.env.VISTAAFK_DEVICE_TYPE === 'mobile' || Boolean(process.env.TERMUX_VERSION);
  if (!isMobile) return;
  exec('termux-notification-remove vistaafk', () => {});
}

export function startNotificationTicker(getBots: () => NotificationBotInfo[]) {
  if (notificationTimer) clearInterval(notificationTimer);
  notificationTimer = setInterval(() => {
    lastNotificationContent = ''; // force update to refresh uptime string
    updateTermuxNotification(getBots());
  }, 30000);
}

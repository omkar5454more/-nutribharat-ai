import { Platform } from 'react-native';

/**
 * Browser notifications for reminders. They only work while the app/page is open: a web app cannot wake a closed phone
 * without a push service, which this app deliberately does not use. Native builds would use expo-notifications instead.
 */
const api = (): typeof Notification | null => (Platform.OS === 'web' && typeof Notification !== 'undefined' ? Notification : null);

export const notificationsSupported = () => api() !== null;
export const notificationsAllowed = () => api()?.permission === 'granted';

export async function askNotificationPermission(): Promise<boolean> {
  const n = api();
  if (!n) return false;
  if (n.permission === 'granted') return true;
  if (n.permission === 'denied') return false;
  return (await n.requestPermission()) === 'granted';
}

export function showNotification(title: string, body: string) {
  const n = api();
  if (n && n.permission === 'granted') {
    try { new n(title, { body }); } catch { /* some browsers only allow this from a service worker; the in-app banner still shows */ }
  }
}

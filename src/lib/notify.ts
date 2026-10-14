import { Platform } from 'react-native';

/**
 * Reminders. On Android / iOS they are real scheduled notifications (they arrive even when the app is closed), using expo-notifications.
 * On the web they appear only while the page is open (browser Notification API). Text is always short and generic: never health details.
 */
const webApi = (): typeof Notification | null => (Platform.OS === 'web' && typeof Notification !== 'undefined' ? Notification : null);
const native = Platform.OS !== 'web';

// loaded lazily so the web build never needs it
let N: typeof import('expo-notifications') | null = null;
function lib() {
  if (!native) return null;
  if (!N) {
    N = require('expo-notifications');
    N!.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  }
  return N!;
}

export const notificationsSupported = () => native || webApi() !== null;
export const notificationsAllowed = () => (native ? nativeAllowed : webApi()?.permission === 'granted');
let nativeAllowed = false;

/** Asks for permission (and creates the Android channel). Returns true when reminders can be shown. */
export async function askNotificationPermission(): Promise<boolean> {
  if (native) {
    const n = lib()!;
    try {
      if (Platform.OS === 'android') await n.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: n.AndroidImportance.DEFAULT });
      const cur = await n.getPermissionsAsync();
      let ok = cur.granted;
      if (!ok && cur.canAskAgain) ok = (await n.requestPermissionsAsync()).granted;
      nativeAllowed = ok;
      return ok;
    } catch { return false; }
  }
  const w = webApi();
  if (!w) return false;
  if (w.permission === 'granted') return true;
  if (w.permission === 'denied') return false;
  return (await w.requestPermission()) === 'granted';
}

export async function refreshNativePermission(): Promise<boolean> {
  if (!native) return notificationsAllowed();
  try { nativeAllowed = (await lib()!.getPermissionsAsync()).granted; } catch { nativeAllowed = false; }
  return nativeAllowed;
}

/** Shows one right now (web while the page is open). */
export function showNotification(title: string, body: string) {
  const w = webApi();
  if (w && w.permission === 'granted') {
    try { new w(title, { body }); } catch { /* the in-app banner still shows */ }
  }
}

export type DailyReminder = { id: string; title: string; hour: number; minute: number };

/** Replaces all scheduled daily reminders with this list (native only). Safe to call repeatedly. */
export async function scheduleDailyReminders(items: DailyReminder[]) {
  if (!native || !nativeAllowed) return;
  const n = lib()!;
  try {
    const existing = await n.getAllScheduledNotificationsAsync();
    for (const e of existing) if (e.identifier.startsWith('daily-')) await n.cancelScheduledNotificationAsync(e.identifier);
    for (const it of items) {
      await n.scheduleNotificationAsync({
        identifier: `daily-${it.id}`,
        content: { title: it.title, body: '', ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}) } as any,
        trigger: { type: n.SchedulableTriggerInputTypes.DAILY, hour: it.hour, minute: it.minute, ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}) } as any,
      });
    }
  } catch { /* reminders are a convenience; never break the app */ }
}

/** One-time reminder (a check-in follow-up the person asked for). */
export async function scheduleOnce(id: string, title: string, at: number) {
  if (!native || !nativeAllowed || at <= Date.now()) return;
  const n = lib()!;
  try {
    await n.scheduleNotificationAsync({
      identifier: id,
      content: { title, body: '', ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}) } as any,
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(at), ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}) } as any,
    });
  } catch { /* ignore */ }
}

export async function cancelScheduled(id: string) {
  if (!native) return;
  try { await lib()!.cancelScheduledNotificationAsync(id); } catch { /* ignore */ }
}

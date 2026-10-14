import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Registers the service worker (production web builds only, so local development never serves stale files). */
export function registerServiceWorker() {
  if (Platform.OS !== 'web' || process.env.NODE_ENV !== 'production' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* installing is optional */ });
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

/** "Install app" support: Android/Chrome gives us a prompt to show; iPhone needs the manual Share → Add to Home Screen steps. */
export function useInstall() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
  const standalone = isWeb && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
  const isIos = isWeb && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isWeb) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, [isWeb]);

  return {
    /** only true on the web, outside the installed app */
    show: isWeb && !standalone,
    standalone,
    isIos,
    canPrompt: !!event,
    install: async () => { if (!event) return; await event.prompt(); await event.userChoice; setEvent(null); },
  };
}

/** Where email links (confirm account, reset password) should send people back to. Only known on the web; the Android app needs a deep link. */
export function appUrl(): string | undefined {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
}

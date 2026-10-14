import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { createDemoFetch, resetDemo } from './demoBackend';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Demo build (`npm run demo`): the whole app runs against an in-browser fake backend. Never set this in a real deployment. */
export const isDemo = process.env.EXPO_PUBLIC_DEMO === '1';

/** False until the developer has created a Supabase project and filled in .env — the app shows a setup screen instead of crashing. */
export const isConfigured = isDemo || Boolean(url && key && !url.includes('YOUR-PROJECT'));

const live = isConfigured && !isDemo;

export const supabase = createClient(live ? url! : 'https://placeholder.supabase.co', live ? key! : 'placeholder', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',   // lets the web app read the password-reset / email-confirmation link
  },
  ...(isDemo ? { global: { fetch: createDemoFetch(localStorage) as typeof fetch } } : {}),
});

/** Demo only: wipe the fake data and the saved login, then reload the page. */
export async function resetDemoData() {
  resetDemo(localStorage);
  await supabase.auth.signOut();
  (globalThis as any).location?.reload?.();
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

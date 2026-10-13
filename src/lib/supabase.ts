import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** False until the developer has created a Supabase project and filled in .env — the app shows a setup screen instead of crashing. */
export const isConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT'));

export const supabase = createClient(isConfigured ? url! : 'https://placeholder.supabase.co', isConfigured ? key! : 'placeholder', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

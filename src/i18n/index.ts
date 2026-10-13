import { create } from 'zustand';
import { en, type Key } from './en';
import { hi } from './hi';
import { mr } from './mr';
import { FOOD_NAMES } from './foodNames';

export type Lang = 'en' | 'hi' | 'mr';
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
];
export const DICTS: Record<Lang, Record<Key, string>> = { en, hi, mr };
export type { Key };

const STORAGE_KEY = 'nutribharat.lang';

function detect(): Lang {
  try {
    const saved = (globalThis as any).localStorage?.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'hi' || saved === 'mr') return saved;
  } catch { /* storage unavailable: fall through */ }
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (locale.startsWith('hi')) return 'hi';
    if (locale.startsWith('mr')) return 'mr';
  } catch { /* ignore */ }
  return 'en';
}

export const useLang = create<{ lang: Lang; setLang: (l: Lang) => void }>((set) => ({
  lang: detect(),
  setLang: (lang) => {
    try { (globalThis as any).localStorage?.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    set({ lang });
  },
}));

export type Params = Record<string, string | number>;

export function translate(lang: Lang, key: Key, params?: Params): string {
  const text = DICTS[lang][key] ?? en[key];
  return params ? text.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`)) : text;
}

/** `const t = useT(); t('today.title')` — re-renders when the language changes. */
export function useT() {
  const lang = useLang((s) => s.lang);
  return (key: Key, params?: Params) => translate(lang, key, params);
}

/** Display name of a food in the chosen language (falls back to the English name). */
export function foodLabel(foodId: string, englishName: string, lang: Lang): string {
  return (lang !== 'en' && FOOD_NAMES[lang]?.[foodId]) || englishName;
}

export function useFoodLabel() {
  const lang = useLang((s) => s.lang);
  return (foodId: string, englishName: string) => foodLabel(foodId, englishName, lang);
}

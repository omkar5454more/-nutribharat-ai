import { describe, expect, it } from 'vitest';
import { FOODS } from '../core/foods';
import { en } from './en';
import { DICTS, foodLabel, translate, type Lang } from './index';
import { FOOD_NAMES } from './foodNames';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('translations', () => {
  const langs: Lang[] = ['hi', 'mr'];

  it.each(langs)('%s defines every key with the same {placeholders} as English', (lang) => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const text = DICTS[lang][key];
      expect(text, `${lang}:${key}`).toBeTruthy();
      expect(placeholders(text), `${lang}:${key}`).toBe(placeholders(en[key]));
    }
    expect(Object.keys(DICTS[lang]).length).toBe(Object.keys(en).length);
  });

  it.each(langs)('%s uses its own script rather than leaving English behind', (lang) => {
    const devanagari = /[ऀ-ॿ]/;
    const sample = ['today.scan', 'auth.signIn', 'prof.delete', 'advice.losing_too_fast', 'note.repro_pregnant'] as const;
    for (const k of sample) expect(devanagari.test(DICTS[lang][k]), `${lang}:${k}`).toBe(true);
  });

  it('every safety note keeps its "doctor / dietitian" referral in every language', () => {
    const referral: Record<Lang, RegExp> = { en: /doctor or dietitian/, hi: /डॉक्टर.*डायटीशियन/, mr: /डॉक्टर.*आहारतज्ज्ञ/ };
    for (const lang of ['en', 'hi', 'mr'] as Lang[]) {
      for (const k of ['note.minor_see_pro', 'note.repro_pregnant', 'note.repro_breastfeeding', 'note.underweight_no_loss', 'note.bmi_outside', 'note.generic_pro'] as const) {
        expect(DICTS[lang][k], `${lang}:${k}`).toMatch(referral[lang]);
      }
    }
  });

  it('translate fills placeholders and leaves unknown ones visible', () => {
    expect(translate('en', 'today.hello', { name: 'Asha' })).toBe('Namaste, Asha');
    expect(translate('hi', 'today.left', { n: 120 })).toContain('120');
    expect(translate('en', 'today.hello')).toBe('Namaste, {name}');
  });
});

describe('food names', () => {
  it('every food has a Hindi and Marathi display name, and no stray ids', () => {
    const ids = new Set(FOODS.map((f) => f.id));
    for (const lang of ['hi', 'mr'] as const) {
      for (const f of FOODS) expect(FOOD_NAMES[lang][f.id], `${lang}:${f.id}`).toBeTruthy();
      for (const id of Object.keys(FOOD_NAMES[lang])) expect(ids.has(id), `${lang}:${id}`).toBe(true);
    }
  });

  it('falls back to English', () => {
    expect(foodLabel('roti', 'Roti / Chapati', 'en')).toBe('Roti / Chapati');
    expect(foodLabel('roti', 'Roti / Chapati', 'hi')).toBe('रोटी / चपाती');
    expect(foodLabel('unknown', 'Mystery', 'mr')).toBe('Mystery');
  });
});

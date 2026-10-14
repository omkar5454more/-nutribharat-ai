import { describe, expect, it } from 'vitest';
import { FOODS } from '../core/foods';
import { en } from './en';
import { DICTS, foodLabel, translate, type Lang } from './index';
import { FOOD_NAMES } from './foodNames';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('translations', () => {
  const langs: Lang[] = ['hi', 'mr', 'ta', 'te', 'kn', 'bn', 'gu'];
  const SCRIPT: Record<string, RegExp> = { hi: /[ऀ-ॿ]/, mr: /[ऀ-ॿ]/, ta: /[஀-௿]/, te: /[ఀ-౿]/, kn: /[ಀ-೿]/, bn: /[ঀ-৿]/, gu: /[઀-૿]/ };

  it.each(langs)('%s defines every key with the same {placeholders} as English', (lang) => {
    const partial = !['hi', 'mr'].includes(lang);   // the five newer languages do not have the Release-4 'h4.' strings yet (English is shown)
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const text = DICTS[lang][key];
      if (partial && key.startsWith('h4.')) { if (text) expect(placeholders(text), `${lang}:${key}`).toBe(placeholders(en[key])); continue; }
      expect(text, `${lang}:${key}`).toBeTruthy();
      expect(placeholders(text!), `${lang}:${key}`).toBe(placeholders(en[key]));
    }
    if (!partial) expect(Object.keys(DICTS[lang]).length).toBe(Object.keys(en).length);
    for (const key of Object.keys(DICTS[lang])) expect(key in en, `${lang}:${key} is not an English key`).toBe(true);
  });

  it.each(langs)('%s uses its own script rather than leaving English behind', (lang) => {
    const script = SCRIPT[lang];
    const sample = ['today.scan', 'auth.signIn', 'prof.delete', 'advice.losing_too_fast', 'note.repro_pregnant'] as const;
    for (const k of sample) expect(script.test(DICTS[lang][k]!), `${lang}:${k}`).toBe(true);
  });

  it('every safety note keeps its "doctor / dietitian" referral in every language', () => {
    const referral: Record<Lang, RegExp> = {
      en: /doctor or dietitian/, hi: /डॉक्टर.*डायटीशियन/, mr: /डॉक्टर.*आहारतज्ज्ञ/,
      ta: /மருத்துவர்.*உணவியல் நிபுணர/, te: /డాక్టర్.*డైటీషియన్/, kn: /ವೈದ್ಯ.*ಆಹಾರ ತಜ್ಞ/, bn: /ডাক্তার.*পুষ্টিবিদ/, gu: /ડૉક્ટર.*ડાયેટિશિયન/,
    };
    for (const lang of ['en', 'hi', 'mr', 'ta', 'te', 'kn', 'bn', 'gu'] as Lang[]) {
      for (const k of ['note.minor_see_pro', 'note.repro_pregnant', 'note.repro_breastfeeding', 'note.underweight_no_loss', 'note.bmi_outside', 'note.generic_pro'] as const) {
        expect(DICTS[lang][k]!, `${lang}:${k}`).toMatch(referral[lang]);
      }
    }
  });

  it('every Hindi and Marathi safety note keeps a "see a doctor" pointer', () => {
    const doc = { hi: /डॉक्टर/, mr: /डॉक्टर/ };
    for (const lang of ['hi', 'mr'] as const) {
      for (const k of ['h4.note.anemia_assessment', 'h4.note.combined_plan', 'h4.note.concern_general', 'h4.note.thyroid_medicine_timing', 'h4.read.bp_high', 'h4.read.bp_crisis', 'h4.read.glucose_high', 'h4.read.glucose_crisis'] as const) {
        expect(DICTS[lang][k]!, `${lang}:${k}`).toMatch(doc[lang]);
      }
    }
    expect(en['h4.read.bp_crisis']).toContain('112');
    expect(en['h4.emergency.symptom']).toContain('112');
  });

  it('translate falls back to English for a missing translation', () => {
    expect(translate('ta', 'h4.skip')).toBe(en['h4.skip']);
    expect(translate('hi', 'h4.skip')).not.toBe(en['h4.skip']);
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
    for (const lang of ['hi', 'mr', 'ta', 'te', 'kn', 'bn', 'gu'] as const) {
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

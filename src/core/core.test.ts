import { describe, expect, it } from 'vitest';
import { FOODS, FOOD_BY_ID } from './foods';
import { bmr, computeTargets } from './goals';
import { matchFood, ScanResultSchema, searchFoods } from './match';
import { gramsFor, makeItem, mealTotals, nutrientsFor } from './nutrition';
import type { ProfileInput } from './types';

const base: ProfileInput = { sex: 'male', age: 30, height_cm: 175, weight_kg: 75, activity: 'moderate', goal: 'maintain', reproductive: 'none' };

describe('food table', () => {
  it('has unique ids and sane units', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    for (const f of FOODS) {
      expect(f.units.length).toBeGreaterThan(0);
      expect(f.units.every((u) => u.grams > 0)).toBe(true);
    }
  });

  it('energy roughly agrees with the macros (Atwater, 15% tolerance; fibre explains small gaps)', () => {
    for (const f of FOODS) {
      const p = f.per100g;
      const atwater = p.protein_g * 4 + p.carbs_g * 4 + p.fat_g * 9;
      expect(Math.abs(atwater - p.kcal) / Math.max(p.kcal, 1), `${f.id}: ${p.kcal} vs ${atwater}`).toBeLessThan(0.15);
    }
  });

  it('is clearly marked as seed data until verified', () => {
    expect(FOODS.every((f) => f.source === 'seed')).toBe(true);
  });
});

describe('nutrition engine', () => {
  it('scales per-100g values by weight', () => {
    const n = nutrientsFor(FOOD_BY_ID['roti'], 80);
    expect(n.kcal).toBe(Math.round(297 * 0.8));
    expect(n.protein_g).toBeCloseTo(7.8, 1);
  });

  it('converts household units and sums a thali', () => {
    const roti = FOOD_BY_ID['roti'], dal = FOOD_BY_ID['dal-tadka'], rice = FOOD_BY_ID['rice'];
    expect(gramsFor(roti, 2, '1 roti')).toBe(80);
    expect(gramsFor(roti, 1, 'unknown unit')).toBe(40);   // falls back to the first unit
    const items = [makeItem(roti, 80, 'ai'), makeItem(dal, 150, 'ai'), makeItem(rice, 150, 'manual')];
    const t = mealTotals(items);
    expect(t.kcal).toBe(items.reduce((a, i) => a + i.nutrients.kcal, 0));
    expect(t.kcal).toBeGreaterThan(500);
    expect(t.kcal).toBeLessThan(700);
  });

  it('never returns negative numbers', () => {
    expect(nutrientsFor(FOOD_BY_ID['roti'], -50).kcal).toBe(0);
  });

  it('adding oil raises fat and energy (the oil correction)', () => {
    const sabzi = makeItem(FOOD_BY_ID['mixed-veg'], 150, 'ai');
    const withOil = mealTotals([sabzi, makeItem(FOOD_BY_ID['ghee-oil'], 10, 'manual')]);
    expect(withOil.fat_g - sabzi.nutrients.fat_g).toBeCloseTo(10, 0);
    expect(withOil.kcal - sabzi.nutrients.kcal).toBe(90);
  });
});

describe('food matching', () => {
  it.each([
    ['chapati', 'roti'], ['Phulka', 'roti'], ['Kanda Poha', 'poha'], ['Misal Pav', 'misal'], ['wada pav', 'vada-pav'],
    ['toor dal', 'dal-tadka'], ['Chole', 'chana-masala'], ['dahi', 'curd'], ['steamed rice', 'rice'], ['Hyderabadi Biryani', 'chicken-biryani'],
    ['jowar bhakri', 'bhakri'], ['sada dosa', 'dosa'],
  ])('%s -> %s', (name, id) => {
    expect(matchFood(name)?.food.id).toBe(id);
  });

  it('returns null for things it does not know instead of guessing', () => {
    expect(matchFood('spaghetti carbonara')).toBeNull();
    expect(matchFood('')).toBeNull();
  });

  it('search finds foods by Hindi names and returns everything for an empty box', () => {
    expect(searchFoods('doodh')[0].id).toBe('milk');
    expect(searchFoods('').length).toBeGreaterThan(10);
  });
});

describe('scan result schema', () => {
  it('accepts a good result and rejects junk', () => {
    expect(ScanResultSchema.safeParse({ is_food: true, items: [{ name: 'chapati', estimated_grams: 80, confidence: 0.9 }] }).success).toBe(true);
    expect(ScanResultSchema.safeParse({ is_food: true, items: [{ name: '', estimated_grams: 80, confidence: 0.9 }] }).success).toBe(false);
    expect(ScanResultSchema.safeParse({ is_food: true, items: [{ name: 'x', estimated_grams: -5, confidence: 2 }] }).success).toBe(false);
    expect(ScanResultSchema.safeParse({ items: [] }).success).toBe(false);
  });
});

describe('goal calculator', () => {
  it('matches the Mifflin–St Jeor formula', () => {
    expect(bmr(base)).toBeCloseTo(10 * 75 + 6.25 * 175 - 5 * 30 + 5, 5);
    expect(bmr({ ...base, sex: 'female' })).toBeCloseTo(10 * 75 + 6.25 * 175 - 5 * 30 - 161, 5);
  });

  it('maintain ~ TDEE; lose is below, gain is above', () => {
    const m = computeTargets(base), l = computeTargets({ ...base, goal: 'lose' }), g = computeTargets({ ...base, goal: 'gain' });
    expect(Math.abs(m.kcal - m.tdee)).toBeLessThanOrEqual(10);
    expect(l.kcal).toBeLessThan(m.kcal);
    expect(m.tdee - l.kcal).toBeLessThanOrEqual(500 + 10);
    expect(g.kcal).toBeGreaterThan(m.kcal);
    expect(l.protein_g).toBeGreaterThan(m.protein_g);
  });

  it('macros add back up to the calorie target', () => {
    const t = computeTargets({ ...base, goal: 'lose' });
    const kcal = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9;
    expect(Math.abs(kcal - t.kcal)).toBeLessThan(25);
  });

  it('never goes below the safety floor for weight loss', () => {
    const t = computeTargets({ sex: 'female', age: 55, height_cm: 150, weight_kg: 55, activity: 'sedentary', goal: 'lose', reproductive: 'none' });
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
  });

  it('offers no deficit to under-18s, pregnant or breastfeeding users, and points to a professional', () => {
    const kid = computeTargets({ ...base, age: 16, goal: 'lose' });
    expect(kid.seeProfessional).toBe(true);
    expect(kid.kcal).toBeGreaterThanOrEqual(kid.tdee - 10);
    for (const reproductive of ['pregnant', 'breastfeeding'] as const) {
      const t = computeTargets({ ...base, sex: 'female', goal: 'lose', reproductive });
      expect(t.seeProfessional).toBe(true);
      expect(t.kcal).toBeGreaterThanOrEqual(t.tdee - 10);
      expect(t.notes.map((n) => n.code)).toContain(reproductive === 'pregnant' ? 'repro_pregnant' : 'repro_breastfeeding');
    }
  });

  it('does not suggest weight loss at an underweight BMI', () => {
    const t = computeTargets({ ...base, weight_kg: 50, goal: 'lose' });   // BMI ~16.3
    expect(t.bmi).toBeLessThan(18.5);
    expect(t.seeProfessional).toBe(true);
    expect(t.kcal).toBeGreaterThanOrEqual(t.tdee - 10);
  });

  it('flags very high BMI for professional advice', () => {
    expect(computeTargets({ ...base, weight_kg: 120 }).seeProfessional).toBe(true);
  });

  it('water target grows with weight and with breastfeeding', () => {
    expect(computeTargets({ ...base, weight_kg: 90 }).water_ml).toBeGreaterThan(computeTargets(base).water_ml);
    expect(computeTargets({ ...base, sex: 'female', reproductive: 'breastfeeding' }).water_ml).toBeGreaterThan(computeTargets({ ...base, sex: 'female' }).water_ml);
  });
});

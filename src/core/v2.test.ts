import { describe, expect, it } from 'vitest';
import { FOOD_BY_ID } from './foods';
import { computeTargets } from './goals';
import { excludedByAllergies, planDay, type DietPref, type Region } from './planner';
import { dayKey, lastNDays, summarizeWeek, summarizeWeight, weightAdvice } from './progress';
import type { ProfileInput } from './types';

const prof: ProfileInput = { sex: 'female', age: 30, height_cm: 160, weight_kg: 60, activity: 'light', goal: 'maintain', reproductive: 'none' };
const targets = computeTargets(prof);

const idsOf = (plan: ReturnType<typeof planDay>) => plan.slots.flatMap((s) => s.items.map((i) => i.foodId));

describe('meal planner', () => {
  it('builds four meals close to the calorie target', () => {
    const plan = planDay({ targets, diet: 'any', region: 'any' });
    expect(plan.slots.map((s) => s.slot)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    expect(plan.emptySlots).toEqual([]);
    expect(Math.abs(plan.totals.kcal - targets.kcal) / targets.kcal).toBeLessThan(0.2);
  });

  it.each(['any', 'maharashtrian', 'north', 'south', 'gujarati'] as Region[])('region %s always yields a full plan', (region) => {
    for (const diet of ['any', 'veg', 'egg', 'non-veg', 'vegan', 'jain'] as DietPref[]) {
      const plan = planDay({ targets, diet, region, seed: 3 });
      expect(plan.slots.length + plan.emptySlots.length).toBe(4);
      expect(plan.emptySlots, `${region}/${diet}`).toEqual([]);
    }
  });

  it('never puts forbidden foods in a vegetarian / vegan / egg-free plan (many seeds)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const region of ['any', 'north', 'south'] as Region[]) {
        for (const id of idsOf(planDay({ targets, diet: 'veg', region, seed }))) expect(['veg', 'vegan']).toContain(FOOD_BY_ID[id].diet);
        for (const id of idsOf(planDay({ targets, diet: 'vegan', region, seed }))) expect(FOOD_BY_ID[id].diet).toBe('vegan');
        for (const id of idsOf(planDay({ targets, diet: 'egg', region, seed }))) expect(FOOD_BY_ID[id].diet).not.toBe('non-veg');
      }
    }
  });

  it('respects allergies it can check and reports the ones it cannot', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const ids = idsOf(planDay({ targets, diet: 'any', region: 'any', allergies: ['milk', 'egg', 'fish'], seed }));
      for (const banned of ['milk', 'curd', 'chai', 'paneer', 'egg-boiled', 'fish-curry', 'lassi']) expect(ids).not.toContain(banned);
    }
    const plan = planDay({ targets, diet: 'any', region: 'any', allergies: ['Sesame', 'peanuts'] });
    expect(plan.uncheckedAllergies).toEqual(['Sesame']);
    expect(excludedByAllergies(['groundnut']).foods.has('poha')).toBe(true);
  });

  it('scales portions to the target and stays within sane limits', () => {
    const small = planDay({ targets: { kcal: 1200, protein_g: 60 }, diet: 'any', region: 'any' });
    const big = planDay({ targets: { kcal: 3000, protein_g: 120 }, diet: 'any', region: 'any' });
    expect(big.totals.kcal).toBeGreaterThan(small.totals.kcal * 1.5);
    for (const s of [...small.slots, ...big.slots]) for (const i of s.items) expect(i.grams).toBeGreaterThanOrEqual(5);
  });

  it('is repeatable for a seed and varies across seeds', () => {
    const key = (seed: number) => JSON.stringify(planDay({ targets, diet: 'any', region: 'any', seed }).slots.map((s) => s.items.map((i) => i.foodId)));
    expect(key(5)).toBe(key(5));
    expect(new Set(Array.from({ length: 20 }, (_, s) => key(s + 1))).size).toBeGreaterThan(3);
  });

  it('jain plans only use curated combinations', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ids = idsOf(planDay({ targets, diet: 'jain', region: 'any', seed }));
      for (const bad of ['aloo-gobi', 'poha', 'vada-pav', 'samosa', 'misal', 'chicken-curry', 'egg-boiled']) expect(ids).not.toContain(bad);
    }
  });
});

describe('weight progress', () => {
  const logs = (pairs: [string, number][]) => pairs.map(([date, weight_kg]) => ({ date, weight_kg }));

  it('summarises change and weekly rate', () => {
    const s = summarizeWeight(logs([['2026-10-01', 70], ['2026-10-08', 69.2], ['2026-10-15', 68.4]]))!;
    expect(s.start).toBe(70);
    expect(s.latest).toBe(68.4);
    expect(s.change).toBe(-1.6);
    expect(s.weeklyRate).toBeCloseTo(-0.8, 1);
  });

  it('returns null / not-enough-data without a trend', () => {
    expect(summarizeWeight([])).toBeNull();
    const one = summarizeWeight(logs([['2026-10-01', 70]]))!;
    expect(one.weeklyRate).toBeNull();
    expect(weightAdvice(one, 'lose')).toBe('not_enough_data');
  });

  it('flags unsafe fast loss and trends that contradict the goal', () => {
    const fast = summarizeWeight(logs([['2026-10-01', 70], ['2026-10-08', 68.5]]))!; // -1.5 kg/week > 1% of body weight
    expect(weightAdvice(fast, 'lose')).toBe('losing_too_fast');
    expect(weightAdvice(fast, 'maintain')).toBe('losing_too_fast');
    const up = summarizeWeight(logs([['2026-10-01', 70], ['2026-10-08', 70.8]]))!;
    expect(weightAdvice(up, 'lose')).toBe('gaining_while_losing');
    expect(weightAdvice(up, 'gain')).toBe('on_track');
    const down = summarizeWeight(logs([['2026-10-01', 70], ['2026-10-08', 69.4]]))!;
    expect(weightAdvice(down, 'gain')).toBe('losing_while_gaining');
    expect(weightAdvice(down, 'lose')).toBe('on_track');
  });

  it('smooths with a 3-entry moving average', () => {
    const s = summarizeWeight(logs([['2026-10-01', 70], ['2026-10-02', 71], ['2026-10-03', 70], ['2026-10-04', 69]]))!;
    expect(s.smoothed).toEqual([70, 70.5, 70.3, 70]);
  });
});

describe('week summary', () => {
  const n = (kcal: number, protein_g = 0) => ({ kcal, protein_g, carbs_g: 0, fat_g: 0, fiber_g: 0 });

  it('averages only days with meals and counts days on target', () => {
    const days = [
      { date: '2026-10-07', totals: n(0), meals: 0 },
      { date: '2026-10-08', totals: n(2000, 60), meals: 3 },
      { date: '2026-10-09', totals: n(1000, 30), meals: 2 },
      { date: '2026-10-10', totals: n(2100, 90), meals: 4 },
    ];
    const w = summarizeWeek(days, 2000);
    expect(w.daysLogged).toBe(3);
    expect(w.avgKcal).toBe(1700);
    expect(w.avgProtein).toBe(60);
    expect(w.daysOnTarget).toBe(2);
  });

  it('streak counts back from today, or from yesterday when today is empty', () => {
    const d = (date: string, meals: number) => ({ date, totals: n(meals ? 1500 : 0), meals });
    expect(summarizeWeek([d('2026-10-08', 0), d('2026-10-09', 2), d('2026-10-10', 1), d('2026-10-11', 3)], 2000).streak).toBe(3);
    expect(summarizeWeek([d('2026-10-09', 2), d('2026-10-10', 1), d('2026-10-11', 0)], 2000).streak).toBe(2);
    expect(summarizeWeek([d('2026-10-09', 2), d('2026-10-10', 0), d('2026-10-11', 3)], 2000).streak).toBe(1);
  });

  it('day keys use the local calendar day', () => {
    expect(dayKey(new Date(2026, 9, 13, 23, 59))).toBe('2026-10-13');
    expect(lastNDays(3, new Date(2026, 9, 13))).toEqual(['2026-10-11', '2026-10-12', '2026-10-13']);
    expect(lastNDays(2, new Date(2026, 10, 1))).toEqual(['2026-10-31', '2026-11-01']);
  });
});

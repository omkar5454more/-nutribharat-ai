import { describe, expect, it } from 'vitest';
import { badges, lastDates, summarizeDays, symptomSeries, type DayRecord } from './insights';
import { groceryList, planDays, substitutionsFor, weekCost } from './weekplan';
import { computeTargets } from './goals';

const day = (o: Partial<DayRecord> = {}): DayRecord => ({ date: '2026-10-14', kcal: null, protein_g: null, mealsLogged: 0, waterMl: null, sleepHours: null, steps: null, exerciseMin: null, workoutDone: false, routineDone: 0, routineTotal: 0, mood: null, symptoms: 0, ...o });

describe('summarizeDays', () => {
  it('averages only over days that have data, and counts them', () => {
    const s = summarizeDays([day({ kcal: 1800, mealsLogged: 3 }), day({ kcal: 2000, mealsLogged: 4 }), day()], 2000);
    expect(s.kcal).toEqual({ value: 1900, n: 2 });
    expect(s.mealDays).toBe(2);
    expect(s.loggedDays).toBe(2);
  });
  it('an unlogged day is "not logged", not zero', () => {
    const s = summarizeDays([day(), day(), day()], 2000);
    expect(s.kcal.value).toBeNull();
    expect(s.sleep.value).toBeNull();
    expect(s.routinePct).toBeNull();
  });
  it('counts water goal days, workouts, symptom days and routine completion', () => {
    const s = summarizeDays([day({ waterMl: 2000, workoutDone: true, routineDone: 4, routineTotal: 8, symptoms: 1 }), day({ waterMl: 800, routineDone: 2, routineTotal: 8 })], 2000);
    expect(s.water.goalDays).toBe(1);
    expect(s.workouts).toBe(1);
    expect(s.symptomDays).toBe(1);
    expect(s.routinePct).toBe(38);
  });
});

describe('series and dates', () => {
  it('builds the last n dates oldest first, across a month boundary', () => {
    expect(lastDates('2026-11-02', 4)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
  it('symptom series gives a count and the highest severity per day', () => {
    const s = symptomSeries([{ date: '2026-10-13', severity: 4 }, { date: '2026-10-13', severity: 7 }], ['2026-10-12', '2026-10-13']);
    expect(s).toEqual([{ date: '2026-10-12', count: 0, maxSeverity: 0 }, { date: '2026-10-13', count: 2, maxSeverity: 7 }]);
  });
});

describe('badges', () => {
  const none = { mealDays: 0, waterGoalDays: 0, workoutsDone: 0, checkIns: 0, flexPlanned: false, routineDays: 0, moodDays: 0, sleepLogs: 0, weightLogs: 0 };
  it('nothing is unlocked at the start, and progress is capped at the target', () => {
    expect(badges(none).every((b) => !b.unlocked)).toBe(true);
    const b = badges({ ...none, mealDays: 30 }).find((x) => x.id === 'meals_7')!;
    expect(b).toMatchObject({ unlocked: true, progress: 7, target: 7 });
  });
  it('milestones are totals: more data never removes a badge', () => {
    const a = badges({ ...none, mealDays: 7 }).filter((b) => b.unlocked).length;
    const c = badges({ ...none, mealDays: 7, moodDays: 1 }).filter((b) => b.unlocked).length;
    expect(c).toBeGreaterThanOrEqual(a);
  });
});

describe('weekly plan and grocery list', () => {
  const targets = computeTargets({ sex: 'female', age: 30, height_cm: 160, weight_kg: 60, activity: 'light', goal: 'maintain', reproductive: 'none' });
  const plans = planDays({ targets, diet: 'veg', region: 'any', allergies: [], days: 7 });
  it('makes 7 days that all respect the diet', () => {
    expect(plans).toHaveLength(7);
    for (const p of plans) for (const s of p.slots) for (const i of s.items) expect(['chicken-curry', 'fish-curry', 'egg-boiled', 'butter-chicken', 'chicken-biryani']).not.toContain(i.foodId);
  });
  it('the days are not all identical', () => {
    expect(new Set(plans.map((p) => p.slots.map((s) => s.items.map((i) => i.foodId).join('+')).join('|'))).size).toBeGreaterThan(2);
  });
  it('grocery list adds up the plan and its cost matches the week', () => {
    const list = groceryList(plans);
    const total = list.reduce((a, l) => a + l.cost, 0);
    expect(Math.abs(total - weekCost(plans))).toBeLessThan(list.length + 7);
    expect(list.every((l) => l.grams > 0)).toBe(true);
  });
  it('substitutions respect diet and allergies', () => {
    expect(substitutionsFor('paneer', 'veg', [])).not.toContain('chicken-curry');
    expect(substitutionsFor('paneer', 'veg', [])).not.toContain('egg-boiled');
    expect(substitutionsFor('curd', 'veg', ['milk'])).toEqual([]);
    expect(substitutionsFor('unknown', 'veg', [])).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { computeTargets } from './goals';
import { costOf, missingPrices } from './prices';
import { planDay, type DietPref } from './planner';

const targets = computeTargets({ sex: 'female', age: 30, height_cm: 160, weight_kg: 60, activity: 'light', goal: 'maintain', reproductive: 'none' });

describe('prices', () => {
  it('every food has a price, and cost scales with grams', () => {
    expect(missingPrices()).toEqual([]);
    expect(costOf('roti', 80)).toBeCloseTo(6.4, 5);
    expect(costOf('roti', -5)).toBe(0);
    expect(costOf('nope', 100)).toBe(0);
  });
});

describe('budget planner', () => {
  it('reports a cost for every plan, with or without a budget', () => {
    const plan = planDay({ targets, diet: 'any', region: 'any' });
    expect(plan.totalCost).toBeGreaterThan(0);
    expect(plan.totalCost).toBe(Math.round(plan.slots.reduce((a, s) => a + s.cost, 0)));
    expect(plan.overBudget).toBe(false);
  });

  it('a lower budget gives a cheaper plan on average', () => {
    const avg = (budget?: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 30; seed++) sum += planDay({ targets, diet: 'any', region: 'any', seed, budget }).totalCost;
      return sum / 30;
    };
    expect(avg(120)).toBeLessThan(avg(undefined));
  });

  it('stays within a comfortable budget (many seeds, all diets)', () => {
    for (const diet of ['any', 'veg', 'vegan', 'egg'] as DietPref[]) {
      for (let seed = 1; seed <= 20; seed++) {
        const plan = planDay({ targets, diet, region: 'any', seed, budget: 300 });
        expect(plan.overBudget, `${diet}/${seed}`).toBe(false);
        expect(plan.totalCost).toBeLessThanOrEqual(300);
      }
    }
  });

  it('keeps the calories on target even on a tight budget', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const plan = planDay({ targets, diet: 'veg', region: 'any', seed, budget: 100 });
      expect(Math.abs(plan.totals.kcal - targets.kcal) / targets.kcal).toBeLessThan(0.25);
    }
  });

  it('says so when the budget is too small instead of pretending', () => {
    const plan = planDay({ targets, diet: 'any', region: 'any', budget: 20 });
    expect(plan.overBudget).toBe(true);
    expect(plan.slots).toHaveLength(4);
    expect(plan.totalCost).toBeGreaterThan(20);
  });
});

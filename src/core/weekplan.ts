import { FOOD_BY_ID } from './foods';
import { dietAllows, excludedByAllergies, planDay, type DayPlan, type DietPref } from './planner';
import { costOf } from './prices';
import type { Constraints } from './health/safety';
import type { Targets } from './types';

export type WeekOpts = { targets: Targets; diet: DietPref; region: Parameters<typeof planDay>[0]['region']; allergies: string[]; budget?: number; constraints?: Constraints | null; cooking?: 'quick' | 'normal' | 'long'; startSeed?: number; days?: number };

/** One plan per day. Each day uses a different seed so meals vary, and the same dish does not repeat back-to-back where the planner can avoid it. */
export function planDays(o: WeekOpts): DayPlan[] {
  const n = o.days ?? 7;
  return Array.from({ length: n }, (_, i) => planDay({ targets: o.targets, diet: o.diet, region: o.region, allergies: o.allergies, budget: o.budget, constraints: o.constraints ?? null, cooking: o.cooking, seed: (o.startSeed ?? 1) + i * 7 }));
}

export type GroceryLine = { foodId: string; grams: number; cost: number; times: number };

/** Total grams per food across the plan, with a rough ₹ cost. Quantities are what the plan uses as eaten — cooked weights, not raw shopping weights. */
export function groceryList(plans: DayPlan[]): GroceryLine[] {
  const m = new Map<string, GroceryLine>();
  for (const p of plans) for (const s of p.slots) for (const it of s.items) {
    const cur = m.get(it.foodId) ?? { foodId: it.foodId, grams: 0, cost: 0, times: 0 };
    cur.grams += it.grams; cur.cost += costOf(it.foodId, it.grams); cur.times += 1;
    m.set(it.foodId, cur);
  }
  return [...m.values()].map((l) => ({ ...l, grams: Math.round(l.grams / 10) * 10, cost: Math.round(l.cost) })).sort((a, b) => b.cost - a.cost);
}

export const weekCost = (plans: DayPlan[]) => plans.reduce((a, p) => a + p.totalCost, 0);

const GROUPS: string[][] = [
  ['roti', 'bhakri', 'thepla', 'paratha', 'rice', 'khichdi', 'veg-pulao'],
  ['dal-tadka', 'rajma', 'chana-masala', 'moong-chilla', 'paneer', 'egg-boiled', 'chicken-curry', 'fish-curry'],
  ['curd', 'milk', 'raita', 'lassi'],
  ['mixed-veg', 'aloo-gobi', 'palak-paneer'],
  ['poha', 'upma', 'idli', 'dosa', 'dhokla', 'sabudana-khichdi'],
  ['banana', 'apple'],
];

/** Swaps from the same food group that fit the person's diet and allergies. A suggestion only; portions and nutrition are recalculated in the app. */
export function substitutionsFor(foodId: string, diet: DietPref, allergies: string[]): string[] {
  const banned = excludedByAllergies(allergies).foods;
  const g = GROUPS.find((x) => x.includes(foodId));
  if (!g) return [];
  return g.filter((id) => id !== foodId && FOOD_BY_ID[id] && dietAllows(diet, FOOD_BY_ID[id]) && !banned.has(id)).slice(0, 3);
}

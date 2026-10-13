import type { Food, MealItem, Nutrients } from './types';

export const ZERO: Nutrients = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Nutrients for `grams` of a food. This is the ONLY place meal numbers are computed — the AI never supplies them. */
export function nutrientsFor(food: Food, grams: number): Nutrients {
  const k = Math.max(0, grams) / 100;
  const p = food.per100g;
  return {
    kcal: Math.round(p.kcal * k),
    protein_g: r1(p.protein_g * k),
    carbs_g: r1(p.carbs_g * k),
    fat_g: r1(p.fat_g * k),
    fiber_g: r1(p.fiber_g * k),
  };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const t = list.reduce(
    (a, n) => ({
      kcal: a.kcal + n.kcal,
      protein_g: a.protein_g + n.protein_g,
      carbs_g: a.carbs_g + n.carbs_g,
      fat_g: a.fat_g + n.fat_g,
      fiber_g: a.fiber_g + n.fiber_g,
    }),
    ZERO
  );
  return { kcal: Math.round(t.kcal), protein_g: r1(t.protein_g), carbs_g: r1(t.carbs_g), fat_g: r1(t.fat_g), fiber_g: r1(t.fiber_g) };
}

export function makeItem(food: Food, grams: number, source: MealItem['source'], confidence?: number): MealItem {
  return { foodId: food.id, name: food.name, grams, nutrients: nutrientsFor(food, grams), source, confidence };
}

/** grams for "quantity x household unit", e.g. (roti, '1 roti', 2) -> 80 g. Falls back to the first unit. */
export function gramsFor(food: Food, quantity: number, unitName?: string): number {
  const unit = food.units.find((u) => u.name === unitName) ?? food.units[0];
  return Math.round(unit.grams * Math.max(0, quantity));
}

export function mealTotals(items: MealItem[]): Nutrients {
  return sumNutrients(items.map((i) => i.nutrients));
}

/** Share of energy from each macro, for the dashboard bar. */
export function macroSplit(n: Nutrients) {
  const p = n.protein_g * 4, c = n.carbs_g * 4, f = n.fat_g * 9;
  const total = p + c + f || 1;
  return { protein: p / total, carbs: c / total, fat: f / total };
}

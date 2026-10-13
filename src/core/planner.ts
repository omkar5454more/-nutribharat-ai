import { FOOD_BY_ID } from './foods';
import { makeItem, mealTotals, sumNutrients } from './nutrition';
import type { Food, MealItem, Nutrients, Targets } from './types';

export type Region = 'any' | 'maharashtrian' | 'north' | 'south' | 'gujarati';
export type Slot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type DietPref = 'any' | 'veg' | 'egg' | 'non-veg' | 'vegan' | 'jain';

/** Share of the daily calories each slot should carry. */
const SLOT_SHARE: Record<Slot, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };

type Combo = { slot: Slot; region: Region | 'pan'; jain?: boolean; parts: [foodId: string, grams: number][] };

/** Everyday Indian combinations. Quantities are typical servings; the generator scales them to the calorie target. */
const COMBOS: Combo[] = [
  // breakfast
  { slot: 'breakfast', region: 'maharashtrian', parts: [['poha', 200], ['chai', 150]] },
  { slot: 'breakfast', region: 'maharashtrian', parts: [['sabudana-khichdi', 200], ['curd', 100]] },
  { slot: 'breakfast', region: 'maharashtrian', parts: [['misal', 250], ['pav', 70]] },
  { slot: 'breakfast', region: 'south', parts: [['idli', 120], ['sambar', 150], ['chai', 150]] },
  { slot: 'breakfast', region: 'south', parts: [['dosa', 90], ['sambar', 150]] },
  { slot: 'breakfast', region: 'south', parts: [['upma', 200], ['chai', 150]] },
  { slot: 'breakfast', region: 'north', parts: [['paratha', 80], ['curd', 100], ['chai', 150]] },
  { slot: 'breakfast', region: 'north', parts: [['moong-chilla', 140], ['curd', 100]] },
  { slot: 'breakfast', region: 'gujarati', parts: [['thepla', 80], ['curd', 100], ['chai', 150]] },
  { slot: 'breakfast', region: 'gujarati', jain: true, parts: [['dhokla', 160], ['chai', 150]] },
  { slot: 'breakfast', region: 'pan', parts: [['egg-boiled', 100], ['roti', 80], ['chai', 150]] },
  { slot: 'breakfast', region: 'pan', jain: true, parts: [['milk', 250], ['banana', 100], ['roti', 40]] },
  { slot: 'breakfast', region: 'pan', parts: [['poha', 200], ['banana', 100]] },
  { slot: 'breakfast', region: 'pan', parts: [['sabudana-khichdi', 200], ['apple', 100]] },
  // lunch
  { slot: 'lunch', region: 'pan', parts: [['roti', 120], ['dal-tadka', 150], ['mixed-veg', 100], ['rice', 100], ['curd', 100]] },
  { slot: 'lunch', region: 'north', parts: [['roti', 80], ['rajma', 150], ['rice', 150], ['curd', 100]] },
  { slot: 'lunch', region: 'north', parts: [['roti', 80], ['chana-masala', 150], ['rice', 100], ['raita', 100]] },
  { slot: 'lunch', region: 'north', parts: [['roti', 80], ['paneer-curry', 150], ['mixed-veg', 100]] },
  { slot: 'lunch', region: 'maharashtrian', parts: [['bhakri', 120], ['dal-tadka', 150], ['mixed-veg', 100], ['curd', 100]] },
  { slot: 'lunch', region: 'maharashtrian', parts: [['roti', 80], ['dal-tadka', 150], ['rice', 150], ['mixed-veg', 100]] },
  { slot: 'lunch', region: 'south', parts: [['rice', 200], ['sambar', 150], ['mixed-veg', 100], ['curd', 100]] },
  { slot: 'lunch', region: 'gujarati', parts: [['thepla', 80], ['dal-tadka', 150], ['mixed-veg', 100], ['curd', 100]] },
  { slot: 'lunch', region: 'gujarati', jain: true, parts: [['roti', 80], ['dal-tadka', 150], ['rice', 100], ['curd', 100]] },
  { slot: 'lunch', region: 'pan', parts: [['roti', 80], ['chicken-curry', 150], ['rice', 100], ['mixed-veg', 100]] },
  { slot: 'lunch', region: 'pan', parts: [['roti', 80], ['fish-curry', 150], ['rice', 150]] },
  { slot: 'lunch', region: 'pan', parts: [['veg-biryani', 250], ['raita', 100]] },
  { slot: 'lunch', region: 'pan', parts: [['roti', 120], ['dal-tadka', 150], ['mixed-veg', 100], ['rice', 100]] },
  { slot: 'lunch', region: 'pan', parts: [['roti', 80], ['rajma', 150], ['rice', 150], ['mixed-veg', 100]] },
  // snack
  { slot: 'snack', region: 'pan', jain: true, parts: [['banana', 100], ['milk', 150]] },
  { slot: 'snack', region: 'pan', jain: true, parts: [['curd', 150], ['apple', 100]] },
  { slot: 'snack', region: 'pan', jain: true, parts: [['lassi', 250]] },
  { slot: 'snack', region: 'pan', parts: [['egg-boiled', 100]] },
  { slot: 'snack', region: 'gujarati', jain: true, parts: [['dhokla', 120]] },
  { slot: 'snack', region: 'north', parts: [['moong-chilla', 70], ['chai', 150]] },
  { slot: 'snack', region: 'pan', jain: true, parts: [['apple', 150]] },
  // dinner
  { slot: 'dinner', region: 'pan', parts: [['roti', 80], ['dal-tadka', 150], ['mixed-veg', 150]] },
  { slot: 'dinner', region: 'pan', jain: true, parts: [['khichdi', 250], ['curd', 100]] },
  { slot: 'dinner', region: 'north', parts: [['roti', 80], ['palak-paneer', 150], ['raita', 100]] },
  { slot: 'dinner', region: 'north', parts: [['roti', 80], ['dal-makhani', 150], ['aloo-gobi', 100]] },
  { slot: 'dinner', region: 'maharashtrian', parts: [['bhakri', 120], ['mixed-veg', 150], ['dal-tadka', 100]] },
  { slot: 'dinner', region: 'south', parts: [['dosa', 180], ['sambar', 150]] },
  { slot: 'dinner', region: 'south', parts: [['idli', 160], ['sambar', 200]] },
  { slot: 'dinner', region: 'pan', parts: [['roti', 80], ['chicken-curry', 150], ['mixed-veg', 100]] },
  { slot: 'dinner', region: 'pan', parts: [['rice', 150], ['fish-curry', 150], ['mixed-veg', 100]] },
  { slot: 'dinner', region: 'pan', parts: [['roti', 80], ['egg-boiled', 100], ['mixed-veg', 150]] },
  { slot: 'dinner', region: 'gujarati', jain: true, parts: [['roti', 80], ['dal-tadka', 150], ['rice', 100]] },
  { slot: 'dinner', region: 'pan', parts: [['roti', 80], ['rajma', 150], ['mixed-veg', 100]] },
];

// ---------------------------------------------------------------- allergies
/** Foods to avoid for each allergy word we know how to check. Anything else is reported back as "unchecked". */
const ALLERGEN_FOODS: Record<string, string[]> = {
  milk: ['milk', 'curd', 'raita', 'lassi', 'chai', 'paneer', 'paneer-curry', 'palak-paneer', 'butter-chicken', 'ghee-oil', 'dal-makhani', 'gulab-jamun', 'poha'],
  dairy: ['milk', 'curd', 'raita', 'lassi', 'chai', 'paneer', 'paneer-curry', 'palak-paneer', 'butter-chicken', 'ghee-oil', 'dal-makhani', 'gulab-jamun'],
  egg: ['egg-boiled'],
  eggs: ['egg-boiled'],
  fish: ['fish-curry'],
  wheat: ['roti', 'paratha', 'aloo-paratha', 'thepla', 'pav', 'vada-pav', 'chole-bhature', 'upma', 'samosa', 'misal'],
  gluten: ['roti', 'paratha', 'aloo-paratha', 'thepla', 'pav', 'vada-pav', 'chole-bhature', 'upma', 'samosa', 'misal'],
  peanut: ['poha', 'sabudana-khichdi', 'misal', 'vada-pav'],
  peanuts: ['poha', 'sabudana-khichdi', 'misal', 'vada-pav'],
};
const ALIAS: Record<string, string> = { 'groundnut': 'peanut', 'groundnuts': 'peanut', 'lactose': 'milk' };

export function excludedByAllergies(allergies: string[]): { foods: Set<string>; unchecked: string[] } {
  const foods = new Set<string>();
  const unchecked: string[] = [];
  for (const raw of allergies) {
    const a = ALIAS[raw.trim().toLowerCase()] ?? raw.trim().toLowerCase();
    if (!a) continue;
    if (ALLERGEN_FOODS[a]) ALLERGEN_FOODS[a].forEach((f) => foods.add(f));
    else unchecked.push(raw.trim());
  }
  return { foods, unchecked };
}

// ---------------------------------------------------------------- diet filter
const dietAllows = (diet: DietPref, food: Food): boolean => {
  switch (diet) {
    case 'vegan': return food.diet === 'vegan';
    case 'veg':
    case 'jain': return food.diet === 'vegan' || food.diet === 'veg';
    case 'egg': return food.diet !== 'non-veg';
    default: return true;
  }
};

// ---------------------------------------------------------------- generator
export type PlannedSlot = { slot: Slot; items: MealItem[]; totals: Nutrients; target_kcal: number };
export type DayPlan = {
  slots: PlannedSlot[];
  totals: Nutrients;
  /** allergy words we could not check against our foods — the UI must tell the user to check ingredients themselves */
  uncheckedAllergies: string[];
  /** slots for which no suitable combination exists under the chosen filters */
  emptySlots: Slot[];
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r5 = (g: number) => Math.max(5, Math.round(g / 5) * 5);

function scale(combo: Combo, targetKcal: number): MealItem[] {
  const base = combo.parts.map(([id, g]) => makeItem(FOOD_BY_ID[id], g, 'manual'));
  const kcal = base.reduce((a, i) => a + i.nutrients.kcal, 0) || 1;
  const f = Math.min(1.8, Math.max(0.6, targetKcal / kcal));
  return combo.parts.map(([id, g]) => makeItem(FOOD_BY_ID[id], r5(g * f), 'manual'));
}

export function planDay(opts: {
  targets: Pick<Targets, 'kcal' | 'protein_g'>;
  diet: DietPref;
  region: Region;
  allergies?: string[];
  seed?: number;
}): DayPlan {
  const { targets, diet, region, allergies = [], seed = 1 } = opts;
  const rnd = mulberry32(seed);
  const { foods: banned, unchecked } = excludedByAllergies(allergies);

  const allowed = (anyRegion: boolean) =>
    COMBOS.filter((c) => {
      if (diet === 'jain' && !c.jain) return false;
      if (!anyRegion && region !== 'any' && c.region !== region && c.region !== 'pan') return false;
      return c.parts.every(([id]) => FOOD_BY_ID[id] && dietAllows(diet, FOOD_BY_ID[id]) && !banned.has(id));
    });
  const usable = allowed(false);

  const used = new Set<Combo>();
  const slots: PlannedSlot[] = [];
  const emptySlots: Slot[] = [];
  for (const slot of ['breakfast', 'lunch', 'snack', 'dinner'] as Slot[]) {
    const target_kcal = Math.round(targets.kcal * SLOT_SHARE[slot]);
    const targetProtein = targets.protein_g * SLOT_SHARE[slot];
    let pool = usable.filter((c) => c.slot === slot && !used.has(c));
    if (!pool.length) pool = usable.filter((c) => c.slot === slot);
    if (!pool.length) pool = allowed(true).filter((c) => c.slot === slot);   // nothing in this region fits the diet: borrow from other regions
    if (!pool.length) {
      emptySlots.push(slot);
      continue;
    }
    // prefer region-specific combinations over the generic ones when a region is chosen
    const scored = pool
      .map((c) => {
        const items = scale(c, target_kcal);
        const t = mealTotals(items);
        const err = Math.abs(t.kcal - target_kcal) / Math.max(target_kcal, 1) + Math.max(0, targetProtein - t.protein_g) / Math.max(targetProtein, 1) * 0.5;
        return { c, items, t, score: err - (region !== 'any' && c.region === region ? 0.15 : 0) };
      })
      .sort((a, b) => a.score - b.score);
    const pick = scored[Math.floor(rnd() * Math.min(3, scored.length))];
    used.add(pick.c);
    slots.push({ slot, items: pick.items, totals: pick.t, target_kcal });
  }
  return { slots, totals: sumNutrients(slots.map((s) => s.totals)), uncheckedAllergies: unchecked, emptySlots };
}

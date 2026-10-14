import { FOOD_BY_ID } from '../foods';

export type FoodTag = 'high_sodium' | 'high_sugar' | 'high_sat_fat' | 'fried' | 'refined_carb' | 'high_carb' | 'iron_rich' | 'fiber_rich' | 'high_protein' | 'spicy' | 'caffeine' | 'dairy' | 'heavy';

/**
 * Rough descriptive tags for the starter food table, used only to PREFER or LIMIT foods in plans and to show gentle, factual notes.
 * They describe typical preparations — homemade versions vary — and are NOT medical classifications. Have a dietitian review them.
 * A tag never means a food is "good" or "bad"; it only means "relevant to".
 */
export const FOOD_TAGS: Record<string, FoodTag[]> = {
  roti: ['high_carb'], paratha: ['high_carb', 'high_sat_fat'], 'aloo-paratha': ['high_carb', 'high_sat_fat'], bhakri: ['high_carb', 'fiber_rich'], thepla: ['high_carb'],
  rice: ['high_carb', 'refined_carb'], 'veg-pulao': ['high_carb', 'refined_carb'], khichdi: ['high_carb', 'fiber_rich'],
  'dal-tadka': ['fiber_rich', 'iron_rich', 'high_protein'], 'dal-makhani': ['fiber_rich', 'iron_rich', 'high_sat_fat', 'high_sodium'],
  rajma: ['fiber_rich', 'iron_rich', 'high_protein'], 'chana-masala': ['fiber_rich', 'iron_rich', 'high_protein', 'spicy'],
  'mixed-veg': ['fiber_rich'], 'aloo-gobi': ['high_carb'], 'palak-paneer': ['iron_rich', 'high_sat_fat', 'dairy', 'high_protein'],
  paneer: ['high_protein', 'dairy', 'high_sat_fat'], 'paneer-curry': ['high_sat_fat', 'dairy', 'spicy', 'high_sodium', 'high_protein'],
  'chicken-curry': ['high_protein', 'spicy'], 'butter-chicken': ['high_sat_fat', 'high_sodium', 'dairy', 'high_protein', 'heavy'],
  'fish-curry': ['high_protein', 'spicy'], 'egg-boiled': ['high_protein', 'iron_rich'],
  'chicken-biryani': ['high_carb', 'refined_carb', 'high_sodium', 'spicy', 'heavy', 'high_protein'], 'veg-biryani': ['high_carb', 'refined_carb', 'high_sodium', 'spicy', 'heavy'],
  curd: ['dairy', 'high_protein'], raita: ['dairy'], lassi: ['high_sugar', 'dairy'], milk: ['dairy'], chai: ['caffeine', 'high_sugar', 'dairy'],
  poha: ['refined_carb', 'high_carb'], upma: ['refined_carb', 'high_carb'], idli: ['high_carb'], dosa: ['refined_carb', 'high_carb'], 'masala-dosa': ['refined_carb', 'high_carb', 'heavy'],
  sambar: ['fiber_rich'], 'vada-south': ['fried', 'high_sodium'], dhokla: ['high_carb'], 'sabudana-khichdi': ['refined_carb', 'high_carb'],
  misal: ['spicy', 'fried', 'high_sodium', 'heavy', 'fiber_rich'], pav: ['refined_carb', 'high_carb'], 'vada-pav': ['fried', 'refined_carb', 'high_sodium', 'heavy', 'high_carb'],
  samosa: ['fried', 'high_sodium', 'refined_carb', 'heavy'], 'chole-bhature': ['fried', 'refined_carb', 'heavy', 'high_sodium', 'high_carb'],
  'moong-chilla': ['high_protein', 'fiber_rich'], 'gulab-jamun': ['high_sugar', 'fried', 'high_sat_fat', 'refined_carb'], jalebi: ['high_sugar', 'fried', 'refined_carb'],
  banana: ['high_carb'], apple: ['fiber_rich'], sugar: ['high_sugar'], pizza: ['refined_carb', 'high_sodium', 'high_sat_fat', 'heavy', 'dairy'],
};

export const tagsOf = (foodId: string): FoodTag[] => FOOD_TAGS[foodId] ?? [];
export const hasTag = (foodId: string, tag: FoodTag) => tagsOf(foodId).includes(tag);

/** Gentler options for a food, from the same table (used for "other ideas" — a suggestion, never an instruction). */
export const ALTERNATIVES: Record<string, string[]> = {
  samosa: ['dhokla', 'idli'], 'vada-pav': ['poha', 'idli'], 'chole-bhature': ['chana-masala', 'roti'], 'gulab-jamun': ['banana', 'apple'], jalebi: ['apple', 'banana'],
  'butter-chicken': ['chicken-curry'], 'dal-makhani': ['dal-tadka'], paratha: ['roti'], 'aloo-paratha': ['roti', 'moong-chilla'], 'masala-dosa': ['dosa', 'idli'],
  'chicken-biryani': ['chicken-curry', 'rice'], 'veg-biryani': ['veg-pulao', 'khichdi'], 'vada-south': ['idli', 'dosa'], pizza: ['roti', 'moong-chilla'],
  'paneer-curry': ['dal-tadka', 'chana-masala'], 'palak-paneer': ['dal-tadka', 'mixed-veg'], lassi: ['curd', 'milk'], misal: ['moong-chilla', 'poha'],
};

export function alternativesFor(foodId: string): string[] {
  return (ALTERNATIVES[foodId] ?? []).filter((id) => FOOD_BY_ID[id]);
}

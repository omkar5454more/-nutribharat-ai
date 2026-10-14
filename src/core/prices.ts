import { FOOD_BY_ID } from './foods';

/**
 * Rough cost in rupees of 100 g of each food AS EATEN (home-cooked or bought), typical metro prices.
 * These are ESTIMATES for budget planning only — prices differ by city and season. Replace with real data / let users edit them later.
 */
export const PRICE_PER_100G: Record<string, number> = {
  roti: 8, paratha: 14, 'aloo-paratha': 16, bhakri: 9, thepla: 12, rice: 6, 'veg-pulao': 12, khichdi: 9, 'dal-tadka': 9, 'dal-makhani': 18,
  rajma: 12, 'chana-masala': 12, 'mixed-veg': 10, 'aloo-gobi': 9, 'palak-paneer': 28, paneer: 38, 'paneer-curry': 30, 'chicken-curry': 32,
  'butter-chicken': 40, 'fish-curry': 38, 'egg-boiled': 14, 'chicken-biryani': 40, 'veg-biryani': 20, curd: 7, raita: 8, lassi: 9, milk: 6, chai: 6,
  poha: 9, upma: 8, idli: 8, dosa: 12, 'masala-dosa': 22, sambar: 7, 'vada-south': 20, dhokla: 14, 'sabudana-khichdi': 14, misal: 14, pav: 11,
  'vada-pav': 13, samosa: 20, 'chole-bhature': 20, 'moong-chilla': 12, 'gulab-jamun': 40, jalebi: 35, banana: 6, apple: 18, 'ghee-oil': 30, sugar: 5,
};

export const costOf = (foodId: string, grams: number): number => ((PRICE_PER_100G[foodId] ?? 0) * Math.max(0, grams)) / 100;

export const BUDGET_OPTIONS = [100, 150, 250] as const;

export function missingPrices(): string[] {
  return Object.keys(FOOD_BY_ID).filter((id) => PRICE_PER_100G[id] === undefined);
}

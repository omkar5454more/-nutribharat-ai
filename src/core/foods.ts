import type { Food } from './types';

/**
 * STARTER FOOD TABLE — approximate values per 100 g of the dish as eaten, typed in from common published ranges.
 * They are NOT taken from IFCT and are marked source: 'seed'. Before real users rely on them, replace/verify each row
 * against the Indian Food Composition Tables (IFCT 2017, NIN Hyderabad) under the right licence and set source: 'ifct'.
 * Homemade dishes vary a lot with oil and recipe, which is why the meal screen lets users correct portion and oil.
 */
type Row = [
  id: string, name: string, aliases: string[], cuisine: Food['cuisine'], diet: Food['diet'],
  kcal: number, protein: number, carbs: number, fat: number, fiber: number,
  units: [string, number][],
];

const rows: Row[] = [
  ['roti', 'Roti / Chapati', ['chapati', 'phulka', 'chapatti', 'poli', 'chapati roti', 'wheat roti'], 'pan-indian', 'vegan', 297, 9.8, 56, 3.7, 4.0, [['1 roti', 40], ['1 small phulka', 30]]],
  ['paratha', 'Paratha (plain)', ['plain paratha', 'parantha'], 'north', 'veg', 326, 7.5, 46, 12.5, 3.0, [['1 paratha', 80]]],
  ['aloo-paratha', 'Aloo Paratha', ['potato paratha', 'aloo parantha'], 'north', 'veg', 272, 5.5, 40, 10, 2.5, [['1 paratha', 100]]],
  ['bhakri', 'Bhakri (jowar)', ['jowar bhakri', 'jwari bhakri', 'bajra bhakri', 'bhakari'], 'maharashtrian', 'vegan', 277, 8, 58, 1.5, 5.0, [['1 bhakri', 60]]],
  ['thepla', 'Thepla', ['methi thepla', 'gujarati thepla'], 'gujarati', 'veg', 302, 8, 45, 10, 4.0, [['1 thepla', 40]]],
  ['rice', 'Rice (cooked, white)', ['steamed rice', 'plain rice', 'bhat', 'chawal', 'boiled rice', 'white rice'], 'basic', 'vegan', 126, 2.7, 28.2, 0.3, 0.4, [['1 katori', 150], ['1 plate', 250]]],
  ['veg-pulao', 'Veg Pulao', ['pulao', 'pulav', 'vegetable pulao', 'masale bhat'], 'pan-indian', 'veg', 148, 3, 24, 4.5, 1.5, [['1 katori', 150], ['1 plate', 250]]],
  ['khichdi', 'Dal Khichdi', ['khichdi', 'khichadi', 'moong khichdi'], 'pan-indian', 'veg', 121, 4.5, 19, 3, 2.0, [['1 katori', 200]]],
  ['dal-tadka', 'Dal (tadka)', ['dal', 'daal', 'toor dal', 'arhar dal', 'varan', 'amti', 'dal fry', 'yellow dal', 'moong dal'], 'pan-indian', 'vegan', 105, 5.5, 14, 3, 2.5, [['1 katori', 150]]],
  ['dal-makhani', 'Dal Makhani', ['black dal', 'maa ki dal'], 'north', 'veg', 141, 5.5, 14, 7, 3.0, [['1 katori', 150]]],
  ['rajma', 'Rajma Masala', ['rajma', 'rajma curry', 'kidney bean curry'], 'north', 'vegan', 122, 5.5, 16, 4, 4.0, [['1 katori', 150]]],
  ['chana-masala', 'Chana Masala', ['chole', 'chhole', 'chickpea curry', 'chana', 'chole masala'], 'north', 'vegan', 139, 6.5, 17, 5, 5.0, [['1 katori', 150]]],
  ['mixed-veg', 'Mixed Vegetable Sabzi', ['sabzi', 'sabji', 'bhaji', 'vegetable curry', 'veg sabzi', 'mix veg', 'dry sabzi'], 'pan-indian', 'vegan', 90, 2.2, 9, 5, 2.5, [['1 katori', 100]]],
  ['aloo-gobi', 'Aloo Gobi', ['aloo gobhi', 'potato cauliflower'], 'north', 'vegan', 85, 2.2, 9, 4.5, 2.5, [['1 katori', 100]]],
  ['palak-paneer', 'Palak Paneer', ['spinach paneer', 'saag paneer'], 'north', 'veg', 151, 8, 5, 11, 2.0, [['1 katori', 150]]],
  ['paneer', 'Paneer', ['cottage cheese', 'paneer cubes', 'raw paneer'], 'basic', 'veg', 264, 18, 1.2, 20.8, 0, [['1 cube (25 g)', 25], ['100 g', 100]]],
  ['paneer-curry', 'Paneer Curry', ['paneer butter masala', 'shahi paneer', 'kadai paneer', 'paneer masala'], 'north', 'veg', 190, 9, 7, 14, 1.5, [['1 katori', 150]]],
  ['chicken-curry', 'Chicken Curry', ['chicken masala', 'kombdi rassa', 'murgh curry', 'chicken gravy'], 'pan-indian', 'non-veg', 148, 14, 4, 8.5, 1, [['1 katori', 150]]],
  ['butter-chicken', 'Butter Chicken', ['murgh makhani', 'chicken makhani'], 'north', 'non-veg', 189, 12, 6, 13, 1, [['1 katori', 150]]],
  ['fish-curry', 'Fish Curry', ['machli curry', 'fish masala', 'meen curry'], 'pan-indian', 'non-veg', 118, 12, 3, 6.5, 0.5, [['1 katori', 150]]],
  ['egg-boiled', 'Egg (boiled)', ['boiled egg', 'anda', 'hard boiled egg'], 'basic', 'egg', 150, 12.6, 1.1, 10.6, 0, [['1 egg', 50]]],
  ['chicken-biryani', 'Chicken Biryani', ['biryani', 'dum biryani', 'hyderabadi biryani', 'murgh biryani'], 'pan-indian', 'non-veg', 181, 8.5, 21, 7, 1, [['1 plate', 300]]],
  ['veg-biryani', 'Veg Biryani', ['vegetable biryani'], 'pan-indian', 'veg', 160, 3.5, 25, 5, 1.5, [['1 plate', 300]]],
  ['curd', 'Curd / Dahi', ['dahi', 'yogurt', 'yoghurt', 'plain curd', 'dahi katori'], 'basic', 'veg', 62, 3.5, 4.7, 3.3, 0, [['1 katori', 100]]],
  ['raita', 'Raita', ['boondi raita', 'cucumber raita', 'veg raita'], 'north', 'veg', 55, 2.8, 5, 2.5, 0.3, [['1 katori', 100]]],
  ['lassi', 'Lassi (sweet)', ['sweet lassi', 'mattha', 'chaas', 'buttermilk'], 'beverage', 'veg', 90, 3, 14, 2.5, 0, [['1 glass', 250]]],
  ['milk', 'Milk (full cream)', ['doodh', 'cow milk', 'full cream milk'], 'beverage', 'veg', 62, 3.2, 4.8, 3.4, 0, [['1 glass', 250]]],
  ['chai', 'Masala Chai (with milk & sugar)', ['tea', 'chai', 'milk tea', 'cutting chai'], 'beverage', 'veg', 51, 1.2, 7, 2, 0, [['1 cup', 150], ['1 cutting', 75]]],
  ['poha', 'Poha', ['kanda poha', 'flattened rice', 'batata poha', 'aloo poha'], 'maharashtrian', 'vegan', 129, 2.5, 23, 3, 1.5, [['1 plate', 200]]],
  ['upma', 'Upma', ['rava upma', 'sooji upma', 'semolina upma'], 'south', 'vegan', 136, 3, 21, 4.5, 1.5, [['1 plate', 200]]],
  ['idli', 'Idli', ['idly', 'steamed rice cake'], 'south', 'vegan', 135, 3.9, 29, 0.4, 1.0, [['1 idli', 40], ['2 idlis', 80]]],
  ['dosa', 'Dosa (plain)', ['plain dosa', 'sada dosa', 'dosai'], 'south', 'vegan', 167, 3.9, 29.5, 3.7, 1.0, [['1 dosa', 90]]],
  ['masala-dosa', 'Masala Dosa', ['dosa masala'], 'south', 'vegan', 190, 4, 28, 7, 2, [['1 dosa', 180]]],
  ['sambar', 'Sambar', ['sambhar', 'sambar katori'], 'south', 'vegan', 60, 3, 8, 1.8, 2.0, [['1 katori', 150]]],
  ['vada-south', 'Medu Vada', ['medu wada', 'urad vada', 'vada sambar'], 'south', 'vegan', 290, 9, 30, 15, 3, [['1 vada', 50]]],
  ['dhokla', 'Dhokla', ['khaman', 'khaman dhokla', 'khaman dhokla'], 'gujarati', 'veg', 160, 6, 25, 4, 2, [['1 piece', 40], ['4 pieces', 160]]],
  ['sabudana-khichdi', 'Sabudana Khichdi', ['sabudana', 'sago khichdi', 'sabudana khichadi'], 'maharashtrian', 'vegan', 191, 2, 30, 7, 1, [['1 plate', 200]]],
  ['misal', 'Misal (usal with farsan)', ['misal pav', 'usal', 'kolhapuri misal', 'missal'], 'maharashtrian', 'vegan', 163, 7, 18, 7, 4, [['1 plate', 250]]],
  ['pav', 'Pav (bread roll)', ['ladi pav', 'pao', 'bun', 'dinner roll'], 'street', 'veg', 269, 8, 48, 5, 2, [['1 pav', 35]]],
  ['vada-pav', 'Vada Pav', ['wada pav', 'batata vada pav', 'batata wada pav'], 'street', 'veg', 242, 5, 33, 10, 3, [['1 vada pav', 120]]],
  ['samosa', 'Samosa', ['samosa aloo', 'punjabi samosa'], 'street', 'veg', 267, 4.5, 24, 17, 2, [['1 samosa', 60]]],
  ['chole-bhature', 'Chole Bhature', ['chhole bhature', 'bhature', 'bhatura'], 'north', 'veg', 333, 7, 47, 13, 3, [['1 bhatura', 90]]],
  ['moong-chilla', 'Moong Dal Chilla', ['chilla', 'cheela', 'besan chilla', 'pudla'], 'north', 'veg', 170, 9, 20, 6, 3, [['1 chilla', 70]]],
  ['gulab-jamun', 'Gulab Jamun', ['gulabjamun'], 'street', 'veg', 319, 5, 50, 11, 0.5, [['1 piece', 40]]],
  ['jalebi', 'Jalebi', ['jilebi'], 'street', 'veg', 374, 2, 60, 14, 0, [['1 piece', 30]]],
  ['pizza', 'Pizza', ['pizza slice', 'piza', 'cheese pizza'], 'street', 'veg', 266, 11, 33, 10, 2.3, [['1 slice', 107], ['2 slices', 214]]],
  ['banana', 'Banana', ['kela', 'banana ripe'], 'basic', 'vegan', 89, 1.1, 22.8, 0.3, 2.6, [['1 medium', 100]]],
  ['apple', 'Apple', ['seb'], 'basic', 'vegan', 52, 0.3, 13.8, 0.2, 2.4, [['1 medium', 150]]],
  ['ghee-oil', 'Ghee / Cooking oil (added)', ['ghee', 'oil', 'tel', 'butter', 'tup'], 'basic', 'veg', 900, 0, 0, 100, 0, [['1 tsp', 5], ['1 tbsp', 14]]],
  ['sugar', 'Sugar', ['cheeni', 'saakhar', 'sakkar'], 'basic', 'vegan', 387, 0, 100, 0, 0, [['1 tsp', 5]]],
];

export const FOODS: Food[] = rows.map(([id, name, aliases, cuisine, diet, kcal, protein_g, carbs_g, fat_g, fiber_g, units]) => ({
  id,
  name,
  aliases,
  cuisine,
  diet,
  per100g: { kcal, protein_g, carbs_g, fat_g, fiber_g },
  units: units.map(([n, grams]) => ({ name: n, grams })),
  source: 'seed' as const,
}));

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

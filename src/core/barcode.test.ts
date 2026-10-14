import { describe, expect, it } from 'vitest';
import { cleanBarcode, isValidBarcode, LabelSchema, parseOpenFoodFacts } from './barcode';
import { makeCustomItem, mealTotals, withGrams } from './nutrition';

describe('barcode validation', () => {
  it.each(['8901058000290', '4006381333931', '5449000000996', '012345678905', '96385074'])('%s is valid', (c) => {
    expect(isValidBarcode(c)).toBe(true);
  });

  it.each(['8901058000291', '123', '', 'abcdefghijklm', '89010580002901234'])('%s is rejected', (c) => {
    expect(isValidBarcode(c)).toBe(false);
  });

  it('ignores spaces and dashes', () => {
    expect(cleanBarcode('8901 0580-00290')).toBe('8901058000290');
    expect(isValidBarcode('8901 0580 00290')).toBe(true);
  });
});

describe('Open Food Facts parsing', () => {
  const good = {
    status: 1,
    product: { product_name: 'Instant Noodles', brands: 'Maggi, Nestle', serving_quantity: 70, nutriments: { 'energy-kcal_100g': 436, proteins_100g: 9.2, carbohydrates_100g: 61.4, fat_100g: 16.5, fiber_100g: 2.1 } },
  };

  it('reads per-100 g values, brand and serving size', () => {
    const r = parseOpenFoodFacts(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.product).toEqual({ name: 'Instant Noodles', brand: 'Maggi', per100g: { kcal: 436, protein_g: 9.2, carbs_g: 61.4, fat_g: 16.5, fiber_g: 2.1 }, servingGrams: 70 });
    }
  });

  it('converts kJ when kcal is missing', () => {
    const r = parseOpenFoodFacts({ status: 1, product: { product_name: 'X', nutriments: { energy_100g: 1000, proteins_100g: 5 } } });
    expect(r.ok && r.product.per100g.kcal).toBe(239);
  });

  it('accepts numeric strings and ignores junk servings', () => {
    const r = parseOpenFoodFacts({ status: 1, product: { product_name: 'Y', serving_quantity: '50000', nutriments: { 'energy-kcal_100g': '120', proteins_100g: '3', fat_100g: '' } } });
    expect(r.ok && r.product.per100g).toEqual({ kcal: 120, protein_g: 3, carbs_g: 0, fat_g: 0, fiber_g: 0 });
    expect(r.ok && r.product.servingGrams).toBeNull();
  });

  it('reports not found, missing nutrition and bad responses instead of guessing', () => {
    expect(parseOpenFoodFacts({ status: 0, status_verbose: 'product not found' })).toEqual({ ok: false, reason: 'not_found' });
    expect(parseOpenFoodFacts({ status: 1, product: { product_name: 'No data', nutriments: {} } })).toEqual({ ok: false, reason: 'no_nutrition' });
    expect(parseOpenFoodFacts({ status: 1, product: { product_name: 'Only energy', nutriments: { 'energy-kcal_100g': 100 } } })).toEqual({ ok: false, reason: 'no_nutrition' });
    expect(parseOpenFoodFacts('nonsense')).toEqual({ ok: false, reason: 'bad_response' });
    expect(parseOpenFoodFacts({ status: 1, product: { nutriments: { 'energy-kcal_100g': -5, proteins_100g: 1 } } })).toEqual({ ok: false, reason: 'bad_response' });
  });

  it('names an unnamed product safely', () => {
    const r = parseOpenFoodFacts({ status: 1, product: { nutriments: { 'energy-kcal_100g': 50, proteins_100g: 1 } } });
    expect(r.ok && r.product.name).toBe('Packaged food');
  });
});

describe('custom items', () => {
  const per100g = { kcal: 500, protein_g: 10, carbs_g: 60, fat_g: 20, fiber_g: 4 };

  it('scales by grams and re-scales without a food lookup', () => {
    const item = makeCustomItem('pkg:8901058000290', 'Biscuits', per100g, 30);
    expect(item.nutrients.kcal).toBe(150);
    const bigger = withGrams(item, 60);
    expect(bigger.nutrients.kcal).toBe(300);
    expect(bigger.foodId).toBe('pkg:8901058000290');
    expect(mealTotals([item, bigger]).kcal).toBe(450);
  });

  it('validates label entry', () => {
    expect(LabelSchema.safeParse({ name: 'Bhel', kcal: '350', protein_g: '8', carbs_g: '60', fat_g: '9' }).success).toBe(true);
    expect(LabelSchema.safeParse({ name: '', kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 }).success).toBe(false);
    expect(LabelSchema.safeParse({ name: 'x', kcal: 5000, protein_g: 1, carbs_g: 1, fat_g: 1 }).success).toBe(false);
    expect(LabelSchema.safeParse({ name: 'x', kcal: 100, protein_g: -1, carbs_g: 1, fat_g: 1 }).success).toBe(false);
  });
});

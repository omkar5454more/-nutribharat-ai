import { z } from 'zod';
import type { Nutrients } from './types';

/** EAN-8 / UPC-A (12) / EAN-13 / GTIN-14 with the GS1 check digit. Indian packaged foods use EAN-13 (890…). */
export function isValidBarcode(raw: string): boolean {
  const code = raw.replace(/\s|-/g, '');
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export const cleanBarcode = (raw: string) => raw.replace(/\s|-/g, '');

const num = z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().finite().nonnegative().optional());

const OffSchema = z.object({
  status: z.number().optional(),
  product: z
    .object({
      product_name: z.string().optional(),
      product_name_en: z.string().optional(),
      brands: z.string().optional(),
      serving_quantity: num,
      nutriments: z
        .object({
          'energy-kcal_100g': num,
          energy_100g: num, // kJ
          proteins_100g: num,
          carbohydrates_100g: num,
          fat_100g: num,
          fiber_100g: num,
        })
        .partial()
        .optional(),
    })
    .optional(),
});

export type Product = { name: string; brand: string; per100g: Nutrients; servingGrams: number | null };
export type LookupResult = { ok: true; product: Product } | { ok: false; reason: 'not_found' | 'no_nutrition' | 'bad_response' };

/** Turns an Open Food Facts response into per-100 g nutrition, or says why it can't. Never invents missing numbers. */
export function parseOpenFoodFacts(json: unknown): LookupResult {
  const parsed = OffSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: 'bad_response' };
  const { status, product } = parsed.data;
  if (status === 0 || !product) return { ok: false, reason: 'not_found' };
  const n = product.nutriments ?? {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g !== undefined ? n.energy_100g / 4.184 : undefined);
  // energy plus at least one macro must be present, otherwise the entry is not useful
  if (kcal === undefined || (n.proteins_100g === undefined && n.carbohydrates_100g === undefined && n.fat_100g === undefined)) {
    return { ok: false, reason: 'no_nutrition' };
  }
  const r1 = (x: number | undefined) => Math.round((x ?? 0) * 10) / 10;
  return {
    ok: true,
    product: {
      name: (product.product_name || product.product_name_en || '').trim() || 'Packaged food',
      brand: (product.brands ?? '').split(',')[0].trim(),
      per100g: { kcal: Math.round(kcal), protein_g: r1(n.proteins_100g), carbs_g: r1(n.carbohydrates_100g), fat_g: r1(n.fat_100g), fiber_g: r1(n.fiber_100g) },
      servingGrams: product.serving_quantity && product.serving_quantity > 0 && product.serving_quantity <= 1000 ? Math.round(product.serving_quantity) : null,
    },
  };
}

/** Validates label values typed by the user for a food that is not in any database. */
export const LabelSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kcal: z.coerce.number().min(0).max(900),
  protein_g: z.coerce.number().min(0).max(100),
  carbs_g: z.coerce.number().min(0).max(100),
  fat_g: z.coerce.number().min(0).max(100),
  fiber_g: z.coerce.number().min(0).max(100).default(0),
});

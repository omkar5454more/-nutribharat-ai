import { z } from 'zod';
import { FOODS } from './foods';
import type { Food } from './types';

/** What the analyze-food edge function returns. The model only names foods and estimates weight; nutrition comes from our table. */
export const ScanResultSchema = z.object({
  is_food: z.boolean(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        estimated_grams: z.number().min(1).max(2000),
        confidence: z.number().min(0).max(1),
        notes: z.string().max(200).optional(),
      })
    )
    .max(15),
  uncertain: z.string().max(300).optional(),
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(a|an|the|of|with|and|in|cooked|fresh|homemade|home|made|style|plain|bowl|plate|piece|pieces)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokens = (s: string) => new Set(norm(s).split(' ').filter(Boolean));

function score(query: string, food: Food): number {
  const q = norm(query);
  if (!q) return 0;
  const names = [food.name, ...food.aliases].map(norm);
  if (names.includes(q)) return 1;
  let best = 0;
  const qt = tokens(query);
  for (const n of names) {
    if (n.includes(q) || q.includes(n)) best = Math.max(best, 0.8 * Math.min(q.length, n.length) / Math.max(q.length, n.length) + 0.15);
    const nt = new Set(n.split(' '));
    const common = [...qt].filter((t) => nt.has(t)).length;
    if (common) best = Math.max(best, (2 * common) / (qt.size + nt.size));
  }
  return best;
}

/** Best matching food for a name returned by the AI (or typed by the user), or null if nothing is close enough. */
export function matchFood(name: string, minScore = 0.5): { food: Food; score: number } | null {
  let best: { food: Food; score: number } | null = null;
  for (const f of FOODS) {
    const s = score(name, f);
    if (s > (best?.score ?? 0)) best = { food: f, score: s };
  }
  return best && best.score >= minScore ? best : null;
}

/** Search box: foods ranked by match, empty query returns the whole table. */
export function searchFoods(query: string, limit = 20): Food[] {
  if (!norm(query)) return FOODS.slice(0, limit);
  return FOODS.map((f) => ({ f, s: score(query, f) }))
    .filter((x) => x.s > 0.2)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}

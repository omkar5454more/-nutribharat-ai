import { alternativesFor, tagsOf, type FoodTag } from './foodTags';
import type { Constraints } from './safety';

export type CookingMethod = 'deep' | 'shallow' | 'roasted' | 'boiled';
/** Rough grams of added cooking oil/ghee for a serving of the dish, by how it was cooked. An editable estimate, never a measurement. */
export const COOKING_OIL_G: Record<CookingMethod, number> = { deep: 15, shallow: 7, roasted: 3, boiled: 0 };

export type ScanConsiderations = {
  /** foods that may contain something the person listed as an allergy */
  allergy: string[];
  /** foods with a property the person's own health rules limit or avoid */
  tags: { foodId: string; tag: FoodTag }[];
  /** gentler ideas from the same food table, for next time */
  alternatives: { foodId: string; options: string[] }[];
};

/**
 * Factual notes about the foods found in a photo. Uses ONLY the identified foods and the person's own settings.
 * A photo cannot reveal blood sugar, blood pressure or migraine triggers, so nothing here claims to.
 */
export function scanConsiderations(foodIds: string[], rules: Constraints | null, allergyFoods: Set<string>): ScanConsiderations {
  const unique = [...new Set(foodIds)];
  const tags: ScanConsiderations['tags'] = [];
  for (const id of unique) {
    for (const t of tagsOf(id)) if (rules && (rules.avoidTags.has(t) || rules.limitTags.has(t))) tags.push({ foodId: id, tag: t });
  }
  const flagged = new Set(tags.map((x) => x.foodId));
  return {
    allergy: unique.filter((id) => allergyFoods.has(id)),
    tags,
    alternatives: unique.filter((id) => flagged.has(id)).map((id) => ({ foodId: id, options: alternativesFor(id) })).filter((x) => x.options.length),
  };
}

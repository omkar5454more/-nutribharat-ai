import { FOOD_BY_ID } from './foods';
import { tagsOf, alternativesFor, type FoodTag } from './health/foodTags';
import type { Constraints } from './health/safety';

/** Foods people commonly pick for a planned flexible day. Only ids that exist in the food table. */
export const FLEX_SUGGESTIONS = ['chicken-biryani', 'veg-biryani', 'pizza', 'vada-pav', 'samosa', 'chole-bhature', 'masala-dosa', 'butter-chicken', 'gulab-jamun', 'jalebi'].filter((id) => FOOD_BY_ID[id]);

export const monthStart = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A Flex Day must fall in the month it is planned for. Past days of the current month are not offered. */
export function validFlexDate(date: string, today: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime()) || ymd(d) !== date) return false;
  return date >= ymd(today);
}

export const canPlanFlex = (existing: { month: string }[], forMonth: string) => !existing.some((f) => f.month === forMonth);

export type FlexNote =
  | { code: 'portion_awareness'; foodId: string }
  | { code: 'condition_tag'; foodId: string; tag: FoodTag }
  | { code: 'allergy'; foodId: string };

/**
 * Factual, non-judgemental notes for chosen foods. Words like "cheat", "bad", "guilt" are never produced: this returns codes,
 * and the screen shows neutral text. Condition safeguards stay on: a tag the person's rules say to avoid is mentioned, with gentler alternatives offered.
 */
export function flexNotes(foodIds: string[], rules: Constraints | null, allergyFoodIds: Set<string>): FlexNote[] {
  const out: FlexNote[] = [];
  for (const id of foodIds) {
    if (allergyFoodIds.has(id)) out.push({ code: 'allergy', foodId: id });
    for (const t of tagsOf(id)) if (rules?.avoidTags.has(t) || rules?.limitTags.has(t)) out.push({ code: 'condition_tag', foodId: id, tag: t });
    if (tagsOf(id).includes('heavy')) out.push({ code: 'portion_awareness', foodId: id });
  }
  return out;
}

export const flexAlternatives = (foodId: string) => alternativesFor(foodId);

/** What a Flex Day keeps the same as every other day. Shown as reassurance, and used by tests to guard the rule. */
export const FLEX_KEEPS = ['regular_meals', 'medication_as_prescribed', 'normal_activity', 'water', 'allergy_safety', 'condition_safeguards'] as const;

/**
 * The day's routine stays a normal one: no meal is removed, no extra exercise, no "compensation" the next day.
 * A Flex Day only swaps what one or more meals contain.
 */
export function applyFlexToSlots(slots: { slot: string; foodIds: string[] }[], choices: string[]): { slot: string; foodIds: string[]; flex: boolean }[] {
  const picks = choices.filter((id) => FOOD_BY_ID[id]);
  if (!picks.length) return slots.map((s) => ({ ...s, flex: false }));
  const target = slots.some((s) => s.slot === 'dinner') ? 'dinner' : slots[slots.length - 1]?.slot;
  return slots.map((s) => (s.slot === target ? { slot: s.slot, foodIds: picks, flex: true } : { ...s, flex: false }));
}

import type { HealthProfile } from './conditions';
import { buildConstraints } from './safety';

/**
 * The ONLY health information that may leave the device for the AI assistant, and only when the person allowed it ('ai_processing' consent).
 * Condition names and rule keywords. Never free text (so no names, notes or clinician instructions), never readings, never dates.
 */
export type AiHealthSummary = {
  conditions: { id: string; diagnosed: boolean }[];
  avoid: string[];
  limit: string[];
  prefer: string[];
  no_skipping_meals: boolean;
  exercise_cap: 'gentle' | 'moderate' | 'normal';
  fluids_limited_by_clinician: boolean;
  takes_medicine_that_affects_food_or_exercise: boolean;
};

export function aiHealthSummary(h: HealthProfile, allowed: boolean): AiHealthSummary | null {
  if (!allowed || !h.conditions.length) return null;
  const c = buildConstraints(h);
  return {
    conditions: h.conditions.map((x) => ({ id: x.id, diagnosed: x.status === 'diagnosed' })),
    avoid: [...c.avoidTags].sort(), limit: [...c.limitTags].sort(), prefer: [...c.preferTags].sort(),
    no_skipping_meals: c.noSkipMeals, exercise_cap: c.exercise.cap, fluids_limited_by_clinician: c.hydration === 'clinician_limited',
    takes_medicine_that_affects_food_or_exercise: h.conditions.some((x) => x.status === 'diagnosed' && x.medicationFlags.length > 0),
  };
}

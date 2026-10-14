import { describe, expect, it } from 'vitest';
import { aiHealthSummary } from './aiSummary';

const h = { conditions: [{ id: 'diabetes' as const, status: 'diagnosed' as const, restrictions: [], medicationFlags: ['insulin' as const], symptoms: [], wantsAware: true }], instructions: ['Dr. Rao said walk after dinner, call 9999999999'] };

describe('AI health summary', () => {
  it('is empty without consent, or without conditions', () => {
    expect(aiHealthSummary(h, false)).toBeNull();
    expect(aiHealthSummary({ conditions: [], instructions: [] }, true)).toBeNull();
  });
  it('contains condition names and rules only, never free text', () => {
    const s = aiHealthSummary(h, true)!;
    expect(s.conditions).toEqual([{ id: 'diabetes', diagnosed: true }]);
    expect(s.no_skipping_meals).toBe(true);
    expect(s.exercise_cap).toBe('gentle');
    expect(s.takes_medicine_that_affects_food_or_exercise).toBe(true);
    const text = JSON.stringify(s);
    expect(text).not.toMatch(/Rao|9999|insulin|walk after/);
  });
});

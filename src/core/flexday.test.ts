import { describe, expect, it } from 'vitest';
import { applyFlexToSlots, canPlanFlex, FLEX_SUGGESTIONS, flexNotes, monthStart, validFlexDate, ymd } from './flexday';
import { buildConstraints } from './health/safety';

const today = new Date('2026-10-14T10:00:00');
describe('Flex Day', () => {
  it('offers real foods only, including the favourites people name', () => {
    for (const id of ['chicken-biryani', 'pizza', 'vada-pav', 'gulab-jamun']) expect(FLEX_SUGGESTIONS).toContain(id);
  });
  it('one per month', () => {
    expect(canPlanFlex([{ month: '2026-10-01' }], '2026-11-01')).toBe(true);
    expect(canPlanFlex([{ month: '2026-10-01' }], '2026-10-01')).toBe(false);
    expect(monthStart(today)).toBe('2026-10-01');
  });
  it('date must be real and not in the past', () => {
    expect(validFlexDate('2026-10-25', today)).toBe(true);
    expect(validFlexDate('2026-10-14', today)).toBe(true);
    expect(validFlexDate('2026-10-13', today)).toBe(false);
    expect(validFlexDate('2026-02-31', today)).toBe(false);
    expect(validFlexDate('soon', today)).toBe(false);
    expect(ymd(today)).toBe('2026-10-14');
  });
  it('keeps every meal; only swaps what one meal contains — never removes or adds exercise', () => {
    const slots = [{ slot: 'breakfast', foodIds: ['poha'] }, { slot: 'lunch', foodIds: ['roti'] }, { slot: 'snack', foodIds: ['apple'] }, { slot: 'dinner', foodIds: ['khichdi'] }];
    const r = applyFlexToSlots(slots, ['chicken-biryani']);
    expect(r.map((x) => x.slot)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    expect(r.find((x) => x.flex)!.foodIds).toEqual(['chicken-biryani']);
    expect(r.filter((x) => !x.flex).map((x) => x.foodIds)).toEqual([['poha'], ['roti'], ['apple']]);
    expect(applyFlexToSlots(slots, ['not-a-food']).some((x) => x.flex)).toBe(false);
  });
  it('condition safeguards stay on: tags the rules limit are mentioned, allergies flagged', () => {
    const rules = buildConstraints({ conditions: [{ id: 'hypertension', status: 'diagnosed', restrictions: [], medicationFlags: [], symptoms: [], wantsAware: true }], instructions: [] });
    const n = flexNotes(['chicken-biryani', 'jalebi'], rules, new Set(['jalebi']));
    expect(n).toEqual(expect.arrayContaining([{ code: 'condition_tag', foodId: 'chicken-biryani', tag: 'high_sodium' }, { code: 'allergy', foodId: 'jalebi' }]));
    expect(flexNotes(['pizza'], null, new Set()).every((x) => x.code === 'portion_awareness')).toBe(true);
  });
});

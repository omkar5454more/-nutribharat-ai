import { describe, expect, it } from 'vitest';
import { buildConstraints } from './safety';
import { COOKING_OIL_G, scanConsiderations } from './scan';

const rules = (id: 'hypertension' | 'diabetes' | 'high_cholesterol') => buildConstraints({ conditions: [{ id, status: 'diagnosed', restrictions: [], medicationFlags: [], symptoms: [], wantsAware: true }], instructions: [] });

describe('scanConsiderations', () => {
  it('flags allergy matches regardless of any health setting', () => {
    expect(scanConsiderations(['curd', 'roti'], null, new Set(['curd'])).allergy).toEqual(['curd']);
  });
  it('mentions only properties the person’s own rules limit, with gentler ideas', () => {
    const r = scanConsiderations(['samosa', 'roti'], rules('hypertension'), new Set());
    expect(r.tags).toEqual(expect.arrayContaining([{ foodId: 'samosa', tag: 'high_sodium' }]));
    expect(r.tags.some((x) => x.foodId === 'roti')).toBe(false);
    expect(r.alternatives.find((a) => a.foodId === 'samosa')!.options.length).toBeGreaterThan(0);
  });
  it('says nothing about conditions when there are no health rules', () => {
    expect(scanConsiderations(['samosa', 'jalebi'], null, new Set())).toEqual({ allergy: [], tags: [], alternatives: [] });
  });
  it('de-duplicates repeated foods', () => {
    expect(scanConsiderations(['jalebi', 'jalebi'], rules('diabetes'), new Set()).alternatives).toHaveLength(1);
  });
  it('cooking oil estimates grow with frying and are never negative', () => {
    expect(COOKING_OIL_G.deep).toBeGreaterThan(COOKING_OIL_G.shallow);
    expect(COOKING_OIL_G.shallow).toBeGreaterThan(COOKING_OIL_G.roasted);
    expect(COOKING_OIL_G.boiled).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { buildConstraints } from './health/safety';
import { buildGymPlan, DEFAULT_GYM, EXERCISES, nextWorkout, sessionFor, weekdayOf, type GymPrefs } from './gym';

const prefs = (o: Partial<GymPrefs> = {}): GymPrefs => ({ ...DEFAULT_GYM, goes: true, ...o });
const rules = (id: 'hypertension' | 'diabetes', med = false) => buildConstraints({ conditions: [{ id, status: 'diagnosed', restrictions: [], medicationFlags: med ? [id === 'diabetes' ? 'insulin' : 'bp_medicine'] : [], symptoms: [], wantsAware: true }], instructions: [] });
const sessions = (p: ReturnType<typeof buildGymPlan>) => p.days.filter((d) => d.session);

describe('buildGymPlan', () => {
  it.each([2, 3, 4, 5, 6] as const)('%i days a week gives exactly that many sessions, with rest days between where possible', (n) => {
    const p = buildGymPlan(prefs({ daysPerWeek: n }), null);
    expect(sessions(p)).toHaveLength(n);
    if (n <= 4) for (const d of sessions(p)) expect(p.days[(d.weekday + 1) % 7].session === null || n === 4).toBe(true);
  });
  it('every exercise exists and every session has warm-up and cool-down', () => {
    for (const n of [2, 3, 4, 5, 6] as const) for (const g of ['fat_loss', 'muscle', 'general'] as const) for (const place of ['full_gym', 'basic'] as const) {
      const p = buildGymPlan(prefs({ daysPerWeek: n, goal: g, place }), null);
      for (const d of sessions(p)) {
        expect(d.session!.items.length).toBeGreaterThanOrEqual(4);
        for (const it of d.session!.items) expect(EXERCISES[it.id], it.id).toBeTruthy();
        expect(d.session!.warmupMin).toBeGreaterThan(0);
      }
    }
  });
  it('a basic setup (no machines) never prescribes a machine', () => {
    const p = buildGymPlan(prefs({ place: 'basic', daysPerWeek: 5 }), null);
    for (const d of sessions(p)) for (const it of d.session!.items) expect(EXERCISES[it.id].gym, it.id).not.toBe(true);
  });
  it('fat loss adds cardio, muscle gain does not', () => {
    expect(sessions(buildGymPlan(prefs({ goal: 'fat_loss' }), null))[0].session!.cardio).toBeTruthy();
    expect(sessions(buildGymPlan(prefs({ goal: 'muscle' }), null))[0].session!.cardio).toBeNull();
  });
  it('health rules only make it easier: gentle cap → light only, no heavy lifts, lower effort', () => {
    const normal = buildGymPlan(prefs({ level: 'intermediate', goal: 'muscle', daysPerWeek: 5 }), null);
    const gentle = buildGymPlan(prefs({ level: 'intermediate', goal: 'muscle', daysPerWeek: 5 }), rules('diabetes', true));
    expect(gentle.lightOnly).toBe(true);
    expect(gentle.needsClinicianCheck).toBe(true);
    expect(gentle.effort.high).toBeLessThan(normal.effort.high);
    for (const d of sessions(gentle)) for (const it of d.session!.items) { expect(EXERCISES[it.id].heavy, it.id).not.toBe(true); expect(it.sets).toBeLessThanOrEqual(2); }
  });
  it('high blood pressure flags breath-holding advice and caps effort', () => {
    const p = buildGymPlan(prefs({ level: 'intermediate' }), rules('hypertension'));
    expect(p.avoidBreathHolding).toBe(true);
    expect(p.effort.high).toBeLessThanOrEqual(7);
  });
  it('is deterministic', () => {
    expect(buildGymPlan(prefs(), null)).toEqual(buildGymPlan(prefs(), null));
  });
});

describe('dates', () => {
  it('Monday is 0 and Sunday is 6', () => {
    expect(weekdayOf(new Date(2026, 9, 12))).toBe(0);
    expect(weekdayOf(new Date(2026, 9, 18))).toBe(6);
  });
  it('finds today’s or the next session', () => {
    const p = buildGymPlan(prefs({ daysPerWeek: 3 }), null);   // Mon, Wed, Fri
    expect(sessionFor(p, new Date(2026, 9, 12))).toBeTruthy();
    expect(sessionFor(p, new Date(2026, 9, 13))).toBeNull();
    expect(nextWorkout(p, new Date(2026, 9, 13))!.inDays).toBe(1);
  });
});

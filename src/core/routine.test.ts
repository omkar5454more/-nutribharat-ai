import { describe, expect, it } from 'vitest';
import { adapt, addCustom, dueNow, generateRoutine, DEFAULT_PREFS, fmtMinute, nextUp, parseTime, progress, removeActivity, reschedule, swapToLightWalk, type RoutinePrefs } from './routine';
import { buildConstraints } from './health/safety';
import type { HealthCondition } from './health/conditions';

const cond = (id: HealthCondition['id'], over: Partial<HealthCondition> = {}): HealthCondition => ({ id, status: 'diagnosed', restrictions: [], medicationFlags: [], symptoms: [], wantsAware: true, ...over });
const rulesFor = (...c: HealthCondition[]) => buildConstraints({ conditions: c, instructions: [] });
const gaps = (list: ReturnType<typeof generateRoutine>, wake: number) => {
  const eat = list.filter((a) => a.slot).map((a) => (a.start - wake + 1440) % 1440);
  return eat.slice(1).map((m, i) => m - eat[i]);
};

describe('time helpers', () => {
  it('formats and parses clock times', () => {
    expect(fmtMinute(7 * 60 + 5)).toBe('07:05');
    expect(fmtMinute(-30)).toBe('23:30');
    expect(parseTime('7:30')).toBe(450);
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('abc')).toBeNull();
  });
});

describe('generateRoutine', () => {
  it('builds an ordered day from wake to sleep with the four meals, exercise, hydration and relaxation', () => {
    const r = generateRoutine(DEFAULT_PREFS, null);
    expect(r[0].kind).toBe('wake');
    expect(r[r.length - 1].kind).toBe('sleep');
    for (const k of ['breakfast', 'lunch', 'snack', 'dinner', 'exercise', 'hydration', 'relax'] as const) expect(r.some((a) => a.kind === k), k).toBe(true);
    const times = r.map((a) => (a.start - DEFAULT_PREFS.wakeMinute + 1440) % 1440);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('works for an early-morning, a late-night and a past-midnight sleeper', () => {
    const night: RoutinePrefs = { ...DEFAULT_PREFS, wakeMinute: 14 * 60, sleepMinute: 2 * 60, shift: 'night' };
    const r = generateRoutine(night, null);
    expect(r[r.length - 1].kind).toBe('sleep');
    expect(r[0].start).toBe(14 * 60);
    expect(r.filter((a) => a.slot).length).toBe(4);
  });

  it('adds a small meal when a clinician rule needs shorter gaps (diabetes)', () => {
    const r = generateRoutine(DEFAULT_PREFS, rulesFor(cond('diabetes')));
    for (const g of gaps(r, DEFAULT_PREFS.wakeMinute)) expect(g).toBeLessThanOrEqual(4.5 * 60 + 5);
    expect(r.filter((a) => a.slot).length).toBeGreaterThanOrEqual(5);
  });

  it('GERD: dinner at least 3 hours before bed, exercise never right after a meal', () => {
    const r = generateRoutine(DEFAULT_PREFS, rulesFor(cond('gerd')));
    const dinner = r.find((a) => a.slot === 'dinner')!;
    expect((DEFAULT_PREFS.sleepMinute - dinner.start + 1440) % 1440).toBeGreaterThanOrEqual(180);
    const ex = r.find((a) => a.kind === 'exercise')!;
    for (const m of r.filter((a) => a.slot)) {
      const d = (ex.start - m.start + 1440) % 1440;
      expect(d >= 60 || d > 1000, `${m.slot} then exercise after ${d} min`).toBe(true);
    }
  });

  it('exercise never exceeds the safety cap, even for an "active" person', () => {
    const active = { ...DEFAULT_PREFS, fitness: 'active' as const };
    expect(generateRoutine(active, null).find((a) => a.kind === 'exercise')!.intensity).toBe('normal');
    expect(generateRoutine(active, rulesFor(cond('hypertension'))).find((a) => a.kind === 'exercise')!.intensity).toBe('moderate');
    expect(generateRoutine(active, rulesFor(cond('diabetes', { medicationFlags: ['insulin'] }))).find((a) => a.kind === 'exercise')!.intensity).toBe('gentle');
  });

  it('combined diabetes + blood pressure gives one routine, not two', () => {
    const r = generateRoutine({ ...DEFAULT_PREFS, fitness: 'active' }, rulesFor(cond('diabetes'), cond('hypertension')));
    expect(r.filter((a) => a.kind === 'exercise')).toHaveLength(1);
    expect(r.filter((a) => a.kind === 'wake')).toHaveLength(1);
    expect(r.find((a) => a.kind === 'exercise')!.intensity).toBe('moderate');
  });

  it('a clinician fluid limit removes every water prompt; migraine adds more of them', () => {
    expect(generateRoutine(DEFAULT_PREFS, rulesFor(cond('hypertension', { restrictions: ['fluid_limit'] }))).some((a) => a.kind === 'hydration')).toBe(false);
    const normal = generateRoutine(DEFAULT_PREFS, null).filter((a) => a.kind === 'hydration').length;
    const migraine = generateRoutine(DEFAULT_PREFS, rulesFor(cond('migraine'))).filter((a) => a.kind === 'hydration').length;
    expect(migraine).toBeGreaterThan(normal);
  });

  it('medication entries come only from what the person entered, and only the enabled ones', () => {
    expect(generateRoutine(DEFAULT_PREFS, rulesFor(cond('diabetes', { medicationFlags: ['insulin'] }))).some((a) => a.kind === 'medication')).toBe(false);
    const r = generateRoutine(DEFAULT_PREFS, null, [{ label: 'Morning tablet', minute: 8 * 60, enabled: true }, { label: 'Off', minute: 9 * 60, enabled: false }]);
    const meds = r.filter((a) => a.kind === 'medication');
    expect(meds.map((m) => [m.medicationLabel, m.start, m.source])).toEqual([['Morning tablet', 480, 'user']]);
  });
});

describe('editing', () => {
  const base = generateRoutine(DEFAULT_PREFS, null);
  it('reschedule moves one item and keeps the order', () => {
    const lunch = base.find((a) => a.slot === 'lunch')!;
    const moved = reschedule(base, lunch.id, 14 * 60 + 30, DEFAULT_PREFS.wakeMinute);
    expect(moved.find((a) => a.id === lunch.id)!.start).toBe(14 * 60 + 30);
    expect(moved.length).toBe(base.length);
  });
  it('custom items are added (trimmed, bounded) and can be removed', () => {
    const added = addCustom(base, '  Call mom  ', 19 * 60, 5000, DEFAULT_PREFS.wakeMinute);
    const item = added.find((a) => a.title === 'Call mom')!;
    expect(item.duration).toBe(600);
    expect(item.source).toBe('user');
    expect(removeActivity(added, item.id)).toHaveLength(base.length);
    expect(addCustom(base, '   ', 600, 10, 420)).toBe(base);
  });
});

describe('adaptive suggestions are never guilt-based or restrictive', () => {
  const rules = null;
  const r = generateRoutine(DEFAULT_PREFS, rules, [{ label: 'Tablet', minute: 8 * 60, enabled: true }]);
  const wake = DEFAULT_PREFS.wakeMinute;
  it('a late lunch just gets a new time — no skipping the next meal, no extra exercise', () => {
    const lunch = r.find((a) => a.slot === 'lunch')!;
    const s = adapt(r, {}, lunch.start + 60, wake, rules);
    const late = s.find((x) => x.code === 'meal_late');
    expect(late).toBeTruthy();
    expect(s.map((x) => x.code).join(' ')).not.toMatch(/skip|fast|extra|compensate/);
  });
  it('a missed medication never produces a suggestion', () => {
    const med = r.find((a) => a.kind === 'medication')!;
    const s = adapt(r, {}, med.start + 120, wake, rules);
    expect(s.some((x) => x.activityId === med.id)).toBe(false);
  });
  it('a missed harder workout becomes an offer of a light walk; completed things are left alone', () => {
    const rr = generateRoutine({ ...DEFAULT_PREFS, fitness: 'active' }, rules);
    const ex = rr.find((a) => a.kind === 'exercise')!;
    expect(adapt(rr, {}, ex.start + 120, wake, rules).some((x) => x.code === 'swap_light_walk')).toBe(true);
    expect(adapt(rr, { [ex.id]: 'done' }, ex.start + 120, wake, rules).some((x) => x.code === 'swap_light_walk')).toBe(false);
    const swapped = swapToLightWalk(rr, ex.id).find((a) => a.id === ex.id)!;
    expect(swapped).toMatchObject({ intensity: 'gentle', duration: 15 });
  });
  it('no water catch-up when fluids are limited; a good day says so', () => {
    const lim = rulesFor(cond('hypertension', { restrictions: ['fluid_limit'] }));
    const rr = generateRoutine(DEFAULT_PREFS, lim);
    expect(adapt(rr, {}, wake + 600, wake, lim).some((x) => x.code === 'catch_up_water')).toBe(false);
    expect(adapt(r, {}, wake + 5, wake, rules)).toEqual([{ code: 'all_good' }]);
  });
  it('gives at most three suggestions', () => {
    expect(adapt(r, {}, wake + 700, wake, rules).length).toBeLessThanOrEqual(3);
  });
});

describe('progress, next-up and reminders', () => {
  const r = generateRoutine(DEFAULT_PREFS, null);
  const wake = DEFAULT_PREFS.wakeMinute;
  it('counts only real activities and tracks percent', () => {
    const real = r.filter((a) => a.kind !== 'wake' && a.kind !== 'sleep');
    expect(progress(r, {}).total).toBe(real.length);
    const st = Object.fromEntries(real.slice(0, 2).map((a) => [a.id, 'done' as const]));
    expect(progress(r, st).done).toBe(2);
  });
  it('next-up is the earliest unfinished item from now', () => {
    const bf = r.find((a) => a.slot === 'breakfast')!;
    expect(nextUp(r, {}, bf.start - 5, wake, )?.id).toBe(bf.id);
    expect(nextUp(r, { [bf.id]: 'done' }, bf.start - 5, wake)?.id).not.toBe(bf.id);
  });
  it('reminders fire only for enabled kinds and unfinished items', () => {
    const bf = r.find((a) => a.slot === 'breakfast')!;
    expect(dueNow(r, {}, bf.start + 1, new Set(['breakfast'])).map((a) => a.id)).toEqual([bf.id]);
    expect(dueNow(r, { [bf.id]: 'done' }, bf.start + 1, new Set(['breakfast']))).toEqual([]);
    expect(dueNow(r, {}, bf.start + 1, new Set(['lunch']))).toEqual([]);
    expect(dueNow(r, {}, bf.start + 30, new Set(['breakfast']))).toEqual([]);
  });
});

import type { Constraints } from './health/safety';

export type ActivityKind = 'wake' | 'hydration' | 'exercise' | 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'relax' | 'sleep' | 'medication' | 'custom';
export type Shift = 'none' | 'day' | 'night' | 'rotating';

export type RoutinePrefs = {
  wakeMinute: number;
  sleepMinute: number;
  workStart: number | null;
  workEnd: number | null;
  shift: Shift;
  cooking: 'quick' | 'normal' | 'long';
  fitness: 'beginner' | 'moderate' | 'active';
};

export const DEFAULT_PREFS: RoutinePrefs = { wakeMinute: 7 * 60, sleepMinute: 23 * 60, workStart: 10 * 60, workEnd: 18 * 60, shift: 'none', cooking: 'normal', fitness: 'beginner' };

/** A reminder the USER (or their clinician, via the user) entered. The app never creates these on its own. */
export type MedicationReminder = { label: string; minute: number; enabled: boolean };

export type Activity = {
  id: string;
  kind: ActivityKind;
  /** i18n key for generated activities ('routine.breakfast'); free text for the person's own ones */
  title: string;
  /** i18n key of a short helper line, or '' */
  detailKey: string;
  start: number;
  duration: number;
  source: 'generated' | 'user';
  medicationLabel?: string;
  /** exercise only */
  intensity?: 'gentle' | 'moderate' | 'normal';
  /** meals only: slot name used to look up the planned meal */
  slot?: 'breakfast' | 'lunch' | 'snack' | 'dinner';
};

export type Status = 'done' | 'skipped';

const clamp = (m: number) => ((Math.round(m) % 1440) + 1440) % 1440;
export const fmtMinute = (m: number) => `${String(Math.floor(clamp(m) / 60)).padStart(2, '0')}:${String(clamp(m) % 60).padStart(2, '0')}`;
export const parseTime = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
};

/** minutes after wake (handles a sleep time that is after midnight) */
const awakeSpan = (p: RoutinePrefs) => { const s = (p.sleepMinute - p.wakeMinute + 1440) % 1440; return s === 0 ? 1440 : s; };

let counter = 0;
const uid = (kind: string) => `${kind}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Builds one day's routine from the person's own times and the (already combined) safety rules.
 * Meals are spaced so that no gap exceeds a rule's limit; exercise respects the intensity cap; hydration prompts disappear under a fluid limit.
 * Medication entries repeat ONLY what the person entered. This function never decides a medicine, dose or time.
 */
export function generateRoutine(prefs: RoutinePrefs, rules: Constraints | null, meds: MedicationReminder[] = []): Activity[] {
  const span = awakeSpan(prefs);
  const at = (offset: number) => clamp(prefs.wakeMinute + offset);
  const out: Activity[] = [];
  const add = (a: Omit<Activity, 'id' | 'source' | 'detailKey'> & { detailKey?: string }) => out.push({ id: uid(a.kind), source: 'generated', detailKey: '', ...a });

  add({ kind: 'wake', title: 'routine.wake', start: at(0), duration: 0, detailKey: rules?.hydration === 'clinician_limited' ? '' : 'routine.wake_water' });

  // meals: breakfast soon after waking, dinner leaves the required gap before bed
  const dinnerGap = rules?.dinnerBeforeSleepMin ?? 120;
  const breakfast = Math.min(60, Math.max(20, Math.round(span * 0.05)));
  const dinner = Math.max(breakfast + 360, span - dinnerGap);
  const lunch = Math.round(breakfast + (dinner - breakfast) * 0.42);
  const snack = Math.round(lunch + (dinner - lunch) * 0.5);
  const meals: [number, 'breakfast' | 'lunch' | 'snack' | 'dinner'][] = [[breakfast, 'breakfast'], [lunch, 'lunch'], [snack, 'snack'], [dinner, 'dinner']];

  // a rule like "no more than 4 hours between meals" may need an extra small meal
  const maxGap = rules?.mealGapMaxHours ? rules.mealGapMaxHours * 60 : null;
  if (maxGap) {
    for (let i = 0; i < meals.length - 1; i++) {
      if (meals[i + 1][0] - meals[i][0] > maxGap + 5) {
        meals.splice(i + 1, 0, [Math.round((meals[i][0] + meals[i + 1][0]) / 2), 'snack']);
        i++;
      }
    }
  }
  for (const [off, slot] of meals) {
    const dur = slot === 'snack' ? 15 : slot === 'dinner' ? 40 : 30;
    add({ kind: slot, slot, title: `routine.${slot}`, start: at(off), duration: dur, detailKey: slot === 'dinner' && dinnerGap >= 180 ? 'routine.dinner_early' : '' });
  }

  // hydration: skipped completely when a clinician limited fluids
  if (rules?.hydration !== 'clinician_limited') {
    const count = rules?.hydration === 'emphasis' ? 5 : 4;
    for (let i = 1; i <= count; i++) {
      const off = Math.round((span - 120) * (i / (count + 1)));
      add({ kind: 'hydration', title: 'routine.hydration', start: at(off), duration: 0, detailKey: 'routine.hydration_detail' });
    }
  }

  // exercise: a gentle walk is the default; level follows fitness but never exceeds the safety cap
  const cap = rules?.exercise.cap ?? 'normal';
  const want: 'gentle' | 'moderate' | 'normal' = prefs.fitness === 'beginner' ? 'gentle' : prefs.fitness === 'moderate' ? 'moderate' : 'normal';
  const order = { gentle: 0, moderate: 1, normal: 2 } as const;
  const intensity = order[want] <= order[cap] ? want : cap;
  const after = rules?.exercise.avoidAfterMealMin ?? 30;
  const preferred = prefs.shift === 'night' ? Math.round(span * 0.45) : Math.round(Math.max(breakfast + after + 30, span * 0.1)); // morning, away from breakfast
  let exStart = preferred;
  for (const [off, slot] of meals) {
    if (slot !== 'snack' && exStart >= off - 20 && exStart < off + after + 20) exStart = off + after + 20;   // never straight after a meal
  }
  add({ kind: 'exercise', title: 'routine.exercise', start: at(exStart), duration: intensity === 'gentle' ? 20 : intensity === 'moderate' ? 30 : 40, intensity, detailKey: `routine.exercise_${intensity}` });

  add({ kind: 'relax', title: 'routine.relax', start: at(span - 60), duration: 20, detailKey: 'routine.relax_detail' });
  add({ kind: 'sleep', title: 'routine.sleep', start: clamp(prefs.sleepMinute), duration: 0, detailKey: rules?.sleepRegularity ? 'routine.sleep_regular' : '' });

  for (const m of meds.filter((x) => x.enabled)) {
    out.push({ id: uid('medication'), kind: 'medication', title: 'routine.medication', detailKey: '', start: clamp(m.minute), duration: 0, source: 'user', medicationLabel: m.label });
  }
  return sortByClock(out, prefs.wakeMinute);
}

/** Order by time of day counted from waking, so a late-night sleep entry stays last. */
export function sortByClock(list: Activity[], wake: number): Activity[] {
  return [...list].sort((a, b) => ((a.start - wake + 1440) % 1440) - ((b.start - wake + 1440) % 1440) || a.id.localeCompare(b.id));
}

/** Move one entry (drag / "later" / "earlier"). Meals keep a minimum distance from neighbours' sleep; bedtime itself is changed in preferences. */
export function reschedule(list: Activity[], id: string, newStart: number, wake: number): Activity[] {
  return sortByClock(list.map((a) => (a.id === id ? { ...a, start: clamp(newStart), source: a.source } : a)), wake);
}

export function addCustom(list: Activity[], title: string, start: number, duration: number, wake: number): Activity[] {
  const t = title.trim().slice(0, 120);
  if (!t) return list;
  return sortByClock([...list, { id: uid('custom'), kind: 'custom', title: t, detailKey: '', start: clamp(start), duration: Math.max(0, Math.min(600, duration)), source: 'user' }], wake);
}

export const removeActivity = (list: Activity[], id: string) => list.filter((a) => a.id !== id);

// ---------------------------------------------------------------- adaptive, no-guilt suggestions
export type Suggestion =
  | { code: 'meal_late'; activityId: string; newStart: number }
  | { code: 'catch_up_water'; activityId?: undefined }
  | { code: 'swap_light_walk'; activityId: string }
  | { code: 'shift_exercise_tomorrow'; activityId: string }
  | { code: 'all_good'; activityId?: undefined };

/**
 * Looks at the day so far and offers at most 3 gentle options. It never scolds, never suggests "making up" for a missed meal by eating less,
 * fasting or exercising extra, and never touches medication entries.
 */
export function adapt(list: Activity[], status: Record<string, Status>, now: number, wake: number, rules: Constraints | null): Suggestion[] {
  const since = (m: number) => (m - wake + 1440) % 1440;
  const nowS = since(now);
  const out: Suggestion[] = [];
  const overdue = list.filter((a) => a.kind !== 'medication' && !status[a.id] && since(a.start) + 20 < nowS && a.duration > 0);
  const lateMeal = overdue.find((a) => a.slot);
  if (lateMeal) out.push({ code: 'meal_late', activityId: lateMeal.id, newStart: now + 10 });          // eat when you can, normally — no skipping the next one
  const waters = list.filter((a) => a.kind === 'hydration');
  if (rules?.hydration !== 'clinician_limited' && waters.filter((a) => since(a.start) < nowS && !status[a.id]).length >= 2) out.push({ code: 'catch_up_water' });
  const ex = list.find((a) => a.kind === 'exercise');
  if (ex && !status[ex.id] && since(ex.start) + 90 < nowS && ex.intensity !== 'gentle') out.push({ code: 'swap_light_walk', activityId: ex.id });
  else if (ex && !status[ex.id] && since(ex.start) + 240 < nowS) out.push({ code: 'shift_exercise_tomorrow', activityId: ex.id });
  return out.length ? out.slice(0, 3) : [{ code: 'all_good' }];
}

/** Light walk instead of a planned harder session */
export function swapToLightWalk(list: Activity[], id: string): Activity[] {
  return list.map((a) => (a.id === id ? { ...a, intensity: 'gentle', duration: 15, detailKey: 'routine.exercise_gentle' } : a));
}

export function progress(list: Activity[], status: Record<string, Status>) {
  const countable = list.filter((a) => a.kind !== 'wake' && a.kind !== 'sleep');
  const done = countable.filter((a) => status[a.id] === 'done').length;
  return { done, total: countable.length, pct: countable.length ? Math.round((done / countable.length) * 100) : 0 };
}

/** The next entry that is not finished and starts now or later (by clock from waking). */
export function nextUp(list: Activity[], status: Record<string, Status>, now: number, wake: number): Activity | null {
  const since = (m: number) => (m - wake + 1440) % 1440;
  const n = since(now);
  return list.filter((a) => !status[a.id] && a.kind !== 'wake').find((a) => since(a.start) >= n - 10) ?? null;
}

/** Entries that should raise an in-app reminder right now (within the last 2 minutes), once. Medication reminders only for user-entered items. */
export function dueNow(list: Activity[], status: Record<string, Status>, now: number, enabled: Set<ActivityKind>): Activity[] {
  return list.filter((a) => !status[a.id] && enabled.has(a.kind) && ((now - a.start + 1440) % 1440) <= 2);
}

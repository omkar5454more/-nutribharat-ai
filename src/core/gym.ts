import type { Constraints } from './health/safety';

/**
 * Gym schedule builder: a simple, conservative weekly plan from a few answers. It is general fitness guidance, not a personal-training or medical prescription.
 * The person's health rules can only make it easier (lighter, no maximal lifts), never harder. A qualified trainer / clinician should review the content.
 */
export type GymGoal = 'fat_loss' | 'muscle' | 'general';
export type GymLevel = 'beginner' | 'intermediate';
export type GymPlace = 'full_gym' | 'basic';

export type GymPrefs = { goes: boolean; daysPerWeek: 2 | 3 | 4 | 5 | 6; goal: GymGoal; level: GymLevel; place: GymPlace };
export const DEFAULT_GYM: GymPrefs = { goes: false, daysPerWeek: 3, goal: 'general', level: 'beginner', place: 'full_gym' };

type Names = { en: string; hi: string; mr: string };
export type Exercise = { id: string; name: Names; group: 'push' | 'pull' | 'legs' | 'core' | 'cardio' | 'mobility'; heavy?: boolean; gym?: boolean };

const X = (id: string, group: Exercise['group'], en: string, hi: string, mr: string, o: Partial<Exercise> = {}): Exercise => ({ id, group, name: { en, hi, mr }, ...o });

export const EXERCISES: Record<string, Exercise> = Object.fromEntries([
  X('bench', 'push', 'Bench press', 'बेंच प्रेस', 'बेंच प्रेस', { heavy: true, gym: true }),
  X('pushup', 'push', 'Push-ups (or knee push-ups)', 'पुश-अप (या घुटनों पर)', 'पुश-अप (किंवा गुडघ्यांवर)'),
  X('shoulder-press', 'push', 'Dumbbell shoulder press', 'डंबल शोल्डर प्रेस', 'डंबल शोल्डर प्रेस', { heavy: true }),
  X('chest-press-machine', 'push', 'Chest press machine', 'चेस्ट प्रेस मशीन', 'चेस्ट प्रेस मशीन', { gym: true }),
  X('tricep-pushdown', 'push', 'Triceps pushdown', 'ट्राइसेप्स पुशडाउन', 'ट्रायसेप्स पुशडाउन', { gym: true }),
  X('lat-pulldown', 'pull', 'Lat pulldown', 'लैट पुलडाउन', 'लॅट पुलडाउन', { gym: true }),
  X('seated-row', 'pull', 'Seated cable row', 'सीटेड केबल रो', 'सीटेड केबल रो', { gym: true }),
  X('db-row', 'pull', 'One-arm dumbbell row', 'वन-आर्म डंबल रो', 'वन-आर्म डंबल रो'),
  X('biceps-curl', 'pull', 'Biceps curl', 'बाइसेप्स कर्ल', 'बायसेप्स कर्ल'),
  X('face-pull', 'pull', 'Face pull / rear-delt fly', 'फेस पुल / रियर-डेल्ट फ्लाई', 'फेस पुल / रिअर-डेल्ट फ्लाय'),
  X('squat', 'legs', 'Bodyweight or goblet squat', 'बॉडीवेट या गॉब्लेट स्क्वाट', 'बॉडीवेट किंवा गॉब्लेट स्क्वॉट'),
  X('leg-press', 'legs', 'Leg press', 'लेग प्रेस', 'लेग प्रेस', { gym: true }),
  X('lunge', 'legs', 'Walking lunges', 'वॉकिंग लंजेस', 'वॉकिंग लंजेस'),
  X('rdl', 'legs', 'Romanian deadlift (light)', 'रोमानियन डेडलिफ्ट (हल्का)', 'रोमानियन डेडलिफ्ट (हलके)', { heavy: true }),
  X('glute-bridge', 'legs', 'Glute bridge', 'ग्लूट ब्रिज', 'ग्लूट ब्रिज'),
  X('calf-raise', 'legs', 'Calf raises', 'काफ रेज़', 'काफ रेझ'),
  X('plank', 'core', 'Plank (hold)', 'प्लैंक', 'प्लँक'),
  X('dead-bug', 'core', 'Dead bug', 'डेड बग', 'डेड बग'),
  X('crunch', 'core', 'Crunches', 'क्रंचेस', 'क्रंचेस'),
  X('walk', 'cardio', 'Brisk walk', 'तेज़ चाल', 'वेगाने चालणे'),
  X('cycle', 'cardio', 'Stationary cycle', 'स्टेशनरी साइकिल', 'स्टेशनरी सायकल', { gym: true }),
  X('treadmill', 'cardio', 'Treadmill incline walk', 'ट्रेडमिल इनलाइन वॉक', 'ट्रेडमिल इनलाइन वॉक', { gym: true }),
  X('stretch', 'mobility', 'Full-body stretch', 'पूरे शरीर की स्ट्रेचिंग', 'संपूर्ण शरीराचे स्ट्रेचिंग'),
].map((e) => [e.id, e]));

export type Prescription = { id: string; sets: number; reps: string };
export type Session = { key: string; focus: 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs'; items: Prescription[]; cardio: Prescription | null; warmupMin: number; cooldownMin: number };
export type PlanDay = { weekday: number; session: Session | null };     // weekday 0 = Monday
export type GymPlan = {
  days: PlanDay[];
  /** how hard the person should aim to work, 1-10 effort scale */
  effort: { low: number; high: number };
  lightOnly: boolean;
  needsClinicianCheck: boolean;
  avoidBreathHolding: boolean;
};

const WEEKDAYS: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

const TEMPLATES: Record<Session['focus'], string[]> = {
  full: ['squat', 'chest-press-machine', 'seated-row', 'glute-bridge', 'shoulder-press', 'plank'],
  upper: ['chest-press-machine', 'lat-pulldown', 'shoulder-press', 'db-row', 'biceps-curl', 'tricep-pushdown'],
  lower: ['leg-press', 'squat', 'rdl', 'lunge', 'calf-raise', 'plank'],
  push: ['bench', 'shoulder-press', 'chest-press-machine', 'tricep-pushdown', 'pushup', 'crunch'],
  pull: ['lat-pulldown', 'seated-row', 'db-row', 'face-pull', 'biceps-curl', 'dead-bug'],
  legs: ['leg-press', 'squat', 'rdl', 'lunge', 'glute-bridge', 'calf-raise'],
};

function focusFor(n: number, i: number): Session['focus'] {
  if (n <= 3) return 'full';
  if (n === 4) return i % 2 === 0 ? 'upper' : 'lower';
  if (n === 5) return (['push', 'pull', 'legs', 'upper', 'lower'] as const)[i];
  return (['push', 'pull', 'legs', 'push', 'pull', 'legs'] as const)[i];
}

/** Swap an exercise for an easier, equipment-free (or lighter) alternative when needed. */
function adjust(id: string, prefs: GymPrefs, light: boolean): string {
  const e = EXERCISES[id];
  if (prefs.place === 'basic' && e.gym) {
    const sub: Record<string, string> = { 'chest-press-machine': 'pushup', bench: 'pushup', 'lat-pulldown': 'db-row', 'seated-row': 'db-row', 'leg-press': 'squat', 'tricep-pushdown': 'pushup', cycle: 'walk', treadmill: 'walk' };
    id = sub[id] ?? id;
  }
  if (light && EXERCISES[id].heavy) {
    const sub: Record<string, string> = { bench: 'pushup', 'shoulder-press': 'face-pull', rdl: 'glute-bridge' };
    id = sub[id] ?? id;
  }
  return id;
}

export function buildGymPlan(prefs: GymPrefs, rules: Constraints | null): GymPlan {
  const cap = rules?.exercise.cap ?? 'normal';
  const lightOnly = cap === 'gentle';
  const moderateOnly = cap === 'moderate';
  const beginner = prefs.level === 'beginner' || lightOnly;
  const perSession = prefs.goal === 'general' ? 5 : 6;
  const sets = lightOnly ? 2 : beginner ? 2 : moderateOnly ? 3 : 3;
  const reps = lightOnly ? '12–15 (easy)' : prefs.goal === 'muscle' ? '8–12' : beginner ? '10–12' : '10–15';
  const weekdays = WEEKDAYS[prefs.daysPerWeek];
  const cardio: Prescription | null = prefs.goal === 'fat_loss' || prefs.goal === 'general'
    ? { id: adjust(prefs.goal === 'fat_loss' ? 'treadmill' : 'walk', prefs, lightOnly), sets: 1, reps: lightOnly ? '10–15 min easy' : prefs.goal === 'fat_loss' ? '15–20 min' : '10–15 min' }
    : null;

  const days: PlanDay[] = Array.from({ length: 7 }, (_, weekday) => ({ weekday, session: null as Session | null }));
  weekdays.forEach((wd, i) => {
    const focus = focusFor(prefs.daysPerWeek, i);
    const unique: string[] = [];
    for (const id of [...TEMPLATES[focus], 'squat', 'pushup', 'db-row', 'glute-bridge', 'plank', 'dead-bug']) {
      const a = adjust(id, prefs, lightOnly);
      if (!unique.includes(a)) unique.push(a);
      if (unique.length === perSession) break;
    }
    days[wd].session = {
      key: `${focus}-${i + 1}`, focus,
      items: unique.map((id) => ({ id, sets: EXERCISES[id].group === 'core' ? 2 : sets, reps: EXERCISES[id].id === 'plank' ? '20–40 sec' : reps })),
      cardio, warmupMin: 5, cooldownMin: 5,
    };
  });
  return {
    days,
    effort: lightOnly ? { low: 3, high: 5 } : moderateOnly || beginner ? { low: 5, high: 7 } : { low: 6, high: 8 },
    lightOnly,
    needsClinicianCheck: !!rules?.exercise.needsClinicianCheck,
    avoidBreathHolding: !!rules && rules.active.includes('hypertension'),
  };
}

/** Monday = 0 … Sunday = 6, from a JS Date. */
export const weekdayOf = (d: Date) => (d.getDay() + 6) % 7;
export const sessionFor = (plan: GymPlan, d: Date): Session | null => plan.days[weekdayOf(d)].session;
export const nextWorkout = (plan: GymPlan, d: Date): { inDays: number; session: Session } | null => {
  for (let k = 0; k < 7; k++) {
    const s = plan.days[(weekdayOf(d) + k) % 7].session;
    if (s) return { inDays: k, session: s };
  }
  return null;
};

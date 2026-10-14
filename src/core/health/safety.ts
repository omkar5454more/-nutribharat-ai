import type { ConditionId, HealthCondition, HealthProfile, Restriction } from './conditions';
import type { FoodTag } from './foodTags';

/**
 * Rule-based safety layer. It is deliberately conservative, only ever PREFERS / LIMITS foods, adds gentle notes, and points to a clinician.
 * It never diagnoses, never changes or recommends medicines, and treats a clinician's instruction as stronger than anything here.
 * Every threshold and rule below needs review by a qualified clinician / dietitian before real-world use.
 */

export type SafetyNoteCode =
  | 'clinician_first' | 'medication_boundary' | 'combined_plan' | 'concern_general' | 'other_general'
  | 'diabetes_carbs' | 'diabetes_regular_meals' | 'diabetes_exercise_check' | 'diabetes_deficit'
  | 'bp_sodium' | 'bp_activity' | 'chol_fats' | 'anemia_iron' | 'anemia_assessment' | 'anemia_tea_gap'
  | 'gerd_dinner' | 'gerd_meals' | 'migraine_regular' | 'migraine_triggers_personal' | 'migraine_hydration'
  | 'pcos_balanced' | 'pcos_sleep' | 'pcos_cycle_optional' | 'thyroid_medicine_timing' | 'symptom_gentle_exercise' | 'fluid_clinician';

export type ConflictCode = 'iron_vs_saturated_fat' | 'caffeine_gerd_vs_migraine';

export type Intensity = 'gentle' | 'moderate' | 'normal';
const RANK: Record<Intensity, number> = { gentle: 0, moderate: 1, normal: 2 };

export type Constraints = {
  avoidTags: Set<FoodTag>;
  limitTags: Set<FoodTag>;
  preferTags: Set<FoodTag>;
  /** longest comfortable gap between meals, in hours (null = no rule) */
  mealGapMaxHours: number | null;
  /** do not suggest skipping meals or fasting */
  noSkipMeals: boolean;
  /** minutes between dinner and sleep */
  dinnerBeforeSleepMin: number;
  exercise: { cap: Intensity; needsClinicianCheck: boolean; avoidAfterMealMin: number };
  hydration: 'normal' | 'emphasis' | 'clinician_limited';
  sleepRegularity: boolean;
  logs: { glucose: boolean; bp: boolean; triggerDiary: boolean; cycle: boolean };
  /** a calorie deficit should be agreed with a clinician first */
  deficitNeedsClinician: boolean;
  notes: { code: SafetyNoteCode; conditions?: ConditionId[] }[];
  conflicts: { code: ConflictCode; between: ConditionId[] }[];
  /** conditions that actually shaped these rules (diagnosed + asked for personalisation) */
  active: ConditionId[];
  /** the person's own clinician notes, to show first */
  instructions: string[];
};

const RESTRICTION_RULES: Record<Restriction, (c: Constraints) => void> = {
  low_sodium: (c) => c.avoidTags.add('high_sodium'),
  low_sugar: (c) => c.avoidTags.add('high_sugar'),
  low_fat: (c) => { c.avoidTags.add('high_sat_fat'); c.avoidTags.add('fried'); },
  low_carb: (c) => { c.limitTags.add('high_carb'); c.limitTags.add('refined_carb'); },
  high_fiber: (c) => c.preferTags.add('fiber_rich'),
  fluid_limit: (c) => { c.hydration = 'clinician_limited'; },
  avoid_caffeine: (c) => c.avoidTags.add('caffeine'),
  avoid_spicy: (c) => c.avoidTags.add('spicy'),
  small_frequent_meals: (c) => { c.mealGapMaxHours = Math.min(c.mealGapMaxHours ?? 99, 3.5); },
};

function empty(): Constraints {
  return {
    avoidTags: new Set(), limitTags: new Set(), preferTags: new Set(), mealGapMaxHours: null, noSkipMeals: false, dinnerBeforeSleepMin: 120,
    exercise: { cap: 'normal', needsClinicianCheck: false, avoidAfterMealMin: 30 }, hydration: 'normal', sleepRegularity: false,
    logs: { glucose: false, bp: false, triggerDiary: false, cycle: false }, deficitNeedsClinician: false, notes: [], conflicts: [], active: [], instructions: [],
  };
}

function capExercise(c: Constraints, cap: Intensity, needsCheck = false) {
  if (RANK[cap] < RANK[c.exercise.cap]) c.exercise.cap = cap;
  if (needsCheck) c.exercise.needsClinicianCheck = true;
}

const addNote = (c: Constraints, code: SafetyNoteCode, conditions?: ConditionId[]) => {
  if (!c.notes.some((n) => n.code === code)) c.notes.push({ code, conditions });
};

function applyCondition(c: Constraints, cond: HealthCondition) {
  const meds = new Set(cond.medicationFlags);
  switch (cond.id) {
    case 'diabetes':
      c.limitTags.add('high_sugar'); c.limitTags.add('refined_carb'); c.avoidTags.add('high_sugar');
      c.preferTags.add('fiber_rich'); c.preferTags.add('high_protein');
      c.mealGapMaxHours = Math.min(c.mealGapMaxHours ?? 99, 4.5); c.noSkipMeals = true; c.logs.glucose = true;
      capExercise(c, 'moderate');
      if (meds.has('insulin') || meds.has('oral_diabetes_medicine')) { capExercise(c, 'gentle', true); c.deficitNeedsClinician = true; addNote(c, 'diabetes_exercise_check', ['diabetes']); addNote(c, 'diabetes_deficit', ['diabetes']); }
      addNote(c, 'diabetes_carbs', ['diabetes']); addNote(c, 'diabetes_regular_meals', ['diabetes']);
      break;
    case 'hypertension':
      c.avoidTags.add('high_sodium'); c.limitTags.add('fried'); c.preferTags.add('fiber_rich'); c.logs.bp = true;
      capExercise(c, 'moderate', meds.has('bp_medicine') || meds.has('diuretic'));
      addNote(c, 'bp_sodium', ['hypertension']); addNote(c, 'bp_activity', ['hypertension']);
      break;
    case 'high_cholesterol':
      c.limitTags.add('high_sat_fat'); c.limitTags.add('fried'); c.preferTags.add('fiber_rich');
      addNote(c, 'chol_fats', ['high_cholesterol']);
      break;
    case 'anemia':
      c.preferTags.add('iron_rich');
      addNote(c, 'anemia_iron', ['anemia']); addNote(c, 'anemia_tea_gap', ['anemia']);
      break;
    case 'gerd':
      c.avoidTags.add('spicy'); c.limitTags.add('fried'); c.limitTags.add('heavy'); c.limitTags.add('caffeine');
      c.dinnerBeforeSleepMin = Math.max(c.dinnerBeforeSleepMin, 180); c.exercise.avoidAfterMealMin = Math.max(c.exercise.avoidAfterMealMin, 60);
      c.mealGapMaxHours = Math.min(c.mealGapMaxHours ?? 99, 5);
      addNote(c, 'gerd_dinner', ['gerd']); addNote(c, 'gerd_meals', ['gerd']);
      break;
    case 'migraine':
      c.noSkipMeals = true; c.mealGapMaxHours = Math.min(c.mealGapMaxHours ?? 99, 5); c.sleepRegularity = true; c.logs.triggerDiary = true;
      if (c.hydration !== 'clinician_limited') c.hydration = 'emphasis';
      addNote(c, 'migraine_regular', ['migraine']); addNote(c, 'migraine_hydration', ['migraine']); addNote(c, 'migraine_triggers_personal', ['migraine']);
      break;
    case 'pcos':
      c.limitTags.add('high_sugar'); c.limitTags.add('refined_carb'); c.preferTags.add('fiber_rich'); c.preferTags.add('high_protein'); c.sleepRegularity = true; c.logs.cycle = true;
      addNote(c, 'pcos_balanced', ['pcos']); addNote(c, 'pcos_sleep', ['pcos']); addNote(c, 'pcos_cycle_optional', ['pcos']);
      break;
    case 'thyroid':
      addNote(c, 'thyroid_medicine_timing', ['thyroid']);   // medicine timing is the clinician's / pharmacist's call — no food rules from us
      break;
    case 'other':
      addNote(c, 'other_general', ['other']);
      break;
  }
  // symptoms the person reported make activity gentler and point to a clinician; they are never used to name a disease
  if (cond.symptoms.includes('dizziness') || cond.symptoms.includes('palpitations')) { capExercise(c, 'gentle', true); addNote(c, 'symptom_gentle_exercise', [cond.id]); }
  for (const r of cond.restrictions) RESTRICTION_RULES[r]?.(c);
}

/**
 * One combined set of rules for everything the person told us (diagnosed + asked for personalisation).
 * A 'concern' (suspected, not diagnosed) adds only a general note — it never adds a rule.
 */
export function buildConstraints(h: HealthProfile): Constraints {
  const c = empty();
  c.instructions = h.instructions.map((s) => s.trim()).filter(Boolean);
  const active = h.conditions.filter((x) => x.status === 'diagnosed' && x.wantsAware);
  c.active = active.map((x) => x.id);

  if (c.instructions.length) addNote(c, 'clinician_first');
  if (h.conditions.some((x) => x.status === 'concern')) addNote(c, 'concern_general');
  if (h.conditions.some((x) => x.id === 'anemia')) addNote(c, 'anemia_assessment', ['anemia']);
  for (const cond of active) applyCondition(c, cond);
  if (active.some((x) => x.medicationFlags.length)) addNote(c, 'medication_boundary');
  if (c.hydration === 'clinician_limited') addNote(c, 'fluid_clinician');

  const has = (id: ConditionId) => c.active.includes(id);
  // conflicts: one combined, conservative routine — never two contradictory ones
  if (has('anemia') && has('high_cholesterol')) {
    c.conflicts.push({ code: 'iron_vs_saturated_fat', between: ['anemia', 'high_cholesterol'] });
    c.avoidTags.add('high_sat_fat');                       // lean on plant iron (dal, rajma, chana, greens) rather than rich dishes
  }
  if (has('gerd') && has('migraine')) {
    c.conflicts.push({ code: 'caffeine_gerd_vs_migraine', between: ['gerd', 'migraine'] });
    c.limitTags.delete('caffeine');                         // do not push a sudden caffeine change (withdrawal can itself bring headaches)
    c.avoidTags.delete('caffeine');
  }
  if (c.active.length >= 2) addNote(c, 'combined_plan');
  // a tag cannot be both preferred and avoided: avoiding wins
  for (const t of c.avoidTags) { c.preferTags.delete(t); c.limitTags.delete(t); }
  return c;
}

// ---------------------------------------------------------------- readings
export type Level = 'normal' | 'info' | 'warning' | 'urgent';
export type ReadingCode =
  | 'bp_normal' | 'bp_elevated' | 'bp_high' | 'bp_crisis' | 'bp_low'
  | 'glucose_normal' | 'glucose_high' | 'glucose_very_high' | 'glucose_crisis' | 'glucose_low' | 'glucose_severe_low';
export type ReadingEval = { level: Level; code: ReadingCode; emergency: boolean };

export function evaluateBp(systolic: number, diastolic: number): ReadingEval {
  if (systolic >= 180 || diastolic >= 120) return { level: 'urgent', code: 'bp_crisis', emergency: true };
  if (systolic < 90 || diastolic < 60) return { level: 'warning', code: 'bp_low', emergency: false };
  if (systolic >= 140 || diastolic >= 90) return { level: 'warning', code: 'bp_high', emergency: false };
  if (systolic >= 130 || diastolic >= 80) return { level: 'info', code: 'bp_elevated', emergency: false };
  return { level: 'normal', code: 'bp_normal', emergency: false };
}

export type GlucoseContext = 'fasting' | 'post_meal' | 'bedtime' | 'random';

export function evaluateGlucose(mgdl: number, context: GlucoseContext = 'random'): ReadingEval {
  if (mgdl < 54) return { level: 'urgent', code: 'glucose_severe_low', emergency: true };
  if (mgdl < 70) return { level: 'warning', code: 'glucose_low', emergency: false };
  if (mgdl >= 300) return { level: 'urgent', code: 'glucose_crisis', emergency: true };
  if (mgdl >= 250) return { level: 'warning', code: 'glucose_very_high', emergency: false };
  if ((context === 'fasting' && mgdl >= 126) || (context === 'post_meal' && mgdl >= 180) || (context !== 'fasting' && context !== 'post_meal' && mgdl >= 200)) {
    return { level: 'info', code: 'glucose_high', emergency: false };
  }
  return { level: 'normal', code: 'glucose_normal', emergency: false };
}

// ---------------------------------------------------------------- text checks (chat, notes)
const any = (text: string, patterns: RegExp[]) => patterns.some((p) => p.test(text));

const EMERGENCY = [
  /chest (pain|pressure|tightness)/i, /(can'?t|cannot|unable to) breathe/i, /(difficulty|trouble) breathing/i, /shortness of breath/i,
  /\b(faint(ed|ing)?|passed out|unconscious|collapsed)\b/i, /(worst|sudden|thunderclap).{0,20}headache/i, /slurred speech|face (is )?droop/i,
  /(weakness|numbness).{0,25}(one side|left side|right side)/i, /(sudden|loss of).{0,15}(vision|sight)/i, /vomit(ing)? blood|blood in (my )?(stool|vomit)|black (stool|tarry)/i,
  /\bseizure|\bconvulsion/i, /severe bleeding/i,
  /सीने में (दर्द|जकड़न)/, /सांस (लेने )?में (तकलीफ|दिक्कत)/, /बेहोश/, /दौरा पड़/, /खून की उल्टी/,
  /छातीत (दुखत|वेदना)/, /श्वास घेण्यास त्रास/, /बेशुद्ध/,
];
const SELF_HARM = [/suicid/i, /kill (myself|me)/i, /end my life/i, /want to die/i, /आत्महत्या/, /मरना चाहता|मरना चाहती/, /जीव(न)? संपव/];

export type RedFlag = { urgent: false } | { urgent: true; code: 'emergency_symptom' | 'self_harm' };

/** Looks for words that describe an emergency. It cannot assess anything — it only decides to say "get help now" instead of coaching. */
export function detectRedFlags(text: string): RedFlag {
  if (any(text, SELF_HARM)) return { urgent: true, code: 'self_harm' };
  if (any(text, EMERGENCY)) return { urgent: true, code: 'emergency_symptom' };
  return { urgent: false };
}

const MEDICATION = [
  /(stop|quit|skip|miss|reduce|lower|increase|double|change|adjust|halve).{0,25}(medicine|medication|insulin|tablet|pill|dose|dosage|metformin|thyroxine|statin)/i,
  /(medicine|medication|insulin|tablet|pill|dose).{0,25}(stop|skip|reduce|lower|increase|double|change|adjust)/i,
  /without (my )?(doctor|medicine|insulin)/i, /(दवा|दवाई|इंसुलिन|गोली).{0,15}(बंद|छोड़|कम|बढ़ा|डोज)/, /(औषध|गोळी|इन्सुलिन).{0,15}(बंद|सोड|कमी|वाढव)/,
];
const UNSAFE_DIET = [
  /fast(ing)? for (\d+|several|many|a few) days/i, /\bstarv(e|ing|ation)\b/i, /only (water|juice)\b.{0,15}(for|days)/i, /(under|below|less than) ?(\d{3}) ?(kcal|calories?)\b/i,
  /\b(300|400|500|600|700|800|900|1000) ?(kcal|calories?) (a|per) day/i, /crash diet/i, /one meal a day|omad/i, /detox (for|cleanse)/i,
];
const CURE = [/\bcure\b.{0,20}(diabetes|thyroid|pcos|pcod|bp|hypertension|migraine)/i, /(reverse|cure) (my )?(diabetes|pcos|pcod|thyroid)/i];

export type RequestCheck = { blocked: false } | { blocked: true; code: 'medication_boundary' | 'unsafe_diet' | 'cure_claim' };

/** Requests the coach must not act on: changing medicines, extreme diets, "cures". The app answers with a safe boundary message instead. */
export function checkRequest(text: string): RequestCheck {
  if (any(text, MEDICATION)) return { blocked: true, code: 'medication_boundary' };
  if (any(text, UNSAFE_DIET)) return { blocked: true, code: 'unsafe_diet' };
  if (any(text, CURE)) return { blocked: true, code: 'cure_claim' };
  return { blocked: false };
}

/** Would skipping a meal / fasting be a reasonable thing to offer this person? */
export const mayOfferFasting = (c: Constraints) => !c.noSkipMeals && c.active.length === 0;

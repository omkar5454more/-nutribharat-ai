export type ConditionId = 'pcos' | 'migraine' | 'hypertension' | 'diabetes' | 'thyroid' | 'high_cholesterol' | 'anemia' | 'gerd' | 'other';
export type ConditionStatus = 'diagnosed' | 'concern';
export type MeasurementKind = 'bp' | 'glucose' | 'cycle' | 'symptom' | 'migraine';

export const CONDITION_IDS: ConditionId[] = ['pcos', 'migraine', 'hypertension', 'diabetes', 'thyroid', 'high_cholesterol', 'anemia', 'gerd', 'other'];

/** Things a clinician may have told the person to follow. Chosen by the user; the app never adds one on its own. */
export const RESTRICTIONS = ['low_sodium', 'low_sugar', 'low_fat', 'low_carb', 'high_fiber', 'fluid_limit', 'avoid_caffeine', 'avoid_spicy', 'small_frequent_meals'] as const;
export type Restriction = (typeof RESTRICTIONS)[number];

/** Kinds of medicine that can matter for FOOD or EXERCISE safety. Never a drug name or a dose. */
export const MEDICATION_FLAGS = ['insulin', 'oral_diabetes_medicine', 'bp_medicine', 'diuretic', 'thyroid_medicine', 'cholesterol_medicine', 'iron_supplement', 'hormonal_medicine', 'migraine_medicine', 'acid_reducer', 'blood_thinner'] as const;
export type MedicationFlag = (typeof MEDICATION_FLAGS)[number];

export const SYMPTOMS = ['irregular_cycles', 'acne', 'fatigue', 'aura', 'nausea', 'light_sensitivity', 'dizziness', 'heartburn', 'palpitations', 'weakness'] as const;
export type Symptom = (typeof SYMPTOMS)[number];

type Def = {
  /** medicines worth asking about for this condition */
  medicationFlags: MedicationFlag[];
  /** symptoms the person may want to keep an eye on */
  symptoms: Symptom[];
  /** logs this condition benefits from */
  logs: MeasurementKind[];
};

export const CONDITION_DEFS: Record<ConditionId, Def> = {
  pcos: { medicationFlags: ['hormonal_medicine'], symptoms: ['irregular_cycles', 'acne', 'fatigue'], logs: ['cycle', 'symptom'] },
  migraine: { medicationFlags: ['migraine_medicine'], symptoms: ['aura', 'nausea', 'light_sensitivity'], logs: ['migraine'] },
  hypertension: { medicationFlags: ['bp_medicine', 'diuretic'], symptoms: ['dizziness', 'palpitations'], logs: ['bp'] },
  diabetes: { medicationFlags: ['insulin', 'oral_diabetes_medicine'], symptoms: ['fatigue', 'dizziness', 'weakness'], logs: ['glucose'] },
  thyroid: { medicationFlags: ['thyroid_medicine'], symptoms: ['fatigue', 'palpitations'], logs: ['symptom'] },
  high_cholesterol: { medicationFlags: ['cholesterol_medicine'], symptoms: [], logs: [] },
  anemia: { medicationFlags: ['iron_supplement'], symptoms: ['fatigue', 'dizziness', 'weakness'], logs: ['symptom'] },
  gerd: { medicationFlags: ['acid_reducer'], symptoms: ['heartburn', 'nausea'], logs: ['symptom'] },
  other: { medicationFlags: [], symptoms: [], logs: ['symptom'] },
};

/** One person's recorded health picture. Contains only what they chose to share, with consent. */
export type HealthCondition = {
  id: ConditionId;
  /** 'concern' = something they suspect. Never treated as a diagnosis: it only unlocks general tips. */
  status: ConditionStatus;
  otherLabel?: string;
  restrictions: Restriction[];
  medicationFlags: MedicationFlag[];
  symptoms: Symptom[];
  /** the person asked for condition-aware suggestions */
  wantsAware: boolean;
};

export type HealthProfile = {
  conditions: HealthCondition[];
  /** the person's own notes of their clinician's instructions (free text, shown back to them, never interpreted as medical orders by the app) */
  instructions: string[];
};

export const EMPTY_HEALTH: HealthProfile = { conditions: [], instructions: [] };

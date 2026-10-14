import { describe, expect, it } from 'vitest';
import { EMPTY_HEALTH, type ConditionId, type HealthCondition, type HealthProfile } from './conditions';
import { alternativesFor, hasTag, tagsOf } from './foodTags';
import { FOODS } from '../foods';
import { buildConstraints, checkRequest, detectRedFlags, evaluateBp, evaluateGlucose, mayOfferFasting } from './safety';

const cond = (id: ConditionId, over: Partial<HealthCondition> = {}): HealthCondition => ({ id, status: 'diagnosed', restrictions: [], medicationFlags: [], symptoms: [], wantsAware: true, ...over });
const profile = (conditions: HealthCondition[], instructions: string[] = []): HealthProfile => ({ conditions, instructions });
const notes = (c: ReturnType<typeof buildConstraints>) => c.notes.map((n) => n.code);

describe('food tags', () => {
  it('every food in the table has tags or is deliberately plain, and alternatives exist in the table', () => {
    for (const f of FOODS) for (const t of tagsOf(f.id)) expect(typeof t).toBe('string');
    for (const id of Object.keys({ samosa: 1, 'vada-pav': 1, jalebi: 1, pizza: 1 })) for (const alt of alternativesFor(id)) expect(FOODS.some((f) => f.id === alt)).toBe(true);
    expect(hasTag('jalebi', 'high_sugar')).toBe(true);
    expect(hasTag('rajma', 'iron_rich')).toBe(true);
    expect(tagsOf('unknown-food')).toEqual([]);
  });
});

describe('no conditions', () => {
  it('adds no rules at all', () => {
    const c = buildConstraints(EMPTY_HEALTH);
    expect(c.avoidTags.size + c.limitTags.size + c.preferTags.size).toBe(0);
    expect(c.noSkipMeals).toBe(false);
    expect(c.exercise.cap).toBe('normal');
    expect(c.notes).toEqual([]);
    expect(mayOfferFasting(c)).toBe(true);
  });
});

describe('single conditions', () => {
  it('diabetes: carbohydrate awareness, regular meals, no fasting, glucose log', () => {
    const c = buildConstraints(profile([cond('diabetes')]));
    expect(c.avoidTags.has('high_sugar')).toBe(true);
    expect(c.limitTags.has('refined_carb')).toBe(true);
    expect(c.preferTags.has('fiber_rich')).toBe(true);
    expect(c.mealGapMaxHours).toBeLessThanOrEqual(4.5);
    expect(c.noSkipMeals).toBe(true);
    expect(c.logs.glucose).toBe(true);
    expect(mayOfferFasting(c)).toBe(false);
    expect(notes(c)).toEqual(expect.arrayContaining(['diabetes_carbs', 'diabetes_regular_meals']));
  });

  it('diabetes with insulin or tablets: gentle exercise, clinician check, medicine boundary, deficit needs a clinician', () => {
    const c = buildConstraints(profile([cond('diabetes', { medicationFlags: ['insulin'] })]));
    expect(c.exercise).toMatchObject({ cap: 'gentle', needsClinicianCheck: true });
    expect(c.deficitNeedsClinician).toBe(true);
    expect(notes(c)).toEqual(expect.arrayContaining(['medication_boundary', 'diabetes_exercise_check', 'diabetes_deficit']));
  });

  it('hypertension: low-sodium choices, BP log, moderate activity', () => {
    const c = buildConstraints(profile([cond('hypertension', { medicationFlags: ['bp_medicine'] })]));
    expect(c.avoidTags.has('high_sodium')).toBe(true);
    expect(c.logs.bp).toBe(true);
    expect(c.exercise.cap).toBe('moderate');
    expect(c.exercise.needsClinicianCheck).toBe(true);
  });

  it('migraine: regular meals, hydration, sleep regularity, trigger diary — and NO assumed food triggers', () => {
    const c = buildConstraints(profile([cond('migraine')]));
    expect(c.noSkipMeals).toBe(true);
    expect(c.hydration).toBe('emphasis');
    expect(c.sleepRegularity).toBe(true);
    expect(c.logs.triggerDiary).toBe(true);
    expect(c.avoidTags.size).toBe(0);                       // no food is banned "for everyone with migraine"
    expect(notes(c)).toContain('migraine_triggers_personal');
  });

  it('GERD: later dinner gap, no spicy/fried, no exercise right after eating', () => {
    const c = buildConstraints(profile([cond('gerd')]));
    expect(c.dinnerBeforeSleepMin).toBeGreaterThanOrEqual(180);
    expect(c.avoidTags.has('spicy')).toBe(true);
    expect(c.exercise.avoidAfterMealMin).toBeGreaterThanOrEqual(60);
  });

  it('thyroid: only a note — medicine timing is left to the clinician / pharmacist', () => {
    const c = buildConstraints(profile([cond('thyroid', { medicationFlags: ['thyroid_medicine'] })]));
    expect(c.avoidTags.size + c.limitTags.size).toBe(0);
    expect(notes(c)).toEqual(expect.arrayContaining(['thyroid_medicine_timing', 'medication_boundary']));
  });

  it('anemia: iron-rich foods are preferred, and a medical assessment is always recommended', () => {
    const c = buildConstraints(profile([cond('anemia')]));
    expect(c.preferTags.has('iron_rich')).toBe(true);
    expect(notes(c)).toContain('anemia_assessment');
  });

  it('PCOS: balanced meals, sleep regularity, optional cycle log', () => {
    const c = buildConstraints(profile([cond('pcos')]));
    expect(c.preferTags.has('high_protein')).toBe(true);
    expect(c.sleepRegularity).toBe(true);
    expect(c.logs.cycle).toBe(true);
  });
});

describe('suspected concerns and opt-outs', () => {
  it('a suspected concern never adds a rule — only a general note', () => {
    const c = buildConstraints(profile([cond('diabetes', { status: 'concern' })]));
    expect(c.active).toEqual([]);
    expect(c.avoidTags.size + c.limitTags.size).toBe(0);
    expect(c.noSkipMeals).toBe(false);
    expect(notes(c)).toEqual(['concern_general']);
  });

  it('conditions the person did not ask to personalise are ignored', () => {
    const c = buildConstraints(profile([cond('hypertension', { wantsAware: false })]));
    expect(c.active).toEqual([]);
    expect(c.avoidTags.size).toBe(0);
  });

  it('anemia concern still recommends an assessment', () => {
    expect(notes(buildConstraints(profile([cond('anemia', { status: 'concern' })])))).toEqual(expect.arrayContaining(['concern_general', 'anemia_assessment']));
  });
});

describe('multiple conditions: one combined plan, conservative on conflicts', () => {
  it('diabetes + high blood pressure + cholesterol produce ONE rule set that respects all three', () => {
    const c = buildConstraints(profile([cond('diabetes'), cond('hypertension'), cond('high_cholesterol')]));
    expect(c.avoidTags.has('high_sugar') && c.avoidTags.has('high_sodium')).toBe(true);
    expect(c.limitTags.has('high_sat_fat')).toBe(true);
    expect(c.preferTags.has('fiber_rich')).toBe(true);
    expect(c.noSkipMeals).toBe(true);
    expect(c.exercise.cap).toBe('moderate');
    expect(notes(c)).toContain('combined_plan');
    for (const t of c.avoidTags) expect(c.preferTags.has(t) || c.limitTags.has(t)).toBe(false);   // never "avoid" and "prefer" the same thing
  });

  it('anemia + high cholesterol: iron from plants — saturated-fat-heavy iron dishes are avoided', () => {
    const c = buildConstraints(profile([cond('anemia'), cond('high_cholesterol')]));
    expect(c.conflicts.map((x) => x.code)).toContain('iron_vs_saturated_fat');
    expect(c.avoidTags.has('high_sat_fat')).toBe(true);
    expect(c.preferTags.has('iron_rich')).toBe(true);
  });

  it('GERD + migraine: no sudden caffeine push in either direction', () => {
    const c = buildConstraints(profile([cond('gerd'), cond('migraine')]));
    expect(c.conflicts.map((x) => x.code)).toContain('caffeine_gerd_vs_migraine');
    expect(c.avoidTags.has('caffeine') || c.limitTags.has('caffeine')).toBe(false);
  });

  it('the most conservative exercise cap wins; a reported dizziness symptom makes it gentle', () => {
    expect(buildConstraints(profile([cond('hypertension'), cond('diabetes', { medicationFlags: ['oral_diabetes_medicine'] })])).exercise.cap).toBe('gentle');
    const c = buildConstraints(profile([cond('anemia', { symptoms: ['dizziness'] })]));
    expect(c.exercise).toMatchObject({ cap: 'gentle', needsClinicianCheck: true });
  });

  it('restrictions from a clinician are applied, and a fluid limit switches hydration prompts off', () => {
    const c = buildConstraints(profile([cond('hypertension', { restrictions: ['low_sodium', 'fluid_limit', 'avoid_spicy'] })]));
    expect(c.avoidTags.has('spicy')).toBe(true);
    expect(c.hydration).toBe('clinician_limited');
    expect(notes(c)).toContain('fluid_clinician');
    const m = buildConstraints(profile([cond('migraine', { restrictions: ['fluid_limit'] })]));
    expect(m.hydration).toBe('clinician_limited');                       // beats the migraine "drink more" default
  });

  it('a clinician’s own instructions are surfaced first', () => {
    const c = buildConstraints(profile([cond('diabetes')], ['Walk after dinner for 20 minutes']));
    expect(c.instructions).toEqual(['Walk after dinner for 20 minutes']);
    expect(notes(c)[0]).toBe('clinician_first');
  });
});

describe('blood pressure readings', () => {
  it.each([
    [118, 76, 'normal', 'bp_normal'], [132, 78, 'info', 'bp_elevated'], [126, 84, 'info', 'bp_elevated'], [145, 92, 'warning', 'bp_high'],
    [150, 70, 'warning', 'bp_high'], [85, 55, 'warning', 'bp_low'], [182, 100, 'urgent', 'bp_crisis'], [150, 121, 'urgent', 'bp_crisis'],
  ] as const)('%i/%i -> %s (%s)', (s, d, level, code) => {
    expect(evaluateBp(s, d)).toMatchObject({ level, code });
  });
  it('a crisis reading is flagged as an emergency; nothing else is', () => {
    expect(evaluateBp(190, 110).emergency).toBe(true);
    expect(evaluateBp(160, 100).emergency).toBe(false);
  });
});

describe('glucose readings', () => {
  it.each([
    [52, 'random', 'urgent', 'glucose_severe_low'], [65, 'fasting', 'warning', 'glucose_low'], [92, 'fasting', 'normal', 'glucose_normal'], [128, 'fasting', 'info', 'glucose_high'],
    [150, 'post_meal', 'normal', 'glucose_normal'], [190, 'post_meal', 'info', 'glucose_high'], [210, 'random', 'info', 'glucose_high'], [260, 'random', 'warning', 'glucose_very_high'],
    [320, 'random', 'urgent', 'glucose_crisis'],
  ] as const)('%i mg/dL %s -> %s (%s)', (v, ctx, level, code) => {
    expect(evaluateGlucose(v, ctx)).toMatchObject({ level, code });
  });
  it('severe low and crisis readings are emergencies', () => {
    expect(evaluateGlucose(50).emergency).toBe(true);
    expect(evaluateGlucose(350).emergency).toBe(true);
    expect(evaluateGlucose(65).emergency).toBe(false);
  });
});

describe('red-flag symptoms', () => {
  it.each([
    'I have chest pain since morning', 'sudden worst headache of my life', 'my father is having slurred speech', 'I fainted at work', 'I am vomiting blood',
    'मुझे सीने में दर्द हो रहा है', 'मला श्वास घेण्यास त्रास होतोय', 'he is unconscious',
  ])('%s is an emergency', (t) => {
    expect(detectRedFlags(t)).toEqual({ urgent: true, code: 'emergency_symptom' });
  });
  it.each(['I want to die', 'thinking about suicide', 'मैं आत्महत्या करना चाहता हूँ'])('%s is a self-harm flag', (t) => {
    expect(detectRedFlags(t)).toEqual({ urgent: true, code: 'self_harm' });
  });
  it.each(['What can I eat for breakfast?', 'I have a mild headache after skipping lunch', 'is poha healthy', ''])('%s is not an emergency', (t) => {
    expect(detectRedFlags(t)).toEqual({ urgent: false });
  });
});

describe('requests the coach must refuse', () => {
  it.each([
    ['Should I stop taking my insulin today?', 'medication_boundary'], ['can I skip my BP tablet if I feel fine', 'medication_boundary'], ['increase my metformin dose',  'medication_boundary'],
    ['मैं दवाई बंद कर दूँ?', 'medication_boundary'], ['I want to fast for 5 days', 'unsafe_diet'], ['give me a 500 calories a day plan', 'unsafe_diet'], ['one meal a day to lose weight', 'unsafe_diet'],
    ['how to cure my diabetes with food', 'cure_claim'], ['reverse my pcos', 'cure_claim'],
  ])('%s -> %s', (t, code) => {
    expect(checkRequest(t)).toEqual({ blocked: true, code });
  });
  it.each(['What is a good low-sodium dinner?', 'How much water should I drink?', 'I take my tablet at 8 am, what breakfast goes with it?', 'meal ideas for diabetes'])('%s is allowed', (t) => {
    expect(checkRequest(t)).toEqual({ blocked: false });
  });
});

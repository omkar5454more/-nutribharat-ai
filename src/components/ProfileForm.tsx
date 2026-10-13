import { useState } from 'react';
import { Text } from 'react-native';
import { z } from 'zod';
import { ACTIVITY_LABEL, computeTargets } from '@/core/goals';
import type { ActivityLevel, GoalType, ReproductiveStatus, Sex } from '@/core/types';
import { ageFrom, saveProfile, type ProfileRow } from '@/lib/data';
import { Button, Card, Chips, Field, H2, Muted, Notice } from './ui';

// India's DPDP Act requires verifiable parental consent for under-18s; the MVP simply requires adults.
const MIN_AGE = 18;

const Schema = z.object({
  display_name: z.string().trim().max(40),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD, e.g. 1995-08-21.').refine((s) => !Number.isNaN(Date.parse(s)), 'That date is not valid.'),
  height_cm: z.coerce.number().min(100, 'Height must be between 100 and 230 cm.').max(230, 'Height must be between 100 and 230 cm.'),
  weight_kg: z.coerce.number().min(30, 'Weight must be between 30 and 250 kg.').max(250, 'Weight must be between 30 and 250 kg.'),
});

export function ProfileForm({ userId, initial, onSaved, submitLabel }: { userId: string; initial?: ProfileRow | null; onSaved: () => void; submitLabel: string }) {
  const [name, setName] = useState(initial?.display_name ?? '');
  const [birth, setBirth] = useState(initial?.birth_date ?? '');
  const [height, setHeight] = useState(initial ? String(initial.height_cm) : '');
  const [weight, setWeight] = useState(initial ? String(initial.weight_kg) : '');
  const [sex, setSex] = useState<Sex>(initial?.sex ?? 'female');
  const [activity, setActivity] = useState<ActivityLevel>(initial?.activity ?? 'light');
  const [goal, setGoal] = useState<GoalType>(initial?.goal ?? 'maintain');
  const [repro, setRepro] = useState<ReproductiveStatus>(initial?.reproductive ?? 'none');
  const [diet, setDiet] = useState(initial?.diet ?? 'any');
  const [allergies, setAllergies] = useState((initial?.allergies ?? []).join(', '));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const r = Schema.safeParse({ display_name: name, birth_date: birth, height_cm: height, weight_kg: weight });
    const errs: Record<string, string> = {};
    if (!r.success) r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
    else if (ageFrom(r.data.birth_date) < MIN_AGE) errs.birth_date = `You must be ${MIN_AGE} or older to use NutriBharat AI.`;
    else if (ageFrom(r.data.birth_date) > 100) errs.birth_date = 'That date is not valid.';
    if (Object.keys(errs).length) return setErrors(errs);
    setErrors({});
    setBusy(true);
    try {
      await saveProfile(userId, {
        ...r.data!, sex, activity, goal, reproductive: sex === 'male' ? 'none' : repro, diet,
        allergies: allergies.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean).slice(0, 20),
      });
      onSaved();
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : 'Could not save. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const preview =
    r2(birth, height, weight) &&
    computeTargets({ sex, age: ageFrom(birth), height_cm: +height, weight_kg: +weight, activity, goal, reproductive: sex === 'male' ? 'none' : repro });

  return (
    <>
      <Field label="Name (optional)" value={name} onChangeText={setName} maxLength={40} />
      <Field label="Date of birth" value={birth} onChangeText={setBirth} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" error={errors.birth_date} />
      <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" error={errors.height_cm} />
      <Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" error={errors.weight_kg} />

      <H2>Sex</H2>
      <Chips value={sex} onChange={setSex} options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'other', label: 'Other / prefer not to say' }]} />
      <Muted>Used only to estimate your calorie needs; the formula differs slightly by sex.</Muted>

      {sex !== 'male' ? (
        <>
          <H2>Pregnancy or breastfeeding (optional)</H2>
          <Chips value={repro} onChange={setRepro} options={[{ value: 'none', label: 'Neither' }, { value: 'pregnant', label: 'Pregnant' }, { value: 'breastfeeding', label: 'Breastfeeding' }]} />
        </>
      ) : null}

      <H2>How active are you?</H2>
      <Chips value={activity} onChange={setActivity} options={(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((k) => ({ value: k, label: ACTIVITY_LABEL[k].split(' — ')[0] }))} />
      <Muted>{ACTIVITY_LABEL[activity]}</Muted>

      <H2>Your goal</H2>
      <Chips value={goal} onChange={setGoal} options={[{ value: 'lose', label: 'Lose weight' }, { value: 'maintain', label: 'Stay the same' }, { value: 'gain', label: 'Gain weight' }]} />

      <H2>Food preference</H2>
      <Chips value={diet} onChange={setDiet} options={[{ value: 'any', label: 'Anything' }, { value: 'veg', label: 'Vegetarian' }, { value: 'egg', label: 'Eggetarian' }, { value: 'non-veg', label: 'Non-veg' }, { value: 'vegan', label: 'Vegan' }, { value: 'jain', label: 'Jain' }]} />
      <Field label="Allergies (optional, comma separated)" value={allergies} onChangeText={setAllergies} placeholder="peanuts, milk" />

      {preview ? (
        <Card>
          <H2>Your daily targets</H2>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>{preview.kcal} kcal</Text>
          <Muted>Protein {preview.protein_g} g · Carbs {preview.carbs_g} g · Fat {preview.fat_g} g · Water {(preview.water_ml / 1000).toFixed(1)} L</Muted>
          {preview.notes.map((n) => <Notice key={n}>{n}</Notice>)}
        </Card>
      ) : null}

      {errors.form ? <Notice>{errors.form}</Notice> : null}
      <Button title={submitLabel} onPress={submit} loading={busy} />
    </>
  );
}

const r2 = (birth: string, h: string, w: string) => /^\d{4}-\d{2}-\d{2}$/.test(birth) && !Number.isNaN(Date.parse(birth)) && +h >= 100 && +h <= 230 && +w >= 30 && +w <= 250 && ageFrom(birth) >= MIN_AGE && ageFrom(birth) <= 100;

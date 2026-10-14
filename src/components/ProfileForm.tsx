import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { computeTargets } from '@/core/goals';
import type { ActivityLevel, GoalType, ReproductiveStatus, Sex } from '@/core/types';
import { useT, type Key } from '@/i18n';
import { ageFrom, saveProfile, type MemberInput, type ProfileRow } from '@/lib/data';
import { colors } from '@/lib/theme';
import { Notes } from './common';
import { Button, Card, Chips, Field, H2, Muted, Notice } from './ui';

// India's DPDP Act requires verifiable parental consent for under-18s; the app simply requires adults.
const MIN_AGE = 18;
const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const DIETS = ['any', 'veg', 'egg', 'non-veg', 'vegan', 'jain'] as const;
const RELATIONS = ['spouse', 'parent', 'sibling', 'adultChild', 'other'] as const;

const validBirth = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const num = (s: string) => Number(s.replace(',', '.'));

type Props = {
  userId: string;
  initial?: ProfileRow | null;
  submitLabel: string;
  onSaved: () => void;
  /** 'member' = adding a family member: a name and the person's consent are required */
  mode?: 'self' | 'member';
  /** used in member mode instead of saving the user's own profile */
  onSubmitMember?: (m: MemberInput) => Promise<void>;
};

export function ProfileForm({ userId, initial, onSaved, submitLabel, mode = 'self', onSubmitMember }: Props) {
  const t = useT();
  const isMember = mode === 'member';
  const [name, setName] = useState(initial?.display_name ?? '');
  const [relation, setRelation] = useState<(typeof RELATIONS)[number]>('spouse');
  const [consent, setConsent] = useState(false);
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
    const errs: Record<string, string> = {};
    if (isMember && !name.trim()) errs.name = t('fam.nameNeeded');
    if (!validBirth(birth)) errs.birth_date = t('form.dobFormat');
    else if (ageFrom(birth) < MIN_AGE) errs.birth_date = t('form.dobAdult', { n: MIN_AGE });
    else if (ageFrom(birth) > 100) errs.birth_date = t('form.dobInvalid');
    if (!(num(height) >= 100 && num(height) <= 230)) errs.height_cm = t('form.heightRange');
    if (!(num(weight) >= 30 && num(weight) <= 250)) errs.weight_kg = t('form.weightRange');
    if (isMember && !consent) errs.consent = t('fam.consentNeeded');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const row = {
      display_name: name.trim().slice(0, 40), birth_date: birth, height_cm: num(height), weight_kg: num(weight),
      sex, activity, goal, reproductive: sex === 'male' ? ('none' as const) : repro, diet,
      allergies: allergies.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean).slice(0, 20),
    };
    try {
      if (isMember) await onSubmitMember!({ ...row, relation });
      else await saveProfile(userId, row);
      onSaved();
    } catch {
      setErrors({ form: t('form.saveFail') });
    } finally {
      setBusy(false);
    }
  }

  const ready = validBirth(birth) && num(height) >= 100 && num(height) <= 230 && num(weight) >= 30 && num(weight) <= 250 && ageFrom(birth) >= MIN_AGE && ageFrom(birth) <= 100;
  const preview = ready ? computeTargets({ sex, age: ageFrom(birth), height_cm: num(height), weight_kg: num(weight), activity, goal, reproductive: sex === 'male' ? 'none' : repro }) : null;

  return (
    <>
      <Field label={isMember ? t('fam.name') : t('form.name')} value={name} onChangeText={setName} maxLength={40} error={errors.name} />
      {isMember ? (
        <>
          <H2>{t('fam.relation')}</H2>
          <Chips value={relation} onChange={setRelation} options={RELATIONS.map((v) => ({ value: v, label: t(`fam.rel.${v}` as Key) }))} />
        </>
      ) : null}
      <Field label={t('form.dob')} value={birth} onChangeText={setBirth} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" error={errors.birth_date} />
      <Field label={t('form.height')} value={height} onChangeText={setHeight} keyboardType="decimal-pad" error={errors.height_cm} />
      <Field label={t('form.weight')} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" error={errors.weight_kg} />

      <H2>{t('form.sex')}</H2>
      <Chips value={sex} onChange={setSex} options={(['female', 'male', 'other'] as Sex[]).map((v) => ({ value: v, label: t(`form.sex.${v}` as Key) }))} />
      <Muted>{t('form.sexNote')}</Muted>

      {sex !== 'male' ? (
        <>
          <H2>{t('form.repro')}</H2>
          <Chips value={repro} onChange={setRepro} options={(['none', 'pregnant', 'breastfeeding'] as ReproductiveStatus[]).map((v) => ({ value: v, label: t(`form.repro.${v}` as Key) }))} />
        </>
      ) : null}

      <H2>{t('form.activity')}</H2>
      <Chips value={activity} onChange={setActivity} options={ACTIVITIES.map((v) => ({ value: v, label: t(`act.${v}` as Key) }))} />
      <Muted>{t(`act.${activity}.d` as Key)}</Muted>

      <H2>{t('form.goal')}</H2>
      <Chips value={goal} onChange={setGoal} options={(['lose', 'maintain', 'gain'] as GoalType[]).map((v) => ({ value: v, label: t(`form.goal.${v}` as Key) }))} />

      <H2>{t('form.diet')}</H2>
      <Chips value={diet as (typeof DIETS)[number]} onChange={setDiet} options={DIETS.map((v) => ({ value: v, label: t(`form.diet.${v}` as Key) }))} />
      <Field label={t('form.allergies')} value={allergies} onChangeText={setAllergies} placeholder={t('form.allergiesPh')} />

      {preview ? (
        <Card>
          <H2>{t('form.targets')}</H2>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>{preview.kcal} kcal</Text>
          <Muted>
            {t('macro.protein')} {preview.protein_g} {t('common.g')} · {t('macro.carbs')} {preview.carbs_g} {t('common.g')} · {t('macro.fat')} {preview.fat_g} {t('common.g')} · {t('macro.water')} {(preview.water_ml / 1000).toFixed(1)} L
          </Muted>
          <Notes notes={preview.notes} />
        </Card>
      ) : null}

      {isMember ? (
        <Pressable
          onPress={() => setConsent(!consent)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: errors.consent ? colors.danger : colors.border, backgroundColor: '#fff' }}
        >
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, backgroundColor: consent ? colors.primary : '#fff', alignItems: 'center', justifyContent: 'center' }}>
            {consent ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
          </View>
          <Text style={{ flex: 1, color: colors.text, lineHeight: 20 }}>{t('fam.consent')}</Text>
        </Pressable>
      ) : null}
      {errors.consent ? <Notice>{errors.consent}</Notice> : null}

      {errors.form ? <Notice>{errors.form}</Notice> : null}
      <Button title={submitLabel} onPress={submit} loading={busy} />
    </>
  );
}

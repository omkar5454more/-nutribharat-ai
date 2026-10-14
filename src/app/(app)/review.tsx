import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Button, Card, Chips, H2, Muted, Notice, Screen } from '@/components/ui';
import { FOOD_BY_ID } from '@/core/foods';
import { mealTotals } from '@/core/nutrition';
import { useFoodLabel, useT, type Key } from '@/i18n';
import { saveMeal, useInvalidateMeals, type MealType } from '@/lib/data';
import { colors } from '@/lib/theme';
import { useDraft } from '@/state/draft';
import { useActive } from '@/lib/active';
import { ScanConsiderations } from '@/components/ScanConsiderations';

const TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** Confirm / correct what was recognised. All numbers here come from the food table x the grams the user confirms. */
export default function Review() {
  const t = useT();
  const label = useFoodLabel();
  const router = useRouter();
  const { uid, memberId } = useActive();
  const invalidate = useInvalidateMeals();
  const d = useDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = mealTotals(d.items);
  const hasAi = d.items.some((i) => i.source === 'ai');
  const g = t('common.g');

  async function save() {
    setError('');
    if (d.unmatched.length) return setError(t('review.unmatchedBlock'));
    setBusy(true);
    try {
      await saveMeal(uid!, memberId, d.mealType, d.items);
      invalidate();
      d.reset();
      router.dismissAll();
    } catch {
      setError(t('review.saveFail'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Chips<MealType> value={d.mealType} onChange={d.setMealType} options={TYPES.map((v) => ({ value: v, label: t(`meal.${v}` as Key) }))} />

      {hasAi ? <Notice tone="info">{t('review.aiNote')}</Notice> : null}

      {d.unmatched.map((u, i) => (
        <Card key={`${u.name}-${i}`} style={{ borderColor: colors.accent }}>
          <Text style={{ fontWeight: '700' }}>{t('review.unmatched', { name: u.name })}</Text>
          <Muted>{t('review.unmatchedHint', { g: u.grams })}</Muted>
          <Button title={t('review.choose')} variant="secondary" onPress={() => router.push({ pathname: '/add-food', params: { mode: 'resolve', index: String(i), q: u.name } })} />
          <Button title={t('common.remove')} variant="link" onPress={() => d.dropUnmatched(i)} />
        </Card>
      ))}

      {d.items.length === 0 && d.unmatched.length === 0 ? <Muted>{t('review.empty')}</Muted> : null}

      {d.items.map((it, i) => {
        const name = label(it.foodId, it.name);
        return (
          <Card key={`${it.foodId}-${i}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontWeight: '700', flex: 1 }}>{name}</Text>
              <Text style={{ fontWeight: '700' }}>{it.nutrients.kcal} kcal</Text>
            </View>
            {it.source === 'ai' && it.confidence != null && it.confidence < 0.6 ? <Text style={{ color: colors.accent }}>{t('review.notSure')}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Step label="−" onPress={() => d.setGrams(i, it.grams - 10)} a11y={name} />
              <TextInput
                value={String(it.grams)}
                onChangeText={(v) => d.setGrams(i, Number(v.replace(/[^0-9.]/g, '')) || 1)}
                keyboardType="numeric"
                accessibilityLabel={t('review.gramsOf', { name })}
                style={{ minWidth: 70, minHeight: 44, textAlign: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, fontSize: 16, backgroundColor: '#fff' }}
              />
              <Text style={{ color: colors.muted }}>{g}</Text>
              <Step label="+" onPress={() => d.setGrams(i, it.grams + 10)} a11y={name} />
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Button title={t('review.changeFood')} variant="link" onPress={() => router.push({ pathname: '/add-food', params: { mode: 'replace', index: String(i) } })} />
              <Button title={t('common.remove')} variant="link" onPress={() => d.remove(i)} />
            </View>
            <Muted>
              {t('macro.protein')} {it.nutrients.protein_g} {g} · {t('macro.carbs')} {it.nutrients.carbs_g} {g} · {t('macro.fat')} {it.nutrients.fat_g} {g}
            </Muted>
          </Card>
        );
      })}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button title={t('review.addFood')} variant="secondary" onPress={() => router.push({ pathname: '/add-food', params: { mode: 'add' } })} />
        <Button title={t('review.barcode')} variant="secondary" onPress={() => router.push('/barcode')} />
        <Button title={t('review.oil')} variant="secondary" onPress={() => d.add(FOOD_BY_ID['ghee-oil'], 5)} />
      </View>
      <Muted>{t('review.oilHint')}</Muted>

      <ScanConsiderations items={d.items} />

      <Card>
        <H2>{t('review.total')}</H2>
        <Text style={{ fontSize: 28, fontWeight: '800' }}>{total.kcal} kcal</Text>
        <Muted>
          {t('macro.protein')} {total.protein_g} {g} · {t('macro.carbs')} {total.carbs_g} {g} · {t('macro.fat')} {total.fat_g} {g} · {t('macro.fibre')} {total.fiber_g} {g}
        </Muted>
      </Card>

      {error ? <Notice>{error}</Notice> : null}
      <Button title={t('review.save')} onPress={save} loading={busy} disabled={d.items.length === 0} />
    </Screen>
  );
}

function Step({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${a11y}`} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, color: colors.primaryDark, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

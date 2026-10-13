import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Button, Card, Chips, H2, Muted, Notice, Screen } from '@/components/ui';
import { FOOD_BY_ID } from '@/core/foods';
import { mealTotals } from '@/core/nutrition';
import { saveMeal, useInvalidateMeals, type MealType } from '@/lib/data';
import { colors } from '@/lib/theme';
import { useDraft } from '@/state/draft';
import { useSession } from '@/state/session';

/** Confirm / correct what was recognised. All numbers here come from the food table x the grams the user confirms. */
export default function Review() {
  const router = useRouter();
  const { session } = useSession();
  const invalidate = useInvalidateMeals();
  const d = useDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = mealTotals(d.items);
  const hasAi = d.items.some((i) => i.source === 'ai');

  async function save() {
    setError('');
    if (d.unmatched.length) return setError('Some foods are not matched yet. Pick the right food for each one, or remove it.');
    setBusy(true);
    try {
      await saveMeal(session!.user.id, d.mealType, d.items);
      invalidate();
      d.reset();
      router.dismissAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your meal. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const addOil = (grams: number) => d.add(FOOD_BY_ID['ghee-oil'], grams);

  return (
    <Screen>
      <Chips<MealType>
        value={d.mealType}
        onChange={d.setMealType}
        options={[{ value: 'breakfast', label: 'Breakfast' }, { value: 'lunch', label: 'Lunch' }, { value: 'snack', label: 'Snack' }, { value: 'dinner', label: 'Dinner' }]}
      />

      {hasAi ? <Notice tone="info">AI estimated these foods and amounts from your photo. Please check them — the calories below are calculated from the amounts you confirm.</Notice> : null}

      {d.unmatched.map((u, i) => (
        <Card key={`${u.name}-${i}`} style={{ borderColor: colors.accent }}>
          <Text style={{ fontWeight: '700' }}>“{u.name}” — not in our food list</Text>
          <Muted>About {u.grams} g. Choose the closest food, or remove it.</Muted>
          <Button title="Choose a food" variant="secondary" onPress={() => router.push({ pathname: '/add-food', params: { mode: 'resolve', index: String(i), q: u.name } })} />
          <Button title="Remove" variant="link" onPress={() => d.dropUnmatched(i)} />
        </Card>
      ))}

      {d.items.length === 0 && d.unmatched.length === 0 ? <Muted>No foods yet. Add what you ate.</Muted> : null}

      {d.items.map((it, i) => (
        <Card key={`${it.foodId}-${i}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontWeight: '700', flex: 1 }}>{it.name}</Text>
            <Text style={{ fontWeight: '700' }}>{it.nutrients.kcal} kcal</Text>
          </View>
          {it.source === 'ai' && it.confidence != null && it.confidence < 0.6 ? <Text style={{ color: colors.accent }}>Not sure about this one — please check.</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Step label="−" onPress={() => d.setGrams(i, it.grams - 10)} a11y={`Reduce ${it.name}`} />
            <TextInput
              value={String(it.grams)}
              onChangeText={(t) => d.setGrams(i, Number(t.replace(/[^0-9.]/g, '')) || 1)}
              keyboardType="numeric"
              accessibilityLabel={`Grams of ${it.name}`}
              style={{ minWidth: 70, minHeight: 44, textAlign: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, fontSize: 16, backgroundColor: '#fff' }}
            />
            <Text style={{ color: colors.muted }}>g</Text>
            <Step label="+" onPress={() => d.setGrams(i, it.grams + 10)} a11y={`Increase ${it.name}`} />
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Button title="Change food" variant="link" onPress={() => router.push({ pathname: '/add-food', params: { mode: 'replace', index: String(i) } })} />
            <Button title="Remove" variant="link" onPress={() => d.remove(i)} />
          </View>
          <Muted>P {it.nutrients.protein_g} g · C {it.nutrients.carbs_g} g · F {it.nutrients.fat_g} g</Muted>
        </Card>
      ))}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button title="＋ Add food" variant="secondary" onPress={() => router.push({ pathname: '/add-food', params: { mode: 'add' } })} />
        <Button title="＋ 1 tsp oil/ghee" variant="secondary" onPress={() => addOil(5)} />
      </View>
      <Muted>Cooked with extra oil or ghee? Tap “1 tsp oil/ghee” for each teaspoon. Photos can’t show how much oil was used.</Muted>

      <Card>
        <H2>Meal total</H2>
        <Text style={{ fontSize: 28, fontWeight: '800' }}>{total.kcal} kcal</Text>
        <Muted>Protein {total.protein_g} g · Carbs {total.carbs_g} g · Fat {total.fat_g} g · Fibre {total.fiber_g} g</Muted>
      </Card>

      {error ? <Notice>{error}</Notice> : null}
      <Button title="Save meal" onPress={save} loading={busy} disabled={d.items.length === 0} />
    </Screen>
  );
}

function Step({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, color: colors.primaryDark, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

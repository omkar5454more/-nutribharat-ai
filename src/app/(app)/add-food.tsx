import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Field, Muted, Screen } from '@/components/ui';
import { searchFoods } from '@/core/match';
import { gramsFor } from '@/core/nutrition';
import type { Food } from '@/core/types';
import { colors } from '@/lib/theme';
import { useDraft } from '@/state/draft';

/** Search the Indian food table. `mode` = add | resolve | replace (with `index` for the last two). */
export default function AddFood() {
  const router = useRouter();
  const { mode = 'add', index = '0', q = '' } = useLocalSearchParams<{ mode?: string; index?: string; q?: string }>();
  const [query, setQuery] = useState(String(q));
  const results = useMemo(() => searchFoods(query, 25), [query]);
  const draft = useDraft();

  function choose(food: Food) {
    const i = Number(index);
    if (mode === 'resolve') draft.resolveUnmatched(i, food);
    else if (mode === 'replace') draft.replaceFood(i, food.id);
    else draft.add(food, gramsFor(food, 1));
    router.back();
  }

  return (
    <Screen>
      <Field label="Search foods" value={query} onChangeText={setQuery} placeholder="roti, dal, poha, doodh…" autoFocus autoCapitalize="none" />
      {results.length === 0 ? <Muted>No match. Try a simpler name, like “dal” or “rice”.</Muted> : null}
      {results.map((f) => (
        <Pressable key={f.id} onPress={() => choose(f)} accessibilityRole="button" accessibilityLabel={`Add ${f.name}`}>
          <Card style={{ minHeight: 56 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', flex: 1 }}>{f.name}</Text>
              <Text style={{ color: colors.muted }}>{f.per100g.kcal} kcal / 100 g</Text>
            </View>
            <Muted>{f.units[0].name} ≈ {f.units[0].grams} g</Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

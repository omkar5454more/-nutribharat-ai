import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Field, Muted, Screen } from '@/components/ui';
import { searchFoods } from '@/core/match';
import { gramsFor } from '@/core/nutrition';
import type { Food } from '@/core/types';
import { FOOD_NAMES } from '@/i18n/foodNames';
import { useFoodLabel, useLang, useT } from '@/i18n';
import { colors } from '@/lib/theme';
import { useDraft } from '@/state/draft';

/** Search the Indian food table. `mode` = add | resolve | replace (with `index` for the last two). Hindi / Marathi names are searchable too. */
export default function AddFood() {
  const t = useT();
  const label = useFoodLabel();
  const lang = useLang((s) => s.lang);
  const router = useRouter();
  const { mode = 'add', index = '0', q = '' } = useLocalSearchParams<{ mode?: string; index?: string; q?: string }>();
  const [query, setQuery] = useState(String(q));
  const results = useMemo(() => {
    const byEnglish = searchFoods(query, 25);
    if (lang === 'en' || !query.trim()) return byEnglish;
    // also match what the user typed against the translated names
    const needle = query.trim().toLowerCase();
    const extra = searchFoods('', 100).filter((f) => FOOD_NAMES[lang][f.id]?.toLowerCase().includes(needle) && !byEnglish.includes(f));
    return [...extra, ...byEnglish].slice(0, 25);
  }, [query, lang]);
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
      <Field label={t('add.search')} value={query} onChangeText={setQuery} placeholder={t('add.placeholder')} autoFocus autoCapitalize="none" />
      {results.length === 0 ? <Muted>{t('add.none')}</Muted> : null}
      {results.map((f) => (
        <Pressable key={f.id} onPress={() => choose(f)} accessibilityRole="button" accessibilityLabel={label(f.id, f.name)}>
          <Card style={{ minHeight: 56 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontWeight: '700', flex: 1 }}>{label(f.id, f.name)}</Text>
              <Text style={{ color: colors.muted }}>{t('add.per100', { n: f.per100g.kcal })}</Text>
            </View>
            <Muted>{f.units[0].name} ≈ {f.units[0].grams} {t('common.g')}</Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

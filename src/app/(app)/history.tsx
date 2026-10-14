import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Button, Card, H1, Muted, Notice, Screen } from '@/components/ui';
import { useFoodLabel, useT, type Key } from '@/i18n';
import { useActive } from '@/lib/active';
import { deleteMeal, startOfDay, totalsOf, useInvalidateMeals, useMeals, type MealRow } from '@/lib/data';

const DAYS = 7;

export default function History() {
  const t = useT();
  const label = useFoodLabel();
  const { uid, memberId } = useActive();
  const [error, setError] = useState('');
  const invalidate = useInvalidateMeals();
  const to = new Date(startOfDay().getTime() + 24 * 3600 * 1000);
  const from = new Date(to.getTime() - DAYS * 24 * 3600 * 1000);
  const meals = useMeals(uid, memberId, from, to);

  const byDay = new Map<string, MealRow[]>();
  (meals.data ?? []).forEach((m) => {
    const key = new Date(m.eaten_at).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), m]);
  });

  async function remove(id: string) {
    try {
      await deleteMeal(id);
      invalidate();
    } catch {
      setError(t('hist.deleteFail'));
    }
  }

  function confirmDelete(id: string) {
    if (Platform.OS === 'web') return void (window.confirm(t('hist.deleteTitle')) && remove(id));
    Alert.alert(t('hist.deleteTitle'), undefined, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: () => remove(id) }]);
  }

  return (
    <Screen>
      <H1>{t('hist.title', { n: DAYS })}</H1>
      {error ? <Notice>{error}</Notice> : null}
      {meals.isLoading ? <Muted>{t('common.loading')}</Muted> : null}
      {!meals.isLoading && byDay.size === 0 ? <Muted>{t('hist.none', { n: DAYS })}</Muted> : null}
      {[...byDay.entries()].map(([day, list]) => {
        const tot = totalsOf(list);
        return (
          <Card key={day}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '800' }}>{day}</Text>
              <Text style={{ fontWeight: '800' }}>{Math.round(tot.kcal)} kcal</Text>
            </View>
            <Muted>{t('macro.protein')} {Math.round(tot.protein_g)} {t('common.g')} · {t('macro.carbs')} {Math.round(tot.carbs_g)} {t('common.g')} · {t('macro.fat')} {Math.round(tot.fat_g)} {t('common.g')}</Muted>
            {list.map((m) => (
              <View key={m.id} style={{ borderTopWidth: 1, borderTopColor: '#EEE9DD', paddingTop: 8, gap: 4 }}>
                <Text style={{ fontWeight: '600' }}>{t(`meal.${m.meal_type}` as Key)} · {Math.round(m.kcal)} kcal</Text>
                <Muted>{m.meal_items.map((i) => `${label(i.food_id, i.name)} (${Math.round(i.grams)} ${t('common.g')})`).join(', ')}</Muted>
                <Button title={t('common.delete')} variant="link" onPress={() => confirmDelete(m.id)} />
              </View>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}

import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Button, Card, H1, Muted, Notice, Screen } from '@/components/ui';
import { deleteMeal, startOfDay, totalsOf, useInvalidateMeals, useMeals, type MealRow } from '@/lib/data';
import { useSession } from '@/state/session';

const DAYS = 7;

export default function History() {
  const { session } = useSession();
  const [error, setError] = useState('');
  const invalidate = useInvalidateMeals();
  const to = new Date(startOfDay().getTime() + 24 * 3600 * 1000);
  const from = new Date(to.getTime() - DAYS * 24 * 3600 * 1000);
  const meals = useMeals(session?.user.id, from, to);

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
      setError('Could not delete that meal. Please try again.');
    }
  }

  function confirmDelete(id: string) {
    if (Platform.OS === 'web') return void (window.confirm('Delete this meal?') && remove(id));
    Alert.alert('Delete this meal?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove(id) }]);
  }

  return (
    <Screen>
      <H1>Last {DAYS} days</H1>
      {error ? <Notice>{error}</Notice> : null}
      {meals.isLoading ? <Muted>Loading…</Muted> : null}
      {!meals.isLoading && byDay.size === 0 ? <Muted>No meals logged in the last {DAYS} days.</Muted> : null}
      {[...byDay.entries()].map(([day, list]) => {
        const t = totalsOf(list);
        return (
          <Card key={day}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '800' }}>{day}</Text>
              <Text style={{ fontWeight: '800' }}>{Math.round(t.kcal)} kcal</Text>
            </View>
            <Muted>Protein {Math.round(t.protein_g)} g · Carbs {Math.round(t.carbs_g)} g · Fat {Math.round(t.fat_g)} g</Muted>
            {list.map((m) => (
              <View key={m.id} style={{ borderTopWidth: 1, borderTopColor: '#EEE9DD', paddingTop: 8, gap: 4 }}>
                <Text style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                  {m.meal_type} · {Math.round(m.kcal)} kcal
                </Text>
                <Muted>{m.meal_items.map((i) => `${i.name} (${Math.round(i.grams)} g)`).join(', ')}</Muted>
                <Button title="Delete" variant="link" onPress={() => confirmDelete(m.id)} />
              </View>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}

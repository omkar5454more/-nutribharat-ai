import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, H1, H2, Muted, Notice, ProgressBar, Screen } from '@/components/ui';
import { totalsOf, targetsFor, startOfDay, useMeals, useProfile } from '@/lib/data';
import { colors } from '@/lib/theme';
import { useDraft } from '@/state/draft';
import { useSession } from '@/state/session';

export default function Today() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const profile = useProfile(uid).data!;
  const from = startOfDay();
  const to = new Date(from.getTime() + 24 * 3600 * 1000);
  const meals = useMeals(uid, from, to);
  const targets = targetsFor(profile);
  const eaten = totalsOf(meals.data ?? []);
  const left = targets.kcal - eaten.kcal;
  const reset = useDraft((s) => s.reset);

  return (
    <Screen>
      <H1>{profile.display_name ? `Namaste, ${profile.display_name}` : 'Today'}</H1>

      <Card>
        <Muted>Calories today</Muted>
        <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text }}>
          {eaten.kcal} <Text style={{ fontSize: 16, fontWeight: '600', color: colors.muted }}>/ {targets.kcal} kcal</Text>
        </Text>
        <ProgressBar value={eaten.kcal} max={targets.kcal} />
        <Muted>{left >= 0 ? `${left} kcal left` : `${-left} kcal over your target`}</Muted>
      </Card>

      <Card>
        <Macro label="Protein" value={eaten.protein_g} max={targets.protein_g} color={colors.protein} />
        <Macro label="Carbs" value={eaten.carbs_g} max={targets.carbs_g} color={colors.carbs} />
        <Macro label="Fat" value={eaten.fat_g} max={targets.fat_g} color={colors.fat} />
      </Card>

      {targets.seeProfessional || targets.notes.length ? (
        <Notice>{targets.notes[0] ?? 'For your situation, please follow a doctor or dietitian’s advice; these numbers are only a guide.'}</Notice>
      ) : null}

      <Button title="📷  Scan a meal" onPress={() => router.push('/scan')} />
      <Button
        title="＋  Add food manually"
        variant="secondary"
        onPress={() => {
          reset();
          router.push('/review');
        }}
      />

      <H2>Today’s meals</H2>
      {meals.isLoading ? <Muted>Loading…</Muted> : null}
      {meals.error ? <Notice>Could not load your meals. Check your connection and pull to refresh.</Notice> : null}
      {meals.data?.length === 0 ? <Muted>Nothing logged yet. Scan your first meal to get started.</Muted> : null}
      {meals.data?.map((m) => (
        <Card key={m.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', textTransform: 'capitalize' }}>{m.meal_type}</Text>
            <Text style={{ fontWeight: '700' }}>{Math.round(m.kcal)} kcal</Text>
          </View>
          <Muted>{m.meal_items.map((i) => i.name).join(', ')}</Muted>
        </Card>
      ))}
    </Screen>
  );
}

function Macro({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '600' }}>{label}</Text>
        <Muted>{Math.round(value)} / {max} g</Muted>
      </View>
      <ProgressBar value={value} max={max} color={color} />
    </View>
  );
}

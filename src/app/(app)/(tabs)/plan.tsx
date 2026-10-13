import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Notes } from '@/components/common';
import { Button, Card, Chips, H1, H2, Muted, Notice, Screen } from '@/components/ui';
import { planDay, type DietPref, type Region } from '@/core/planner';
import { useFoodLabel, useT, type Key } from '@/i18n';
import { targetsFor, useProfile } from '@/lib/data';
import { useDraft } from '@/state/draft';
import { useSession } from '@/state/session';

const REGIONS: Region[] = ['any', 'maharashtrian', 'north', 'south', 'gujarati'];

export default function Plan() {
  const t = useT();
  const label = useFoodLabel();
  const router = useRouter();
  const { session } = useSession();
  const profile = useProfile(session?.user.id).data!;
  const targets = targetsFor(profile);
  const [region, setRegion] = useState<Region>('any');
  const [seed, setSeed] = useState(1);
  const start = useDraft((s) => s.start);
  const setMealType = useDraft((s) => s.setMealType);
  const g = t('common.g');

  const plan = useMemo(
    () => planDay({ targets, diet: profile.diet as DietPref, region, allergies: profile.allergies, seed }),
    [targets.kcal, targets.protein_g, profile.diet, profile.allergies.join(','), region, seed]
  );

  function logSlot(i: number) {
    const slot = plan.slots[i];
    start(slot.items);
    setMealType(slot.slot);
    router.push('/review');
  }

  return (
    <Screen>
      <H1>{t('plan.title')}</H1>
      <Muted>{t('plan.sub')}</Muted>
      <Muted>{t('plan.region')}</Muted>
      <Chips<Region> value={region} onChange={(r) => { setRegion(r); setSeed(1); }} options={REGIONS.map((r) => ({ value: r, label: t(`region.${r}` as Key) }))} />
      <Button title={t('plan.another')} variant="secondary" onPress={() => setSeed((s) => s + 1)} />

      <Notes notes={targets.notes} />
      {profile.diet === 'jain' ? <Notice>{t('plan.jain')}</Notice> : null}
      {plan.uncheckedAllergies.length ? <Notice>{t('plan.unchecked', { list: plan.uncheckedAllergies.join(', ') })}</Notice> : null}

      <Card>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>{t('plan.total', { a: plan.totals.kcal, b: targets.kcal })}</Text>
        <Muted>
          {t('macro.protein')} {Math.round(plan.totals.protein_g)} / {targets.protein_g} {g} · {t('macro.carbs')} {Math.round(plan.totals.carbs_g)} {g} · {t('macro.fat')} {Math.round(plan.totals.fat_g)} {g}
        </Muted>
      </Card>

      {plan.emptySlots.map((s) => (
        <Notice key={s}>{t(`meal.${s}` as Key)}: {t('plan.empty')}</Notice>
      ))}

      {plan.slots.map((s, i) => (
        <Card key={s.slot}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <H2>{t(`meal.${s.slot}` as Key)}</H2>
            <Text style={{ fontWeight: '700' }}>{s.totals.kcal} kcal</Text>
          </View>
          {s.items.map((it) => (
            <Text key={it.foodId} style={{ lineHeight: 22 }}>
              • {label(it.foodId, it.name)} <Text style={{ color: '#6B746E' }}>— {it.grams} {g}</Text>
            </Text>
          ))}
          <Button title={t('plan.log')} variant="secondary" onPress={() => logSlot(i)} />
        </Card>
      ))}

      <Muted>{t('plan.disclaimer')}</Muted>
    </Screen>
  );
}

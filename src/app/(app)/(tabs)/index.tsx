import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Notes } from '@/components/common';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { RoutineView } from '@/components/RoutineView';
import { Button, Card, H1, H2, Muted, Notice, ProgressBar, Screen } from '@/components/ui';
import { useFoodLabel, useT, type Key } from '@/i18n';
import { useActive } from '@/lib/active';
import { GLASS_ML, addWater, deleteWater, startOfDay, targetsFor, totalsOf, useMeals, useWater } from '@/lib/data';
import { colors } from '@/lib/theme';
import { useDraft } from '@/state/draft';

export default function Today() {
  const t = useT();
  const label = useFoodLabel();
  const router = useRouter();
  const qc = useQueryClient();
  const { uid, memberId, profile } = useActive();
  const from = startOfDay();
  const to = new Date(from.getTime() + 24 * 3600 * 1000);
  const meals = useMeals(uid, memberId, from, to);
  const water = useWater(uid, memberId, from, to);
  const [waterError, setWaterError] = useState('');
  const targets = targetsFor(profile);
  const eaten = totalsOf(meals.data ?? []);
  const left = targets.kcal - eaten.kcal;
  const reset = useDraft((s) => s.reset);
  const drunk = (water.data ?? []).reduce((a, w) => a + w.ml, 0);

  async function changeWater(action: 'add' | 'undo') {
    setWaterError('');
    try {
      if (action === 'add') await addWater(uid!, memberId, GLASS_ML);
      else if (water.data?.[0]) await deleteWater(water.data[0].id);
      await qc.invalidateQueries({ queryKey: ['water'] });
    } catch {
      setWaterError(t('water.fail'));
    }
  }

  return (
    <Screen>
      <H1>{profile.display_name ? t('today.hello', { name: profile.display_name }) : t('today.title')}</H1>
      <MemberSwitcher />

      <RoutineView />

      <Card>
        <Muted>{t('today.calories')}</Muted>
        <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text }}>
          {eaten.kcal} <Text style={{ fontSize: 16, fontWeight: '600', color: colors.muted }}>/ {targets.kcal} kcal</Text>
        </Text>
        <ProgressBar value={eaten.kcal} max={targets.kcal} />
        <Muted>{left >= 0 ? t('today.left', { n: left }) : t('today.over', { n: -left })}</Muted>
      </Card>

      <Card>
        <Macro label={t('macro.protein')} value={eaten.protein_g} max={targets.protein_g} color={colors.protein} unit={t('common.g')} />
        <Macro label={t('macro.carbs')} value={eaten.carbs_g} max={targets.carbs_g} color={colors.carbs} unit={t('common.g')} />
        <Macro label={t('macro.fat')} value={eaten.fat_g} max={targets.fat_g} color={colors.fat} unit={t('common.g')} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '700' }}>{t('water.title')}</Text>
          <Muted>{t('water.progress', { a: (drunk / 1000).toFixed(2).replace(/\.?0+$/, '') || '0', b: (targets.water_ml / 1000).toFixed(1) })}</Muted>
        </View>
        <ProgressBar value={drunk} max={targets.water_ml} color="#3B9AD9" />
        {waterError ? <Notice>{waterError}</Notice> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title={t('water.add')} variant="secondary" onPress={() => changeWater('add')} /></View>
          {water.data?.length ? <Button title={t('water.undo')} variant="link" onPress={() => changeWater('undo')} /> : null}
        </View>
      </Card>

      {targets.notes.length ? <Notes notes={targets.notes} /> : targets.seeProfessional ? <Notice>{t('note.generic_pro')}</Notice> : null}

      <Button title={t('today.scan')} onPress={() => router.push('/scan')} />
      <Button title={t('today.barcode')} variant="secondary" onPress={() => { reset(); router.push({ pathname: '/barcode', params: { next: 'review' } }); }} />
      <Button
        title={t('today.addManual')}
        variant="secondary"
        onPress={() => {
          reset();
          router.push('/review');
        }}
      />

      <H2>{t('today.meals')}</H2>
      {meals.isLoading ? <Muted>{t('common.loading')}</Muted> : null}
      {meals.error ? <Notice>{t('today.loadFail')}</Notice> : null}
      {meals.data?.length === 0 ? <Muted>{t('today.noMeals')}</Muted> : null}
      {meals.data?.map((m) => (
        <Card key={m.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700' }}>{t(`meal.${m.meal_type}` as Key)}</Text>
            <Text style={{ fontWeight: '700' }}>{Math.round(m.kcal)} kcal</Text>
          </View>
          <Muted>{m.meal_items.map((i) => label(i.food_id, i.name)).join(', ')}</Muted>
        </Card>
      ))}
    </Screen>
  );
}

function Macro({ label, value, max, color, unit }: { label: string; value: number; max: number; color: string; unit: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '600' }}>{label}</Text>
        <Muted>{Math.round(value)} / {max} {unit}</Muted>
      </View>
      <ProgressBar value={value} max={max} color={color} />
    </View>
  );
}

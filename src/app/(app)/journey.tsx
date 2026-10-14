import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { CheckPop } from '@/components/motion';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { Card, H1, H2, Muted, ProgressBar, Screen } from '@/components/ui';
import { FOOD_BY_ID } from '@/core/foods';
import { badges, summarizeDays } from '@/core/insights';
import { dayKey } from '@/core/progress';
import { useFoodLabel, useT, type Key } from '@/i18n';
import { useActive } from '@/lib/active';
import { startOfDay, targetsFor, useWeights } from '@/lib/data';
import { useFlexDays, useSymptomHistory } from '@/lib/health';
import { useDayRecords } from '@/lib/reports';
import { colors } from '@/lib/theme';

const DISCOVER = ['moong-chilla', 'khichdi', 'dhokla', 'rajma', 'bhakri', 'sambar', 'thepla', 'idli', 'chana-masala', 'poha'];
const CHALLENGES = ['water', 'walk', 'veg', 'stretch', 'sleep'] as const;

/** Milestones count UP only (totals), so rest days, illness and missed logs never take a badge away. */
export default function Journey() {
  const t = useT();
  const label = useFoodLabel();
  const { uid, memberId, profile } = useActive();
  const r = useDayRecords(uid, memberId, 30);
  const weights = useWeights(uid, memberId);
  const flex = useFlexDays(uid, memberId);
  const checkIns = useSymptomHistory(uid, memberId, new Date(startOfDay().getTime() - 365 * 86400000).toISOString()); // a stable key: a changing one would refetch forever
  const goal = targetsFor(profile).water_ml;
  const s = summarizeDays(r.days, goal);
  const week = summarizeDays(r.days.slice(-7), goal);
  const list = useMemo(() => badges({
    mealDays: s.mealDays, waterGoalDays: s.water.goalDays, workoutsDone: s.workouts, checkIns: checkIns.data?.length ?? 0, flexPlanned: (flex.data ?? []).length > 0,
    routineDays: 0, moodDays: s.mood.n, sleepLogs: s.sleep.n, weightLogs: weights.data?.length ?? 0,
  }), [s.mealDays, s.water.goalDays, s.workouts, checkIns.data, flex.data, s.mood.n, s.sleep.n, weights.data]);
  const dayNo = Number(dayKey(new Date()).replace(/-/g, ''));
  const food = DISCOVER[dayNo % DISCOVER.length];
  const challenge = CHALLENGES[dayNo % CHALLENGES.length];

  return (
    <Screen>
      <H1>{t('h4.jy.title')}</H1>
      <MemberSwitcher />
      <Muted>{t('h4.jy.sub')}</Muted>
      <Card>
        <H2>{t('h4.jy.challenge')}</H2>
        <Text style={{ color: colors.text, fontSize: 16 }}>{t(`h4.jy.c.${challenge}` as Key)}</Text>
      </Card>
      <Card>
        <H2>{t('h4.jy.reflect')}</H2>
        <Muted>{t('h4.jy.reflectBody', { n: week.loggedDays })}</Muted>
        {FOOD_BY_ID[food] ? <Text style={{ color: colors.text }}>🍽️ {t('h4.jy.discover', { food: label(food, FOOD_BY_ID[food].name) })}</Text> : null}
      </Card>
      {list.map((b, i) => (
        <Card key={b.id} delay={Math.min(i * 40, 300)} style={b.unlocked ? { borderWidth: 1.5, borderColor: '#F0A93B' } : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {b.unlocked ? <CheckPop done size={30} /> : <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EFEAF8' }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: colors.text }}>{t(`h4.jy.b.${b.id}` as Key)}</Text>
              <Muted>{b.unlocked ? t('h4.jy.unlocked') : t('h4.jy.progress', { a: b.progress, b: b.target })}</Muted>
            </View>
          </View>
          {!b.unlocked ? <ProgressBar value={b.progress} max={b.target} color="#7C6FD0" /> : null}
        </Card>
      ))}
    </Screen>
  );
}

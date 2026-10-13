import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Field, H1, H2, Muted, Notice, Screen } from '@/components/ui';
import { dayKey, lastNDays, summarizeWeek, summarizeWeight, weightAdvice } from '@/core/progress';
import { useT, type Key } from '@/i18n';
import { logWeight, startOfDay, targetsFor, totalsOf, useMeals, useProfile, useWeights, type MealRow } from '@/lib/data';
import { colors } from '@/lib/theme';
import { useSession } from '@/state/session';

export default function Progress() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const uid = session?.user.id;
  const profile = useProfile(uid).data!;
  const targets = targetsFor(profile);
  const weights = useWeights(uid);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const to = new Date(startOfDay().getTime() + 24 * 3600 * 1000);
  const from = new Date(to.getTime() - 7 * 24 * 3600 * 1000);
  const meals = useMeals(uid, from, to);
  const days = lastNDays(7).map((date) => {
    const list = (meals.data ?? []).filter((m: MealRow) => dayKey(new Date(m.eaten_at)) === date);
    return { date, totals: totalsOf(list), meals: list.length };
  });
  const week = summarizeWeek(days, targets.kcal);
  const summary = summarizeWeight(weights.data ?? []);
  const advice = weightAdvice(summary, profile.goal);
  const maxKcal = Math.max(targets.kcal * 1.3, ...days.map((d) => d.totals.kcal));

  async function submit() {
    setError('');
    const kg = Number(input.replace(',', '.'));
    if (!(kg >= 30 && kg <= 250)) return setError(t('prog.weightRange'));
    setBusy(true);
    try {
      await logWeight(uid!, Math.round(kg * 10) / 10);
      setInput('');
      await qc.invalidateQueries({ queryKey: ['weights'] });
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  const trend = (summary?.smoothed ?? []).slice(-14);
  const lo = Math.min(...trend), hi = Math.max(...trend);

  return (
    <Screen>
      <H1>{t('prog.title')}</H1>

      <Card>
        <H2>{t('prog.weight')}</H2>
        {summary ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Stat label={t('prog.start')} value={`${summary.start} kg`} />
              <Stat label={t('prog.now')} value={`${summary.latest} kg`} />
              <Stat label={t('prog.change')} value={`${summary.change > 0 ? '+' : ''}${summary.change} kg`} />
            </View>
            {trend.length > 1 ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 70, gap: 4 }} accessibilityLabel={t('prog.weight')}>
                {trend.map((v, i) => (
                  <View key={i} style={{ flex: 1, height: 14 + (hi === lo ? 28 : ((v - lo) / (hi - lo)) * 50), backgroundColor: colors.primary, borderRadius: 4, opacity: 0.4 + (0.6 * (i + 1)) / trend.length }} />
                ))}
              </View>
            ) : null}
            {summary.weeklyRate !== null ? <Muted>{t('prog.rate', { n: `${summary.weeklyRate > 0 ? '+' : ''}${summary.weeklyRate}` })}</Muted> : null}
            <Notice tone={advice === 'on_track' || advice === 'not_enough_data' ? 'info' : 'warn'}>{t(`advice.${advice}` as Key)}</Notice>
          </>
        ) : (
          <Muted>{t('prog.noWeight')}</Muted>
        )}
        <Field label={t('prog.weightPh')} value={input} onChangeText={setInput} keyboardType="decimal-pad" error={error} />
        <Button title={t('prog.log')} onPress={submit} loading={busy} />
      </Card>

      <Card>
        <H2>{t('prog.week')}</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Stat label={t('prog.daysLogged')} value={`${week.daysLogged} / 7`} />
          <Stat label={t('prog.avgKcal')} value={`${week.avgKcal} kcal`} />
          <Stat label={t('prog.avgProtein')} value={`${week.avgProtein} ${t('common.g')}`} />
          <Stat label={t('prog.onTarget')} value={`${week.daysOnTarget}`} />
          <Stat label={t('prog.streak')} value={t(week.streak === 1 ? 'prog.streakDay' : 'prog.streakDays', { n: week.streak })} />
        </View>
      </Card>

      <Card>
        <H2>{t('prog.calories7')}</H2>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6 }}>
          {days.map((d) => (
            <View key={d.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <View
                accessibilityLabel={`${d.date}: ${Math.round(d.totals.kcal)} kcal`}
                style={{ width: '100%', height: Math.max(3, (d.totals.kcal / maxKcal) * 90), backgroundColor: d.meals ? colors.primary : colors.border, borderRadius: 4 }}
              />
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{d.date.slice(8)}</Text>
            </View>
          ))}
        </View>
        <Muted>{t('prog.target')}: {targets.kcal} kcal</Muted>
      </Card>

      <Button title={t('prog.seeMeals')} variant="secondary" onPress={() => router.push('/history')} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 90 }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{value}</Text>
    </View>
  );
}

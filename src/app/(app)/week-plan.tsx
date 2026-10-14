import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MemberSwitcher } from '@/components/MemberSwitcher';
import { Badge, Button, Card, Chips, H1, H2, Muted, Screen } from '@/components/ui';
import { FOOD_BY_ID } from '@/core/foods';
import type { DietPref } from '@/core/planner';
import { groceryList, planDays, substitutionsFor, weekCost } from '@/core/weekplan';
import { useFoodLabel, useT, type Key } from '@/i18n';
import { useActive } from '@/lib/active';
import { targetsFor } from '@/lib/data';
import { useHealthContext } from '@/lib/healthCtx';
import { colors, radius } from '@/lib/theme';

/** 7- or 30-day plan from the same planner, plus a grocery list with tick-off and swap ideas. Estimates only. */
export default function WeekPlan() {
  const t = useT();
  const label = useFoodLabel();
  const { profile } = useActive();
  const ctx = useHealthContext();
  const [days, setDays] = useState<'7' | '30'>('7');
  const [seed, setSeed] = useState(1);
  const [ticked, setTicked] = useState<string[]>([]);
  const targets = targetsFor(profile);
  const plans = useMemo(() => planDays({ targets, diet: profile.diet as DietPref, region: 'any', allergies: profile.allergies, constraints: ctx.constraints, cooking: ctx.prefs?.cooking, startSeed: seed, days: Number(days) }),
    [targets.kcal, profile.diet, profile.allergies.join(','), ctx.constraints, ctx.prefs?.cooking, seed, days]);
  const list = useMemo(() => groceryList(plans), [plans]);
  const name = (id: string) => label(id, FOOD_BY_ID[id]?.name ?? id);

  return (
    <Screen>
      <H1>{t('h4.wp.title')}</H1>
      <MemberSwitcher />
      <Chips value={days} onChange={(v) => { setDays(v); setSeed(1); }} options={[{ value: '7', label: t('h4.wp.days7') }, { value: '30', label: t('h4.wp.days30') }]} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Badge label={t('h4.wp.cost', { n: weekCost(plans) })} tone="good" />
        <Button title={t('h4.wp.newPlan')} variant="secondary" onPress={() => setSeed((s) => s + 3)} />
      </View>

      <Card>
        <H2>{t('h4.wp.grocery')}</H2>
        <Muted>{t('h4.wp.groceryNote')}</Muted>
        {list.map((l) => {
          const on = ticked.includes(l.foodId);
          const swaps = substitutionsFor(l.foodId, profile.diet as DietPref, profile.allergies);
          return (
            <View key={l.foodId} style={{ gap: 2 }}>
              <Pressable onPress={() => setTicked((x) => (on ? x.filter((i) => i !== l.foodId) : [...x, l.foodId]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
                <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
                </View>
                <Text style={{ flex: 1, color: colors.text, textDecorationLine: on ? 'line-through' : 'none' }}>{name(l.foodId)}</Text>
                <Text style={{ color: colors.muted }}>{l.grams} g · ₹{l.cost}</Text>
              </Pressable>
              {swaps.length ? <Muted style={{ marginLeft: 32, fontSize: 12 }}>{t('h4.wp.swap', { food: name(l.foodId), list: swaps.map(name).join(', ') })}</Muted> : null}
            </View>
          );
        })}
      </Card>

      {plans.slice(0, Number(days)).map((p, i) => (
        <Card key={i}>
          <Text style={{ fontWeight: '800', color: colors.text }}>{t('h4.wp.day', { n: i + 1 })} · {p.totals.kcal} kcal · ₹{p.totalCost}</Text>
          {p.slots.map((s) => (
            <View key={s.slot} style={{ backgroundColor: '#F6F4FA', borderRadius: radius.sm, padding: 8 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{t(`meal.${s.slot}` as Key)}</Text>
              <Muted>{s.items.map((it) => `${name(it.foodId)} ${it.grams} g`).join(' · ')}</Muted>
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

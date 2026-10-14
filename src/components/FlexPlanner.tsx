import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { applyFlexToSlots, canPlanFlex, FLEX_KEEPS, FLEX_SUGGESTIONS, flexAlternatives, flexNotes, monthStart, validFlexDate, ymd } from '@/core/flexday';
import { FOOD_BY_ID } from '@/core/foods';
import { excludedByAllergies } from '@/core/planner';
import { tagsOf } from '@/core/health/foodTags';
import { useFoodLabel, useT, type Key } from '@/i18n';
import { deleteFlexDay, saveFlexDay, setFlexStatus, useFlexDays, type FlexDayRow } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { colors } from '@/lib/theme';
import { Badge, Button, Card, Field, H2, MultiChips, Muted, Notice } from './ui';
import { celebrate } from './Celebrate';

void applyFlexToSlots;
void tagsOf;

/** Plan (or review) this month's Flex Day: a date and the foods the person is looking forward to. No moral language, no compensation. */
export function FlexPlanner({ onPlanned }: { onPlanned?: () => void }) {
  const t = useT();
  const label = useFoodLabel();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const flex = useFlexDays(ctx.uid, ctx.memberId);
  const today = new Date();
  const month = monthStart(today);
  const current = (flex.data ?? []).find((f) => f.month === month);
  const [date, setDate] = useState(ymd(new Date(today.getFullYear(), today.getMonth(), Math.min(28, today.getDate() + 7))));
  const [picked, setPicked] = useState<string[]>(['chicken-biryani']);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const allergy = excludedByAllergies(ctx.profile?.allergies ?? []).foods;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const refresh = () => qc.invalidateQueries({ queryKey: ['flex'] });

  async function plan() {
    setError('');
    const monthOfDate = date.slice(0, 7) + '-01';
    if (!validFlexDate(date, today)) return setError(t('h4.flex.dateBad'));
    if (monthOfDate !== month && !canPlanFlex(flex.data ?? [], monthOfDate)) return setError(t('h4.flex.already'));
    if (current && monthOfDate === month && !current.id) return;
    try {
      const foods = [...picked.map((id) => ({ label: FOOD_BY_ID[id].name, foodId: id })), ...(custom.trim() ? [{ label: custom.trim(), foodId: null }] : [])];
      await saveFlexDay(ctx.uid!, ctx.memberId, monthOfDate, date, foods, monthOfDate === month ? current?.id : undefined);
      setCustom('');
      await refresh();
      onPlanned?.();
    } catch {
      setError(t('h4.fail'));
    }
  }

  const notesFor = (f: FlexDayRow) => flexNotes(f.foods.map((x) => x.foodId).filter(Boolean) as string[], ctx.constraints, allergy);

  return (
    <View style={{ gap: 12 }}>
      <Muted>{t('h4.flex.intro')}</Muted>
      <Card>
        <Text style={{ fontWeight: '800', color: colors.text }}>{t('h4.flex.keeps')}</Text>
        {FLEX_KEEPS.map((k) => <Text key={k} style={{ color: colors.text }}>✓ {t(`h4.keep.${k}` as Key)}</Text>)}
      </Card>

      {current ? (
        <Card>
          <Badge label={t('h4.flex.planned', { date: current.date })} tone="good" />
          <Text style={{ color: colors.text, fontWeight: '700' }}>{current.foods.map((f) => (f.foodId && FOOD_BY_ID[f.foodId] ? label(f.foodId, FOOD_BY_ID[f.foodId].name) : f.label)).join(', ')}</Text>
          {notesFor(current).map((n, i) => {
            const name = FOOD_BY_ID[n.foodId] ? label(n.foodId, FOOD_BY_ID[n.foodId].name) : n.foodId;
            if (n.code === 'allergy') return <Notice key={i} tone="urgent">{t('h4.flexnote.allergy', { food: name })}</Notice>;
            if (n.code === 'condition_tag') return <Notice key={i} tone="info">{t('h4.flexnote.condition', { food: name, tag: t(`h4.tag.${n.tag}` as Key) })}</Notice>;
            return <Muted key={i}>{t('h4.flexnote.portion', { food: name })}</Muted>;
          })}
          {current.foods.filter((f) => f.foodId && flexAlternatives(f.foodId).length).slice(0, 2).map((f) => (
            <Muted key={f.id}>{t('h4.flex.alt', { food: label(f.foodId!, FOOD_BY_ID[f.foodId!].name), list: flexAlternatives(f.foodId!).map((a) => label(a, FOOD_BY_ID[a].name)).join(', ') })}</Muted>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {current.status === 'planned' ? <Button title={t('h4.flex.enjoyed')} onPress={async () => { await setFlexStatus(current.id, 'done'); celebrate(t('h4.cel.flex')); await refresh(); }} /> : <Badge label={current.status} />}
            {current.status === 'planned' ? <Button title={t('h4.flex.notThisMonth')} variant="link" onPress={async () => { await setFlexStatus(current.id, 'skipped'); await refresh(); }} /> : null}
            <Button title={t('h4.remove')} variant="link" onPress={async () => { await deleteFlexDay(current.id); await refresh(); }} />
          </View>
        </Card>
      ) : null}

      <Card>
        <H2>{t('h4.flex.pick')}</H2>
        <Field label={t('h4.flex.date')} value={date} onChangeText={setDate} maxLength={10} />
        <Text style={{ fontWeight: '600', color: colors.text }}>{t('h4.flex.foods')}</Text>
        <MultiChips options={FLEX_SUGGESTIONS.map((id) => ({ value: id, label: label(id, FOOD_BY_ID[id].name) }))} values={picked} onToggle={toggle} />
        <Field label={t('h4.flex.custom')} value={custom} onChangeText={setCustom} maxLength={60} />
        {error ? <Notice>{error}</Notice> : null}
        <Button title={current ? t('h4.edit') : t('h4.flex.plan')} onPress={plan} />
      </Card>

      {(flex.data ?? []).filter((f) => f.month !== month).length ? (
        <Card>
          <H2>{t('h4.flex.history')}</H2>
          {(flex.data ?? []).filter((f) => f.month !== month).map((f) => <Muted key={f.id}>{f.date} · {f.foods.map((x) => x.label).join(', ')}</Muted>)}
        </Card>
      ) : null}
    </View>
  );
}

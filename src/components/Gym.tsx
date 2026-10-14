import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { buildGymPlan, DEFAULT_GYM, EXERCISES, sessionFor, weekdayOf, type GymPlan, type GymPrefs, type Session } from '@/core/gym';
import { ymd } from '@/core/flexday';
import { useLang, useT, type Key } from '@/i18n';
import { saveGymPrefs, setWorkoutStatus, useGymPrefs, useWorkoutLogs } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { colors, radius } from '@/lib/theme';
import { Badge, Button, Card, Chips, H2, Muted, Notice } from './ui';
import { CheckPop } from './motion';

export function useExName() {
  const lang = useLang((s) => s.lang);
  return (id: string) => { const n = EXERCISES[id]?.name; return n ? (lang === 'hi' ? n.hi : lang === 'mr' ? n.mr : n.en) : id; };
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Do you go to the gym?" and, if yes, a few questions. Saves and calls onSaved. */
export function GymForm({ onSaved, compact = false }: { onSaved?: () => void; compact?: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const saved = useGymPrefs(ctx.uid, ctx.memberId);
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(saved.data?.exists ? (saved.data.goes ? 'yes' : 'no') : null);
  const [p, setP] = useState<GymPrefs>(saved.data?.exists ? saved.data : { ...DEFAULT_GYM, goes: true });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function save(next: GymPrefs) {
    setError('');
    try {
      await saveGymPrefs(ctx.uid!, ctx.memberId, next);
      await qc.invalidateQueries({ queryKey: ['gym-prefs'] });
      onSaved?.();
    } catch { setError(t('h4.fail')); }
  }

  return (
    <View style={{ gap: 12 }}>
      <H2>{t('h4.gym.ask')}</H2>
      <Chips<'yes' | 'no'> value={answer ?? ('' as 'yes')} onChange={(v) => { setAnswer(v); setMsg(''); }} options={[{ value: 'yes', label: t('h4.gym.yes') }, { value: 'no', label: t('h4.gym.no') }]} />
      {answer === 'no' ? (
        <>
          <Notice tone="info">{t('h4.gym.noReply')}</Notice>
          {msg ? null : <Button title={t('h4.save')} variant="secondary" onPress={async () => { await save({ ...p, goes: false }); setMsg('ok'); }} />}
        </>
      ) : null}
      {answer === 'yes' ? (
        <>
          <Text style={{ fontWeight: '700', color: colors.text }}>{t('h4.gym.days')}</Text>
          <Chips<string> value={String(p.daysPerWeek)} onChange={(v) => setP({ ...p, daysPerWeek: Number(v) as GymPrefs['daysPerWeek'] })} options={['2', '3', '4', '5', '6'].map((n) => ({ value: n, label: n }))} />
          <Text style={{ fontWeight: '700', color: colors.text }}>{t('h4.gym.goal')}</Text>
          <Chips value={p.goal} onChange={(v) => setP({ ...p, goal: v })} options={(['fat_loss', 'muscle', 'general'] as const).map((g) => ({ value: g, label: t(`h4.gym.goal.${g}` as Key) }))} />
          <Text style={{ fontWeight: '700', color: colors.text }}>{t('h4.gym.level')}</Text>
          <Chips value={p.level} onChange={(v) => setP({ ...p, level: v })} options={(['beginner', 'intermediate'] as const).map((g) => ({ value: g, label: t(`h4.gym.level.${g}` as Key) }))} />
          <Text style={{ fontWeight: '700', color: colors.text }}>{t('h4.gym.place')}</Text>
          <Chips value={p.place} onChange={(v) => setP({ ...p, place: v })} options={(['full_gym', 'basic'] as const).map((g) => ({ value: g, label: t(`h4.gym.place.${g}` as Key) }))} />
          {error ? <Notice>{error}</Notice> : null}
          <Button title={t('h4.gym.make')} onPress={() => save({ ...p, goes: true })} />
        </>
      ) : null}
      {compact ? null : <Muted>{t('h4.gym.general')}</Muted>}
    </View>
  );
}

function SessionCard({ s, plan, today, done, onToggle }: { s: Session; plan: GymPlan; today: boolean; done: boolean; onToggle?: () => void }) {
  const t = useT();
  const name = useExName();
  return (
    <Card style={today ? { borderWidth: 1.5, borderColor: colors.primary } : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '800', fontSize: 17, color: colors.text }}>{t(`h4.gym.focus.${s.focus}` as Key)}</Text>
        {today ? <Badge label={t('h4.gym.today')} tone="good" /> : null}
      </View>
      <Muted>{t('h4.gym.warm', { n: s.warmupMin })}</Muted>
      {s.items.map((it) => (
        <View key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: colors.text, flex: 1 }}>• {name(it.id)}</Text>
          <Text style={{ color: colors.muted, fontWeight: '600' }}>{t('h4.gym.sets', { sets: it.sets, reps: it.reps })}</Text>
        </View>
      ))}
      {s.cardio ? <Muted>{t('h4.gym.cardio')}: {name(s.cardio.id)} · {s.cardio.reps}</Muted> : null}
      <Muted>{t('h4.gym.cool', { n: s.cooldownMin })}</Muted>
      <Muted>{t('h4.gym.effort', { a: plan.effort.low, b: plan.effort.high })}</Muted>
      {onToggle ? (
        done ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CheckPop done size={26} /><Text style={{ fontWeight: '800', color: colors.primaryDark }}>{t('h4.gym.done')}</Text>
            <Button title={t('h4.gym.undo')} variant="link" onPress={onToggle} />
          </View>
        ) : <Button title={t('h4.gym.markDone')} onPress={onToggle} />
      ) : null}
    </Card>
  );
}

/** The person's weekly plan plus safety notes. */
export function GymPlanView() {
  const t = useT();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const prefs = useGymPrefs(ctx.uid, ctx.memberId);
  const monday = new Date(); monday.setDate(monday.getDate() - weekdayOf(monday));
  const logs = useWorkoutLogs(ctx.uid, ctx.memberId, ymd(monday));
  if (!prefs.data?.exists || !prefs.data.goes) return null;
  const plan = buildGymPlan(prefs.data, ctx.constraints);
  const today = new Date();
  const todayKey = ymd(today);
  const isDone = (key: string, date: string) => logs.data?.some((l) => l.key === key && l.date === date && l.status === 'done') ?? false;
  const doneCount = plan.days.filter((d, wd) => { const dt = new Date(monday); dt.setDate(dt.getDate() + wd); return d.session && isDone(d.session.key, ymd(dt)); }).length;
  const total = plan.days.filter((d) => d.session).length;

  async function toggle(s: Session, date: string, done: boolean) {
    await setWorkoutStatus(ctx.uid!, ctx.memberId, date, s.key, done ? null : 'done');
    await qc.invalidateQueries({ queryKey: ['workouts'] });
  }

  return (
    <View style={{ gap: 12 }}>
      <Muted>{t('h4.gym.thisWeek', { n: doneCount, total })}</Muted>
      {plan.lightOnly ? <Notice tone="info">{t('h4.gym.light')}</Notice> : null}
      {plan.needsClinicianCheck ? <Notice tone="info">{t('h4.gym.check')}</Notice> : null}
      {plan.avoidBreathHolding ? <Notice tone="info">{t('h4.gym.breath')}</Notice> : null}
      {plan.days.map((d, wd) => {
        const dt = new Date(monday); dt.setDate(dt.getDate() + wd);
        const date = ymd(dt);
        const isToday = date === todayKey;
        return d.session ? (
          <View key={wd} style={{ gap: 6 }}>
            <Text style={{ fontWeight: '700', color: colors.muted }}>{dayLabels[wd]} {dt.getDate()}</Text>
            <SessionCard s={d.session} plan={plan} today={isToday} done={isDone(d.session.key, date)} onToggle={isToday ? () => toggle(d.session!, date, isDone(d.session!.key, date)) : undefined} />
          </View>
        ) : (
          <View key={wd} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ fontWeight: '700', color: colors.muted, width: 64 }}>{dayLabels[wd]} {dt.getDate()}</Text>
            <View style={{ backgroundColor: '#EEF2EE', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: colors.muted }}>{t('h4.gym.rest')}</Text></View>
          </View>
        );
      })}
      <Muted>{t('h4.gym.general')}</Muted>
    </View>
  );
}

export { sessionFor, buildGymPlan };

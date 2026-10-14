import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { adapt, dueNow, fmtMinute, generateRoutine, nextUp, progress, swapToLightWalk, type Activity, type ActivityKind, type Suggestion } from '@/core/routine';
import { planDay, type DietPref } from '@/core/planner';
import { useFoodLabel, useT, type Key } from '@/i18n';
import { ymd } from '@/core/flexday';
import { FOOD_BY_ID } from '@/core/foods';
import { targetsFor } from '@/lib/data';
import { saveRoutine, setActivityStatus, updateActivity, useFlexDays, useRoutine, type StoredRoutine } from '@/lib/health';
import { useHealthContext } from '@/lib/healthCtx';
import { notificationsAllowed, showNotification } from '@/lib/notify';
import { colors, radius, space } from '@/lib/theme';
import { HealthNotes } from './HealthNotes';
import { Icon, type IconName } from './icons';
import { CheckPop, CountUp, Ring } from './motion';
import { Badge, Button, Card, Hero, Muted, Notice } from './ui';

const ICON: Record<ActivityKind, IconName> = { wake: 'clock', hydration: 'drop', exercise: 'run', breakfast: 'plate', lunch: 'plate', snack: 'plate', dinner: 'plate', relax: 'moon', sleep: 'moon', medication: 'bell', custom: 'check' };
/** Reminders on by default (until the person changes them): meals, movement and any medicine reminder they typed in. */
export const DEFAULT_REMINDERS: ActivityKind[] = ['breakfast', 'lunch', 'dinner', 'exercise', 'medication'];

const minuteNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

export function activityTitle(t: (k: Key, p?: Record<string, string | number>) => string, a: Activity) {
  return a.title.startsWith('routine.') ? t(`h4.${a.title}` as Key) : a.title;
}

/**
 * The Today screen's centrepiece: a gentle, editable timeline for the day. Meals, water, movement, rest and (only if the person typed them in)
 * medicine reminders. Missing something is never scolded: suggestions only ever move things later or make them easier.
 */
export function RoutineView() {
  const t = useT();
  const label = useFoodLabel();
  const router = useRouter();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const today = ymd(new Date());
  const routine = useRoutine(ctx.uid, ctx.memberId, today);
  const flex = useFlexDays(ctx.uid, ctx.memberId);
  const [now, setNow] = useState(minuteNow());
  const [banner, setBanner] = useState<Activity | null>(null);
  const notified = useRef(new Set<string>());
  const creating = useRef('');
  const [error, setError] = useState('');

  useEffect(() => { const id = setInterval(() => setNow(minuteNow()), 30000); return () => clearInterval(id); }, []);

  const prefs = ctx.prefs?.exists ? ctx.prefs : null;
  const who = `${ctx.uid}:${ctx.memberId}:${today}`;
  const enabled = useMemo(() => {
    const rows = ctx.reminders.filter((r) => r.kind !== 'medication' && r.minute === null);
    return new Set<ActivityKind>(rows.length ? rows.filter((r) => r.enabled).map((r) => r.kind as ActivityKind).concat('medication') : DEFAULT_REMINDERS);
  }, [ctx.reminders]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['routine'] });

  async function build() {
    if (!prefs || !ctx.uid) return;
    setError('');
    try {
      await saveRoutine(ctx.uid, ctx.memberId, today, generateRoutine(prefs, ctx.constraints, ctx.meds));
      await refresh();
    } catch {
      setError(t('h4.fail'));
    }
  }

  // the first time the screen opens with settings but no routine for today, create it
  useEffect(() => {
    if (prefs && routine.isSuccess && routine.data === null && !ctx.loading && creating.current !== who) {
      creating.current = who;
      build();
    }
  }, [prefs, routine.isSuccess, routine.data, ctx.loading, who]); // eslint-disable-line react-hooks/exhaustive-deps

  const data: StoredRoutine | null | undefined = routine.data;
  const acts = data?.activities ?? [];
  const status = data?.status ?? {};
  const wake = prefs?.wakeMinute ?? 420;

  // reminders: a banner inside the app, plus a browser notification when the person allowed it
  useEffect(() => {
    if (!data) return;
    for (const a of dueNow(acts, status, now, enabled)) {
      if (notified.current.has(a.id)) continue;
      notified.current.add(a.id);
      setBanner(a);
      const title = activityTitle(t, a);
      showNotification(t('h4.notif.time', { what: title }), a.medicationLabel ? t('h4.rt.medFor', { label: a.medicationLabel }) : fmtMinute(a.start));
    }
  }, [now, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // suggested meals for each slot (from the same planner as the Plan tab), with the Flex Day swapped in when today is one
  const plan = useMemo(() => {
    if (!ctx.profile) return null;
    return planDay({ targets: targetsFor(ctx.profile), diet: ctx.profile.diet as DietPref, region: 'any', allergies: ctx.profile.allergies, seed: Number(today.replace(/-/g, '')) % 997, constraints: ctx.constraints, cooking: prefs?.cooking ?? 'normal' });
  }, [ctx.profile, ctx.constraints, today, prefs?.cooking]);
  const todaysFlex = (flex.data ?? []).find((f) => f.date === today && f.status !== 'skipped');
  const mealText = (a: Activity): string => {
    if (!a.slot) return '';
    if (todaysFlex && a.slot === 'dinner' && todaysFlex.foods.length) return todaysFlex.foods.map((f) => (f.foodId && FOOD_BY_ID[f.foodId] ? label(f.foodId, FOOD_BY_ID[f.foodId].name) : f.label)).join(', ');
    const s = plan?.slots.find((x) => x.slot === a.slot);
    return s ? s.items.slice(0, 3).map((i) => label(i.foodId, i.name)).join(', ') : '';
  };

  const prog = progress(acts, status);
  const next = data ? nextUp(acts, status, now, wake) : null;
  const ideas: Suggestion[] = data ? adapt(acts, status, now, wake, ctx.constraints) : [];

  async function mark(a: Activity, st: 'done' | 'skipped' | null) {
    try { await setActivityStatus(ctx.uid!, a.id, st); await refresh(); } catch { setError(t('h4.fail')); }
  }
  async function nudge(a: Activity, delta: number) {
    try { await updateActivity(a.id, { start: (a.start + delta + 1440) % 1440 }); await refresh(); } catch { setError(t('h4.fail')); }
  }
  async function apply(s: Suggestion) {
    try {
      if (s.code === 'meal_late') await updateActivity(s.activityId, { start: s.newStart % 1440 });
      else if (s.code === 'swap_light_walk') { const a = swapToLightWalk(acts, s.activityId).find((x) => x.id === s.activityId)!; await updateActivity(a.id, { duration: 15, intensity: 'gentle' }); }
      await refresh();
    } catch { setError(t('h4.fail')); }
  }

  if (ctx.loading || routine.isLoading) return null;

  if (!prefs) {
    return (
      <Hero delay={60}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{t('h4.today.setup')}</Text>
        <Text style={{ color: '#E6F7EC' }}>{t('h4.today.setupBody')}</Text>
        <Button title={t('h4.setup.routine')} variant="secondary" onPress={() => router.push('/setup')} />
      </Hero>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <Hero delay={40}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Ring size={104} stroke={11} progress={prog.pct / 100} color="#fff" track="rgba(255,255,255,0.25)">
            <CountUp value={prog.pct} format={(n) => `${Math.round(n)}%`} style={{ color: '#fff', fontSize: 22, fontWeight: '800' }} />
          </Ring>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: '#E6F7EC', fontWeight: '700' }}>{t('h4.rt.title')}</Text>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{next ? `${t('h4.rt.next')}: ${activityTitle(t, next)} · ${fmtMinute(next.start)}` : t('h4.rt.allDone')}</Text>
            <Text style={{ color: '#E6F7EC' }}>{t('h4.rt.progress', { done: prog.done, total: prog.total })}</Text>
          </View>
        </View>
      </Hero>

      {banner ? (
        <Notice tone="info">{`${activityTitle(t, banner)} · ${fmtMinute(banner.start)}${banner.medicationLabel ? ' · ' + t('h4.rt.medFor', { label: banner.medicationLabel }) : ''}`}</Notice>
      ) : null}
      {todaysFlex ? <Notice tone="info">{t('h4.rt.flexBanner')}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <HealthNotes constraints={ctx.constraints} compact />

      {data ? (
        <>
          {acts.map((a, i) => (
            <Card key={a.id} delay={Math.min(i * 40, 320)} style={status[a.id] === 'done' ? { opacity: 0.72 } : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  {status[a.id] === 'done' ? <CheckPop done size={24} /> : <Icon name={ICON[a.kind]} size={20} color={colors.primaryDark} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.text, textDecorationLine: status[a.id] === 'skipped' ? 'line-through' : 'none' }}>
                    {fmtMinute(a.start)}  {activityTitle(t, a)}
                  </Text>
                  {a.kind === 'medication' ? <Muted>{t('h4.rt.medFor', { label: a.medicationLabel ?? '' })}</Muted> : null}
                  {a.detailKey && a.kind !== 'medication' ? <Muted>{a.detailKey.startsWith('routine.') ? t(`h4.${a.detailKey}` as Key) : a.detailKey}</Muted> : null}
                  {mealText(a) ? <Muted>{mealText(a)}</Muted> : null}
                </View>
                {status[a.id] === 'skipped' ? <Badge label={t('h4.rt.skipped')} /> : null}
              </View>
              {a.kind !== 'wake' && a.kind !== 'sleep' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
                  {status[a.id] ? (
                    <Button title={t('h4.rt.undo')} variant="link" onPress={() => mark(a, null)} />
                  ) : (
                    <>
                      <View style={{ flexGrow: 1 }}><Button title={t('h4.rt.done')} onPress={() => mark(a, 'done')} /></View>
                      {a.kind !== 'medication' ? <Button title={t('h4.rt.skip')} variant="link" onPress={() => mark(a, 'skipped')} /> : null}
                      <Button title={t('h4.rt.earlier')} variant="link" onPress={() => nudge(a, -15)} />
                      <Button title={t('h4.rt.later')} variant="link" onPress={() => nudge(a, 15)} />
                    </>
                  )}
                </View>
              ) : null}
            </Card>
          ))}

          {ideas.length && ideas[0].code !== 'all_good' ? (
            <Card>
              <Text style={{ fontWeight: '800', color: colors.text }}>{t('h4.adapt.title')}</Text>
              {ideas.map((s) => (
                <View key={s.code} style={{ gap: 6 }}>
                  <Text style={{ color: colors.text }}>
                    {t(`h4.adapt.${s.code}` as Key, s.code === 'meal_late' ? { time: fmtMinute(s.newStart) } : undefined)}
                  </Text>
                  {s.code === 'meal_late' || s.code === 'swap_light_walk' ? <Button title={t('h4.adapt.apply')} variant="secondary" onPress={() => apply(s)} /> : null}
                </View>
              ))}
            </Card>
          ) : null}

          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Button title={t('h4.rt.edit')} variant="secondary" onPress={() => router.push('/routine-edit')} />
            <Button title={t('h4.rt.regen')} variant="link" onPress={build} />
            <Button title={t('h4.rt.settings')} variant="link" onPress={() => router.push('/routine-settings')} />
          </View>
          {!notificationsAllowed() ? <Muted>{t('h4.notif.note')}</Muted> : null}
        </>
      ) : (
        <Card>
          <Muted>{t('h4.rt.empty')}</Muted>
          <Button title={t('h4.rt.make')} onPress={build} />
        </Card>
      )}
    </View>
  );
}

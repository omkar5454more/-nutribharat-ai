import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Ellipse, G } from 'react-native-svg';
import { buildGymPlan, sessionFor } from '@/core/gym';
import { planDay, type DietPref } from '@/core/planner';
import { useFoodLabel, useT, type Key } from '@/i18n';
import { GLASS_ML, addWater, startOfDay, targetsFor, useMeals, type MealType } from '@/lib/data';
import { saveMood, useGymPrefs, useMoods } from '@/lib/health';
import { useDayRecords } from '@/lib/reports';
import { DotRow } from './Charts';
import { useHealthContext } from '@/lib/healthCtx';
import { colors, radius, space } from '@/lib/theme';
import { useDraft } from '@/state/draft';
import { Icon, type IconName } from './icons';
import { FadeIn, PressScale } from './motion';

const hour = () => new Date().getHours();
const greetingKey = (): Key => (hour() < 12 ? 'h4.dash.morning' : hour() < 17 ? 'h4.dash.afternoon' : 'h4.dash.evening');

/** Soft translucent petals behind the greeting. Purely decorative. */
function Petals() {
  return (
    <Svg width="100%" height={230} viewBox="0 0 400 230" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="none">
      <G x={200} y={120} opacity={0.38}>
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <Ellipse key={a} cx={0} cy={-70} rx={34} ry={86} fill="#FFFFFF" transform={`rotate(${a})`} />
        ))}
      </G>
    </Svg>
  );
}

/** Pastel, airy header: avatar, settings, a heart badge and a big friendly greeting. */
export function DashHeader({ name }: { name: string }) {
  const t = useT();
  const router = useRouter();
  return (
    <LinearGradient colors={['#D9D4F5', '#F5D5E6', '#FBE4D2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, overflow: 'hidden', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 22, minHeight: 210 }}>
      <Petals />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFFCC', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontWeight: '800', fontSize: 18, color: '#5B4FA8' }}>{(name || 'N').slice(0, 1).toUpperCase()}</Text>
        </View>
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={t('tab.profile')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFFCC', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="profile" size={20} color="#5B4FA8" />
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', gap: 6, marginTop: 6 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(91,79,168,0.18)' } as object}>
          <Icon name="heart" size={26} color="#E2557B" />
        </View>
        <Text style={{ color: '#6B6584', fontWeight: '600' }}>{t('h4.dash.enjoy')}</Text>
        <Text style={{ fontSize: 34, fontWeight: '800', color: '#1F1B3A', letterSpacing: -0.5 }} accessibilityRole="header">{t(greetingKey())}</Text>
        <Text style={{ color: '#4A4568', fontWeight: '600' }}>{name ? t('today.hello', { name }) : t('today.title')}</Text>
      </View>
    </LinearGradient>
  );
}

type Task = { id: string; title: string; icon: IconName; color: string; go: () => void };

/** A short, friendly list of what to do next. Each can be dismissed; nothing nags. */
export function AssistantTasks() {
  const t = useT();
  const router = useRouter();
  const ctx = useHealthContext();
  const gym = useGymPrefs(ctx.uid, ctx.memberId);
  const reset = useDraft((s) => s.reset);
  const from = startOfDay();
  const meals = useMeals(ctx.uid, ctx.memberId, from, new Date(from.getTime() + 86400000));
  const [hidden, setHidden] = useState<string[]>([]);
  const [all, setAll] = useState(false);

  const tasks: Task[] = [];
  if (ctx.prefs && !ctx.prefs.exists) tasks.push({ id: 'routine', title: t('h4.task.routine'), icon: 'clock', color: '#E3DDFB', go: () => router.push('/setup') });
  if (gym.data && !gym.data.exists) tasks.push({ id: 'gym', title: t('h4.task.gym'), icon: 'run', color: '#FDE2D0', go: () => router.push('/gym') });
  const logged = new Set((meals.data ?? []).map((m) => m.meal_type));
  const due: [MealType, number][] = [['breakfast', 9], ['lunch', 13], ['dinner', 20]];
  for (const [m, h] of due) {
    if (hour() >= h && !logged.has(m)) { tasks.push({ id: `meal-${m}`, title: t('h4.task.meal', { meal: t(`meal.${m}` as Key).toLowerCase() }), icon: 'plate', color: '#D9F0E3', go: () => { reset(); router.push('/review'); } }); break; }
  }
  if (!ctx.consents.condition_tracking && !ctx.stored.conditions.length) tasks.push({ id: 'health', title: t('h4.task.health'), icon: 'heart', color: '#F9D8E3', go: () => router.push('/health') });

  const open = tasks.filter((x) => !hidden.includes(x.id));
  if (!open.length) return null;
  const shown = all ? open : open.slice(0, 2);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{t('h4.dash.assistant')}</Text>
        {open.length > 2 ? <Pressable onPress={() => setAll((a) => !a)}><Text style={{ color: colors.muted, fontWeight: '600' }}>{all ? '–' : `+${open.length - 2}`}</Text></Pressable> : null}
      </View>
      {shown.map((task, i) => (
        <FadeIn key={task.id} delay={i * 60}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, paddingRight: 12, boxShadow: '0 6px 20px rgba(60,50,120,0.08)' } as object}>
            <PressScale onPress={task.go} accessibilityRole="button" accessibilityLabel={task.title} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: task.color, alignItems: 'center', justifyContent: 'center' }}><Icon name={task.icon} size={20} color="#3A3560" /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>{t('h4.dash.task')}</Text>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{task.title}</Text>
              </View>
            </PressScale>
            <Pressable onPress={() => setHidden((h) => [...h, task.id])} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10}><Text style={{ fontSize: 22, color: colors.muted }}>×</Text></Pressable>
          </View>
        </FadeIn>
      ))}
    </View>
  );
}

/** One-tap logging chips. */
export function LogToday() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const reset = useDraft((s) => s.reset);
  const [water, setWater] = useState(false);
  const chip = (id: string, label: string, icon: IconName, bg: string, go: () => void) => (
    <View key={id} style={{ width: '48.5%' }}>
      <PressScale onPress={go} accessibilityRole="button" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 12, boxShadow: '0 4px 14px rgba(60,50,120,0.07)' } as object}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} color="#3A3560" /></View>
        <Text style={{ color: colors.text, fontWeight: '700', flexShrink: 1 }}>{label}</Text>
      </PressScale>
    </View>
  );
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{t('h4.dash.logToday')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
        {chip('headache', t('h4.quick.headache'), 'heart', '#F9D8E3', () => router.push({ pathname: '/check-in', params: { type: 'headache' } }))}
        {chip('energy', t('h4.quick.energy'), 'flame', '#FDE9C9', () => router.push({ pathname: '/check-in', params: { type: 'fatigue' } }))}
        {chip('water', water ? '✓ ' + t('h4.quick.water') : t('h4.quick.water'), 'drop', '#D6EBFA', async () => { try { await addWater(ctx.uid!, ctx.memberId, GLASS_ML); await qc.invalidateQueries({ queryKey: ['water'] }); setWater(true); } catch { /* shown on the water card below */ } })}
        {chip('meal', t('h4.quick.meal'), 'plate', '#D9F0E3', () => { reset(); router.push('/review'); })}
        {chip('sleep', t('h4.quick.sleep'), 'moon', '#E3DDFB', () => router.push('/progress'))}
        {chip('weight', t('h4.quick.weight'), 'progress', '#E3EAF5', () => router.push('/progress'))}
      </View>
    </View>
  );
}

function Tile({ colorsPair, title, sub, onPress, icon }: { colorsPair: [string, string]; title: string; sub: string; onPress: () => void; icon: IconName }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={{ flex: 1 }}>
      <LinearGradient colors={colorsPair} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg, padding: 14, minHeight: 130, justifyContent: 'space-between' }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFFAA', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={18} color="#3A3560" /></View>
        <View style={{ gap: 2 }}>
          <Text style={{ fontWeight: '800', color: '#1F1B3A', fontSize: 15 }}>{title}</Text>
          <Text style={{ color: '#4A4568', fontSize: 13 }} numberOfLines={3}>{sub}</Text>
        </View>
      </LinearGradient>
    </PressScale>
  );
}

/** Two gradient cards: the next meal idea and today's workout. */
export function ForYou() {
  const t = useT();
  const label = useFoodLabel();
  const router = useRouter();
  const ctx = useHealthContext();
  const gym = useGymPrefs(ctx.uid, ctx.memberId);
  const plan = useMemo(() => (ctx.profile ? planDay({ targets: targetsFor(ctx.profile), diet: ctx.profile.diet as DietPref, region: 'any', allergies: ctx.profile.allergies, seed: new Date().getDate(), constraints: ctx.constraints, cooking: ctx.prefs?.cooking }) : null), [ctx.profile, ctx.constraints, ctx.prefs?.cooking]);
  const slotNow = hour() < 11 ? 'breakfast' : hour() < 16 ? 'lunch' : hour() < 19 ? 'snack' : 'dinner';
  const slot = plan?.slots.find((s) => s.slot === slotNow) ?? plan?.slots[0];
  const mealSub = slot ? `${t(`meal.${slot.slot}` as Key)}: ${slot.items.slice(0, 2).map((i) => label(i.foodId, i.name)).join(', ')}` : '';

  const gymTitle = t('h4.fy.workout');
  let gymSub = t('h4.task.gym');
  if (gym.data?.exists && gym.data.goes) {
    const p = buildGymPlan(gym.data, ctx.constraints);
    const s = sessionFor(p, new Date());
    gymSub = s ? t(`h4.gym.focus.${s.focus}` as Key) : t('h4.fy.rest');
  } else if (gym.data?.exists) gymSub = t('h4.gym.noReply');
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{t('h4.dash.forYou')}</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Tile colorsPair={['#CFE9D9', '#F6E8C8']} title={t('h4.fy.meal')} sub={mealSub} icon="plate" onPress={() => router.push('/plan')} />
        <Tile colorsPair={['#D8D2F4', '#F7D2E3']} title={gymTitle} sub={gymSub} icon="run" onPress={() => router.push('/gym')} />
      </View>
    </View>
  );
}

const MOODS: { e: string; key: 'great' | 'good' | 'okay' | 'low' | 'bad'; bg: string; v: number }[] = [
  { e: '😄', key: 'great', bg: '#D9F0E3', v: 5 }, { e: '🙂', key: 'good', bg: '#E3F0D9', v: 4 }, { e: '😐', key: 'okay', bg: '#FDE9C9', v: 3 }, { e: '😔', key: 'low', bg: '#F9D8E3', v: 2 }, { e: '😣', key: 'bad', bg: '#F7CFCF', v: 1 },
];

/** A friendly daily mood tap, saved once per day (tap again to change). Low moods gently offer a check-in. Shows the last 7 days. */
export function MoodRow() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const ctx = useHealthContext();
  const today = new Date();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const weekAgo = new Date(today.getTime() - 6 * 86400000);
  const moods = useMoods(ctx.uid, ctx.memberId, key(weekAgo));
  const [picked, setPicked] = useState<(typeof MOODS)[number]['key'] | null>(null);
  const saved = (moods.data ?? []).find((m) => m.date === key(today));
  const current = picked ?? MOODS.find((m) => m.v === saved?.mood)?.key ?? null;

  async function choose(m: (typeof MOODS)[number]) {
    setPicked(m.key);
    try { await saveMood(ctx.uid!, ctx.memberId, key(today), m.v); await qc.invalidateQueries({ queryKey: ['moods'] }); } catch { /* the kind reply still shows */ }
  }
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(today.getTime() - (6 - i) * 86400000); const v = (moods.data ?? []).find((x) => x.date === key(d))?.mood; return { label: String(d.getDate()), emoji: v ? MOODS.find((m) => m.v === v)!.e : null }; });
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{t('h4.mood.title')}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {MOODS.map((m) => {
          const on = current === m.key;
          return (
            <PressScale key={m.key} onPress={() => choose(m)} accessibilityRole="button" accessibilityLabel={`mood ${m.key}`} scaleTo={0.85}
              style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: on ? m.bg : '#fff', borderWidth: on ? 2 : 0, borderColor: '#5B4FA8', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(60,50,120,0.08)' } as object}>
              <Text style={{ fontSize: on ? 28 : 24 }}>{m.e}</Text>
            </PressScale>
          );
        })}
      </View>
      {current ? (
        <FadeIn y={6}>
          <View style={{ backgroundColor: '#fff', borderRadius: radius.md, padding: 12, gap: 8 }}>
            <Text style={{ color: colors.text }}>{t(`h4.mood.${current}` as Key)}</Text>
            {current === 'low' || current === 'bad' ? (
              <Pressable onPress={() => router.push({ pathname: '/check-in', params: { type: 'stress' } })} accessibilityRole="button"><Text style={{ color: colors.primaryDark, fontWeight: '700' }}>{t('h4.ci.title')} →</Text></Pressable>
            ) : null}
          </View>
        </FadeIn>
      ) : null}
      <View style={{ backgroundColor: '#fff', borderRadius: radius.md, padding: 10, gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{t('h4.mood.week')}</Text>
        <DotRow items={week} />
      </View>
    </View>
  );
}

/** "Today at a glance": a short, personal summary and one gentle suggestion based on the day so far. */
export function TodaySummary() {
  const t = useT();
  const ctx = useHealthContext();
  const r = useDayRecords(ctx.uid, ctx.memberId, 1);
  const goal = ctx.profile ? targetsFor(ctx.profile).water_ml : 2000;
  const d = r.days[0];
  if (!d) return null;
  const tip = hour() >= 14 && (d.waterMl ?? 0) < goal * 0.5 ? 'water' : hour() >= 12 && d.mealsLogged === 0 ? 'meal' : hour() >= 17 && !d.workoutDone && (d.steps ?? 0) < 4000 ? 'walk' : 'good';
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, gap: 6, boxShadow: '0 6px 20px rgba(60,50,120,0.08)' } as object}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{t('h4.ds.title')}</Text>
      <Text style={{ color: colors.muted }}>{t('h4.ds.line', { meals: d.mealsLogged, water: d.waterMl ?? 0, pct: Math.round(Math.min(100, ((d.waterMl ?? 0) / goal) * 100)) })}</Text>
      <Text style={{ color: colors.text, fontWeight: '600' }}>{t(`h4.ds.tip.${tip}` as Key)}</Text>
    </View>
  );
}

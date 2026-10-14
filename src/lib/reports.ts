import { useMemo } from 'react';
import { lastDates, type DayRecord } from '@/core/insights';
import { dayKey } from '@/core/progress';
import { startOfDay, totalsOf, useActivity, useMeals, useSleep, useWater, useWeights } from './data';
import { useMoods, useSymptomHistory, useWorkoutLogs } from './health';

/** One record per calendar day for the last `n` days, built from what the person logged. Missing data stays null (not zero). */
export function useDayRecords(uid: string | undefined, memberId: string | null, n: number) {
  const today = startOfDay();
  const from = new Date(today.getTime() - (n - 1) * 86400000);
  const to = new Date(today.getTime() + 86400000);
  const fromKey = dayKey(from);
  const meals = useMeals(uid, memberId, from, to);
  const water = useWater(uid, memberId, from, to);
  const sleep = useSleep(uid, memberId);
  const activity = useActivity(uid, memberId);
  const weights = useWeights(uid, memberId);
  const workouts = useWorkoutLogs(uid, memberId, fromKey);
  const moods = useMoods(uid, memberId, fromKey);
  const symptoms = useSymptomHistory(uid, memberId, from.toISOString());
  const loading = [meals, water, sleep, activity, workouts, moods, symptoms].some((q) => q.isLoading);

  const days = useMemo(() => {
    const dates = lastDates(dayKey(today), n);
    return dates.map((date): DayRecord => {
      const dm = (meals.data ?? []).filter((m) => dayKey(new Date(m.eaten_at)) === date);
      const t = totalsOf(dm);
      const w = (water.data ?? []).filter((x) => dayKey(new Date(x.logged_at)) === date).reduce((a, x) => a + x.ml, 0);
      const sl = (sleep.data ?? []).find((x) => x.date === date);
      const ac = (activity.data ?? []).find((x) => x.date === date);
      return {
        date, kcal: dm.length ? Math.round(t.kcal) : null, protein_g: dm.length ? Math.round(t.protein_g) : null, mealsLogged: dm.length,
        waterMl: w > 0 ? w : null, sleepHours: sl ? sl.hours : null, steps: ac && ac.steps > 0 ? ac.steps : null, exerciseMin: ac ? ac.exercise_min : null,
        workoutDone: (workouts.data ?? []).some((x) => x.date === date && x.status === 'done'),
        routineDone: 0, routineTotal: 0,
        mood: (moods.data ?? []).find((x) => x.date === date)?.mood ?? null,
        symptoms: (symptoms.data ?? []).filter((x) => x.date === date).length,
      };
    });
  }, [meals.data, water.data, sleep.data, activity.data, workouts.data, moods.data, symptoms.data, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const weightRange = (weights.data ?? []).filter((w) => w.date >= fromKey);
  return { days, loading, weightStart: weightRange[0]?.weight_kg ?? null, weightEnd: weightRange.length > 1 ? weightRange[weightRange.length - 1].weight_kg : null };
}

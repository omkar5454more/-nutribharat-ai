import type { GoalType, Nutrients } from './types';

export type WeightLog = { date: string; weight_kg: number }; // date = YYYY-MM-DD (local day)
export type DayTotals = { date: string; totals: Nutrients; meals: number };

const DAY = 24 * 3600 * 1000;

/** Local-day key, e.g. 2026-10-13 (not UTC, so a late-night meal lands on the day the user ate it). */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const lastNDays = (n: number, today = new Date()): string[] =>
  Array.from({ length: n }, (_, i) => dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1 - i))));

export type WeightSummary = {
  start: number;
  latest: number;
  change: number;
  /** kg per week over the most recent 14 days (negative = losing); null when there isn't enough data */
  weeklyRate: number | null;
  /** 3-entry moving average, smooths day-to-day water-weight noise */
  smoothed: number[];
};

export function summarizeWeight(logs: WeightLog[]): WeightSummary | null {
  if (!logs.length) return null;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const w = sorted.map((l) => l.weight_kg);
  const smoothed = w.map((_, i) => {
    const win = w.slice(Math.max(0, i - 2), i + 1);
    return Math.round((win.reduce((a, b) => a + b, 0) / win.length) * 10) / 10;
  });
  const latest = sorted[sorted.length - 1];
  const cutoff = Date.parse(latest.date) - 14 * DAY;
  const recent = sorted.filter((l) => Date.parse(l.date) >= cutoff);
  let weeklyRate: number | null = null;
  if (recent.length >= 2) {
    const first = recent[0];
    const days = (Date.parse(latest.date) - Date.parse(first.date)) / DAY;
    if (days >= 5) weeklyRate = Math.round(((latest.weight_kg - first.weight_kg) / days) * 7 * 100) / 100;
  }
  return { start: sorted[0].weight_kg, latest: latest.weight_kg, change: Math.round((latest.weight_kg - sorted[0].weight_kg) * 10) / 10, weeklyRate, smoothed };
}

export type WeightAdvice = 'losing_too_fast' | 'gaining_while_losing' | 'losing_while_gaining' | 'on_track' | 'not_enough_data';

/** Plain check of the weight trend against the goal. 'losing_too_fast' = more than 1% of body weight per week. */
export function weightAdvice(summary: WeightSummary | null, goal: GoalType): WeightAdvice {
  if (!summary || summary.weeklyRate === null) return 'not_enough_data';
  const r = summary.weeklyRate;
  if (r < -0.01 * summary.latest) return 'losing_too_fast';
  if (goal === 'lose' && r > 0.1) return 'gaining_while_losing';
  if (goal === 'gain' && r < -0.1) return 'losing_while_gaining';
  return 'on_track';
}

export type WeekSummary = {
  daysLogged: number;
  avgKcal: number;
  avgProtein: number;
  /** days (of those logged) within ±15% of the calorie target */
  daysOnTarget: number;
  streak: number;
};

/** Averages count only days that have at least one meal, so a day without logging isn't read as "ate nothing". */
export function summarizeWeek(days: DayTotals[], targetKcal: number): WeekSummary {
  const logged = days.filter((d) => d.meals > 0);
  const avg = (f: (d: DayTotals) => number) => (logged.length ? Math.round(logged.reduce((a, d) => a + f(d), 0) / logged.length) : 0);
  const daysOnTarget = logged.filter((d) => Math.abs(d.totals.kcal - targetKcal) <= targetKcal * 0.15).length;
  // streak = consecutive logged days ending today (or yesterday, if today has no meal yet)
  let streak = 0;
  const ordered = [...days].sort((a, b) => b.date.localeCompare(a.date));
  let i = ordered.length && ordered[0].meals === 0 ? 1 : 0;
  for (; i < ordered.length && ordered[i].meals > 0; i++) streak++;
  return { daysLogged: logged.length, avgKcal: avg((d) => d.totals.kcal), avgProtein: avg((d) => d.totals.protein_g), daysOnTarget, streak };
}

export type SleepLog = { date: string; hours: number };
export type ActivityLog = { date: string; steps: number; exercise_min: number };

export const STEP_GOAL = 8000;      // a common everyday target; the app presents it as a guide, not a prescription
export const SLEEP_MIN = 7;         // general adult guidance is roughly 7–9 hours
export const SLEEP_MAX = 9;

export type SleepAdvice = 'very_short' | 'short' | 'good' | 'long' | 'not_enough_data';

export function sleepAdvice(avgHours: number | null): SleepAdvice {
  if (avgHours === null) return 'not_enough_data';
  if (avgHours < 6) return 'very_short';
  if (avgHours < SLEEP_MIN) return 'short';
  if (avgHours <= SLEEP_MAX) return 'good';
  return 'long';
}

export type WellnessWeek = {
  sleepNights: number;
  avgSleep: number | null;
  nightsInRange: number;
  activityDays: number;
  avgSteps: number | null;
  daysAtStepGoal: number;
  exerciseMinutes: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** `dates` = the days to look at (e.g. the last 7). Only days that have a log count towards averages. */
export function summarizeWellness(dates: string[], sleep: SleepLog[], activity: ActivityLog[]): WellnessWeek {
  const inRange = new Set(dates);
  const sl = sleep.filter((s) => inRange.has(s.date));
  const ac = activity.filter((a) => inRange.has(a.date));
  return {
    sleepNights: sl.length,
    avgSleep: sl.length ? round1(sl.reduce((a, s) => a + s.hours, 0) / sl.length) : null,
    nightsInRange: sl.filter((s) => s.hours >= SLEEP_MIN && s.hours <= SLEEP_MAX).length,
    activityDays: ac.length,
    avgSteps: ac.length ? Math.round(ac.reduce((a, d) => a + d.steps, 0) / ac.length) : null,
    daysAtStepGoal: ac.filter((a) => a.steps >= STEP_GOAL).length,
    exerciseMinutes: ac.reduce((a, d) => a + d.exercise_min, 0),
  };
}

export const validSleep = (h: number) => Number.isFinite(h) && h >= 1 && h <= 16;
export const validSteps = (n: number) => Number.isInteger(n) && n >= 0 && n <= 100000;
export const validMinutes = (n: number) => Number.isInteger(n) && n >= 0 && n <= 600;

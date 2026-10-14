/**
 * Weekly / monthly reports and the wellness journey, computed from what the person actually logged.
 * Logged numbers and estimates are kept apart, nothing here diagnoses anything, and a day with no log is simply "not logged" (never a failure).
 */
export type DayRecord = {
  date: string;
  /** null = nothing logged that day */
  kcal: number | null;
  protein_g: number | null;
  mealsLogged: number;
  waterMl: number | null;
  sleepHours: number | null;
  steps: number | null;
  exerciseMin: number | null;
  workoutDone: boolean;
  routineDone: number;
  routineTotal: number;
  mood: number | null;
  symptoms: number;
};

const avg = (xs: (number | null)[]): { value: number | null; n: number } => {
  const v = xs.filter((x): x is number => typeof x === 'number');
  return { value: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null, n: v.length };
};

export type WeekSummary = {
  days: number;
  kcal: { value: number | null; n: number };
  protein: { value: number | null; n: number };
  water: { value: number | null; n: number; goalDays: number };
  sleep: { value: number | null; n: number };
  steps: { value: number | null; n: number };
  mealDays: number;
  workouts: number;
  routinePct: number | null;
  mood: { value: number | null; n: number };
  symptomDays: number;
  /** share of days with at least one meal logged — shown as "days logged", not as a score */
  loggedDays: number;
};

export function summarizeDays(days: DayRecord[], waterGoalMl: number): WeekSummary {
  const done = days.reduce((a, d) => a + d.routineDone, 0);
  const total = days.reduce((a, d) => a + d.routineTotal, 0);
  const w = avg(days.map((d) => d.waterMl));
  return {
    days: days.length,
    kcal: avg(days.map((d) => d.kcal)), protein: avg(days.map((d) => d.protein_g)),
    water: { ...w, goalDays: days.filter((d) => (d.waterMl ?? 0) >= waterGoalMl * 0.9).length },
    sleep: avg(days.map((d) => d.sleepHours)), steps: avg(days.map((d) => d.steps)),
    mealDays: days.filter((d) => d.mealsLogged > 0).length,
    workouts: days.filter((d) => d.workoutDone).length,
    routinePct: total ? Math.round((done / total) * 100) : null,
    mood: avg(days.map((d) => d.mood)),
    symptomDays: days.filter((d) => d.symptoms > 0).length,
    loggedDays: days.filter((d) => d.mealsLogged > 0 || d.waterMl || d.sleepHours || d.steps).length,
  };
}

export type SymptomPoint = { date: string; count: number; maxSeverity: number };
export function symptomSeries(logs: { date: string; severity: number }[], dates: string[]): SymptomPoint[] {
  return dates.map((date) => {
    const day = logs.filter((l) => l.date === date);
    return { date, count: day.length, maxSeverity: day.reduce((m, l) => Math.max(m, l.severity), 0) };
  });
}

/** Last n calendar dates ending on `end` (YYYY-MM-DD), oldest first. */
export function lastDates(end: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${end}T00:00:00`);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d); x.setDate(d.getDate() - i);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
  }
  return out;
}

export type JourneyStats = { mealDays: number; waterGoalDays: number; workoutsDone: number; checkIns: number; flexPlanned: boolean; routineDays: number; moodDays: number; sleepLogs: number; weightLogs: number };
export type Badge = { id: string; progress: number; target: number; unlocked: boolean };

const DEFS: { id: string; target: number; of: (s: JourneyStats) => number }[] = [
  { id: 'first_meal', target: 1, of: (s) => s.mealDays },
  { id: 'meals_7', target: 7, of: (s) => s.mealDays },
  { id: 'water_3', target: 3, of: (s) => s.waterGoalDays },
  { id: 'water_10', target: 10, of: (s) => s.waterGoalDays },
  { id: 'first_workout', target: 1, of: (s) => s.workoutsDone },
  { id: 'workouts_10', target: 10, of: (s) => s.workoutsDone },
  { id: 'first_checkin', target: 1, of: (s) => s.checkIns },
  { id: 'routine_5', target: 5, of: (s) => s.routineDays },
  { id: 'mood_7', target: 7, of: (s) => s.moodDays },
  { id: 'sleep_7', target: 7, of: (s) => s.sleepLogs },
  { id: 'flex_planned', target: 1, of: (s) => (s.flexPlanned ? 1 : 0) },
  { id: 'weight_3', target: 3, of: (s) => s.weightLogs },
];

/** Milestones that only ever count UP (totals, not streaks), so a rest day or an illness never takes anything away. */
export function badges(s: JourneyStats): Badge[] {
  return DEFS.map((d) => { const v = d.of(s); return { id: d.id, target: d.target, progress: Math.min(v, d.target), unlocked: v >= d.target }; });
}

/**
 * Symptom check-ins: a safety screen first, then (only if the person agrees) gentle follow-ups.
 * Nothing here diagnoses, names a medicine, or promises a result. Emergencies end the routine flow.
 * All thresholds and wording need review by a clinician before real-world use.
 */

export type SymptomType = 'headache' | 'fatigue' | 'menstrual' | 'stress' | 'sleep' | 'other';
export const SYMPTOM_TYPES: SymptomType[] = ['headache', 'fatigue', 'menstrual', 'stress', 'sleep', 'other'];

/** Yes/no answers to the screening questions. Anything the person leaves unanswered counts as "no". */
export type HeadacheAnswers = {
  /** came on suddenly and is the worst headache of their life, or reached full strength within a minute */
  suddenSevere: boolean;
  /** weakness or numbness on one side, face drooping, trouble speaking, vision loss, confusion, fainting, seizure */
  neurological: boolean;
  /** fever with a stiff neck, or a rash */
  feverStiffNeck: boolean;
  /** after a knock or injury to the head */
  afterInjury: boolean;
  /** not like their usual headaches (new, different, getting steadily worse over days) */
  newOrDifferent: boolean;
  /** the person says they have been diagnosed with migraine by a doctor */
  knownMigraine: boolean;
};

export type Screening = 'emergency' | 'see_doctor' | 'usual';

export function screenHeadache(a: Partial<HeadacheAnswers>): Screening {
  if (a.suddenSevere || a.neurological || a.feverStiffNeck || a.afterInjury) return 'emergency';
  if (a.newOrDifferent || !a.knownMigraine) return 'see_doctor';
  return 'usual';
}

/** Other symptom types: only severity and a few danger signs. A very high score or a danger sign advises care. */
export function screenGeneral(severity: number, dangerSign: boolean): Screening {
  if (dangerSign) return 'emergency';
  return severity >= 9 ? 'see_doctor' : 'usual';
}

export type Response = 'better' | 'same' | 'worse' | 'stop';
export type LogStatus = 'open' | 'better' | 'resolved' | 'worse' | 'stopped';

export type FollowUpPlan = { dueAt: number; attempt: number } | null;

export const FOLLOW_UP_DELAYS_MIN = [30, 60, 120] as const;
const MAX_FOLLOW_UPS = 2;                 // never nag: at most two follow-ups for one episode

export type QuietHours = { startMinute: number; endMinute: number } | null;

const minuteOfDay = (ms: number) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
const inQuiet = (m: number, q: NonNullable<QuietHours>) => (q.startMinute <= q.endMinute ? m >= q.startMinute && m < q.endMinute : m >= q.startMinute || m < q.endMinute);

/** Moves a reminder out of quiet hours, to the moment they end. */
export function respectQuietHours(dueAt: number, quiet: QuietHours): number {
  if (!quiet) return dueAt;
  const m = minuteOfDay(dueAt);
  if (!inQuiet(m, quiet)) return dueAt;
  const wait = (quiet.endMinute - m + 1440) % 1440;
  return dueAt + wait * 60000;
}

/** First follow-up, only when the person asked for one. */
export function firstFollowUp(now: number, delayMin: (typeof FOLLOW_UP_DELAYS_MIN)[number], quiet: QuietHours): FollowUpPlan {
  return { dueAt: respectQuietHours(now + delayMin * 60000, quiet), attempt: 1 };
}

export type NextStep =
  | { kind: 'celebrate'; status: 'better' }                                  // improved: close the episode warmly
  | { kind: 'check_again'; status: 'open'; follow: NonNullable<FollowUpPlan> } // about the same: one more gentle check
  | { kind: 'suggest_care'; status: 'open' }                                  // still the same after the follow-ups: suggest a clinician, no more reminders
  | { kind: 'rescreen'; status: 'worse' }                                     // worse: stop routine coaching and re-run the safety screen
  | { kind: 'stopped'; status: 'stopped' };                                   // the person turned reminders off

/** What to do after the person answers a follow-up. `attempt` is the number of follow-ups already answered, including this one. */
export function nextStep(response: Response, attempt: number, now: number, quiet: QuietHours): NextStep {
  if (response === 'stop') return { kind: 'stopped', status: 'stopped' };
  if (response === 'better') return { kind: 'celebrate', status: 'better' };
  if (response === 'worse') return { kind: 'rescreen', status: 'worse' };
  if (attempt >= MAX_FOLLOW_UPS) return { kind: 'suggest_care', status: 'open' };
  return { kind: 'check_again', status: 'open', follow: { dueAt: respectQuietHours(now + FOLLOW_UP_DELAYS_MIN[2] * 60000, quiet), attempt: attempt + 1 } };
}

/** A follow-up is due, still pending, and not suppressed. `comfort` mutes non-urgent prompts only when the person chose quiet reminders. */
export function isDue(dueAt: number, now: number, pending: boolean): boolean {
  return pending && now >= dueAt;
}

/** Comfort mode suppresses everything except follow-ups the person asked for about the current episode. */
export function suppressNonEssential(comfortActive: boolean, category: 'followup' | 'routine' | 'meal' | 'wellness'): boolean {
  return comfortActive && category !== 'followup';
}

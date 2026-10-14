import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { CONDITION_IDS, EMPTY_HEALTH, MEDICATION_FLAGS, RESTRICTIONS, SYMPTOMS, type HealthCondition, type HealthProfile, type MeasurementKind } from '@/core/health/conditions';
import { generateRoutine, DEFAULT_PREFS, type Activity, type MedicationReminder, type RoutinePrefs, type Status } from '@/core/routine';
import { supabase } from './supabase';

export type Purpose = 'condition_tracking' | 'coaching' | 'ai_processing';
export const PURPOSES: Purpose[] = ['condition_tracking', 'coaching', 'ai_processing'];

/** Restrict a query to one person's rows: me (member_id is null) or a family member. */
function scoped<Q extends { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(q: Q, memberId: string | null): Q {
  return memberId ? q.eq('member_id', memberId) : q.is('member_id', null);
}
const must = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

// ---------------------------------------------------------------- consent
export function useConsents(uid: string | undefined, memberId: string | null) {
  return useQuery({
    queryKey: ['consents', uid, memberId],
    enabled: !!uid,
    queryFn: async (): Promise<Record<Purpose, boolean>> => {
      const { data, error } = await scoped(supabase.from('health_consents').select('*').eq('user_id', uid!) as any, memberId) as any;
      must(error);
      const out = { condition_tracking: false, coaching: false, ai_processing: false };
      for (const r of data ?? []) if (r.granted && !r.withdrawn_at && r.purpose in out) out[r.purpose as Purpose] = true;
      return out;
    },
  });
}

export async function setConsent(uid: string, memberId: string | null, purpose: Purpose, granted: boolean) {
  const find = await (scoped(supabase.from('health_consents').select('id').eq('user_id', uid).eq('purpose', purpose) as any, memberId) as any);
  must(find.error);
  const fields = granted ? { granted: true, withdrawn_at: null, granted_at: new Date().toISOString() } : { granted: false, withdrawn_at: new Date().toISOString() };
  if (find.data?.length) {
    const { error } = await supabase.from('health_consents').update(fields).eq('id', find.data[0].id);
    must(error);
  } else {
    const { error } = await supabase.from('health_consents').insert({ user_id: uid, member_id: memberId, purpose, ...fields });
    must(error);
  }
}

// ---------------------------------------------------------------- conditions and clinician notes
const arr = <T extends string>(allowed: readonly T[], v: unknown): T[] => (Array.isArray(v) ? v.filter((x): x is T => (allowed as readonly string[]).includes(x)) : []);

export function useHealth(uid: string | undefined, memberId: string | null) {
  return useQuery({
    queryKey: ['health', uid, memberId],
    enabled: !!uid,
    queryFn: async (): Promise<HealthProfile> => {
      const conds = await (scoped(supabase.from('user_health_conditions').select('*').eq('user_id', uid!) as any, memberId) as any);
      must(conds.error);
      const details = await supabase.from('condition_details').select('*').eq('user_id', uid!);
      must(details.error);
      const notes = await (scoped(supabase.from('clinician_instructions').select('*').eq('user_id', uid!) as any, memberId) as any);
      must(notes.error);
      const conditions: HealthCondition[] = (conds.data ?? [])
        .filter((c: any) => (CONDITION_IDS as string[]).includes(c.condition))
        .map((c: any) => {
          const d = (details.data ?? []).find((x: any) => x.condition_id === c.id);
          return {
            id: c.condition, status: c.status === 'concern' ? 'concern' : 'diagnosed', otherLabel: c.other_label ?? undefined,
            restrictions: arr(RESTRICTIONS, d?.restrictions), medicationFlags: arr(MEDICATION_FLAGS, d?.medication_flags), symptoms: arr(SYMPTOMS, d?.symptoms),
            wantsAware: d ? d.wants_condition_aware !== false : true,
          };
        });
      return { conditions, instructions: (notes.data ?? []).map((n: any) => String(n.instruction)) };
    },
  });
}

export const healthOrEmpty = (h: HealthProfile | undefined): HealthProfile => h ?? EMPTY_HEALTH;

/** Replace the person's recorded conditions and clinician notes. Requires an active 'condition_tracking' consent (the database enforces that too). */
export async function saveHealth(uid: string, memberId: string | null, h: HealthProfile) {
  const del = await (scoped(supabase.from('user_health_conditions').delete().eq('user_id', uid) as any, memberId) as any);   // details go with them
  must(del.error);
  const delN = await (scoped(supabase.from('clinician_instructions').delete().eq('user_id', uid) as any, memberId) as any);
  must(delN.error);
  for (const c of h.conditions) {
    const ins = await supabase.from('user_health_conditions').insert({
      user_id: uid, member_id: memberId, condition: c.id, other_label: c.id === 'other' ? (c.otherLabel ?? 'Other').slice(0, 60) : null,
      status: c.status, professionally_diagnosed: c.status === 'diagnosed',
    }).select('id').single();
    must(ins.error);
    const { error } = await supabase.from('condition_details').insert({
      condition_id: (ins.data as any).id, user_id: uid, restrictions: c.restrictions, medication_flags: c.medicationFlags, symptoms: c.symptoms, wants_condition_aware: c.wantsAware,
    });
    must(error);
  }
  for (const text of h.instructions.map((t) => t.trim().slice(0, 500)).filter(Boolean)) {
    const { error } = await supabase.from('clinician_instructions').insert({ user_id: uid, member_id: memberId, instruction: text, source: 'user_entered' });
    must(error);
  }
}

// ---------------------------------------------------------------- measurements
export const MeasurementRowSchema = z.object({
  id: z.string(), kind: z.string(), measured_at: z.string(),
  systolic: z.coerce.number().nullable().optional(), diastolic: z.coerce.number().nullable().optional(), pulse: z.coerce.number().nullable().optional(),
  glucose_mg_dl: z.coerce.number().nullable().optional(), glucose_context: z.string().nullable().optional(), note: z.string().nullable().optional(),
});
export type MeasurementRow = z.infer<typeof MeasurementRowSchema>;

export function useMeasurements(uid: string | undefined, memberId: string | null) {
  return useQuery({
    queryKey: ['measurements', uid, memberId],
    enabled: !!uid,
    queryFn: async (): Promise<MeasurementRow[]> => {
      const { data, error } = await (scoped(supabase.from('health_measurement_logs').select('*').eq('user_id', uid!) as any, memberId) as any).order('measured_at', { ascending: false }).limit(60);
      must(error);
      return (data ?? []).map((r: unknown) => MeasurementRowSchema.parse(r));
    },
  });
}

export async function addMeasurement(uid: string, memberId: string | null, m: { kind: MeasurementKind; systolic?: number; diastolic?: number; pulse?: number; glucose?: number; context?: string; note?: string }) {
  const { error } = await supabase.from('health_measurement_logs').insert({
    user_id: uid, member_id: memberId, kind: m.kind, systolic: m.systolic ?? null, diastolic: m.diastolic ?? null, pulse: m.pulse ?? null,
    glucose_mg_dl: m.glucose ?? null, glucose_context: m.context ?? null, note: m.note?.slice(0, 300) ?? null,
  });
  must(error);
}

export async function deleteMeasurement(id: string) {
  const { error } = await supabase.from('health_measurement_logs').delete().eq('id', id);
  must(error);
}

// ---------------------------------------------------------------- triggers (the person's own observations)
export function useTriggers(uid: string | undefined, memberId: string | null) {
  return useQuery({
    queryKey: ['triggers', uid, memberId],
    enabled: !!uid,
    queryFn: async (): Promise<{ id: string; label: string }[]> => {
      const { data, error } = await (scoped(supabase.from('condition_triggers').select('*').eq('user_id', uid!) as any, memberId) as any).order('created_at', { ascending: false });
      must(error);
      return (data ?? []).map((r: any) => ({ id: r.id, label: r.label }));
    },
  });
}
export async function addTrigger(uid: string, memberId: string | null, label: string) {
  const { error } = await supabase.from('condition_triggers').insert({ user_id: uid, member_id: memberId, label: label.trim().slice(0, 80), kind: 'food' });
  must(error);
}
export async function deleteTrigger(id: string) {
  const { error } = await supabase.from('condition_triggers').delete().eq('id', id);
  must(error);
}

// ---------------------------------------------------------------- safety log
export async function logSafetyEvent(uid: string, memberId: string | null, kind: 'emergency_reading' | 'red_flag_symptom' | 'conflict_detected' | 'conservative_default' | 'blocked_request' | 'medication_boundary', severity: 'info' | 'warning' | 'urgent', details: Record<string, unknown> = {}) {
  // best effort: a failure to log must never block showing the safety message
  try { await supabase.from('recommendation_safety_events').insert({ user_id: uid, member_id: memberId, kind, severity, details }); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- routine preferences and reminders
export function useRoutinePrefs(uid: string | undefined, memberId: string | null) {
  return useQuery({
    queryKey: ['routine-prefs', uid, memberId],
    enabled: !!uid,
    queryFn: async (): Promise<RoutinePrefs & { exists: boolean }> => {
      const { data, error } = await (scoped(supabase.from('routine_preferences').select('*').eq('user_id', uid!) as any, memberId) as any);
      must(error);
      const r = data?.[0];
      if (!r) return { ...DEFAULT_PREFS, exists: false };
      return { wakeMinute: Number(r.wake_minute), sleepMinute: Number(r.sleep_minute), workStart: r.work_start_minute ?? null, workEnd: r.work_end_minute ?? null, shift: r.shift, cooking: r.cooking_time, fitness: r.fitness_level, exists: true };
    },
  });
}

export async function saveRoutinePrefs(uid: string, memberId: string | null, p: RoutinePrefs) {
  const del = await (scoped(supabase.from('routine_preferences').delete().eq('user_id', uid) as any, memberId) as any);
  must(del.error);
  const { error } = await supabase.from('routine_preferences').insert({
    user_id: uid, member_id: memberId, wake_minute: p.wakeMinute, sleep_minute: p.sleepMinute, work_start_minute: p.workStart, work_end_minute: p.workEnd,
    shift: p.shift, cooking_time: p.cooking, fitness_level: p.fitness,
  });
  must(error);
}

export type ReminderRow = { id: string; kind: string; minute: number | null; enabled: boolean; label: string | null };

export function useReminders(uid: string | undefined, memberId: string | null) {
  return useQuery({
    queryKey: ['reminders', uid, memberId],
    enabled: !!uid,
    queryFn: async (): Promise<ReminderRow[]> => {
      const { data, error } = await (scoped(supabase.from('routine_reminders').select('*').eq('user_id', uid!) as any, memberId) as any);
      must(error);
      return (data ?? []).map((r: any) => ({ id: r.id, kind: r.kind, minute: r.minute ?? null, enabled: r.enabled !== false, label: r.medication_label ?? null }));
    },
  });
}

export async function saveReminder(uid: string, memberId: string | null, r: { kind: string; minute: number | null; enabled: boolean; label?: string }) {
  const { error } = await supabase.from('routine_reminders').insert({ user_id: uid, member_id: memberId, kind: r.kind, minute: r.minute, enabled: r.enabled, medication_label: r.label ?? null });
  must(error);
}
export async function setReminderEnabled(id: string, enabled: boolean) {
  const { error } = await supabase.from('routine_reminders').update({ enabled }).eq('id', id);
  must(error);
}
export async function deleteReminder(id: string) {
  const { error } = await supabase.from('routine_reminders').delete().eq('id', id);
  must(error);
}

export const medsFrom = (rows: ReminderRow[]): MedicationReminder[] =>
  rows.filter((r) => r.kind === 'medication' && r.label && r.minute !== null).map((r) => ({ label: r.label!, minute: r.minute!, enabled: r.enabled }));

// ---------------------------------------------------------------- the day's routine
export type StoredRoutine = { id: string; date: string; activities: Activity[]; status: Record<string, Status>; isFlexDay: boolean };

export function useRoutine(uid: string | undefined, memberId: string | null, date: string) {
  return useQuery({
    queryKey: ['routine', uid, memberId, date],
    enabled: !!uid,
    queryFn: async (): Promise<StoredRoutine | null> => {
      const { data, error } = await (scoped(supabase.from('daily_routines').select('*').eq('user_id', uid!).eq('routine_date', date) as any, memberId) as any);
      must(error);
      const r = data?.[0];
      if (!r) return null;
      const acts = await supabase.from('routine_activities').select('*').eq('routine_id', r.id);
      must(acts.error);
      const comps = await supabase.from('routine_completions').select('*').eq('user_id', uid!);
      must(comps.error);
      const ids = new Set((acts.data ?? []).map((a: any) => a.id));
      const status: Record<string, Status> = {};
      for (const c of comps.data ?? []) if (ids.has(c.activity_id)) status[c.activity_id] = c.status;
      const activities: Activity[] = (acts.data ?? []).map((a: any) => ({
        id: a.id, kind: a.kind, title: a.title, detailKey: a.detail ?? '', start: a.start_minute, duration: a.duration_min, source: a.source,
        medicationLabel: a.medication_label ?? undefined, intensity: a.payload?.intensity, slot: a.payload?.slot,
      }));
      return { id: r.id, date, activities, status, isFlexDay: !!r.is_flex_day };
    },
  });
}

/** Save (replace) the whole routine for a day. Completion records for activities that no longer exist go away with them. */
export async function saveRoutine(uid: string, memberId: string | null, date: string, activities: Activity[], keepStatus: Record<string, Status> = {}, isFlexDay = false): Promise<StoredRoutine> {
  const old = await (scoped(supabase.from('daily_routines').delete().eq('user_id', uid).eq('routine_date', date) as any, memberId) as any);
  must(old.error);
  const ins = await supabase.from('daily_routines').insert({ user_id: uid, member_id: memberId, routine_date: date, title: '', settings: {}, is_flex_day: isFlexDay }).select('id').single();
  must(ins.error);
  const routineId = (ins.data as any).id as string;
  const idMap: Record<string, string> = {};
  const fresh: Activity[] = [];
  for (const [i, a] of activities.entries()) {
    const row = await supabase.from('routine_activities').insert({
      routine_id: routineId, user_id: uid, kind: a.kind, title: a.title.slice(0, 120), detail: a.detailKey, start_minute: a.start, duration_min: a.duration, sort_order: i, source: a.source,
      medication_label: a.kind === 'medication' ? a.medicationLabel : null, payload: { intensity: a.intensity ?? null, slot: a.slot ?? null },
    }).select('id').single();
    must(row.error);
    idMap[a.id] = (row.data as any).id;
    fresh.push({ ...a, id: idMap[a.id] });
  }
  const status: Record<string, Status> = {};
  for (const [oldId, st] of Object.entries(keepStatus)) {
    const nid = idMap[oldId];
    if (!nid) continue;
    const { error } = await supabase.from('routine_completions').insert({ activity_id: nid, user_id: uid, status: st });
    must(error);
    status[nid] = st;
  }
  return { id: routineId, date, activities: fresh, status, isFlexDay };
}

export async function setActivityStatus(uid: string, activityId: string, status: Status | null) {
  const del = await supabase.from('routine_completions').delete().eq('activity_id', activityId);
  must(del.error);
  if (status) {
    const { error } = await supabase.from('routine_completions').insert({ activity_id: activityId, user_id: uid, status });
    must(error);
  }
}

/** Change one entry (time, or a swapped lighter workout). */
export async function updateActivity(id: string, a: { start?: number; duration?: number; intensity?: string }) {
  const fields: Record<string, unknown> = {};
  if (a.start !== undefined) fields.start_minute = a.start;
  if (a.duration !== undefined) fields.duration_min = a.duration;
  if (a.intensity !== undefined) { fields.payload = { intensity: a.intensity, slot: null }; fields.detail = `routine.exercise_${a.intensity}`; }
  const { error } = await supabase.from('routine_activities').update(fields).eq('id', id);
  must(error);
}

/** Convenience: the generated routine for a day (not saved). */
export const draftRoutine = generateRoutine;

// ---------------------------------------------------------------- Flex Day
export type FlexDayRow = { id: string; month: string; date: string; status: 'planned' | 'done' | 'skipped'; foods: { id: string; label: string; foodId: string | null }[] };

export function useFlexDays(uid: string | undefined, memberId: string | null) {
  return useQuery({
    queryKey: ['flex', uid, memberId],
    enabled: !!uid,
    queryFn: async (): Promise<FlexDayRow[]> => {
      const { data, error } = await (scoped(supabase.from('monthly_flex_days').select('*').eq('user_id', uid!) as any, memberId) as any).order('month', { ascending: false });
      must(error);
      const foods = await supabase.from('flex_day_food_choices').select('*').eq('user_id', uid!);
      must(foods.error);
      return (data ?? []).map((f: any) => ({
        id: f.id, month: f.month, date: f.flex_date, status: f.status,
        foods: (foods.data ?? []).filter((c: any) => c.flex_day_id === f.id).map((c: any) => ({ id: c.id, label: c.food_label, foodId: c.food_id ?? null })),
      }));
    },
  });
}

export async function saveFlexDay(uid: string, memberId: string | null, month: string, date: string, foods: { label: string; foodId: string | null }[], existingId?: string) {
  if (existingId) {
    const d = await supabase.from('monthly_flex_days').delete().eq('id', existingId);   // its food choices go with it
    must(d.error);
  }
  const ins = await supabase.from('monthly_flex_days').insert({ user_id: uid, member_id: memberId, month, flex_date: date, status: 'planned' }).select('id').single();
  must(ins.error);
  for (const f of foods) {
    const { error } = await supabase.from('flex_day_food_choices').insert({ flex_day_id: (ins.data as any).id, user_id: uid, food_label: f.label.slice(0, 60), food_id: f.foodId });
    must(error);
  }
}
export async function setFlexStatus(id: string, status: 'planned' | 'done' | 'skipped') {
  const { error } = await supabase.from('monthly_flex_days').update({ status }).eq('id', id);
  must(error);
}
export async function deleteFlexDay(id: string) {
  const { error } = await supabase.from('monthly_flex_days').delete().eq('id', id);
  must(error);
}

// ---------------------------------------------------------------- privacy: export, retention, deletion
const EXPORT_TABLES = ['health_consents', 'user_health_conditions', 'condition_details', 'condition_triggers', 'health_measurement_logs', 'clinician_instructions', 'routine_preferences', 'daily_routines', 'routine_activities', 'routine_completions', 'routine_reminders', 'monthly_flex_days', 'flex_day_food_choices', 'recommendation_safety_events'] as const;

/** Everything the app holds about the account's health and routines, as one JSON-able object (for "download my data"). */
export async function exportHealthData(uid: string) {
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), note: 'NutriBharat AI health and routine data for this account.' };
  for (const t of EXPORT_TABLES) {
    const { data, error } = await supabase.from(t).select('*').eq('user_id', uid);
    must(error);
    out[t] = data ?? [];
  }
  return out;
}

export async function deleteAllHealthData() {
  const { error } = await supabase.rpc('delete_my_health_data');
  must(error);
}

export async function purgeOldHealthLogs(days: number): Promise<number> {
  const { data, error } = await supabase.rpc('purge_my_health_logs', { older_than_days: days });
  must(error);
  return Number(data ?? 0);
}

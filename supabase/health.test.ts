// Real SQL, real row-level security (in-memory Postgres): proves the consent gate, per-person isolation and deletion for the health tables.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const DIR = join(__dirname, 'migrations');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
let db: PGlite;

async function as<T = any>(user: string | null, sql: string): Promise<{ rows: T[] }> {
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`);
  try { return (await db.query(sql)) as { rows: T[] }; } finally { await db.exec('reset role;'); }
}
const fails = async (user: string | null, sql: string) => { try { await as(user, sql); return false; } catch { return true; } };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; grant usage on schema public to anon, authenticated;
  `);
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.sql')).sort()) await db.exec(readFileSync(join(DIR, f), 'utf8'));
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant usage on all sequences in schema public to authenticated;
                 grant execute on all functions in schema public to authenticated;`);
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com');`);
});

const consent = (u: string, purpose = 'condition_tracking', member = 'null') =>
  as(u, `insert into health_consents (user_id, member_id, purpose) values ('${u}', ${member}, '${purpose}')`);
const addCondition = async (u: string, condition = 'diabetes', extra = '') =>
  (await as<{ id: string }>(u, `insert into user_health_conditions (user_id, condition ${extra ? ', ' + extra.split('|')[0] : ''}) values ('${u}', '${condition}' ${extra ? ', ' + extra.split('|')[1] : ''}) returning id`)).rows[0].id;

describe('consent gate', () => {
  it('health data cannot be written before consent is given', async () => {
    expect(await fails(A, `insert into user_health_conditions (user_id, condition) values ('${A}', 'diabetes')`)).toBe(true);
    expect(await fails(A, `insert into health_measurement_logs (user_id, kind, systolic, diastolic) values ('${A}', 'bp', 120, 80)`)).toBe(true);
    expect(await fails(A, `insert into condition_triggers (user_id, label) values ('${A}', 'skipping meals')`)).toBe(true);
    expect(await fails(A, `insert into clinician_instructions (user_id, instruction) values ('${A}', 'walk daily')`)).toBe(true);
    expect(await fails(A, `insert into routine_reminders (user_id, kind, minute, medication_label) values ('${A}', 'medication', 480, 'Morning tablet')`)).toBe(true);
  });

  it('works after consent, and one person’s consent does not unlock another', async () => {
    await consent(A);
    const id = await addCondition(A, 'diabetes');
    await as(A, `insert into condition_details (condition_id, user_id, medication_flags, restrictions) values ('${id}', '${A}', '{insulin}', '{low_sugar}')`);
    await as(A, `insert into health_measurement_logs (user_id, kind, systolic, diastolic) values ('${A}', 'bp', 128, 82)`);
    await as(A, `insert into routine_reminders (user_id, kind, minute, medication_label) values ('${A}', 'medication', 480, 'Morning tablet')`);
    expect(await fails(B, `insert into user_health_conditions (user_id, condition) values ('${B}', 'migraine')`)).toBe(true);   // B never consented
  });

  it('withdrawing consent stops new writes but still allows reading and deleting', async () => {
    await as(A, `update health_consents set granted = false, withdrawn_at = now() where user_id = '${A}' and purpose = 'condition_tracking'`);
    expect(await fails(A, `insert into health_measurement_logs (user_id, kind, glucose_mg_dl) values ('${A}', 'glucose', 110)`)).toBe(true);
    expect(await fails(A, `insert into user_health_conditions (user_id, condition) values ('${A}', 'thyroid')`)).toBe(true);
    expect((await as(A, `select count(*)::int as n from user_health_conditions`)).rows[0]).toEqual({ n: 1 });
    await as(A, `delete from health_measurement_logs where user_id = '${A}'`);
    expect((await as(A, `select count(*)::int as n from health_measurement_logs`)).rows[0]).toEqual({ n: 0 });
    await as(A, `update health_consents set granted = true, withdrawn_at = null where user_id = '${A}'`);   // re-grant for the next tests
  });

  it('a consent row cannot claim to be withdrawn without a date', async () => {
    expect(await fails(A, `update health_consents set granted = false, withdrawn_at = null where user_id = '${A}'`)).toBe(true);
  });
});

describe('isolation', () => {
  it('another account sees nothing of the health data', async () => {
    await consent(B);
    for (const t of ['user_health_conditions', 'condition_details', 'health_measurement_logs', 'routine_reminders', 'health_consents']) {
      expect((await as(B, `select * from ${t}`)).rows.filter((r: any) => r.user_id === A), t).toEqual([]);
    }
    expect((await as(A, `select count(*)::int as n from user_health_conditions`)).rows[0].n).toBe(1);
  });

  it('cannot attach details to somebody else’s condition, or write as another user', async () => {
    const mine = (await as<{ id: string }>(A, `select id from user_health_conditions limit 1`)).rows[0].id;
    expect(await fails(B, `insert into condition_details (condition_id, user_id) values ('${mine}', '${B}')`)).toBe(true);
    expect(await fails(B, `insert into user_health_conditions (user_id, condition) values ('${A}', 'anemia')`)).toBe(true);
    await as(B, `delete from user_health_conditions where user_id = '${A}'`);
    expect((await as(A, `select count(*)::int as n from user_health_conditions`)).rows[0].n).toBe(1);
  });

  it('a signed-out visitor has no access at all', async () => {
    expect(await fails(null, `select * from user_health_conditions`)).toBe(true);
    expect(await fails(null, `select * from daily_routines`)).toBe(true);
  });
});

describe('validation', () => {
  it('only known conditions; "other" needs a label; suspected concerns are never "professionally diagnosed"', async () => {
    expect(await fails(A, `insert into user_health_conditions (user_id, condition) values ('${A}', 'made_up')`)).toBe(true);
    expect(await fails(A, `insert into user_health_conditions (user_id, condition) values ('${A}', 'other')`)).toBe(true);
    await as(A, `insert into user_health_conditions (user_id, condition, other_label, professionally_diagnosed) values ('${A}', 'other', 'Eczema', true)`);
    expect(await fails(A, `insert into user_health_conditions (user_id, condition, status, professionally_diagnosed) values ('${A}', 'gerd', 'concern', true)`)).toBe(true);
    await as(A, `insert into user_health_conditions (user_id, condition, status, professionally_diagnosed) values ('${A}', 'gerd', 'concern', false)`);
    expect(await fails(A, `insert into user_health_conditions (user_id, condition) values ('${A}', 'diabetes')`)).toBe(true);        // duplicate
  });

  it('measurement values must be physically possible', async () => {
    expect(await fails(A, `insert into health_measurement_logs (user_id, kind, systolic, diastolic) values ('${A}', 'bp', 80, 120)`)).toBe(true);
    expect(await fails(A, `insert into health_measurement_logs (user_id, kind, systolic, diastolic) values ('${A}', 'bp', 400, 80)`)).toBe(true);
    expect(await fails(A, `insert into health_measurement_logs (user_id, kind, glucose_mg_dl) values ('${A}', 'glucose', 5)`)).toBe(true);
    expect(await fails(A, `insert into health_measurement_logs (user_id, kind, glucose_mg_dl, glucose_context) values ('${A}', 'glucose', 100, 'whenever')`)).toBe(true);
    await as(A, `insert into health_measurement_logs (user_id, kind, glucose_mg_dl, glucose_context) values ('${A}', 'glucose', 104, 'fasting')`);
  });

  it('a medication reminder needs a label and a time (the app never invents one)', async () => {
    expect(await fails(A, `insert into routine_reminders (user_id, kind, minute) values ('${A}', 'medication', 480)`)).toBe(true);
    expect(await fails(A, `insert into routine_reminders (user_id, kind, medication_label) values ('${A}', 'medication', 'X')`)).toBe(true);
    expect(await fails(A, `insert into routine_activities (routine_id, user_id, kind, title, start_minute) values (gen_random_uuid(), '${A}', 'medication', 'Tablet', 480)`)).toBe(true);
  });
});

describe('family members', () => {
  let member: string;
  it('consent and data are per person, and the member must belong to the caller', async () => {
    member = (await as<{ id: string }>(A, `insert into members (owner_id, display_name, sex, birth_date, height_cm, weight_kg, activity, goal, consent_confirmed)
      values ('${A}', 'Mom', 'female', '1970-01-01', 155, 62, 'light', 'maintain', true) returning id`)).rows[0].id;
    expect(await fails(A, `insert into user_health_conditions (user_id, member_id, condition) values ('${A}', '${member}', 'thyroid')`)).toBe(true);   // no consent for Mom yet
    await consent(A, 'condition_tracking', `'${member}'`);
    await as(A, `insert into user_health_conditions (user_id, member_id, condition) values ('${A}', '${member}', 'thyroid')`);
    expect(await fails(B, `insert into health_consents (user_id, member_id, purpose) values ('${B}', '${member}', 'condition_tracking')`)).toBe(true);
    expect(await fails(B, `insert into daily_routines (user_id, member_id, routine_date) values ('${B}', '${member}', '2026-10-14')`)).toBe(true);
  });
});

describe('routines and Flex Day', () => {
  let routine: string, activity: string;
  it('a routine, its activities and completions work and stay private', async () => {
    routine = (await as<{ id: string }>(A, `insert into daily_routines (user_id, routine_date, title) values ('${A}', '2026-10-14', 'Healthy Wednesday') returning id`)).rows[0].id;
    expect(await fails(A, `insert into daily_routines (user_id, routine_date) values ('${A}', '2026-10-14')`)).toBe(true);          // one per day
    activity = (await as<{ id: string }>(A, `insert into routine_activities (routine_id, user_id, kind, title, start_minute, duration_min)
      values ('${routine}', '${A}', 'breakfast', 'Balanced breakfast', 510, 25) returning id`)).rows[0].id;
    await as(A, `insert into routine_completions (activity_id, user_id, status) values ('${activity}', '${A}', 'done')`);
    expect(await fails(A, `insert into routine_completions (activity_id, user_id, status) values ('${activity}', '${A}', 'skipped')`)).toBe(true);   // one per activity
    expect(await fails(B, `insert into routine_activities (routine_id, user_id, kind, title, start_minute) values ('${routine}', '${B}', 'lunch', 'x', 700)`)).toBe(true);
    expect((await as(B, `select * from daily_routines`)).rows).toEqual([]);
    expect(await fails(A, `insert into routine_activities (routine_id, user_id, kind, title, start_minute) values ('${routine}', '${A}', 'lunch', 'x', 2000)`)).toBe(true);
  });

  it('one Flex Day per month, inside that month, with its own food choices', async () => {
    const flex = (await as<{ id: string }>(A, `insert into monthly_flex_days (user_id, month, flex_date) values ('${A}', '2026-10-01', '2026-10-25') returning id`)).rows[0].id;
    expect(await fails(A, `insert into monthly_flex_days (user_id, month, flex_date) values ('${A}', '2026-10-01', '2026-10-26')`)).toBe(true);
    expect(await fails(A, `insert into monthly_flex_days (user_id, month, flex_date) values ('${A}', '2026-11-01', '2026-10-30')`)).toBe(true);
    expect(await fails(A, `insert into monthly_flex_days (user_id, month, flex_date) values ('${A}', '2026-12-15', '2026-12-15')`)).toBe(true);
    await as(A, `insert into flex_day_food_choices (flex_day_id, user_id, food_label, food_id) values ('${flex}', '${A}', 'Biryani', 'chicken-biryani')`);
    expect(await fails(B, `insert into flex_day_food_choices (flex_day_id, user_id, food_label) values ('${flex}', '${B}', 'Pizza')`)).toBe(true);
  });
});

describe('safety log, retention and deletion', () => {
  it('the user can add and read safety events but not edit them', async () => {
    await as(A, `insert into recommendation_safety_events (user_id, kind, severity, details) values ('${A}', 'emergency_reading', 'urgent', '{"kind":"bp"}')`);
    expect((await as(A, `select count(*)::int as n from recommendation_safety_events`)).rows[0].n).toBe(1);
    await as(A, `update recommendation_safety_events set severity = 'info' where user_id = '${A}'`);
    expect((await as(A, `select severity from recommendation_safety_events`)).rows[0]).toEqual({ severity: 'urgent' });   // update is not allowed by any policy
    expect(await fails(A, `insert into recommendation_safety_events (user_id, kind, severity) values ('${A}', 'whatever', 'info')`)).toBe(true);
  });

  it('purge_my_health_logs removes only old entries of the caller', async () => {
    await db.exec(`insert into health_measurement_logs (user_id, kind, glucose_mg_dl, measured_at) values ('${A}', 'glucose', 99, now() - interval '400 days'), ('${B}', 'glucose', 98, now() - interval '400 days');`);
    const n = (await as<{ purge_my_health_logs: number }>(A, `select purge_my_health_logs(180) as purge_my_health_logs`)).rows[0] as any;
    expect(Number(Object.values(n)[0])).toBeGreaterThanOrEqual(1);
    expect((await db.query(`select count(*)::int as n from health_measurement_logs where user_id = '${B}'`)).rows[0]).toEqual({ n: 1 });
    expect((await as(A, `select count(*)::int as n from health_measurement_logs where glucose_mg_dl = 99`)).rows[0]).toEqual({ n: 0 });
  });

  it('delete_my_health_data wipes the caller’s health information (and only theirs), leaving routines alone', async () => {
    await as(A, `select delete_my_health_data()`);
    for (const t of ['user_health_conditions', 'condition_details', 'health_measurement_logs', 'condition_triggers', 'clinician_instructions', 'recommendation_safety_events', 'health_consents']) {
      expect((await db.query(`select count(*)::int as n from ${t} where user_id = '${A}'`)).rows[0], t).toEqual({ n: 0 });
    }
    expect((await db.query(`select count(*)::int as n from health_consents where user_id = '${B}'`)).rows[0]).toEqual({ n: 1 });   // B untouched
    expect((await db.query<{ n: number }>(`select count(*)::int as n from daily_routines where user_id = '${A}'`)).rows[0].n).toBeGreaterThan(0);
    expect(await fails(null, `select delete_my_health_data()`)).toBe(true);
  });

  it('deleting the account removes everything, including routines', async () => {
    await as(A, `select delete_my_account()`);
    for (const t of ['daily_routines', 'routine_activities', 'monthly_flex_days', 'flex_day_food_choices', 'routine_preferences']) {
      expect((await db.query(`select count(*)::int as n from ${t} where user_id = '${A}'`)).rows[0], t).toEqual({ n: 0 });
    }
  });
});

describe('symptom check-ins (migration 0005)', () => {
  const C = '33333333-3333-3333-3333-333333333333';
  const D = '44444444-4444-4444-4444-444444444444';
  let log: string;
  it('cannot be written before consent, can after', async () => {
    await db.exec(`insert into auth.users (id, email) values ('${C}', 'c@x.com'), ('${D}', 'd@x.com');`);
    expect(await fails(C, `insert into symptom_logs (user_id, symptom_type, severity, screening) values ('${C}', 'headache', 5, 'usual')`)).toBe(true);
    await consent(C);
    log = (await as<{ id: string }>(C, `insert into symptom_logs (user_id, symptom_type, severity, screening) values ('${C}', 'headache', 5, 'usual') returning id`)).rows[0].id;
  });
  it('validates severity, type, screening and resolution', async () => {
    expect(await fails(C, `insert into symptom_logs (user_id, symptom_type, severity, screening) values ('${C}', 'headache', 11, 'usual')`)).toBe(true);
    expect(await fails(C, `insert into symptom_logs (user_id, symptom_type, severity, screening) values ('${C}', 'cough', 3, 'usual')`)).toBe(true);
    expect(await fails(C, `insert into symptom_logs (user_id, symptom_type, severity, screening) values ('${C}', 'fatigue', 3, 'fine')`)).toBe(true);
    expect(await fails(C, `update symptom_logs set status = 'better' where id = '${log}'`)).toBe(true);   // needs resolved_at
    await as(C, `update symptom_logs set status = 'better', resolved_at = now() where id = '${log}'`);
  });
  it('follow-ups belong to the owner’s log only, and a response needs a time', async () => {
    await as(C, `insert into symptom_followups (log_id, user_id, due_at) values ('${log}', '${C}', now() + interval '1 hour')`);
    expect(await fails(D, `insert into symptom_followups (log_id, user_id, due_at) values ('${log}', '${D}', now())`)).toBe(true);
    expect(await fails(C, `update symptom_followups set status = 'answered' where log_id = '${log}'`)).toBe(true);
    expect((await as(D, `select * from symptom_logs`)).rows).toEqual([]);
  });
  it('notification preferences are private and quiet hours come as a pair', async () => {
    await as(C, `insert into notification_preferences (user_id, quiet_start_minute, quiet_end_minute) values ('${C}', 1320, 420)`);
    expect(await fails(D, `insert into notification_preferences (user_id, quiet_start_minute) values ('${D}', 1320)`)).toBe(true);
    expect((await as(D, `select * from notification_preferences`)).rows).toEqual([]);
  });
  it('achievements are unique per code and private', async () => {
    await as(C, `insert into achievements (user_id, code) values ('${C}', 'first_walk')`);
    expect(await fails(C, `insert into achievements (user_id, code) values ('${C}', 'first_walk')`)).toBe(true);
    expect((await as(D, `select * from achievements`)).rows).toEqual([]);
  });
  it('"delete my health data" removes symptom check-ins and their follow-ups', async () => {
    await as(C, `select delete_my_health_data()`);
    expect((await db.query<{ n: number }>(`select count(*)::int as n from symptom_logs where user_id = '${C}'`)).rows[0].n).toBe(0);
    expect((await db.query<{ n: number }>(`select count(*)::int as n from symptom_followups where user_id = '${C}'`)).rows[0].n).toBe(0);
  });
});

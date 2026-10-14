// Runs the real SQL migrations in an in-memory Postgres (PGlite) with a minimal stand-in for Supabase's auth schema,
// then proves the row-level-security rules: people only ever see and change their own rows.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const DIR = join(__dirname, 'migrations');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

let db: PGlite;

/** run a statement as a signed-in user, the way Supabase does (role `authenticated` + auth.uid() from the JWT claim) */
async function as<T = any>(user: string | null, sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`);
  try {
    return (await db.query(sql, params)) as { rows: T[] };
  } finally {
    await db.exec('reset role;');
  }
}
const fails = async (user: string | null, sql: string, params: unknown[] = []) => {
  try { await as(user, sql, params); return false; } catch { return true; }
};

beforeAll(async () => {
  db = new PGlite();
  // minimal Supabase stand-ins
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.sql')).sort()) await db.exec(readFileSync(join(DIR, f), 'utf8'));
  // Supabase grants table access to its roles; row level security then does the filtering
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant usage on all sequences in schema public to authenticated;`);
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com');`);
});

const profile = `sex, birth_date, height_cm, weight_kg, activity, goal`;
const profileVals = `'female', '1995-01-01', 160, 60, 'light', 'maintain'`;

describe('migrations', () => {
  it('apply cleanly in order and create every table with row level security on', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r' order by relname`
    );
    const names = rows.map((r) => r.relname);
    for (const t of ['profiles', 'meals', 'meal_items', 'scan_usage', 'water_logs', 'weight_logs', 'members', 'sleep_logs', 'activity_logs']) expect(names).toContain(t);
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });
});

describe('row level security', () => {
  it('a signed-out visitor sees and writes nothing', async () => {
    await as(A, `insert into profiles (id, ${profile}) values ('${A}', ${profileVals})`);
    expect((await fails(null, `select * from profiles`))).toBe(true);        // no grants for anon at all
    expect(await fails(null, `insert into water_logs (user_id, ml) values ('${A}', 250)`)).toBe(true);
  });

  it('users only see their own profile, meals, water and weights', async () => {
    await as(B, `insert into profiles (id, ${profile}) values ('${B}', ${profileVals})`);
    await as(A, `insert into water_logs (user_id, ml) values ('${A}', 250)`);
    await as(B, `insert into water_logs (user_id, ml) values ('${B}', 500)`);
    expect((await as(A, `select ml from water_logs`)).rows).toEqual([{ ml: 250 }]);
    expect((await as(B, `select ml from water_logs`)).rows).toEqual([{ ml: 500 }]);
    expect((await as(A, `select id from profiles`)).rows).toEqual([{ id: A }]);
  });

  it('cannot insert a row for somebody else, or edit / delete somebody else’s', async () => {
    expect(await fails(A, `insert into water_logs (user_id, ml) values ('${B}', 100)`)).toBe(true);
    await as(A, `update water_logs set ml = 1 where user_id = '${B}'`);
    await as(A, `delete from water_logs where user_id = '${B}'`);
    expect((await as(B, `select ml from water_logs`)).rows).toEqual([{ ml: 500 }]);   // untouched
  });

  it('table constraints reject impossible values', async () => {
    expect(await fails(A, `insert into water_logs (user_id, ml) values ('${A}', 0)`)).toBe(true);
    expect(await fails(A, `insert into weight_logs (user_id, logged_on, weight_kg) values ('${A}', '2026-10-13', 5)`)).toBe(true);
    expect(await fails(A, `insert into sleep_logs (user_id, logged_on, hours) values ('${A}', '2026-10-13', 30)`)).toBe(true);
    expect(await fails(A, `insert into activity_logs (user_id, logged_on, steps) values ('${A}', '2026-10-13', -5)`)).toBe(true);
    expect(await fails(A, `insert into meals (user_id, meal_type) values ('${A}', 'brunch')`)).toBe(true);
  });

  it('a meal item must belong to the user and to one of their own meals', async () => {
    const { rows } = await as<{ id: string }>(A, `insert into meals (user_id, meal_type, kcal) values ('${A}', 'lunch', 300) returning id`);
    const meal = rows[0].id;
    await as(A, `insert into meal_items (meal_id, user_id, food_id, name, grams, kcal, protein_g, carbs_g, fat_g, source) values ('${meal}', '${A}', 'roti', 'Roti', 80, 238, 7.8, 44.8, 3, 'manual')`);
    // B tries to attach an item to A's meal
    expect(await fails(B, `insert into meal_items (meal_id, user_id, food_id, name, grams, kcal, protein_g, carbs_g, fat_g, source) values ('${meal}', '${B}', 'roti', 'Roti', 80, 238, 7.8, 44.8, 3, 'manual')`)).toBe(true);
    expect((await as(B, `select * from meal_items`)).rows).toEqual([]);
    expect((await as(B, `select * from meals`)).rows).toEqual([]);
  });

  it('scan_usage can be read and written by the owner only', async () => {
    await as(A, `insert into scan_usage (user_id, kind) values ('${A}', 'chat')`);
    expect((await as(A, `select kind from scan_usage`)).rows).toEqual([{ kind: 'chat' }]);
    expect((await as(B, `select kind from scan_usage`)).rows).toEqual([]);
    expect(await fails(A, `insert into scan_usage (user_id, kind) values ('${A}', 'other')`)).toBe(true);
    expect(await fails(A, `insert into scan_usage (user_id) values ('${B}')`)).toBe(true);
  });
});

describe('family members', () => {
  let member: string;
  const memberVals = `display_name, sex, birth_date, height_cm, weight_kg, activity, goal`;

  it('the owner can add an adult family member, but only with consent', async () => {
    expect(await fails(A, `insert into members (owner_id, ${memberVals}, consent_confirmed) values ('${A}', 'Mom', 'female', '1970-01-01', 155, 62, 'light', 'maintain', false)`)).toBe(true);
    const { rows } = await as<{ id: string }>(A, `insert into members (owner_id, ${memberVals}, consent_confirmed) values ('${A}', 'Mom', 'female', '1970-01-01', 155, 62, 'light', 'maintain', true) returning id`);
    member = rows[0].id;
    expect((await as(A, `select display_name from members`)).rows).toEqual([{ display_name: 'Mom' }]);
  });

  it('other accounts cannot see or edit that member, or add the owner as theirs', async () => {
    expect((await as(B, `select * from members`)).rows).toEqual([]);
    expect(await fails(B, `insert into members (owner_id, ${memberVals}, consent_confirmed) values ('${A}', 'X', 'male', '1980-01-01', 170, 70, 'light', 'maintain', true)`)).toBe(true);
    await as(B, `update members set display_name = 'hacked' where id = '${member}'`);
    expect((await as(A, `select display_name from members`)).rows).toEqual([{ display_name: 'Mom' }]);
  });

  it('logs can be tagged with the owner’s own member but not with somebody else’s', async () => {
    await as(A, `insert into meals (user_id, member_id, meal_type, kcal) values ('${A}', '${member}', 'dinner', 400)`);
    await as(A, `insert into water_logs (user_id, member_id, ml) values ('${A}', '${member}', 250)`);
    await as(A, `insert into sleep_logs (user_id, member_id, logged_on, hours) values ('${A}', '${member}', '2026-10-13', 7.5)`);
    await as(A, `insert into activity_logs (user_id, member_id, logged_on, steps, exercise_min) values ('${A}', '${member}', '2026-10-13', 6000, 20)`);
    for (const [table, cols, vals] of [
      ['meals', 'meal_type, kcal', `'lunch', 1`], ['water_logs', 'ml', '100'], ['sleep_logs', 'logged_on, hours', `'2026-10-14', 8`], ['activity_logs', 'logged_on, steps', `'2026-10-14', 1`], ['weight_logs', 'logged_on, weight_kg', `'2026-10-14', 70`],
    ] as const) {
      expect(await fails(B, `insert into ${table} (user_id, member_id, ${cols}) values ('${B}', '${member}', ${vals})`), table).toBe(true);
    }
  });

  it('one weigh-in / sleep / activity entry per person per day, but "me" and a member can both log the same day', async () => {
    await as(A, `insert into weight_logs (user_id, logged_on, weight_kg) values ('${A}', '2026-10-13', 60)`);
    expect(await fails(A, `insert into weight_logs (user_id, logged_on, weight_kg) values ('${A}', '2026-10-13', 61)`)).toBe(true);
    await as(A, `insert into weight_logs (user_id, member_id, logged_on, weight_kg) values ('${A}', '${member}', '2026-10-13', 62)`);
    expect(await fails(A, `insert into weight_logs (user_id, member_id, logged_on, weight_kg) values ('${A}', '${member}', '2026-10-13', 63)`)).toBe(true);
    expect(await fails(A, `insert into sleep_logs (user_id, member_id, logged_on, hours) values ('${A}', '${member}', '2026-10-13', 6)`)).toBe(true);
  });

  it('deleting a member deletes their logs but not the owner’s', async () => {
    const before = (await as(A, `select count(*)::int as n from meals where member_id is null`)).rows[0] as any;
    await as(A, `delete from members where id = '${member}'`);
    expect((await as(A, `select count(*)::int as n from meals where member_id = '${member}'`)).rows[0]).toEqual({ n: 0 });
    expect((await as(A, `select count(*)::int as n from meals where member_id is null`)).rows[0]).toEqual(before);
    expect((await as(A, `select count(*)::int as n from water_logs where member_id = '${member}'`)).rows[0]).toEqual({ n: 0 });
  });
});

describe('delete_my_account', () => {
  it('removes the caller and everything they logged, and nobody else', async () => {
    await as(A, `select delete_my_account()`);
    for (const t of ['profiles', 'meals', 'meal_items', 'water_logs', 'weight_logs', 'sleep_logs', 'activity_logs', 'members', 'scan_usage']) {
      const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from ${t} where ${t === 'profiles' ? 'id' : t === 'members' ? 'owner_id' : t === 'meal_items' ? 'user_id' : 'user_id'} = '${A}'`);
      expect(rows[0].n, t).toBe(0);
    }
    expect((await db.query(`select 1 from auth.users where id = '${B}'`)).rows).toHaveLength(1);
    expect((await as(B, `select ml from water_logs`)).rows).toEqual([{ ml: 500 }]);
  });

  it('cannot be run by a signed-out visitor', async () => {
    expect(await fails(null, `select delete_my_account()`)).toBe(true);
  });
});

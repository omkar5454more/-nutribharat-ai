// The single-paste file the user runs in the Supabase SQL editor must build the same database as the individual migrations.
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

describe('supabase/all-in-one.sql', () => {
  it('is up to date with the migrations', () => {
    const before = readFileSync(join(__dirname, 'all-in-one.sql'), 'utf8');
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-sql.js')]);
    expect(readFileSync(join(__dirname, 'all-in-one.sql'), 'utf8'), 'run `npm run sql` and commit the result').toBe(before);
    for (const f of readdirSync(join(__dirname, 'migrations')).filter((n) => n.endsWith('.sql'))) expect(before).toContain(f);
  });

  it('runs as one script on an empty database and creates every table with RLS on', async () => {
    const db = new PGlite();
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      create schema auth; create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    `);
    await db.exec(readFileSync(join(__dirname, 'all-in-one.sql'), 'utf8'));
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r'`
    );
    expect(rows.map((r) => r.relname).sort()).toEqual(['activity_logs', 'members', 'meal_items', 'meals', 'profiles', 'scan_usage', 'sleep_logs', 'water_logs', 'weight_logs'].sort());
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});

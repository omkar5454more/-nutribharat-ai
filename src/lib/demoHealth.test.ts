import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoFetch, type Store } from './demoBackend';

const memory = (): Store => {
  const data: Record<string, string> = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] };
};
const BASE = 'https://demo.local';
let f: ReturnType<typeof createDemoFetch>;
let token = '';
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await f(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};
const signIn = async (email: string) => { token = (await call('POST', '/auth/v1/token?grant_type=password', { email, password: 'x' })).json.access_token; };

beforeEach(() => { f = createDemoFetch(memory(), () => NOW); token = ''; });

describe('demo backend: health, routine and Flex Day tables', () => {
  it('stores a condition with its details and removes the details with the condition', async () => {
    await signIn('a@x.com');
    const c = await call('POST', '/rest/v1/user_health_conditions', { condition: 'diabetes', status: 'diagnosed' }, { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' });
    await call('POST', '/rest/v1/condition_details', { condition_id: c.json.id, medication_flags: ['insulin'] });
    expect((await call('GET', '/rest/v1/condition_details?select=*')).json).toHaveLength(1);
    await call('DELETE', '/rest/v1/user_health_conditions?user_id=eq.' + c.json.user_id);
    expect((await call('GET', '/rest/v1/user_health_conditions?select=*')).json).toHaveLength(0);
    expect((await call('GET', '/rest/v1/condition_details?select=*')).json).toHaveLength(0);
  });

  it('keeps each account’s health data private', async () => {
    await signIn('a@x.com');
    await call('POST', '/rest/v1/health_measurement_logs', { kind: 'bp', systolic: 120, diastolic: 80 });
    await signIn('b@x.com');
    expect((await call('GET', '/rest/v1/health_measurement_logs?select=*')).json).toEqual([]);
  });

  it('deleting a routine removes its activities and completions', async () => {
    await signIn('a@x.com');
    const r = (await call('POST', '/rest/v1/daily_routines', { routine_date: '2026-10-14' }, { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' })).json;
    const a = (await call('POST', '/rest/v1/routine_activities', { routine_id: r.id, kind: 'breakfast', title: 'x', start_minute: 480 }, { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' })).json;
    await call('POST', '/rest/v1/routine_completions', { activity_id: a.id, status: 'done' });
    await call('DELETE', `/rest/v1/daily_routines?id=eq.${r.id}`);
    expect((await call('GET', '/rest/v1/routine_activities?select=*')).json).toHaveLength(0);
    expect((await call('GET', '/rest/v1/routine_completions?select=*')).json).toHaveLength(0);
  });

  it('delete_my_health_data wipes health information but keeps routines; purge removes only old logs', async () => {
    await signIn('a@x.com');
    await call('POST', '/rest/v1/health_consents', { purpose: 'condition_tracking', granted: true });
    await call('POST', '/rest/v1/user_health_conditions', { condition: 'gerd', status: 'diagnosed' });
    await call('POST', '/rest/v1/daily_routines', { routine_date: '2026-10-14' });
    await call('POST', '/rest/v1/health_measurement_logs', { kind: 'glucose', glucose_mg_dl: 99, measured_at: new Date(2025, 0, 1).toISOString() });
    await call('POST', '/rest/v1/health_measurement_logs', { kind: 'glucose', glucose_mg_dl: 101 });
    expect((await call('POST', '/rest/v1/rpc/purge_my_health_logs', { older_than_days: 180 })).json).toBe(1);
    expect((await call('GET', '/rest/v1/health_measurement_logs?select=*')).json).toHaveLength(1);
    await call('POST', '/rest/v1/rpc/delete_my_health_data', {});
    for (const t of ['health_consents', 'user_health_conditions', 'health_measurement_logs']) expect((await call('GET', `/rest/v1/${t}?select=*`)).json, t).toHaveLength(0);
    expect((await call('GET', '/rest/v1/daily_routines?select=*')).json).toHaveLength(1);
  });

  it('deleting the account removes the health tables too', async () => {
    await signIn('a@x.com');
    await call('POST', '/rest/v1/monthly_flex_days', { month: '2026-10-01', flex_date: '2026-10-25' });
    await call('POST', '/rest/v1/rpc/delete_my_account', {});
    await signIn('a@x.com');
    expect((await call('GET', '/rest/v1/monthly_flex_days?select=*')).json).toEqual([]);
  });
});

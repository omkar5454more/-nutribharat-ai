import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoFetch, type Store } from './demoBackend';

const memory = (): Store & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] };
};

const BASE = 'https://demo.local';
let store: ReturnType<typeof memory>;
let f: ReturnType<typeof createDemoFetch>;
let token = '';
const NOW = new Date(2026, 9, 13, 12, 0, 0);

const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await f(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

async function signIn(email = 'a@example.com') {
  token = (await call('POST', '/auth/v1/token?grant_type=password', { email, password: 'x' })).json.access_token;
}

const member = { display_name: 'Mom', relation: 'parent', sex: 'female', birth_date: '1970-01-01', height_cm: 155, weight_kg: 62, activity: 'light', goal: 'maintain', reproductive: 'none', diet: 'veg', allergies: [] };

beforeEach(() => {
  store = memory();
  f = createDemoFetch(store, () => NOW);
  token = '';
});

describe('demo backend: family members and wellness', () => {
  it('adds, lists and removes a member', async () => {
    await signIn();
    await call('POST', '/rest/v1/members', { owner_id: 'whoever', ...member, consent_confirmed: true });
    const list = (await call('GET', '/rest/v1/members?select=*&order=created_at.asc')).json;
    expect(list).toHaveLength(1);
    expect(list[0].display_name).toBe('Mom');
    await call('DELETE', `/rest/v1/members?id=eq.${list[0].id}`);
    expect((await call('GET', '/rest/v1/members')).json).toEqual([]);
  });

  it('keeps a member’s data separate from mine (member_id is.null vs eq.)', async () => {
    await signIn();
    await call('POST', '/rest/v1/profiles', { id: 'x', display_name: 'Me', weight_kg: 75 });     // seeds sample data for "me"
    await call('POST', '/rest/v1/members', { ...member, consent_confirmed: true });
    const id = (await call('GET', '/rest/v1/members')).json[0].id;
    await call('POST', '/rest/v1/water_logs', { member_id: id, ml: 250, logged_at: NOW.toISOString() });
    await call('POST', '/rest/v1/water_logs', { member_id: null, ml: 500, logged_at: NOW.toISOString() });
    const mine = (await call('GET', '/rest/v1/water_logs?member_id=is.null')).json;
    const hers = (await call('GET', `/rest/v1/water_logs?member_id=eq.${id}`)).json;
    expect(mine.map((w: any) => w.ml)).toEqual([500]);
    expect(hers.map((w: any) => w.ml)).toEqual([250]);
    expect((await call('GET', '/rest/v1/meals?member_id=is.null')).json.length).toBeGreaterThan(5);   // the seeded history is mine
    expect((await call('GET', `/rest/v1/meals?member_id=eq.${id}`)).json).toEqual([]);
  });

  it('removing a member deletes their logs (and meal items) but not mine', async () => {
    await signIn();
    await call('POST', '/rest/v1/profiles', { id: 'x', weight_kg: 75 });
    await call('POST', '/rest/v1/members', { ...member, consent_confirmed: true });
    const id = (await call('GET', '/rest/v1/members')).json[0].id;
    const meal = (await call('POST', '/rest/v1/meals', { member_id: id, meal_type: 'lunch', eaten_at: NOW.toISOString(), kcal: 300 }, { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' })).json;
    await call('POST', '/rest/v1/meal_items', [{ meal_id: meal.id, food_id: 'roti', name: 'Roti', grams: 80, kcal: 238 }]);
    await call('POST', '/rest/v1/sleep_logs', { member_id: id, logged_on: '2026-10-13', hours: 7 });
    const myMeals = (await call('GET', '/rest/v1/meals?member_id=is.null')).json.length;
    await call('DELETE', `/rest/v1/members?id=eq.${id}`);
    expect((await call('GET', `/rest/v1/meals?member_id=eq.${id}`)).json).toEqual([]);
    expect((await call('GET', `/rest/v1/sleep_logs?member_id=eq.${id}`)).json).toEqual([]);
    expect(JSON.parse(store.data['nutribharat.demo.db']).meal_items.some((i: any) => i.meal_id === meal.id)).toBe(false);
    expect((await call('GET', '/rest/v1/meals?member_id=is.null')).json.length).toBe(myMeals);
  });

  it('PATCH updates today’s row, which is how a second weigh-in the same day replaces the first', async () => {
    await signIn();
    await call('POST', '/rest/v1/weight_logs', { member_id: null, logged_on: '2026-10-13', weight_kg: 74.6 });
    const upd = await call('PATCH', '/rest/v1/weight_logs?user_id=eq.demo-user-1&logged_on=eq.2026-10-13&member_id=is.null&select=id', { weight_kg: 74.2 }, { Prefer: 'return=representation' });
    expect(upd.status).toBe(200);
    expect(upd.json).toHaveLength(1);
    const rows = (await call('GET', '/rest/v1/weight_logs')).json;
    expect(rows).toHaveLength(1);
    expect(rows[0].weight_kg).toBe(74.2);
    // nothing to update on another day -> empty result, so the app inserts instead
    const none = await call('PATCH', '/rest/v1/weight_logs?user_id=eq.demo-user-1&logged_on=eq.2026-10-14&member_id=is.null&select=id', { weight_kg: 70 }, { Prefer: 'return=representation' });
    expect(none.json).toEqual([]);
  });

  it('fills in the timestamp the real database would add (water logged without logged_at still shows up today)', async () => {
    await signIn();
    await call('POST', '/rest/v1/water_logs', { member_id: null, ml: 250 });
    const from = new Date(2026, 9, 13).toISOString(), to = new Date(2026, 9, 14).toISOString();
    expect((await call('GET', `/rest/v1/water_logs?member_id=is.null&logged_at=gte.${from}&logged_at=lt.${to}`)).json).toHaveLength(1);
  });

  it('stores sleep and activity per person', async () => {
    await signIn();
    await call('POST', '/rest/v1/sleep_logs', { member_id: null, logged_on: '2026-10-13', hours: 7.5 });
    await call('POST', '/rest/v1/activity_logs', { member_id: null, logged_on: '2026-10-13', steps: 8000, exercise_min: 30 });
    expect((await call('GET', '/rest/v1/sleep_logs?member_id=is.null')).json[0].hours).toBe(7.5);
    expect((await call('GET', '/rest/v1/activity_logs?member_id=is.null')).json[0].steps).toBe(8000);
  });

  it('delete_my_account also removes members and their logs', async () => {
    await signIn();
    await call('POST', '/rest/v1/members', { ...member, consent_confirmed: true });
    await call('POST', '/rest/v1/sleep_logs', { member_id: null, logged_on: '2026-10-13', hours: 7 });
    await call('POST', '/rest/v1/rpc/delete_my_account', {});
    const db = JSON.parse(store.data['nutribharat.demo.db']);
    expect([db.users, db.members, db.sleep_logs, db.activity_logs].every((t: any[]) => t.length === 0)).toBe(true);
  });
});

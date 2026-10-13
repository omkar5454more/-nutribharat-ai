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
  const r = await call('POST', '/auth/v1/token?grant_type=password', { email, password: 'whatever' });
  token = r.json.access_token;
  return r.json;
}

beforeEach(() => {
  store = memory();
  f = createDemoFetch(store, () => NOW);
  token = '';
});

describe('demo backend', () => {
  it('signs anyone in and recognises the session', async () => {
    const s = await signIn();
    expect(s.user.email).toBe('a@example.com');
    expect((await call('GET', '/auth/v1/user')).json.email).toBe('a@example.com');
    expect((await call('GET', '/rest/v1/meals?select=*')).status).toBe(200);
  });

  it('rejects data calls without a session', async () => {
    expect((await call('GET', '/rest/v1/meals')).status).toBe(401);
  });

  it('creating the profile seeds a week of sample meals and weigh-ins', async () => {
    await signIn();
    const pg = { Accept: 'application/vnd.pgrst.object+json' };
    expect((await call('GET', '/rest/v1/profiles?select=*&id=eq.x', undefined, pg)).json).toBeNull();
    await call('POST', '/rest/v1/profiles', { id: 'x', display_name: 'A', weight_kg: 75, diet: 'veg' });
    const profile = (await call('GET', '/rest/v1/profiles?select=*', undefined, pg)).json;
    expect(profile.display_name).toBe('A');
    const meals = (await call('GET', '/rest/v1/meals?select=id,kcal,meal_items(id,name)&order=eaten_at.desc')).json;
    expect(meals.length).toBeGreaterThan(10);
    expect(meals[0].meal_items.length).toBeGreaterThan(0);
    const weights = (await call('GET', '/rest/v1/weight_logs?select=logged_on,weight_kg&order=logged_on.asc')).json;
    expect(weights.length).toBeGreaterThan(4);
    // saving the profile again updates it and does not seed twice
    await call('POST', '/rest/v1/profiles', { id: 'x', display_name: 'B', weight_kg: 74 });
    expect((await call('GET', '/rest/v1/profiles', undefined, pg)).json.display_name).toBe('B');
    expect((await call('GET', '/rest/v1/meals')).json.length).toBe(meals.length);
  });

  it('filters meals by date like PostgREST', async () => {
    await signIn();
    await call('POST', '/rest/v1/profiles', { id: 'x', display_name: 'A', weight_kg: 75 });
    const dayStart = new Date(2026, 9, 12).toISOString();
    const dayEnd = new Date(2026, 9, 13).toISOString();
    const yesterday = (await call('GET', `/rest/v1/meals?select=*&eaten_at=gte.${dayStart}&eaten_at=lt.${dayEnd}`)).json;
    expect(yesterday.length).toBeGreaterThan(0);
    for (const m of yesterday) expect(m.eaten_at >= dayStart && m.eaten_at < dayEnd).toBe(true);
    const today = (await call('GET', `/rest/v1/meals?eaten_at=gte.${dayEnd}&eaten_at=lt.${new Date(2026, 9, 14).toISOString()}`)).json;
    expect(today).toEqual([]);
  });

  it('stores a meal with items, and deleting the meal removes its items', async () => {
    await signIn();
    await call('POST', '/rest/v1/profiles', { id: 'x', weight_kg: 75 });
    const ins = await call('POST', '/rest/v1/meals', { meal_type: 'lunch', eaten_at: NOW.toISOString(), kcal: 300, protein_g: 10, carbs_g: 40, fat_g: 8, fiber_g: 3 }, { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' });
    expect(ins.status).toBe(201);
    const id = ins.json.id;
    await call('POST', '/rest/v1/meal_items', [{ meal_id: id, food_id: 'roti', name: 'Roti', grams: 80, kcal: 238 }]);
    const got = (await call('GET', `/rest/v1/meals?id=eq.${id}`)).json[0];
    expect(got.meal_items).toHaveLength(1);
    expect((await call('DELETE', `/rest/v1/meals?id=eq.${id}`)).status).toBe(204);
    expect((await call('GET', `/rest/v1/meals?id=eq.${id}`)).json).toEqual([]);
    expect(JSON.parse(store.data['nutribharat.demo.db']).meal_items.some((i: any) => i.meal_id === id)).toBe(false);
  });

  it('water: add, list newest first, delete one', async () => {
    await signIn();
    await call('POST', '/rest/v1/water_logs', { ml: 250, logged_at: '2026-10-13T08:00:00.000Z' });
    await call('POST', '/rest/v1/water_logs', { ml: 250, logged_at: '2026-10-13T09:00:00.000Z' });
    const list = (await call('GET', '/rest/v1/water_logs?select=id,ml,logged_at&order=logged_at.desc')).json;
    expect(list.map((w: any) => w.logged_at)).toEqual(['2026-10-13T09:00:00.000Z', '2026-10-13T08:00:00.000Z']);
    await call('DELETE', `/rest/v1/water_logs?id=eq.${list[0].id}`);
    expect((await call('GET', '/rest/v1/water_logs')).json).toHaveLength(1);
  });

  it('weight: one entry per day, the second replaces the first', async () => {
    await signIn();
    await call('POST', '/rest/v1/weight_logs', { logged_on: '2026-10-13', weight_kg: 74.6 });
    await call('POST', '/rest/v1/weight_logs', { logged_on: '2026-10-13', weight_kg: 74.2 });
    const rows = (await call('GET', '/rest/v1/weight_logs')).json;
    expect(rows).toHaveLength(1);
    expect(rows[0].weight_kg).toBe(74.2);
  });

  it("keeps each user's data separate", async () => {
    await signIn('a@example.com');
    await call('POST', '/rest/v1/water_logs', { ml: 250 });
    await signIn('b@example.com');
    expect((await call('GET', '/rest/v1/water_logs')).json).toEqual([]);
    await signIn('a@example.com');
    expect((await call('GET', '/rest/v1/water_logs')).json).toHaveLength(1);
  });

  it('delete_my_account removes the user and everything they logged', async () => {
    await signIn();
    await call('POST', '/rest/v1/profiles', { id: 'x', weight_kg: 75 });
    expect((await call('POST', '/rest/v1/rpc/delete_my_account', {})).status).toBe(204);
    const db = JSON.parse(store.data['nutribharat.demo.db']);
    expect(db.users).toEqual([]);
    expect([db.profiles, db.meals, db.meal_items, db.weight_logs].every((t: any[]) => t.length === 0)).toBe(true);
  });

  it('serves pre-written scan and chat answers in the right language', async () => {
    await signIn();
    const scan = (await call('POST', '/functions/v1/analyze-food', { image_base64: 'x' })).json;
    expect(scan.is_food).toBe(true);
    expect(scan.items.length).toBeGreaterThan(2);
    const en = (await call('POST', '/functions/v1/nutrition-chat', { language: 'en', messages: [{ role: 'user', content: 'a high-protein snack?' }] })).json.reply;
    expect(en).toMatch(/chana/);
    expect(en).toMatch(/Demo reply/);
    const hi = (await call('POST', '/functions/v1/nutrition-chat', { language: 'hi', messages: [{ role: 'user', content: 'तेल कम कैसे?' }] })).json.reply;
    expect(hi).toMatch(/डेमो/);
    expect((await call('POST', '/functions/v1/nutrition-chat', { language: 'mr', messages: [{ role: 'user', content: 'hello' }] })).json.reply).toMatch(/डेमो/);
  });
});

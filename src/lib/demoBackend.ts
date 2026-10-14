/**
 * Demo mode (EXPO_PUBLIC_DEMO=1): a tiny in-browser stand-in for Supabase so the whole app can be tried without any account or server.
 * It answers the same HTTP calls the Supabase client makes. Data lives only in this device's localStorage; the "AI" replies are pre-written.
 * Never enabled in a normal build — see isDemo in supabase.ts.
 */
import { FOOD_BY_ID } from '@/core/foods';
import { nutrientsFor } from '@/core/nutrition';

type Row = Record<string, any>;
const HEALTH_TABLES = ['health_consents', 'user_health_conditions', 'condition_details', 'condition_triggers', 'health_measurement_logs', 'clinician_instructions', 'routine_preferences', 'daily_routines', 'routine_activities', 'routine_completions', 'routine_reminders', 'monthly_flex_days', 'flex_day_food_choices', 'recommendation_safety_events', 'symptom_logs', 'symptom_followups', 'notification_preferences', 'achievements', 'gym_prefs', 'workout_logs', 'mood_logs', 'cycle_logs', 'favorite_foods', 'care_contacts'] as const;
type Db = { users: Row[]; profiles: Row[]; meals: Row[]; meal_items: Row[]; water_logs: Row[]; weight_logs: Row[]; members: Row[]; sleep_logs: Row[]; activity_logs: Row[]; seq: number } & Record<(typeof HEALTH_TABLES)[number], Row[]>;
const LOG_TABLES = ['meals', 'water_logs', 'weight_logs', 'sleep_logs', 'activity_logs', 'condition_triggers', 'health_measurement_logs', 'clinician_instructions', 'routine_preferences', 'daily_routines', 'routine_reminders', 'monthly_flex_days', 'health_consents', 'user_health_conditions', 'recommendation_safety_events', 'symptom_logs', 'achievements', 'gym_prefs', 'workout_logs', 'mood_logs', 'cycle_logs', 'favorite_foods', 'care_contacts'] as const;
export type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

const KEY = 'nutribharat.demo.db';
const empty = (): Db => ({ users: [], profiles: [], meals: [], meal_items: [], water_logs: [], weight_logs: [], members: [], sleep_logs: [], activity_logs: [], seq: 1, ...(Object.fromEntries(HEALTH_TABLES.map((t) => [t, []])) as any) });

const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const fakeJwt = (sub: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 30 * 86400 })}.demo`;

function sessionFor(user: Row) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: fakeJwt(user.id), token_type: 'bearer', expires_in: 30 * 86400, expires_at: now + 30 * 86400, refresh_token: 'demo-refresh',
    user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: user.created_at },
  };
}

// ---------------------------------------------------------------- pre-written "AI"
const SCAN_RESULT = {
  is_food: true,
  items: [
    { name: 'chapati', estimated_grams: 80, confidence: 0.92 },
    { name: 'dal tadka', estimated_grams: 150, confidence: 0.88 },
    { name: 'jeera rice', estimated_grams: 150, confidence: 0.74 },
    { name: 'papad', estimated_grams: 15, confidence: 0.45 },
  ],
  uncertain: 'Demo result: the amount of oil in the dal cannot be seen in a photo.',
};

const CHAT: Record<'en' | 'hi' | 'mr', { protein: string; oil: string; dinner: string; cheap: string; other: string }> = {
  en: {
    protein: 'Good high-protein snacks: roasted chana, a bowl of curd, paneer cubes, a boiled egg, or moong sprouts with lemon. About 10–15 g of protein each. (Demo reply: pre-written, not from the real AI.)',
    oil: 'Try cooking in a non-stick pan, measure oil with a teaspoon (1 tsp is about 40 kcal), and add flavour with spices, curry leaves and lemon instead of extra tadka. (Demo reply: pre-written.)',
    dinner: 'A dinner of 2 rotis, dal and a sabzi is usually light. If you feel heavy at night, eat earlier and keep the oil low. (Demo reply: pre-written.)',
    cheap: 'Budget-friendly vegetarian protein: dal, chana, rajma, moong, soya chunks, curd and peanuts. Dal with rice or roti together makes a good protein mix. (Demo reply: pre-written.)',
    other: 'This is a demo reply: in the real app the AI answers your exact question using your goal and what you ate today. Try asking about protein, oil, dinner or cheap protein.',
  },
  hi: {
    protein: 'ज़्यादा प्रोटीन वाले अच्छे स्नैक: भुना चना, एक कटोरी दही, पनीर के टुकड़े, उबला अंडा, या नींबू के साथ अंकुरित मूँग। हर एक में लगभग 10–15 ग्राम प्रोटीन। (डेमो जवाब: पहले से लिखा हुआ, असली AI का नहीं।)',
    oil: 'नॉन-स्टिक पैन में पकाएँ, तेल चम्मच से नापें (1 चम्मच लगभग 40 kcal), और ऊपर से तड़के की जगह मसाले, करी पत्ता और नींबू से स्वाद बढ़ाएँ। (डेमो जवाब: पहले से लिखा हुआ।)',
    dinner: '2 रोटी, दाल और एक सब्ज़ी का रात का खाना आमतौर पर हल्का होता है। अगर रात को भारीपन लगे तो जल्दी खाएँ और तेल कम रखें। (डेमो जवाब: पहले से लिखा हुआ।)',
    cheap: 'सस्ते शाकाहारी प्रोटीन: दाल, चना, राजमा, मूँग, सोया चंक्स, दही और मूँगफली। दाल के साथ चावल या रोटी मिलकर अच्छा प्रोटीन देते हैं। (डेमो जवाब: पहले से लिखा हुआ।)',
    other: 'यह डेमो जवाब है: असली ऐप में AI आपके लक्ष्य और आज के खाने को देखकर आपके सवाल का सही जवाब देता है। प्रोटीन, तेल, रात के खाने या सस्ते प्रोटीन के बारे में पूछकर देखें।',
  },
  mr: {
    protein: 'जास्त प्रोटीनचे चांगले स्नॅक: भाजलेले चणे, एक वाटी दही, पनीरचे तुकडे, उकडलेले अंडे, किंवा लिंबूसह मोड आलेले मूग. प्रत्येकात सुमारे 10–15 ग्रॅम प्रोटीन. (डेमो उत्तर: आधीच लिहिलेले, खऱ्या AI चे नाही.)',
    oil: 'नॉन-स्टिक तव्यावर शिजवा, तेल चमच्याने मोजा (1 चमचा सुमारे 40 kcal), आणि जास्त फोडणीऐवजी मसाले, कढीपत्ता आणि लिंबाने चव वाढवा. (डेमो उत्तर: आधीच लिहिलेले.)',
    dinner: '2 पोळ्या, वरण आणि एक भाजी असे रात्रीचे जेवण साधारणपणे हलके असते. रात्री जड वाटत असेल तर लवकर जेवा आणि तेल कमी ठेवा. (डेमो उत्तर: आधीच लिहिलेले.)',
    cheap: 'स्वस्त शाकाहारी प्रोटीन: डाळ, चणे, राजमा, मूग, सोया चंक्स, दही आणि शेंगदाणे. डाळीसोबत भात किंवा पोळी मिळून चांगले प्रोटीन मिळते. (डेमो उत्तर: आधीच लिहिलेले.)',
    other: 'हे डेमो उत्तर आहे: खऱ्या अ‍ॅपमध्ये AI तुमचे लक्ष्य आणि आज काय खाल्ले ते पाहून तुमच्या प्रश्नाचे योग्य उत्तर देते. प्रोटीन, तेल, रात्रीचे जेवण किंवा स्वस्त प्रोटीनबद्दल विचारून पाहा.',
  },
};

function chatReply(lang: string, last: string): string {
  const set = CHAT[(lang as 'en') in CHAT ? (lang as 'en') : 'en'];
  const q = last.toLowerCase();
  if (/protein|प्रोटीन|snack|स्नैक|स्नॅक/.test(q)) return set.protein;
  if (/oil|तेल|ghee|घी|तूप/.test(q)) return set.oil;
  if (/dinner|रात|जेवण|heavy|भारी|जड/.test(q)) return set.dinner;
  if (/cheap|budget|सस्ते|स्वस्त/.test(q)) return set.cheap;
  return set.other;
}

// ---------------------------------------------------------------- sample history so Progress / History look alive
function seedHistory(db: Db, userId: string, weightKg: number, now = new Date()) {
  const plan: [string, string, number][][] = [
    [['poha', 'breakfast', 200], ['dal-tadka', 'lunch', 150], ['roti', 'lunch', 120], ['mixed-veg', 'dinner', 150], ['roti', 'dinner', 80]],
    [['idli', 'breakfast', 120], ['sambar', 'breakfast', 150], ['rice', 'lunch', 200], ['rajma', 'lunch', 150], ['khichdi', 'dinner', 250]],
    [['paratha', 'breakfast', 80], ['curd', 'breakfast', 100], ['roti', 'lunch', 80], ['paneer-curry', 'lunch', 150], ['roti', 'dinner', 80], ['dal-tadka', 'dinner', 150]],
    [['upma', 'breakfast', 200], ['roti', 'lunch', 120], ['chana-masala', 'lunch', 150], ['banana', 'snack', 100], ['rice', 'dinner', 150], ['dal-tadka', 'dinner', 150]],
    [['dhokla', 'breakfast', 160], ['thepla', 'lunch', 80], ['curd', 'lunch', 100], ['roti', 'dinner', 80], ['mixed-veg', 'dinner', 100]],
  ];
  plan.forEach((day, k) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (k + 1), 13, 0, 0);
    for (const type of ['breakfast', 'lunch', 'snack', 'dinner']) {
      const parts = day.filter((p) => p[1] === type);
      if (!parts.length) continue;
      const mealId = `demo-m${db.seq++}`;
      // portions are scaled up so a sample day lands near a typical 1,600–2,000 kcal target
      const items = parts.map(([id, , g]) => { const grams = Math.round((g * 1.5) / 5) * 5; return { id, grams, n: nutrientsFor(FOOD_BY_ID[id], grams) }; });
      const sum = (f: (n: ReturnType<typeof nutrientsFor>) => number) => items.reduce((a, i) => a + f(i.n), 0);
      db.meals.push({ id: mealId, user_id: userId, eaten_at: date.toISOString(), meal_type: type, kcal: sum((n) => n.kcal), protein_g: sum((n) => n.protein_g), carbs_g: sum((n) => n.carbs_g), fat_g: sum((n) => n.fat_g), fiber_g: sum((n) => n.fiber_g) });
      items.forEach((i) => db.meal_items.push({ id: `demo-i${db.seq++}`, meal_id: mealId, user_id: userId, food_id: i.id, name: FOOD_BY_ID[i.id].name, grams: i.grams, source: 'manual', ai_confidence: null, ...i.n }));
    }
  });
  // a week of sleep and steps
  for (let d = 1; d <= 6; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    db.sleep_logs.push({ id: `demo-s${db.seq++}`, user_id: userId, member_id: null, logged_on: day, hours: [6.5, 7, 7.5, 6, 8, 7][d - 1] });
    db.activity_logs.push({ id: `demo-a${db.seq++}`, user_id: userId, member_id: null, logged_on: day, steps: [6200, 8400, 9100, 4300, 10200, 7600][d - 1], exercise_min: [0, 30, 20, 0, 40, 15][d - 1] });
  }
  // three weeks of gentle weight loss with day-to-day noise
  for (let d = 20; d >= 1; d -= 3) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    db.weight_logs.push({ id: `demo-w${db.seq++}`, user_id: userId, logged_on: day, weight_kg: Math.round((weightKg + d * 0.07 + (d % 2 ? 0.1 : -0.1)) * 10) / 10 });
  }
}

// ---------------------------------------------------------------- PostgREST-style querying
function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows;
  for (const [key, value] of params.entries()) {
    if (['select', 'order', 'limit', 'columns', 'on_conflict'].includes(key)) continue;
    const m = /^(eq|gte|lt|lte|gt|is)\.(.*)$/.exec(value);
    if (!m) continue;
    const [, op, v] = m;
    out = out.filter((r) => {
      if (op === 'is') return v === 'null' ? r[key] === null || r[key] === undefined : String(r[key]) === v;
      const a = String(r[key] ?? '');
      switch (op) {
        case 'eq': return a === v;
        case 'gte': return a >= v;
        case 'gt': return a > v;
        case 'lt': return a < v;
        default: return a <= v;
      }
    });
  }
  const order = params.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === 'desc' ? -1 : 1));
  }
  const limit = params.get('limit');
  return limit ? out.slice(0, Number(limit)) : out;
}

// ---------------------------------------------------------------- the fake server
export function createDemoFetch(store: Store, now: () => Date = () => new Date()) {
  const load = (): Db => {
    try { const raw = store.getItem(KEY); if (raw) return { ...empty(), ...JSON.parse(raw) }; } catch { /* start fresh */ }
    return empty();
  };
  const save = (db: Db) => store.setItem(KEY, JSON.stringify(db));
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const empty204 = () => new Response(null, { status: 204 });
  const currentUser = (req: Request, db: Db): Row | undefined => {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return db.users.find((u) => u.id === payload.sub);
    } catch { return undefined; }
  };

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input as any, init);
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const db = load();
    const body = async () => { try { return JSON.parse((await req.text()) || '{}'); } catch { return {}; } };

    // ---- auth (any email / password works in the demo)
    if (path.endsWith('/auth/v1/signup') || (path.endsWith('/auth/v1/token') && url.searchParams.get('grant_type') === 'password')) {
      const b = await body();
      const email = String(b.email ?? '').toLowerCase();
      let user = db.users.find((u) => u.email === email);
      if (!user) { user = { id: `demo-user-${db.users.length + 1}`, email, created_at: now().toISOString() }; db.users.push(user); save(db); }
      return json(sessionFor(user));
    }
    if (path.endsWith('/auth/v1/token')) {
      const user = db.users[0];
      return user ? json(sessionFor(user)) : json({ error: 'invalid_grant' }, 400);
    }
    if (path.endsWith('/auth/v1/recover')) return json({});
    if (path.endsWith('/auth/v1/logout')) return empty204();
    if (path.endsWith('/auth/v1/user')) {
      const user = currentUser(req, db);
      return user ? json(sessionFor(user).user) : json({ message: 'not signed in' }, 401);   // GET, and PUT (change password: a no-op in the demo)
    }

    // ---- AI functions (pre-written)
    if (path.endsWith('/functions/v1/analyze-food')) return json(SCAN_RESULT);
    if (path.endsWith('/functions/v1/nutrition-chat')) {
      const b = await body();
      (globalThis as any).__demoChatCalls = [...((globalThis as any).__demoChatCalls ?? []), b];   // lets the browser tests inspect exactly what would be sent to the AI
      const last = [...(b.messages ?? [])].reverse().find((m: Row) => m.role === 'user')?.content ?? '';
      return json({ reply: chatReply(b.language, String(last)) });
    }

    const user = currentUser(req, db);
    if (!user) return json({ message: 'not signed in' }, 401);

    if (path.endsWith('/rest/v1/rpc/delete_my_account')) {
      const id = user.id;
      for (const t of ['profiles', 'meals', 'meal_items', 'water_logs', 'weight_logs', 'sleep_logs', 'activity_logs', ...HEALTH_TABLES] as const) db[t] = db[t].filter((r) => (r.user_id ?? r.id) !== id);
      db.members = db.members.filter((m) => m.owner_id !== id);
      db.users = db.users.filter((u) => u.id !== id);
      save(db);
      return empty204();
    }

    if (path.endsWith('/rest/v1/rpc/delete_my_health_data')) {
      for (const t of ['symptom_logs', 'cycle_logs', 'mood_logs', 'condition_triggers', 'clinician_instructions', 'health_measurement_logs', 'user_health_conditions', 'recommendation_safety_events', 'health_consents'] as const) db[t] = db[t].filter((r) => r.user_id !== user.id);
      db.condition_details = db.condition_details.filter((d) => d.user_id !== user.id);
      db.symptom_followups = db.symptom_followups.filter((f) => f.user_id !== user.id);
      db.routine_reminders = db.routine_reminders.filter((r) => !(r.user_id === user.id && r.kind === 'medication'));
      save(db);
      return empty204();
    }
    if (path.endsWith('/rest/v1/rpc/purge_my_health_logs')) {
      const b = await body();
      const cutoff = now().getTime() - Number(b.older_than_days ?? 180) * 86400000;
      let n = 0;
      for (const [t, col] of [['recommendation_safety_events', 'created_at'], ['health_measurement_logs', 'measured_at']] as const) {
        const before = db[t].length;
        db[t] = db[t].filter((r) => !(r.user_id === user.id && new Date(r[col]).getTime() < cutoff));
        n += before - db[t].length;
      }
      save(db);
      return json(n);
    }

    const table = /\/rest\/v1\/(\w+)$/.exec(path)?.[1] as keyof Omit<Db, 'seq' | 'users'> | undefined;
    if (!table || !(table in db)) return json({ message: `demo backend: unknown route ${path}` }, 404);
    const mine = (r: Row) => (table === 'profiles' ? r.id === user.id : table === 'members' ? r.owner_id === user.id : r.user_id === user.id);

    if (method === 'GET') {
      let rows = applyFilters(db[table].filter(mine), url.searchParams);
      if (table === 'meals') rows = rows.map((m) => ({ ...m, meal_items: db.meal_items.filter((i) => i.meal_id === m.id) }));
      if (req.headers.get('Accept')?.includes('vnd.pgrst.object')) return json(rows[0] ?? null);
      return json(rows);
    }

    if (method === 'POST') {
      const b = await body();
      const list: Row[] = Array.isArray(b) ? b : [b];
      const inserted: Row[] = [];
      for (const row of list) {
        const r: Row = { ...row, user_id: table === 'profiles' || table === 'members' ? undefined : user.id };
        if (table === 'members') { r.created_at = now().toISOString(); r.owner_id = user.id; }
        if (table === 'water_logs') r.logged_at = r.logged_at ?? now().toISOString();   // the real database fills these in
        if (table === 'meals') r.eaten_at = r.eaten_at ?? now().toISOString();
        if (table === 'profiles') {
          const existing = db.profiles.find((p) => p.id === user.id);
          if (existing) Object.assign(existing, row, { id: user.id });
          else {
            db.profiles.push({ ...row, id: user.id });
            if (!db.meals.some((m) => m.user_id === user.id)) seedHistory(db, user.id, Number(row.weight_kg), now());
          }
          continue;
        }
        if (table === 'weight_logs') {
          db.weight_logs = db.weight_logs.filter((w) => !(w.user_id === user.id && w.logged_on === row.logged_on));
        }
        if (table === 'condition_details' || table === 'symptom_followups' || table === 'routine_activities' || table === 'routine_completions' || table === 'flex_day_food_choices') r.user_id = user.id;
        if ((HEALTH_TABLES as readonly string[]).includes(table)) {
          r.created_at = r.created_at ?? now().toISOString();
          if (table === 'health_measurement_logs') r.measured_at = r.measured_at ?? now().toISOString();
        }
        r.id = r.id ?? `demo-${table}-${db.seq++}`;
        db[table].push(r);
        inserted.push(r);
      }
      save(db);
      if (req.headers.get('Prefer')?.includes('return=representation')) {
        return json(req.headers.get('Accept')?.includes('vnd.pgrst.object') ? inserted[0] : inserted, 201);
      }
      return new Response(null, { status: 201 });
    }

    if (method === 'PATCH') {
      const b = await body();
      const hit = applyFilters(db[table].filter(mine), url.searchParams);
      hit.forEach((r) => Object.assign(r, b));
      save(db);
      return req.headers.get('Prefer')?.includes('return=representation') ? json(hit.map((r) => ({ id: r.id }))) : empty204();
    }

    if (method === 'DELETE') {
      const doomed = new Set(applyFilters(db[table].filter(mine), url.searchParams).map((r) => r.id));
      db[table] = db[table].filter((r) => !doomed.has(r.id)) as any;
      if (table === 'meals') db.meal_items = db.meal_items.filter((i) => !doomed.has(i.meal_id));
      if (table === 'symptom_logs') db.symptom_followups = db.symptom_followups.filter((f) => !doomed.has(f.log_id));
      if (table === 'user_health_conditions') db.condition_details = db.condition_details.filter((d) => !doomed.has(d.condition_id));
      if (table === 'daily_routines') {
        const acts = new Set(db.routine_activities.filter((a) => doomed.has(a.routine_id)).map((a) => a.id));
        db.routine_activities = db.routine_activities.filter((a) => !doomed.has(a.routine_id));
        db.routine_completions = db.routine_completions.filter((c) => !acts.has(c.activity_id));
      }
      if (table === 'routine_activities') db.routine_completions = db.routine_completions.filter((c) => !doomed.has(c.activity_id));
      if (table === 'monthly_flex_days') db.flex_day_food_choices = db.flex_day_food_choices.filter((c) => !doomed.has(c.flex_day_id));
      if (table === 'members') {
        // a removed family member takes all of their logs with them
        for (const t of LOG_TABLES) db[t] = db[t].filter((r) => !doomed.has(r.member_id)) as any;
        db.meal_items = db.meal_items.filter((i) => db.meals.some((m) => m.id === i.meal_id));
      }
      save(db);
      return empty204();
    }

    return json({ message: 'demo backend: unsupported' }, 405);
  };
}

export function resetDemo(store: Store) {
  store.removeItem(KEY);
}

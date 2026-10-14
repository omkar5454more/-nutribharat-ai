import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { computeTargets } from '@/core/goals';
import { FOOD_BY_ID } from '@/core/foods';
import { ScanResultSchema, type ScanResult } from '@/core/match';
import { sumNutrients } from '@/core/nutrition';
import { dayKey, type WeightLog } from '@/core/progress';
import type { ActivityLog, SleepLog } from '@/core/wellness';
import type { MealItem, Nutrients, ProfileInput } from '@/core/types';
import { parseOpenFoodFacts, type LookupResult } from '@/core/barcode';
import { isDemo, supabase } from './supabase';

// ---------------------------------------------------------------- profile
export const ProfileRowSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  sex: z.enum(['female', 'male', 'other']),
  birth_date: z.string(),
  height_cm: z.coerce.number(),
  weight_kg: z.coerce.number(),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goal: z.enum(['lose', 'maintain', 'gain']),
  reproductive: z.enum(['none', 'pregnant', 'breastfeeding']),
  diet: z.string(),
  allergies: z.array(z.string()),
});
export type ProfileRow = z.infer<typeof ProfileRowSchema>;

export const ageFrom = (birth: string, now = new Date()) => {
  const b = new Date(birth);
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a;
};

export const profileInput = (p: ProfileRow): ProfileInput => ({
  sex: p.sex, age: ageFrom(p.birth_date), height_cm: p.height_cm, weight_kg: p.weight_kg, activity: p.activity, goal: p.goal, reproductive: p.reproductive,
});

export const targetsFor = (p: ProfileRow) => computeTargets(profileInput(p));

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return data ? ProfileRowSchema.parse(data) : null;
    },
  });
}

export async function saveProfile(userId: string, p: Omit<ProfileRow, 'id'>) {
  const { error } = await supabase.from('profiles').upsert({ id: userId, ...p });
  if (error) throw error;
}

// ---------------------------------------------------------------- family members
// "Me" is member_id = null; a family member is a row in `members`. Every log table is filtered by whose data is on screen.
export type MemberRow = ProfileRow & { relation: string };
export type MemberInput = Omit<ProfileRow, 'id'> & { relation: string };

export function useMembers(userId: string | undefined) {
  return useQuery({
    queryKey: ['members', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase.from('members').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({ ...ProfileRowSchema.parse(m), relation: String(m.relation ?? 'family') }));
    },
  });
}

export async function addMember(userId: string, m: MemberInput) {
  const { error } = await supabase.from('members').insert({ owner_id: userId, ...m, consent_confirmed: true });
  if (error) throw error;
}

export async function deleteMember(id: string) {
  const { error } = await supabase.from('members').delete().eq('id', id);   // their meals, water, weights, sleep and activity go with them
  if (error) throw error;
}

/** Restrict a query to one person's rows: me (member_id is null) or a family member. */
function scoped<Q extends { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(q: Q, memberId: string | null): Q {
  return memberId ? q.eq('member_id', memberId) : q.is('member_id', null);
}

/** One entry per person per day: update today's row if it exists, otherwise insert it. */
async function upsertDaily(table: 'weight_logs' | 'sleep_logs' | 'activity_logs', userId: string, memberId: string | null, date: string, fields: Record<string, number>) {
  const upd = scoped(supabase.from(table).update(fields).eq('user_id', userId).eq('logged_on', date) as any, memberId) as any;
  const { data, error } = await upd.select('id');
  if (error) throw error;
  if (data && data.length) return;
  const { error: e2 } = await supabase.from(table).insert({ user_id: userId, member_id: memberId, logged_on: date, ...fields });
  if (e2) throw e2;
}

// ---------------------------------------------------------------- meals
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export type MealRow = {
  id: string;
  eaten_at: string;
  meal_type: MealType;
  kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number;
  meal_items: { id: string; food_id: string; name: string; grams: number; kcal: number }[];
};

export const mealTypeNow = (d = new Date()): MealType => {
  const h = d.getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snack' : 'dinner';
};

export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export function useMeals(userId: string | undefined, memberId: string | null, from: Date, to: Date) {
  return useQuery({
    queryKey: ['meals', userId, memberId, from.toISOString(), to.toISOString()],
    enabled: !!userId,
    queryFn: async (): Promise<MealRow[]> => {
      const { data, error } = await scoped(
        supabase
          .from('meals')
          .select('id, eaten_at, meal_type, kcal, protein_g, carbs_g, fat_g, fiber_g, meal_items(id, food_id, name, grams, kcal)')
          .gte('eaten_at', from.toISOString())
          .lt('eaten_at', to.toISOString()) as any,
        memberId
      ).order('eaten_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m, kcal: +m.kcal, protein_g: +m.protein_g, carbs_g: +m.carbs_g, fat_g: +m.fat_g, fiber_g: +m.fiber_g,
        meal_items: (m.meal_items ?? []).map((i: any) => ({ ...i, grams: +i.grams, kcal: +i.kcal })),
      }));
    },
  });
}

export const totalsOf = (meals: MealRow[]): Nutrients =>
  sumNutrients(meals.map((m) => ({ kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, fiber_g: m.fiber_g })));

export async function saveMeal(userId: string, memberId: string | null, mealType: MealType, items: MealItem[], eatenAt = new Date()) {
  if (!items.length) throw new Error('Add at least one food.');
  const t = sumNutrients(items.map((i) => i.nutrients));
  const { data: meal, error } = await supabase
    .from('meals')
    .insert({ user_id: userId, member_id: memberId, meal_type: mealType, eaten_at: eatenAt.toISOString(), ...t })
    .select('id')
    .single();
  if (error) throw error;
  const { error: e2 } = await supabase.from('meal_items').insert(
    items.map((i) => ({
      meal_id: meal.id, user_id: userId, food_id: i.foodId, name: i.name, grams: i.grams, source: i.source,
      ai_confidence: i.confidence ?? null, ...i.nutrients,
    }))
  );
  if (e2) {
    await supabase.from('meals').delete().eq('id', meal.id); // don't leave an empty meal behind
    throw e2;
  }
}

export async function deleteMeal(id: string) {
  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) throw error;
}

export function useInvalidateMeals() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['meals'] });
}

// ---------------------------------------------------------------- AI scan
export async function analyzePhoto(base64: string, mediaType = 'image/jpeg'): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke('analyze-food', { body: { image_base64: base64, media_type: mediaType } });
  if (error) {
    // the function returns { error: "friendly text" } with a non-2xx status
    let msg = 'The food scanner is unavailable right now. You can add foods manually.';
    try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return ScanResultSchema.parse(data);
}

export const foodName = (id: string) => FOOD_BY_ID[id]?.name ?? id;

// ---------------------------------------------------------------- water
export type WaterLog = { id: string; ml: number; logged_at: string };
export const GLASS_ML = 250;

export function useWater(userId: string | undefined, memberId: string | null, from: Date, to: Date) {
  return useQuery({
    queryKey: ['water', userId, memberId, from.toISOString()],
    enabled: !!userId,
    queryFn: async (): Promise<WaterLog[]> => {
      const { data, error } = await scoped(supabase.from('water_logs').select('id, ml, logged_at').gte('logged_at', from.toISOString()).lt('logged_at', to.toISOString()) as any, memberId).order('logged_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((w: any) => ({ id: w.id, ml: +w.ml, logged_at: w.logged_at }));
    },
  });
}

export async function addWater(userId: string, memberId: string | null, ml = GLASS_ML) {
  const { error } = await supabase.from('water_logs').insert({ user_id: userId, member_id: memberId, ml });
  if (error) throw error;
}

export async function deleteWater(id: string) {
  const { error } = await supabase.from('water_logs').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------- weight, sleep, activity (one entry per person per day)
export function useWeights(userId: string | undefined, memberId: string | null) {
  return useQuery({
    queryKey: ['weights', userId, memberId],
    enabled: !!userId,
    queryFn: async (): Promise<WeightLog[]> => {
      const { data, error } = await scoped(supabase.from('weight_logs').select('logged_on, weight_kg') as any, memberId).order('logged_on', { ascending: true }).limit(365);
      if (error) throw error;
      return (data ?? []).map((w: any) => ({ date: w.logged_on, weight_kg: +w.weight_kg }));
    },
  });
}

export const logWeight = (userId: string, memberId: string | null, weight_kg: number, date = dayKey(new Date())) => upsertDaily('weight_logs', userId, memberId, date, { weight_kg });

export function useSleep(userId: string | undefined, memberId: string | null) {
  return useQuery({
    queryKey: ['sleep', userId, memberId],
    enabled: !!userId,
    queryFn: async (): Promise<SleepLog[]> => {
      const { data, error } = await scoped(supabase.from('sleep_logs').select('logged_on, hours') as any, memberId).order('logged_on', { ascending: true }).limit(120);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ date: r.logged_on, hours: +r.hours }));
    },
  });
}

export const logSleep = (userId: string, memberId: string | null, hours: number, date = dayKey(new Date())) => upsertDaily('sleep_logs', userId, memberId, date, { hours });

export function useActivity(userId: string | undefined, memberId: string | null) {
  return useQuery({
    queryKey: ['activity', userId, memberId],
    enabled: !!userId,
    queryFn: async (): Promise<ActivityLog[]> => {
      const { data, error } = await scoped(supabase.from('activity_logs').select('logged_on, steps, exercise_min') as any, memberId).order('logged_on', { ascending: true }).limit(120);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ date: r.logged_on, steps: +r.steps, exercise_min: +r.exercise_min }));
    },
  });
}

export const logActivity = (userId: string, memberId: string | null, steps: number, exercise_min: number, date = dayKey(new Date())) =>
  upsertDaily('activity_logs', userId, memberId, date, { steps, exercise_min });

// ---------------------------------------------------------------- chat
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatContext = {
  goal: string; diet: string; allergies: string[]; reproductive: string; age_band: 'adult';
  kcal_target: number; kcal_eaten: number; protein_target: number; protein_eaten: number;
};

export async function askAssistant(messages: ChatMessage[], context: ChatContext, language: string, health: unknown = null): Promise<string> {
  const { data, error } = await supabase.functions.invoke('nutrition-chat', { body: { messages, context, language, ...(health ? { health } : {}) } });
  if (error) {
    let msg = '';
    try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* use default */ }
    throw new Error(msg || 'unavailable');
  }
  const reply = z.object({ reply: z.string().min(1) }).parse(data);
  return reply.reply;
}

// ---------------------------------------------------------------- packaged-food barcode lookup (Open Food Facts, public community database)
export async function lookupProduct(code: string): Promise<LookupResult> {
  if (isDemo) {
    return { ok: true, product: { name: 'Demo namkeen mix', brand: 'Demo brand', per100g: { kcal: 520, protein_g: 14, carbs_g: 46, fat_g: 30, fiber_g: 5 }, servingGrams: 30 } };
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_en,brands,serving_quantity,nutriments`, { signal: ctl.signal });
    if (res.status === 404) return { ok: false, reason: 'not_found' };
    if (!res.ok) return { ok: false, reason: 'bad_response' };
    return parseOpenFoodFacts(await res.json());
  } catch {
    return { ok: false, reason: 'bad_response' };
  } finally {
    clearTimeout(timer);
  }
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { computeTargets } from '@/core/goals';
import { FOOD_BY_ID } from '@/core/foods';
import { ScanResultSchema, type ScanResult } from '@/core/match';
import { sumNutrients } from '@/core/nutrition';
import type { MealItem, Nutrients, ProfileInput } from '@/core/types';
import { supabase } from './supabase';

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

// ---------------------------------------------------------------- meals
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export type MealRow = {
  id: string;
  eaten_at: string;
  meal_type: MealType;
  kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number;
  meal_items: { id: string; name: string; grams: number; kcal: number }[];
};

export const mealTypeNow = (d = new Date()): MealType => {
  const h = d.getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snack' : 'dinner';
};

export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export function useMeals(userId: string | undefined, from: Date, to: Date) {
  return useQuery({
    queryKey: ['meals', userId, from.toISOString(), to.toISOString()],
    enabled: !!userId,
    queryFn: async (): Promise<MealRow[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select('id, eaten_at, meal_type, kcal, protein_g, carbs_g, fat_g, fiber_g, meal_items(id, name, grams, kcal)')
        .gte('eaten_at', from.toISOString())
        .lt('eaten_at', to.toISOString())
        .order('eaten_at', { ascending: false });
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

export async function saveMeal(userId: string, mealType: MealType, items: MealItem[], eatenAt = new Date()) {
  if (!items.length) throw new Error('Add at least one food.');
  const t = sumNutrients(items.map((i) => i.nutrients));
  const { data: meal, error } = await supabase
    .from('meals')
    .insert({ user_id: userId, meal_type: mealType, eaten_at: eatenAt.toISOString(), ...t })
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

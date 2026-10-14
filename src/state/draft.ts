import { create } from 'zustand';
import { makeItem, withGrams } from '@/core/nutrition';
import { FOOD_BY_ID } from '@/core/foods';
import type { Food, MealItem } from '@/core/types';
import { mealTypeNow, type MealType } from '@/lib/data';

/** The meal being built on the review screen (from a scan or from manual search). Lives in memory only. */
type Draft = {
  mealType: MealType;
  items: MealItem[];
  /** names the AI saw that we could not match to our food table — user must pick a food or drop them */
  unmatched: { name: string; grams: number }[];
  note: string;
  start: (items: MealItem[], unmatched?: { name: string; grams: number }[]) => void;
  setMealType: (t: MealType) => void;
  add: (food: Food, grams: number) => void;
  addItem: (item: MealItem) => void;
  setGrams: (index: number, grams: number) => void;
  replaceFood: (index: number, foodId: string) => void;
  remove: (index: number) => void;
  dropUnmatched: (index: number) => void;
  resolveUnmatched: (index: number, food: Food) => void;
  reset: () => void;
};

export const useDraft = create<Draft>((set) => ({
  mealType: mealTypeNow(),
  items: [],
  unmatched: [],
  note: '',
  start: (items, unmatched = []) => set({ items, unmatched, mealType: mealTypeNow(), note: '' }),
  setMealType: (mealType) => set({ mealType }),
  add: (food, grams) => set((s) => ({ items: [...s.items, makeItem(food, grams, 'manual')] })),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  setGrams: (i, grams) => set((s) => ({ items: s.items.map((it, k) => (k === i ? withGrams(it, Math.max(1, grams)) : it)) })),
  replaceFood: (i, foodId) =>
    set((s) => ({ items: s.items.map((it, k) => (k === i ? makeItem(FOOD_BY_ID[foodId], it.grams, it.source, it.confidence) : it)) })),
  remove: (i) => set((s) => ({ items: s.items.filter((_, k) => k !== i) })),
  dropUnmatched: (i) => set((s) => ({ unmatched: s.unmatched.filter((_, k) => k !== i) })),
  resolveUnmatched: (i, food) =>
    set((s) => ({
      items: [...s.items, makeItem(food, s.unmatched[i].grams, 'ai')],
      unmatched: s.unmatched.filter((_, k) => k !== i),
    })),
  reset: () => set({ items: [], unmatched: [], note: '', mealType: mealTypeNow() }),
}));

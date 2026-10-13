export type Nutrients = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

/** One entry of the food table. Nutrients are per 100 g of the food AS EATEN (cooked / prepared). */
export type Food = {
  id: string;
  name: string;
  /** Other spellings / Hindi / Marathi / regional names, lowercase. Used for matching AI output and search. */
  aliases: string[];
  cuisine: 'pan-indian' | 'north' | 'south' | 'maharashtrian' | 'gujarati' | 'street' | 'beverage' | 'basic';
  diet: 'veg' | 'egg' | 'non-veg' | 'vegan';
  per100g: Nutrients;
  /** Household measures, e.g. "1 roti" = 40 g. The first one is the default. */
  units: { name: string; grams: number }[];
  /** Where the numbers come from. 'seed' = approximate starter values, MUST be replaced / verified against IFCT before launch. */
  source: 'seed' | 'ifct';
};

export type Sex = 'female' | 'male' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain';
export type ReproductiveStatus = 'none' | 'pregnant' | 'breastfeeding';

export type ProfileInput = {
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity: ActivityLevel;
  goal: GoalType;
  reproductive: ReproductiveStatus;
};

export type NoteCode =
  | 'minor_see_pro' | 'minor_no_loss' | 'repro_pregnant' | 'repro_breastfeeding' | 'repro_no_loss'
  | 'underweight_no_loss' | 'floor_held' | 'bmi_outside';
export type Note = { code: NoteCode; params?: Record<string, number | string> };

export type Targets = {
  bmr: number;
  tdee: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
  bmi: number;
  /** Safety notes the UI must show (why a goal was adjusted, when to see a professional). Codes are translated in the UI. */
  notes: Note[];
  /** True when the user should be pointed to a doctor / dietitian instead of trusting the numbers. */
  seeProfessional: boolean;
};

export type MealItem = {
  foodId: string;
  name: string;
  grams: number;
  nutrients: Nutrients;
  source: 'ai' | 'manual';
  confidence?: number;
};

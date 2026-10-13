import type { ActivityLevel, ProfileInput, Targets } from './types';

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary — desk job, little exercise',
  light: 'Lightly active — walking / light exercise 1–3 days',
  moderate: 'Moderately active — exercise 3–5 days',
  active: 'Very active — hard exercise 6–7 days',
  very_active: 'Extremely active — physical job + training',
};

/** Lowest daily energy the app will ever suggest for weight loss (general wellness floor, not medical advice). */
const KCAL_FLOOR = { female: 1200, male: 1500, other: 1350 } as const;

const round = (n: number, step = 1) => Math.round(n / step) * step;

/** Mifflin–St Jeor resting energy. 'other' uses the midpoint of the male and female constants. */
export function bmr({ sex, age, height_cm, weight_kg }: Pick<ProfileInput, 'sex' | 'age' | 'height_cm' | 'weight_kg'>): number {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  const constant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return base + constant;
}

export function bmi(height_cm: number, weight_kg: number): number {
  const m = height_cm / 100;
  return weight_kg / (m * m);
}

/**
 * Daily targets from a profile. Deliberately conservative:
 *  - weight-loss deficit is ~15% of TDEE, capped at 500 kcal and never below a floor
 *  - no deficit for under-18s, pregnancy or breastfeeding (the user is pointed to a professional instead)
 *  - no deficit when BMI is already under 18.5
 */
export function computeTargets(p: ProfileInput): Targets {
  const notes: string[] = [];
  let seeProfessional = false;

  const rest = bmr(p);
  const tdee = rest * ACTIVITY_FACTOR[p.activity];
  const bmiValue = bmi(p.height_cm, p.weight_kg);

  let goal = p.goal;
  const noDeficit = (why: string) => {
    if (goal === 'lose') {
      goal = 'maintain';
      notes.push(why);
    }
  };

  if (p.age < 18) {
    seeProfessional = true;
    notes.push('For under-18s, calorie targets should come from a doctor or dietitian. These numbers are only a rough guide for maintaining weight.');
    noDeficit('Weight-loss targets are not offered under 18.');
  }
  if (p.reproductive !== 'none') {
    seeProfessional = true;
    notes.push(
      p.reproductive === 'pregnant'
        ? 'Pregnancy changes your needs month by month. Please follow your doctor or dietitian’s plan; these numbers are only a baseline.'
        : 'Breastfeeding raises your energy and fluid needs. Please follow your doctor or dietitian’s plan; these numbers are only a baseline.'
    );
    noDeficit('Weight-loss targets are not offered during pregnancy or breastfeeding.');
  }
  if (bmiValue < 18.5 && goal === 'lose') {
    seeProfessional = true;
    noDeficit('Your BMI is under 18.5, so a weight-loss target is not suggested. Consider talking to a doctor or dietitian.');
  }

  let kcal = tdee;
  if (goal === 'lose') {
    kcal = tdee - Math.min(500, tdee * 0.15);
    const floor = KCAL_FLOOR[p.sex];
    if (kcal < floor) {
      kcal = floor;
      notes.push(`Your target is held at ${floor} kcal, the lowest this app suggests without a professional’s advice.`);
    }
  } else if (goal === 'gain') {
    kcal = tdee + Math.min(400, tdee * 0.1);
  }
  kcal = round(kcal, 10);

  // Protein per kg of body weight; carbs and fat split the remaining energy.
  const proteinPerKg = goal === 'lose' ? 1.2 : goal === 'gain' ? 1.4 : 1.0;
  const protein_g = round(p.weight_kg * proteinPerKg);
  const fat_g = round((kcal * 0.27) / 9);
  const carbs_g = Math.max(0, round((kcal - protein_g * 4 - fat_g * 9) / 4));

  const water_ml = round(p.weight_kg * 35, 50) + (p.reproductive === 'breastfeeding' ? 700 : 0);

  if (bmiValue >= 30 || bmiValue < 16) {
    seeProfessional = true;
    notes.push('Your BMI is outside the range where general guidance is reliable. Please check with a doctor or dietitian.');
  }

  return {
    bmr: round(rest),
    tdee: round(tdee),
    kcal,
    protein_g,
    carbs_g,
    fat_g,
    water_ml,
    bmi: Math.round(bmiValue * 10) / 10,
    notes,
    seeProfessional,
  };
}

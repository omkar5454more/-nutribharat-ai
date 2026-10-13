# NutriBharat AI

Eat smart. Stay fit. Live healthy. — an AI nutrition companion for Indian food (React Native + Expo + Supabase, all TypeScript).

This is **Release 1 (MVP)**: sign up / log in, onboarding, daily calorie + macro targets, AI food-photo scanning,
editable meal logging, dashboard, history, profile, delete-my-account.

## How the scanner stays honest
1. The phone shrinks the photo and sends it to the `analyze-food` Supabase Edge Function.
2. The function asks Claude to **name the dishes and estimate grams only**. It never returns calories.
3. The app matches each name to its own food table (`src/core/foods.ts`) and **calculates** nutrition from grams × per-100 g values.
4. The user confirms or corrects foods, portions and extra oil on the review screen before anything is saved.
Dishes the app can't match are flagged, never guessed.

## Layout
- `src/core/` — pure logic, unit-tested: food table, nutrition maths, goal calculator (with safety limits), name matching, AI-result schema.
- `src/app/` — Expo Router screens (`sign-in`, `sign-up`, `onboarding`, `(app)/(tabs)/…`, `scan`, `review`, `add-food`).
- `src/lib/` — Supabase client, data hooks, theme. `src/state/` — session + draft meal.
- `supabase/migrations/0001_init.sql` — tables, row-level security, `delete_my_account()`.
- `supabase/functions/analyze-food/` — the AI call (Deno). The Anthropic key lives only here.

## Set up (about 15 minutes)
1. **Supabase**: create a free project at supabase.com. In the SQL editor run `supabase/migrations/0001_init.sql`.
2. Copy `.env.example` to `.env` and paste the project URL and the publishable (anon) key (Project Settings → API).
3. **Edge function** (needs the Supabase CLI): 
   ```
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase secrets set ANTHROPIC_API_KEY=your-key-here
   supabase functions deploy analyze-food
   ```
   Optional secrets: `SCANS_PER_DAY` (default 20 per user), `ANALYZE_MODEL` (default `claude-opus-5-5`).
4. `npm install` then `npx expo start` (press `w` for web, or scan the QR code with Expo Go on your phone).

In Supabase → Authentication you can turn email confirmation on or off; the app handles both.

## Commands
- `npm test` — unit tests for the core logic.
- `npm run typecheck` — TypeScript.

## Before real users
- **Food data**: `src/core/foods.ts` is a ~50-row *starter* table with approximate values, all marked `source: 'seed'`.
  Replace/verify it against **IFCT 2017** (NIN Hyderabad) under the correct licence and add source attribution.
- **Privacy & law**: the MVP requires users to be 18+ (India's DPDP Act needs verifiable parental consent for children).
  Add a privacy policy, a consent screen and a data-retention statement before launch. Meal photos are not stored.
- **Medical boundaries**: the app gives general wellness guidance only. It offers no weight-loss deficit under 18, in pregnancy,
  while breastfeeding or at an underweight BMI, and points those users to a doctor or dietitian. Have a qualified dietitian review the wording.
- **Password reset**: the app sends the reset email, but setting the new password needs deep-link handling (planned for Release 2).
- Not built yet (Release 2/3): AI chat (English/Hindi/Marathi), meal planner, budget plans, water/sleep/step tracking,
  weight progress, barcode scanning, family profiles, subscriptions, admin dashboard.

# NutriBharat AI

Eat smart. Stay fit. Live healthy. — an AI nutrition companion for Indian food (React Native + Expo + Supabase, all TypeScript).
Runs as an **installable web app (PWA)** on Android and iPhone, and can also be built as an Android app.

## What it does
- **Food scanning** — photo → AI names the dishes and guesses grams → the app *calculates* nutrition from its own food table → the user confirms or corrects. Packaged foods: **barcode scan** (Open Food Facts) or type the label.
- **Daily dashboard** — calories, protein / carbs / fat vs targets, water tracker, today's meals.
- **Goal calculator** with safety limits (no weight-loss deficit under 18, in pregnancy / breastfeeding, or at an underweight BMI → points to a doctor or dietitian).
- **Meal planner** — a day of Indian meals for your targets, by region (Maharashtrian, North, South, Gujarati), diet (veg / egg / non-veg / vegan / Jain), allergies, and an optional **daily budget** (₹100 / 150 / 250).
- **Progress** — weight trend with advice (flags unsafe fast loss), 7-day calories chart, streaks, **sleep and steps / exercise** (entered by hand).
- **Family members** — track adults in your family (their consent is required; 18+ only), each with their own targets and data.
- **AI nutrition chat** — answers general food questions using your goal and what you ate today.
- **8 languages** — English, Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati (including food names).
- Accounts: sign up, log in, forgot / reset password, delete my account and all data.

## See it in 1 minute (demo mode — no accounts, no keys)
```
npm install
npm run demo        # opens http://localhost:8081 in your browser
```
Any email and password work. Everything runs in the browser against a built-in fake backend (`src/lib/demoBackend.ts`): data stays in this browser, sample meals / weigh-ins / sleep are added when you create a profile, the barcode lookup returns a sample product, and the AI scan / chat give **pre-written** answers (labelled "Demo reply"). The yellow banner has a **Reset** button. Demo mode is only on when `EXPO_PUBLIC_DEMO=1`, which `npm run demo` sets; a normal build never includes it.

## Put it on the internet (about 30 minutes, all free tiers)
### 1. Database (Supabase)
1. Create a free project at supabase.com (done: project `cqjfvcvweyazqlzqdcka`, tables created; `.env` / `.env.production` hold its URL and *publishable* key, which are safe to ship).
2. **SQL editor → New query**, paste the whole of `supabase/all-in-one.sql`, press **Run**. (It is generated from `supabase/migrations/` by `npm run sql`.)
3. **Authentication → URL Configuration**: set *Site URL* to your web address (e.g. `https://nutribharat-ai.vercel.app`) and add it under *Redirect URLs*. Email links (confirm account, reset password) return there.
4. *Authentication → Providers → Email*: keep "Confirm email" on for a real launch (the app handles both).

### 2. AI functions (Supabase Edge Functions)
**Status for project `cqjfvcvweyazqlzqdcka`:** both functions are already deployed (via the Supabase dashboard editor, with *Verify JWT with legacy secret* switched off because the functions check the signed-in user themselves). **Still to do by hand: add the secret `ANTHROPIC_API_KEY`** (Dashboard → Edge Functions → Secrets). Until then food-photo scanning and chat answer "unavailable"; everything else works. After changing function code, re-deploy with the CLI below or paste the new code into the dashboard editor.

Needs the Supabase CLI (`npm i -g supabase`, or use `npx supabase`):
```
npx supabase login
npx supabase link --project-ref cqjfvcvweyazqlzqdcka
npx supabase secrets set ANTHROPIC_API_KEY=your-key-here
npx supabase functions deploy analyze-food
npx supabase functions deploy nutrition-chat
```
The Anthropic key lives **only** here as a secret — never in the app, `.env` or Vercel. Optional secrets: `SCANS_PER_DAY` (20 per user), `CHATS_PER_DAY` (40), `ANALYZE_MODEL` and `CHAT_MODEL` (default `claude-opus-5-5`; choose a cheaper model if cost matters).

### 3. The web app (Vercel, free)
1. Push this folder to a GitHub repository.
2. vercel.com → **Add New → Project** → import it. `vercel.json` already sets the build command (`npx expo export --platform web`) and output folder (`dist`).
3. Open the Vercel address on a phone → **Install app** (Profile tab) or the browser's "Add to Home Screen".

### Run locally against the real backend
Copy `.env.example` to `.env` (already done here), then `npm install` and `npx expo start` (press `w` for web).

### Android app file (APK) — optional
Free Expo account, then `npx eas build -p android --profile preview` produces an installable `.apk`. Camera barcode scanning and install-from-file work there too. (Not set up yet: see "Before real users".)

## Layout
- `src/core/` — pure, unit-tested logic: food table, nutrition maths, goals, name matching, `planner.ts` (+ `prices.ts`), `progress.ts`, `wellness.ts`, `barcode.ts`.
- `src/i18n/` — `en.ts` is the source of truth; every other language must define every key (a test enforces it, including `{placeholders}` and the doctor/dietitian referral in safety notes).
- `src/app/` — Expo Router screens. `src/lib/` — Supabase client, data hooks, demo backend, PWA helpers. `src/state/` — session, active family member, draft meal.
- `public/` — PWA files (manifest, icons, service worker, `index.html` template).
- `supabase/` — migrations, `all-in-one.sql`, edge functions, and SQL tests that run the migrations in an in-memory Postgres.

## Commands
- `npm test` — unit tests, SQL / row-level-security tests, demo-backend tests (135).
- `npm run typecheck` — TypeScript.
- `npm run sql` — rebuild `supabase/all-in-one.sql` (a test fails if it is stale).
- `npm run demo` — the no-keys demo.

## Before real users
- **Food data**: `src/core/foods.ts` is a ~50-row *starter* table with approximate values (`source: 'seed'`). Replace / verify against **IFCT 2017** (NIN Hyderabad) under the correct licence. Prices in `prices.ts` are rough estimates.
- **Translations** (Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati) were written by an AI. Have a native speaker and a dietitian review them, especially the safety notes. Messages returned by the edge functions are still English.
- **Privacy & law**: only adults (18+) can use the app or be added as family members, because India's DPDP Act needs verifiable parental consent for children. Add a privacy policy, a consent screen and a data-retention statement. Meal photos and chat messages are not stored.
- **Medical boundaries**: general wellness guidance only. Have a qualified dietitian review the wording and the planner.
- **Planner**: hand-written starter combinations. Allergies are only checked for milk, egg, fish, wheat/gluten, peanut — anything else is reported as "unchecked". Jain plans use a small curated set.
- **Barcode data** comes from the community database Open Food Facts and can be wrong or missing (the app then asks you to type the label).
- **Steps / sleep** are entered by hand (a web app cannot read the phone's health data).
- **Password reset** works in the web app (email link opens the "new password" screen). In an Android APK it needs a deep link — not built yet.
- **Not built**: health-app integrations (Google Fit / Apple Health), subscriptions (need Play Store / App Store accounts), admin dashboard (needs a separate secure server), iOS App Store build, Android adaptive icon artwork.

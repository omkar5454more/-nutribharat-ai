# Health coach (Release 4): what it does, how it is kept safe, and what still needs a professional

> **Read this before real users.** The software below is built and tested. The *clinical content* (thresholds, food rules, wording) and the *legal wording* are drafts written by an AI assistant and have **not** been reviewed by a doctor, dietitian or lawyer. Nothing here is medical or legal advice, and the app does not claim DPDP Act (or any law) compliance.

## What was built
| Area | Where |
|---|---|
| Database: 14 new tables, strict row-level security, consent gate, retention + delete functions | `supabase/migrations/0004_health.sql` (tests: `supabase/health.test.ts`) |
| Condition rules, multi-condition combiner, conflict handling, emergency readings, red-flag / unsafe-request detection | `src/core/health/safety.ts` (+ `conditions.ts`, `foodTags.ts`) |
| Daily routine scheduler, adaptive no-guilt suggestions, medication reminders (user-entered only) | `src/core/routine.ts`, `src/components/RoutineView.tsx` |
| Monthly Flex Day | `src/core/flexday.ts`, `src/components/FlexPlanner.tsx` |
| Scan considerations (allergy, condition notes, gentler ideas, cooking-oil estimate) | `src/core/health/scan.ts`, `src/components/ScanConsiderations.tsx` |
| Chat: on-device emergency / unsafe-request check; health summary to the AI only with consent | `src/app/(app)/(tabs)/chat.tsx`, `src/core/health/aiSummary.ts`, `supabase/functions/nutrition-chat` |
| Onboarding steps 4–7, Health & privacy screen, readings, trigger diary, export, retention, deletion | `src/app/(app)/setup.tsx`, `health.tsx`, `src/components/Health*.tsx` |

## How safety works (in layers)
1. **Consent first.** Health data can only be *written* while the person's `condition_tracking` consent is active — enforced by the database (`has_consent()` in the row-level-security policies), not just by the app. Withdrawing consent stops new writes and switches every health rule off; saved data stays until the person deletes it.
2. **The person decides.** Conditions are never inferred. "A doctor told me" and "I only suspect it" are stored separately; a suspicion only unlocks general healthy-habit tips and never a rule.
3. **Rules, not guesses.** `buildConstraints()` turns the person's own choices into one combined rule set. Where conditions disagree it takes the most conservative option (examples: diabetes + blood pressure → one plan, exercise capped at the lowest level; anaemia + high cholesterol → iron from dal/rajma/chana/greens, no rich dishes; acidity + migraine → no sudden caffeine change).
4. **Clinician instructions win.** Notes the person types from their own doctor or dietitian are shown first and are never edited by the app.
5. **Emergencies stop coaching.** Dangerous readings (blood pressure ≥180 or ≥120 diastolic; glucose <54 or ≥300 mg/dL) show a 112 message and a *Call 112* button. In chat, emergency wording or self-harm wording is answered **on the device**, with 112 / Tele-MANAS 14416, and is never sent to the AI.
6. **No medicine advice, ever.** Requests to change / skip / stop a medicine or dose, extreme diets, and "cure" claims get a fixed refusal on the device. Medicine reminders only repeat what the person typed; the app never suggests a drug, dose or time.
7. **No moral language.** Flex Day and missed items use neutral words; adaptive suggestions only move things later or make them easier — never skipping meals, fasting, extra exercise or "making up".
8. **Safety log.** Emergency readings, red-flag chats, conflict decisions and blocked requests are written to `recommendation_safety_events` (append-only for the user; no free text).

## Privacy design
- Every row has an owner (`user_id`); family-member rows also carry `member_id` and the member must belong to the caller. No cross-account access exists (tested).
- **AI processing** is a *separate* consent. When allowed, the AI receives only condition names and rule keywords (`aiSummary.ts`; tested to exclude names, notes, readings and medicine names). Locally handled safety messages are also kept out of the AI conversation history. Without that consent no health information is sent.
- **Export:** *Health & privacy → Download my health data* (JSON). **Retention:** delete logs older than 6 months. **Deletion:** *Delete all my health information* (`delete_my_health_data()`); deleting the account removes everything.
- Photos and chat messages are not stored (unchanged from earlier releases).

## What needs outside help (not done, cannot be done by the software)
**Needs a qualified clinician / dietitian** (all in `src/core/health/` and the `h4.note.*`, `h4.read.*` strings):
- Blood-pressure and glucose thresholds in `evaluateBp` / `evaluateGlucose`; the "rest, recheck after 5 minutes" wording.
- Every food rule and tag (`foodTags.ts`), the exercise caps, meal-gap limits (4.5 h diabetes, 5 h GERD / migraine), the 3-hour dinner gap for acidity, the cooking-oil estimates, the conflict decisions.
- All Hindi and Marathi health wording. The five other languages have no health strings yet and show English.
- The Tele-MANAS number (14416) and 112 should be re-verified before launch.

**Needs a lawyer / privacy professional:** the consent text, the privacy notice (a screen says it is a draft), the retention period, any DPDP Act duties (notice, purpose limitation, withdrawal, grievance contact, data-processor terms with Supabase and the AI provider, cross-border transfer), and whether health data needs extra handling. The app only builds the *mechanisms* (consent, withdrawal, export, deletion, minimisation).

**Needs credentials:** the AI assistant needs the `ANTHROPIC_API_KEY` secret in Supabase. Without it chat/scan show a friendly "unavailable" message; everything else works.

**Not possible in a web app / not built:** reading the phone's health data, reliable background reminders when the app is closed (a PWA cannot do this without a push service; reminders show while the app is open, optionally as browser notifications), subscriptions, an admin dashboard, an AI diagnosis (deliberately never).

## Testing
`npm test` covers the SQL and row-level security in a real in-memory Postgres (consent gate, isolation, validation, family members, retention, deletion), the safety engine (conditions, conflicts, thresholds, red flags, refusals), the routine scheduler, Flex Day, scan notes, the AI summary and the demo backend. Browser tests ran the whole flow in demo mode (consent → conditions → routine → Flex Day → readings and emergency → export / delete → chat safety → scan notes → Hindi).

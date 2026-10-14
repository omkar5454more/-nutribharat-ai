-- NutriBharat AI — Release 4: private health information, condition-aware coaching data, daily routines, Flex Day.
--
-- Rules enforced HERE (not just in the app):
--  * every row belongs to one account (user_id); rows about a family member also carry member_id, and the member must belong to the caller;
--  * health data (conditions, details, triggers, measurements, clinician notes, medication reminders) can only be WRITTEN while the person's
--    'condition_tracking' consent is active. After consent is withdrawn it can still be read and deleted, never added to;
--  * nothing is shared between accounts; there is no public read access of any kind.

-- ---------------------------------------------------------------- consent
create table public.health_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  purpose text not null check (purpose in ('condition_tracking', 'coaching', 'ai_processing')),
  granted boolean not null default true,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  policy_version text not null default '2026-10',
  check (granted or withdrawn_at is not null)
);
create unique index health_consents_one_per_purpose on public.health_consents (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), purpose);

create function public.owns_member(m uuid) returns boolean language sql stable as $$
  select m is null or exists (select 1 from public.members where id = m and owner_id = auth.uid())
$$;

create function public.has_consent(m uuid, p text) returns boolean language sql stable as $$
  select exists (
    select 1 from public.health_consents c
    where c.user_id = auth.uid() and c.member_id is not distinct from m and c.purpose = p and c.granted and c.withdrawn_at is null
  )
$$;

-- ---------------------------------------------------------------- conditions
create table public.user_health_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  condition text not null check (condition in ('pcos', 'migraine', 'hypertension', 'diabetes', 'thyroid', 'high_cholesterol', 'anemia', 'gerd', 'other')),
  other_label text check (other_label is null or char_length(other_label) between 1 and 60),
  -- a 'concern' is something the person suspects; the app never treats it as a diagnosis and only gives general tips for it
  status text not null default 'diagnosed' check (status in ('diagnosed', 'concern')),
  professionally_diagnosed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (condition <> 'other' or other_label is not null),
  check (status = 'diagnosed' or not professionally_diagnosed)
);
create unique index user_health_conditions_unique on public.user_health_conditions
  (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), condition, coalesce(other_label, ''));

create table public.condition_details (
  id uuid primary key default gen_random_uuid(),
  condition_id uuid not null unique references public.user_health_conditions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  restrictions text[] not null default '{}' check (cardinality(restrictions) <= 20),
  -- kinds of medicine that can matter for food / exercise safety, e.g. insulin; never doses
  medication_flags text[] not null default '{}' check (cardinality(medication_flags) <= 20),
  symptoms text[] not null default '{}' check (cardinality(symptoms) <= 20),
  notes text check (notes is null or char_length(notes) <= 500),
  wants_condition_aware boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.condition_triggers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  condition_id uuid references public.user_health_conditions (id) on delete set null,
  -- the person's OWN observation; the app never assumes a food is a trigger for everyone
  label text not null check (char_length(label) between 1 and 80),
  kind text not null default 'food' check (kind in ('food', 'habit', 'environment', 'other')),
  created_at timestamptz not null default now()
);
create index condition_triggers_user_idx on public.condition_triggers (user_id, created_at desc);

create table public.health_measurement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  kind text not null check (kind in ('bp', 'glucose', 'cycle', 'symptom', 'migraine')),
  measured_at timestamptz not null default now(),
  systolic integer,
  diastolic integer,
  pulse integer check (pulse is null or pulse between 20 and 250),
  glucose_mg_dl numeric(5,1),
  glucose_context text check (glucose_context is null or glucose_context in ('fasting', 'post_meal', 'bedtime', 'random')),
  note text check (note is null or char_length(note) <= 300),
  extra jsonb not null default '{}' check (octet_length(extra::text) <= 1000),
  created_at timestamptz not null default now(),
  check (kind <> 'bp' or (systolic between 50 and 300 and diastolic between 30 and 200 and systolic > diastolic)),
  check (kind <> 'glucose' or glucose_mg_dl between 20 and 800)
);
create index health_measurements_user_idx on public.health_measurement_logs (user_id, member_id, kind, measured_at desc);

create table public.clinician_instructions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  condition_id uuid references public.user_health_conditions (id) on delete set null,
  -- written by the user from their clinician's advice; the app displays it and respects it, it never invents or changes it
  instruction text not null check (char_length(instruction) between 1 and 500),
  source text not null default 'user_entered' check (source in ('user_entered', 'clinician_document')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- routines
create table public.routine_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  wake_minute integer not null default 420 check (wake_minute between 0 and 1439),
  sleep_minute integer not null default 1380 check (sleep_minute between 0 and 1439),
  work_start_minute integer check (work_start_minute is null or work_start_minute between 0 and 1439),
  work_end_minute integer check (work_end_minute is null or work_end_minute between 0 and 1439),
  shift text not null default 'none' check (shift in ('none', 'day', 'night', 'rotating')),
  cooking_time text not null default 'normal' check (cooking_time in ('quick', 'normal', 'long')),
  fitness_level text not null default 'beginner' check (fitness_level in ('beginner', 'moderate', 'active')),
  updated_at timestamptz not null default now()
);
create unique index routine_preferences_one on public.routine_preferences (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.daily_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  routine_date date not null,
  title text not null default '' check (char_length(title) <= 120),
  -- the scheduling inputs used (times, budget …). Never contains condition names or other health details.
  settings jsonb not null default '{}' check (octet_length(settings::text) <= 2000),
  is_flex_day boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index daily_routines_one_per_day on public.daily_routines (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), routine_date);

create table public.routine_activities (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.daily_routines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('wake', 'hydration', 'exercise', 'breakfast', 'lunch', 'snack', 'dinner', 'relax', 'sleep', 'medication', 'custom')),
  title text not null check (char_length(title) between 1 and 120),
  detail text not null default '' check (char_length(detail) <= 400),
  start_minute integer not null check (start_minute between 0 and 1439),
  duration_min integer not null default 0 check (duration_min between 0 and 600),
  planned_items jsonb not null default '[]' check (octet_length(planned_items::text) <= 6000),
  -- structured extras for non-meal activities (e.g. exercise intensity); contains no condition names
  payload jsonb not null default '{}' check (octet_length(payload::text) <= 3000),
  sort_order integer not null default 0,
  source text not null default 'generated' check (source in ('generated', 'user')),
  -- a medication reminder only repeats what the user (or their clinician) told the app; it never names a drug or dose on its own
  medication_label text check (medication_label is null or char_length(medication_label) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'medication' or medication_label is not null)
);
create index routine_activities_routine_idx on public.routine_activities (routine_id, start_minute);

create table public.routine_completions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references public.routine_activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('done', 'skipped')),
  completed_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 200)
);

create table public.routine_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  kind text not null check (kind in ('wake', 'hydration', 'exercise', 'breakfast', 'lunch', 'snack', 'dinner', 'relax', 'sleep', 'medication', 'custom')),
  minute integer check (minute is null or minute between 0 and 1439),
  enabled boolean not null default true,
  medication_label text check (medication_label is null or char_length(medication_label) between 1 and 80),
  created_at timestamptz not null default now(),
  check (kind <> 'medication' or (medication_label is not null and minute is not null))
);
create unique index routine_reminders_unique on public.routine_reminders
  (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, coalesce(minute, -1), coalesce(medication_label, ''));

-- ---------------------------------------------------------------- Flex Day
create table public.monthly_flex_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  month date not null check (date_trunc('month', month)::date = month),
  flex_date date not null,
  status text not null default 'planned' check (status in ('planned', 'done', 'skipped')),
  created_at timestamptz not null default now(),
  check (date_trunc('month', flex_date)::date = month)
);
create unique index monthly_flex_one_per_month on public.monthly_flex_days (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), month);

create table public.flex_day_food_choices (
  id uuid primary key default gen_random_uuid(),
  flex_day_id uuid not null references public.monthly_flex_days (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_label text not null check (char_length(food_label) between 1 and 60),
  food_id text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- safety log
create table public.recommendation_safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  kind text not null check (kind in ('emergency_reading', 'red_flag_symptom', 'conflict_detected', 'conservative_default', 'blocked_request', 'medication_boundary')),
  severity text not null check (severity in ('info', 'warning', 'urgent')),
  details jsonb not null default '{}' check (octet_length(details::text) <= 2000),
  created_at timestamptz not null default now()
);
create index safety_events_user_idx on public.recommendation_safety_events (user_id, created_at desc);

-- ---------------------------------------------------------------- row level security
alter table public.health_consents enable row level security;
alter table public.user_health_conditions enable row level security;
alter table public.condition_details enable row level security;
alter table public.condition_triggers enable row level security;
alter table public.health_measurement_logs enable row level security;
alter table public.clinician_instructions enable row level security;
alter table public.routine_preferences enable row level security;
alter table public.daily_routines enable row level security;
alter table public.routine_activities enable row level security;
alter table public.routine_completions enable row level security;
alter table public.routine_reminders enable row level security;
alter table public.monthly_flex_days enable row level security;
alter table public.flex_day_food_choices enable row level security;
alter table public.recommendation_safety_events enable row level security;

create policy "own consents" on public.health_consents for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_member(member_id));

-- health data: read / delete whenever it is yours; add or change only while consent is active
create policy "own conditions" on public.user_health_conditions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_member(member_id) and public.has_consent(member_id, 'condition_tracking'));
create policy "own condition details" on public.condition_details for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.user_health_conditions c
    where c.id = condition_id and c.user_id = auth.uid() and public.has_consent(c.member_id, 'condition_tracking')));
create policy "own triggers" on public.condition_triggers for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_member(member_id) and public.has_consent(member_id, 'condition_tracking')
    and (condition_id is null or exists (select 1 from public.user_health_conditions c where c.id = condition_id and c.user_id = auth.uid())));
create policy "own measurements" on public.health_measurement_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_member(member_id) and public.has_consent(member_id, 'condition_tracking'));
create policy "own clinician instructions" on public.clinician_instructions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_member(member_id) and public.has_consent(member_id, 'condition_tracking')
    and (condition_id is null or exists (select 1 from public.user_health_conditions c where c.id = condition_id and c.user_id = auth.uid())));

-- routines and Flex Day are ordinary wellness data
create policy "own routine preferences" on public.routine_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_member(member_id));
create policy "own routines" on public.daily_routines for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_member(member_id));
create policy "own routine activities" on public.routine_activities for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.daily_routines r where r.id = routine_id and r.user_id = auth.uid()));
create policy "own routine completions" on public.routine_completions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.routine_activities a where a.id = activity_id and a.user_id = auth.uid()));
-- medication reminders count as health data
create policy "own reminders" on public.routine_reminders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_member(member_id) and (kind <> 'medication' or public.has_consent(member_id, 'condition_tracking')));
create policy "own flex days" on public.monthly_flex_days for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_member(member_id));
create policy "own flex choices" on public.flex_day_food_choices for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.monthly_flex_days f where f.id = flex_day_id and f.user_id = auth.uid()));

-- the safety log is append-only for the user (read, add, delete for retention) — it is evidence, not something to edit
create policy "read own safety events" on public.recommendation_safety_events for select using (user_id = auth.uid());
create policy "add own safety events" on public.recommendation_safety_events for insert
  with check (user_id = auth.uid() and public.owns_member(member_id));
create policy "delete own safety events" on public.recommendation_safety_events for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------- timestamps
create trigger conditions_touch before update on public.user_health_conditions for each row execute function public.touch_updated_at();
create trigger condition_details_touch before update on public.condition_details for each row execute function public.touch_updated_at();
create trigger routine_prefs_touch before update on public.routine_preferences for each row execute function public.touch_updated_at();
create trigger routine_activities_touch before update on public.routine_activities for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- retention and deletion
-- Delete the caller's old safety-log entries and measurements (retention control the app offers in Settings).
create function public.purge_my_health_logs(older_than_days integer default 180) returns integer
language plpgsql security invoker as $$
declare n integer := 0; k integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if older_than_days < 0 then raise exception 'older_than_days must be >= 0'; end if;
  delete from public.recommendation_safety_events where user_id = auth.uid() and created_at < now() - make_interval(days => older_than_days);
  get diagnostics k = row_count; n := n + k;
  delete from public.health_measurement_logs where user_id = auth.uid() and measured_at < now() - make_interval(days => older_than_days);
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- "Delete all my health information": conditions (details cascade), triggers, measurements, clinician notes, medication reminders,
-- the safety log and the consent records. Routines, meals and the rest of the account stay.
create function public.delete_my_health_data() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.condition_triggers where user_id = auth.uid();
  delete from public.clinician_instructions where user_id = auth.uid();
  delete from public.health_measurement_logs where user_id = auth.uid();
  delete from public.user_health_conditions where user_id = auth.uid();
  delete from public.routine_reminders where user_id = auth.uid() and kind = 'medication';
  delete from public.recommendation_safety_events where user_id = auth.uid();
  delete from public.health_consents where user_id = auth.uid();
end $$;
revoke all on function public.delete_my_health_data() from public, anon;
grant execute on function public.delete_my_health_data() to authenticated;
revoke all on function public.purge_my_health_logs(integer) from public, anon;
grant execute on function public.purge_my_health_logs(integer) to authenticated;

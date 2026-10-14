-- NutriBharat AI — care features v2: more symptom types, mood check-ins, cycle tracking, favourite foods.

alter table public.symptom_logs drop constraint symptom_logs_symptom_type_check;
alter table public.symptom_logs add constraint symptom_logs_symptom_type_check
  check (symptom_type in ('headache', 'fatigue', 'menstrual', 'stress', 'sleep', 'digestive', 'other'));
alter table public.symptom_logs add column custom_label text check (custom_label is null or char_length(custom_label) between 1 and 60);

-- one mood tap per person per day (tapping again replaces it)
create table public.mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  logged_on date not null,
  mood integer not null check (mood between 1 and 5),
  created_at timestamptz not null default now()
);
create unique index mood_logs_one on public.mood_logs (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), logged_on);

-- private menstrual-cycle diary: health data, so only writable with condition_tracking consent
create table public.cycle_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  start_date date not null,
  end_date date,
  flow text check (flow is null or flow in ('light', 'medium', 'heavy')),
  pain integer check (pain is null or pain between 0 and 10),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create unique index cycle_logs_one on public.cycle_logs (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), start_date);

create table public.favorite_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  food_id text not null check (char_length(food_id) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index favorite_foods_one on public.favorite_foods (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), food_id);

alter table public.mood_logs enable row level security;
alter table public.cycle_logs enable row level security;
alter table public.favorite_foods enable row level security;
create policy "own mood" on public.mood_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_member(member_id));
create policy "own cycle" on public.cycle_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_member(member_id) and public.has_consent(member_id, 'condition_tracking'));
create policy "own favourites" on public.favorite_foods for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_member(member_id));

create or replace function public.delete_my_health_data() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.symptom_logs where user_id = auth.uid();
  delete from public.cycle_logs where user_id = auth.uid();
  delete from public.mood_logs where user_id = auth.uid();
  delete from public.condition_triggers where user_id = auth.uid();
  delete from public.clinician_instructions where user_id = auth.uid();
  delete from public.health_measurement_logs where user_id = auth.uid();
  delete from public.user_health_conditions where user_id = auth.uid();
  delete from public.routine_reminders where user_id = auth.uid() and kind = 'medication';
  delete from public.recommendation_safety_events where user_id = auth.uid();
  delete from public.health_consents where user_id = auth.uid();
end $$;

-- NutriBharat AI — gym preferences and workout completions (ordinary fitness data, owner-only).

create table public.gym_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  goes_to_gym boolean not null,
  days_per_week integer not null default 3 check (days_per_week between 2 and 6),
  goal text not null default 'general' check (goal in ('fat_loss', 'muscle', 'general')),
  level text not null default 'beginner' check (level in ('beginner', 'intermediate')),
  place text not null default 'full_gym' check (place in ('full_gym', 'basic')),
  updated_at timestamptz not null default now()
);
create unique index gym_prefs_one on public.gym_prefs (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  workout_date date not null,
  session_key text not null check (char_length(session_key) between 1 and 40),
  status text not null check (status in ('done', 'skipped')),
  created_at timestamptz not null default now()
);
create unique index workout_logs_one on public.workout_logs (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), workout_date, session_key);

alter table public.gym_prefs enable row level security;
alter table public.workout_logs enable row level security;
create policy "own gym prefs" on public.gym_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_member(member_id));
create policy "own workout logs" on public.workout_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_member(member_id));
create trigger gym_prefs_touch before update on public.gym_prefs for each row execute function public.touch_updated_at();

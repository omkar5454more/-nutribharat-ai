-- NutriBharat AI — symptom check-ins, follow-ups, notification preferences, achievements.
-- Symptom logs are health data: like the other health tables they can only be WRITTEN while 'condition_tracking' consent is active.

create table public.symptom_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  symptom_type text not null check (symptom_type in ('headache', 'fatigue', 'menstrual', 'stress', 'sleep', 'other')),
  started_at timestamptz not null default now(),
  severity integer not null check (severity between 1 and 10),
  duration_min integer check (duration_min is null or duration_min between 0 and 20160),
  triggers text[] not null default '{}' check (cardinality(triggers) <= 10),
  associated text[] not null default '{}' check (cardinality(associated) <= 10),
  note text check (note is null or char_length(note) <= 500),
  -- what the on-device safety screen decided at the time (never an AI diagnosis)
  screening text not null check (screening in ('usual', 'see_doctor', 'emergency')),
  status text not null default 'open' check (status in ('open', 'better', 'resolved', 'worse', 'stopped')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (status not in ('better', 'resolved') or resolved_at is not null)
);
create index symptom_logs_user_idx on public.symptom_logs (user_id, member_id, started_at desc);

create table public.symptom_followups (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.symptom_logs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  due_at timestamptz not null,
  attempt integer not null default 1 check (attempt between 1 and 3),
  status text not null default 'pending' check (status in ('pending', 'answered', 'cancelled')),
  response text check (response is null or response in ('better', 'same', 'worse', 'stop')),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'answered' or (response is not null and answered_at is not null))
);
create index symptom_followups_due_idx on public.symptom_followups (user_id, status, due_at);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  quiet_start_minute integer check (quiet_start_minute is null or quiet_start_minute between 0 and 1439),
  quiet_end_minute integer check (quiet_end_minute is null or quiet_end_minute between 0 and 1439),
  followups boolean not null default true,
  meals boolean not null default true,
  routine boolean not null default true,
  wellness boolean not null default false,
  updated_at timestamptz not null default now(),
  check ((quiet_start_minute is null) = (quiet_end_minute is null))
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 40),
  unlocked_at timestamptz not null default now()
);
create unique index achievements_one on public.achievements (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

alter table public.symptom_logs enable row level security;
alter table public.symptom_followups enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.achievements enable row level security;

create policy "own symptom logs" on public.symptom_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_member(member_id) and public.has_consent(member_id, 'condition_tracking'));
create policy "own followups" on public.symptom_followups for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.symptom_logs l where l.id = log_id and l.user_id = auth.uid()));
create policy "own notification preferences" on public.notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own achievements" on public.achievements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_member(member_id));

create trigger notification_prefs_touch before update on public.notification_preferences for each row execute function public.touch_updated_at();

-- "Delete all my health information" must also remove symptom check-ins (follow-ups go with their log).
create or replace function public.delete_my_health_data() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.symptom_logs where user_id = auth.uid();
  delete from public.condition_triggers where user_id = auth.uid();
  delete from public.clinician_instructions where user_id = auth.uid();
  delete from public.health_measurement_logs where user_id = auth.uid();
  delete from public.user_health_conditions where user_id = auth.uid();
  delete from public.routine_reminders where user_id = auth.uid() and kind = 'medication';
  delete from public.recommendation_safety_events where user_id = auth.uid();
  delete from public.health_consents where user_id = auth.uid();
end $$;

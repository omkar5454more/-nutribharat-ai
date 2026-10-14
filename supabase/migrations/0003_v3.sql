-- NutriBharat AI — Release 3: family members, sleep and activity tracking.
-- Every row still belongs to one account (user_id); family members are extra people that account holder tracks, with their consent.

create table public.members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  relation text not null default 'family',
  sex text not null check (sex in ('female', 'male', 'other')),
  birth_date date not null,
  height_cm numeric(5,1) not null check (height_cm between 80 and 250),
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 300),
  activity text not null check (activity in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  reproductive text not null default 'none' check (reproductive in ('none', 'pregnant', 'breastfeeding')),
  diet text not null default 'any' check (diet in ('any', 'veg', 'egg', 'non-veg', 'vegan', 'jain')),
  allergies text[] not null default '{}',
  -- the account holder confirms this adult agreed to be tracked; the app only allows adults (18+)
  consent_confirmed boolean not null default false check (consent_confirmed),
  created_at timestamptz not null default now()
);
create index members_owner_idx on public.members (owner_id);

-- existing logs belong to "me" (member_id is null); a family member's logs carry their member_id
alter table public.meals add column member_id uuid references public.members (id) on delete cascade;
alter table public.water_logs add column member_id uuid references public.members (id) on delete cascade;
alter table public.weight_logs add column member_id uuid references public.members (id) on delete cascade;

-- one weigh-in per person per day (the old rule was one per account per day)
alter table public.weight_logs drop constraint weight_logs_user_id_logged_on_key;
create unique index weight_logs_one_per_day on public.weight_logs (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), logged_on);

create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  logged_on date not null,
  hours numeric(3,1) not null check (hours between 1 and 16)
);
create unique index sleep_logs_one_per_day on public.sleep_logs (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), logged_on);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  logged_on date not null,
  steps integer not null default 0 check (steps between 0 and 100000),
  exercise_min integer not null default 0 check (exercise_min between 0 and 600)
);
create unique index activity_logs_one_per_day on public.activity_logs (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), logged_on);

alter table public.members enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.activity_logs enable row level security;

create policy "own members" on public.members for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own sleep" on public.sleep_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (member_id is null or exists (select 1 from public.members m where m.id = member_id and m.owner_id = auth.uid())));
create policy "own activity" on public.activity_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (member_id is null or exists (select 1 from public.members m where m.id = member_id and m.owner_id = auth.uid())));

-- the existing policies on meals / water_logs / weight_logs only checked user_id; tighten them so a row can only point at the caller's own members
drop policy "own meals" on public.meals;
create policy "own meals" on public.meals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (member_id is null or exists (select 1 from public.members m where m.id = member_id and m.owner_id = auth.uid())));
drop policy "own water" on public.water_logs;
create policy "own water" on public.water_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (member_id is null or exists (select 1 from public.members m where m.id = member_id and m.owner_id = auth.uid())));
drop policy "own weight" on public.weight_logs;
create policy "own weight" on public.weight_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (member_id is null or exists (select 1 from public.members m where m.id = member_id and m.owner_id = auth.uid())));

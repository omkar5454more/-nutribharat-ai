-- NutriBharat AI — Release 2: water tracking, weight tracking, chat usage limit. Same rule as before: users only see their own rows.

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  ml integer not null check (ml between 1 and 2000)
);
create index water_logs_user_idx on public.water_logs (user_id, logged_at desc);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 300),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)           -- one weigh-in per day; logging again the same day replaces it
);
create index weight_logs_user_idx on public.weight_logs (user_id, logged_on desc);

-- the existing usage table now also counts chat messages, so each feature has its own daily cap
alter table public.scan_usage add column kind text not null default 'scan' check (kind in ('scan', 'chat'));

alter table public.water_logs enable row level security;
alter table public.weight_logs enable row level security;

create policy "own water" on public.water_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own weight" on public.weight_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

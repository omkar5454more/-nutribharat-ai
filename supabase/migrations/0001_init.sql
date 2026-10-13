-- NutriBharat AI — initial schema. Every table is protected by row level security: users only ever see their own rows.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  sex text not null check (sex in ('female', 'male', 'other')),
  birth_date date not null,
  height_cm numeric(5,1) not null check (height_cm between 80 and 250),
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 300),
  activity text not null check (activity in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  reproductive text not null default 'none' check (reproductive in ('none', 'pregnant', 'breastfeeding')),
  diet text not null default 'any' check (diet in ('any', 'veg', 'egg', 'non-veg', 'vegan', 'jain')),
  allergies text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snack', 'dinner')),
  kcal numeric(8,1) not null default 0,
  protein_g numeric(7,1) not null default 0,
  carbs_g numeric(7,1) not null default 0,
  fat_g numeric(7,1) not null default 0,
  fiber_g numeric(7,1) not null default 0,
  created_at timestamptz not null default now()
);
create index meals_user_eaten_idx on public.meals (user_id, eaten_at desc);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text not null,
  name text not null,
  grams numeric(7,1) not null check (grams > 0 and grams <= 5000),
  kcal numeric(8,1) not null,
  protein_g numeric(7,1) not null,
  carbs_g numeric(7,1) not null,
  fat_g numeric(7,1) not null,
  fiber_g numeric(7,1) not null default 0,
  source text not null check (source in ('ai', 'manual')),
  ai_confidence numeric(3,2)
);
create index meal_items_meal_idx on public.meal_items (meal_id);

-- one row per photo analysis; used to cap AI usage per user per day
create table public.scan_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index scan_usage_user_idx on public.scan_usage (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.scan_usage enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own meals" on public.meals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- items must belong to the user AND to one of the user's own meals
create policy "own meal items" on public.meal_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()));
create policy "own scan usage read" on public.scan_usage for select using (user_id = auth.uid());
create policy "own scan usage insert" on public.scan_usage for insert with check (user_id = auth.uid());

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- "Delete my account and data": removes the auth user; every table above cascades.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

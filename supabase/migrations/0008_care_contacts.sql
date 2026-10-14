-- NutriBharat AI — care contacts: people the user chooses to tell when they need help.
-- The app opens the phone's SMS / WhatsApp with a pre-written message; the number is stored only so the user does not retype it.
-- The user must confirm they have told the person (the `told` check), and the number format is validated here too.

create table public.care_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid references public.members (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  relation text not null default 'family' check (relation in ('family', 'spouse', 'parent', 'friend', 'doctor', 'other')),
  told boolean not null check (told),
  alert_emergency boolean not null default true,
  alert_worse boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index care_contacts_one on public.care_contacts (user_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), phone);

alter table public.care_contacts enable row level security;
create policy "own care contacts" on public.care_contacts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_member(member_id));

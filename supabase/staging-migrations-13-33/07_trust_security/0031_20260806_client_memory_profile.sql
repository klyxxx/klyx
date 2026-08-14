-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260806_client_memory_profile.sql
-- SHA256: b47716301a96b9a6f845affe2a5e91417465f630c976f24861dbedc6513e0707
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

create table if not exists public.client_memory_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  household_type text null,
  children_count integer not null default 0,
  pet_types text[] not null default '{}'::text[],
  preferred_languages text[] not null default '{}'::text[],
  access_notes text null,
  cleaning_notes text null,
  babysitting_notes text null,
  moving_notes text null,
  handyman_notes text null,
  memory_enabled boolean not null default true,
  last_confirmed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint client_memory_profiles_profile_unique unique(profile_id),
  constraint client_memory_profiles_children_count_check check (
    children_count between 0 and 20
  ),
  constraint client_memory_profiles_household_type_check check (
    household_type is null
    or household_type = any (
      array[
        'apartment'::text,
        'house'::text,
        'studio'::text,
        'office'::text,
        'other'::text
      ]
    )
  )
);

create index if not exists client_memory_profiles_profile_idx
  on public.client_memory_profiles(profile_id);

alter table public.client_memory_profiles enable row level security;

drop policy if exists "Clients read own memory profile"
  on public.client_memory_profiles;

create policy "Clients read own memory profile"
on public.client_memory_profiles
for select
to authenticated
using (
  profile_id in (
    select id
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'client'
  )
);

commit;

-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260806_provider_service_zones.sql
-- SHA256: 1674a6798234a3d4a2555048c475e3c4a3c253f7831ceacad72c41a69e03af9b
-- PHASE: 07_trust_security
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

create table if not exists public.provider_service_zones (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_service_id uuid not null references public.user_services(id) on delete cascade,
  country_code text not null default 'BE',
  locality text not null,
  postal_code text null,
  radius_km integer not null default 10,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint provider_service_zones_unique
    unique(user_service_id, country_code, locality, postal_code),
  constraint provider_service_zones_radius_check
    check (radius_km between 1 and 100),
  constraint provider_service_zones_country_check
    check (char_length(country_code) = 2),
  constraint provider_service_zones_locality_check
    check (char_length(trim(locality)) between 2 and 100)
);

create index if not exists provider_service_zones_profile_idx
  on public.provider_service_zones(profile_id, is_active);

create index if not exists provider_service_zones_service_idx
  on public.provider_service_zones(user_service_id, is_active);

create unique index if not exists provider_service_zones_one_primary
  on public.provider_service_zones(user_service_id)
  where is_primary = true and is_active = true;

alter table public.provider_service_zones enable row level security;

drop policy if exists "Providers read own service zones"
  on public.provider_service_zones;

create policy "Providers read own service zones"
on public.provider_service_zones
for select
to authenticated
using (
  profile_id in (
    select id
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'provider'
  )
);

commit;

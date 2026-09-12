begin;

-- KLYX_PROFILE_ACTOR_CAPABILITIES_20260912
--
-- Additive transition away from the legacy client/provider discriminator.
-- Existing role/current_mode/account_type columns stay intact and readable.
-- Bookings, Stripe identifiers and historical profile ids are not rewritten.

create table if not exists public.profile_actor_capabilities (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null,
  enabled boolean not null default false,
  source text not null default 'legacy_backfill',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, capability),
  constraint profile_actor_capabilities_capability_check
    check (capability in ('request_services', 'offer_services')),
  constraint profile_actor_capabilities_source_check
    check (source in ('legacy_backfill', 'user', 'system'))
);

comment on table public.profile_actor_capabilities is
  'Additive KLYX actor capabilities. Once rows exist for a profile they are authoritative; legacy role columns remain fallback-only during migration.';
comment on column public.profile_actor_capabilities.profile_id is
  'Stable public.profiles id. Existing booking/payment foreign keys are never remapped by this migration.';
comment on column public.profile_actor_capabilities.capability is
  'request_services or offer_services; independent so one profile can hold both simultaneously.';

create index if not exists profile_actor_capabilities_enabled_idx
  on public.profile_actor_capabilities (capability, profile_id)
  where enabled = true;

alter table public.profile_actor_capabilities enable row level security;

revoke all privileges on table public.profile_actor_capabilities
  from public, anon, authenticated;
grant select on table public.profile_actor_capabilities
  to authenticated;
grant all privileges on table public.profile_actor_capabilities
  to service_role;

drop policy if exists "klyx_profile_actor_capabilities_owner_select"
  on public.profile_actor_capabilities;
create policy "klyx_profile_actor_capabilities_owner_select"
  on public.profile_actor_capabilities
  for select
  to authenticated
  using (public.klyx_owns_profile(profile_id));

-- Preserve current permissions exactly for existing profiles. Older rows may
-- not have account_type populated, so resolve the same legacy discriminator
-- used by the runtime fallback and default safely to client.
insert into public.profile_actor_capabilities (
  profile_id,
  capability,
  enabled,
  source
)
select
  profile.id,
  'request_services',
  coalesce(
    nullif(profile.account_type, ''),
    nullif(profile.current_mode, ''),
    nullif(profile.role, ''),
    'client'
  ) <> 'provider',
  'legacy_backfill'
from public.profiles as profile
on conflict (profile_id, capability) do nothing;

insert into public.profile_actor_capabilities (
  profile_id,
  capability,
  enabled,
  source
)
select
  profile.id,
  'offer_services',
  coalesce(
    nullif(profile.account_type, ''),
    nullif(profile.current_mode, ''),
    nullif(profile.role, ''),
    'client'
  ) = 'provider',
  'legacy_backfill'
from public.profiles as profile
on conflict (profile_id, capability) do nothing;

-- New capability rows are authoritative. Legacy columns are consulted only for
-- profiles that have no capability rows yet, which makes mixed-version deploys
-- safe while the application is migrated progressively.
create or replace function public.klyx_profile_has_capability(
  p_profile_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_capability not in ('request_services', 'offer_services') then false
    when exists (
      select 1
      from public.profile_actor_capabilities as actor_capability
      where actor_capability.profile_id = p_profile_id
    ) then coalesce(
      (
        select actor_capability.enabled
        from public.profile_actor_capabilities as actor_capability
        where actor_capability.profile_id = p_profile_id
          and actor_capability.capability = p_capability
        limit 1
      ),
      false
    )
    else coalesce(
      (
        select case
          when p_capability = 'offer_services' then
            coalesce(
              nullif(profile.account_type, ''),
              nullif(profile.current_mode, ''),
              nullif(profile.role, ''),
              'client'
            ) = 'provider'
          else
            coalesce(
              nullif(profile.account_type, ''),
              nullif(profile.current_mode, ''),
              nullif(profile.role, ''),
              'client'
            ) <> 'provider'
        end
        from public.profiles as profile
        where profile.id = p_profile_id
      ),
      false
    )
  end;
$$;

revoke all on function public.klyx_profile_has_capability(uuid, text)
  from public, anon, authenticated;
grant execute on function public.klyx_profile_has_capability(uuid, text)
  to service_role;

-- Public helper exposes only an already-public fact: whether a published
-- provider profile may be discovered. The generic capability function above
-- stays server-only and cannot be used as an arbitrary capability oracle.
create or replace function public.klyx_public_provider_profile(
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.klyx_profile_has_capability(p_profile_id, 'offer_services')
    and exists (
      select 1
      from public.provider_profiles as provider_profile
      where provider_profile.profile_id = p_profile_id
        and provider_profile.is_published = true
    );
$$;

revoke all on function public.klyx_public_provider_profile(uuid)
  from public;
grant execute on function public.klyx_public_provider_profile(uuid)
  to anon, authenticated, service_role;

-- Keep the existing profile visibility model, replacing only the legacy
-- account_type='provider' predicate with the new offer capability.
drop policy if exists "klyx_profiles_authenticated_select" on public.profiles;
create policy "klyx_profiles_authenticated_select"
  on public.profiles
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.klyx_shares_booking_with_profile(id)
    or public.klyx_public_provider_profile(id)
  );

drop policy if exists "klyx_profiles_public_select" on public.profiles;
create policy "klyx_profiles_public_select"
  on public.profiles
  for select
  to anon
  using (public.klyx_public_provider_profile(id));

-- Preserve every existing provider-service publication requirement and add the
-- actor capability as one extra gate. No service, verification or payment data
-- is created/deleted here.
create or replace function public.klyx_public_provider_service(
  p_user_service_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_services as user_service
    join public.service_profiles as service_profile
      on service_profile.user_service_id = user_service.id
    join public.provider_profiles as provider_profile
      on provider_profile.profile_id = user_service.user_id
    join public.provider_skill_verifications as verification
      on verification.user_service_id = user_service.id
     and verification.profile_id = user_service.user_id
     and verification.status = 'approved'
    where user_service.id = p_user_service_id
      and public.klyx_profile_has_capability(
        user_service.user_id,
        'offer_services'
      )
      and user_service.active = true
      and user_service.provider_enabled = true
      and service_profile.available = true
      and provider_profile.is_published = true
  );
$$;

-- Keep the Founder security audit authoritative for the new RLS table.
create or replace function public.klyx_security_audit()
returns table(
  table_name text,
  rls_enabled boolean,
  policy_count bigint
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    c.relname::text as table_name,
    c.relrowsecurity as rls_enabled,
    count(p.policyname)::bigint as policy_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n
    on n.oid = c.relnamespace
  left join pg_catalog.pg_policies p
    on p.schemaname = n.nspname
   and p.tablename = c.relname
  where
    n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'profiles',
      'profile_actor_capabilities',
      'user_services',
      'service_profiles',
      'provider_profiles',
      'provider_legal_profiles',
      'provider_service_zones',
      'availability_slots',
      'favorites',
      'bookings',
      'service_quotes',
      'messages',
      'reviews',
      'disputes',
      'notifications',
      'user_notifications'
    )
  group by
    c.relname,
    c.relrowsecurity
  order by c.relname;
$$;

alter function public.klyx_security_audit() owner to postgres;
revoke all on function public.klyx_security_audit()
  from public, anon, authenticated;
grant execute on function public.klyx_security_audit()
  to service_role;

comment on column public.profiles.role is
  'LEGACY compatibility column. Do not drop while consumers remain; actor capabilities are the progressive source of truth.';
comment on column public.profiles.current_mode is
  'LEGACY compatibility column. Do not drop while consumers remain; actor capabilities are the progressive source of truth.';
comment on column public.profiles.account_type is
  'LEGACY compatibility discriminator. Do not drop while consumers remain; actor capabilities are the progressive source of truth.';

commit;

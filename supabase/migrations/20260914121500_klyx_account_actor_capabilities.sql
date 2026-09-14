begin;

-- KLYX_ACCOUNT_ACTOR_CAPABILITIES_20260914
--
-- Final authority for what one canonical KLYX account may do.
-- Legacy profiles remain transaction/storage compatibility records only.
-- This migration is additive: no legacy table, column, booking id, Stripe id,
-- provider record or historical profile id is removed or rewritten.

create table if not exists public.account_actor_capabilities (
  account_id uuid not null references public.accounts(id) on delete cascade,
  capability text not null,
  enabled boolean not null default false,
  source text not null default 'legacy_backfill',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, capability),
  constraint account_actor_capabilities_capability_format_check
    check (
      length(capability) between 3 and 128
      and capability ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint account_actor_capabilities_source_check
    check (source in ('legacy_backfill', 'user', 'system', 'admin', 'migration'))
);

comment on table public.account_actor_capabilities is
  'Canonical KLYX account-level capability authority. Capabilities are independent and extensible; legacy client/provider profiles are compatibility-only.';
comment on column public.account_actor_capabilities.account_id is
  'Canonical public.accounts.id. Never a legacy profiles.id.';
comment on column public.account_actor_capabilities.capability is
  'Extensible capability key such as request_services or offer_services. No service category, city or market is encoded in this schema.';

create index if not exists account_actor_capabilities_enabled_idx
  on public.account_actor_capabilities (capability, account_id)
  where enabled = true;

alter table public.account_actor_capabilities enable row level security;

revoke all privileges on table public.account_actor_capabilities
  from public, anon, authenticated;
grant select on table public.account_actor_capabilities
  to authenticated;
grant all privileges on table public.account_actor_capabilities
  to service_role;

create or replace function public.klyx_owns_account(
  p_account_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.accounts as account
    where account.id = p_account_id
      and account.auth_user_id = (select auth.uid())
  );
$$;

alter function public.klyx_owns_account(uuid) owner to postgres;
revoke all on function public.klyx_owns_account(uuid)
  from public, anon;
grant execute on function public.klyx_owns_account(uuid)
  to authenticated, service_role;

create policy "klyx_account_actor_capabilities_owner_select"
  on public.account_actor_capabilities
  for select
  to authenticated
  using (public.klyx_owns_account(account_id));

-- Qualifications are deliberately generic. Product domains may add new
-- qualification keys and scopes without changing the account identity model.
create table if not exists public.account_capability_qualifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  capability text not null,
  qualification_key text not null,
  scope_type text not null default 'global',
  scope_key text not null default 'global',
  status text not null default 'pending',
  source text not null default 'system',
  evidence jsonb not null default '{}'::jsonb,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_capability_qualifications_capability_format_check
    check (
      length(capability) between 3 and 128
      and capability ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint account_capability_qualifications_key_format_check
    check (
      length(qualification_key) between 3 and 128
      and qualification_key ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint account_capability_qualifications_scope_type_check
    check (length(scope_type) between 1 and 64),
  constraint account_capability_qualifications_scope_key_check
    check (length(scope_key) between 1 and 256),
  constraint account_capability_qualifications_status_check
    check (length(status) between 2 and 64),
  constraint account_capability_qualifications_source_check
    check (source in ('legacy_backfill', 'user', 'system', 'admin', 'migration')),
  constraint account_capability_qualifications_unique_scope
    unique (account_id, capability, qualification_key, scope_type, scope_key)
);

comment on table public.account_capability_qualifications is
  'Extensible account-level qualification facts. Scope is generic and must not encode a fixed KLYX city/category list in schema.';

create index if not exists account_capability_qualifications_lookup_idx
  on public.account_capability_qualifications (
    account_id,
    capability,
    qualification_key,
    status
  );

alter table public.account_capability_qualifications enable row level security;

revoke all privileges on table public.account_capability_qualifications
  from public, anon, authenticated;
grant select on table public.account_capability_qualifications
  to authenticated;
grant all privileges on table public.account_capability_qualifications
  to service_role;

create policy "klyx_account_capability_qualifications_owner_select"
  on public.account_capability_qualifications
  for select
  to authenticated
  using (public.klyx_owns_account(account_id));

-- Canonical capability backfill.
-- Every canonical KLYX account can request services. Existing provider history
-- additionally enables offer_services, so an old provider becomes dual-capable
-- instead of being forced into a permanent provider-only identity.
insert into public.account_actor_capabilities (
  account_id,
  capability,
  enabled,
  source
)
select
  account.id,
  'request_services',
  true,
  'legacy_backfill'
from public.accounts as account
on conflict (account_id, capability) do nothing;

insert into public.account_actor_capabilities (
  account_id,
  capability,
  enabled,
  source
)
select
  account.id,
  'offer_services',
  exists (
    select 1
    from public.profiles as profile
    where profile.account_id = account.id
      and coalesce(
        nullif(profile.account_type, ''),
        nullif(profile.current_mode, ''),
        nullif(profile.role, ''),
        'client'
      ) = 'provider'
  ),
  'legacy_backfill'
from public.accounts as account
on conflict (account_id, capability) do nothing;

-- Future accounts receive safe defaults without requiring a profile to exist.
create or replace function public.klyx_seed_account_actor_capabilities()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.account_actor_capabilities (
    account_id,
    capability,
    enabled,
    source
  ) values
    (new.id, 'request_services', true, 'system'),
    (new.id, 'offer_services', false, 'system')
  on conflict (account_id, capability) do nothing;

  return new;
end;
$$;

alter function public.klyx_seed_account_actor_capabilities() owner to postgres;
revoke all on function public.klyx_seed_account_actor_capabilities()
  from public, anon, authenticated;
grant execute on function public.klyx_seed_account_actor_capabilities()
  to service_role;

drop trigger if exists klyx_accounts_seed_actor_capabilities
  on public.accounts;
create trigger klyx_accounts_seed_actor_capabilities
after insert on public.accounts
for each row
execute function public.klyx_seed_account_actor_capabilities();

-- Canonical capability reader. There is intentionally no profile-role fallback
-- once the account capability table exists: missing/disabled means denied.
create or replace function public.klyx_account_has_capability(
  p_account_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select capability.enabled
      from public.account_actor_capabilities as capability
      where capability.account_id = p_account_id
        and capability.capability = p_capability
      limit 1
    ),
    false
  );
$$;

alter function public.klyx_account_has_capability(uuid, text) owner to postgres;
revoke all on function public.klyx_account_has_capability(uuid, text)
  from public, anon, authenticated;
grant execute on function public.klyx_account_has_capability(uuid, text)
  to service_role;

-- Transitional adapter for SQL consumers that still carry profiles.id.
-- It resolves profile -> account and immediately delegates authorization to the
-- canonical account capability. profiles.id is never the authority here.
create or replace function public.klyx_profile_account_has_capability(
  p_profile_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select public.klyx_account_has_capability(
        profile.account_id,
        p_capability
      )
      from public.profiles as profile
      where profile.id = p_profile_id
        and profile.account_id is not null
      limit 1
    ),
    false
  );
$$;

alter function public.klyx_profile_account_has_capability(uuid, text) owner to postgres;
revoke all on function public.klyx_profile_account_has_capability(uuid, text)
  from public, anon, authenticated;
grant execute on function public.klyx_profile_account_has_capability(uuid, text)
  to service_role;

-- Public discovery may expose only a published provider compatibility record
-- whose canonical account currently has offer_services enabled.
create or replace function public.klyx_public_provider_profile(
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles as profile
    join public.provider_profiles as provider_profile
      on provider_profile.profile_id = profile.id
    where profile.id = p_profile_id
      and profile.account_id is not null
      and provider_profile.is_published = true
      and public.klyx_account_has_capability(
        profile.account_id,
        'offer_services'
      )
  );
$$;

alter function public.klyx_public_provider_profile(uuid) owner to postgres;
revoke all on function public.klyx_public_provider_profile(uuid)
  from public;
grant execute on function public.klyx_public_provider_profile(uuid)
  to anon, authenticated, service_role;

-- Replace only the profile SELECT policies so discovery no longer trusts the
-- permanent legacy account_type discriminator. No data/table/column is dropped.
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

-- Keep every existing service publication/qualification gate, adding the
-- canonical account offer capability as the actor-authority gate.
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
    join public.profiles as profile
      on profile.id = user_service.user_id
    join public.service_profiles as service_profile
      on service_profile.user_service_id = user_service.id
    join public.provider_profiles as provider_profile
      on provider_profile.profile_id = user_service.user_id
    join public.provider_skill_verifications as verification
      on verification.user_service_id = user_service.id
     and verification.profile_id = user_service.user_id
     and verification.status = 'approved'
    where user_service.id = p_user_service_id
      and profile.account_id is not null
      and public.klyx_account_has_capability(
        profile.account_id,
        'offer_services'
      )
      and user_service.active = true
      and user_service.provider_enabled = true
      and service_profile.available = true
      and provider_profile.is_published = true
  );
$$;

alter function public.klyx_public_provider_service(uuid) owner to postgres;
revoke all privileges on function public.klyx_public_provider_service(uuid)
  from public, anon, authenticated;
grant execute on function public.klyx_public_provider_service(uuid)
  to anon, authenticated, service_role;

-- Backfill approved legacy skill facts into the generic account qualification
-- ledger without deleting or replacing the legacy verification rows.
insert into public.account_capability_qualifications (
  account_id,
  capability,
  qualification_key,
  scope_type,
  scope_key,
  status,
  source,
  evidence
)
select distinct
  profile.account_id,
  'offer_services',
  'legacy_skill_verification',
  'user_service',
  verification.user_service_id::text,
  'approved',
  'legacy_backfill',
  jsonb_build_object(
    'legacy_profile_id', verification.profile_id,
    'legacy_verification_id', verification.id
  )
from public.provider_skill_verifications as verification
join public.profiles as profile
  on profile.id = verification.profile_id
where profile.account_id is not null
  and verification.status = 'approved'
on conflict (
  account_id,
  capability,
  qualification_key,
  scope_type,
  scope_key
) do nothing;

-- Keep Founder security audit authoritative for the new account-level tables.
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
    and (
      c.relname in (
        'profiles',
        'accounts',
        'account_actor_capabilities',
        'account_capability_qualifications',
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
      or c.relname like 'trust\_%' escape '\'
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
  'LEGACY compatibility field. Canonical permissions live on public.account_actor_capabilities via profiles.account_id.';
comment on column public.profiles.current_mode is
  'LEGACY compatibility field. Canonical permissions live on public.account_actor_capabilities via profiles.account_id.';
comment on column public.profiles.account_type is
  'LEGACY compatibility discriminator only. It is not the canonical KLYX capability authority.';

commit;

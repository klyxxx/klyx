-- ============================================================
-- KLYX UNIQUE ACCOUNT FOUNDATION
--
-- Additive Phase 1 for the target model:
--   1 auth user -> 1 KLYX account -> N legacy profiles/capabilities.
--
-- This migration deliberately does NOT change product behavior and does NOT
-- remove or reinterpret profiles.account_type, profiles.current_mode, role,
-- Stripe state, booking participant ids, provider tables or existing RLS.
-- Profiles remain the legacy/transaction compatibility boundary while the
-- canonical account identity is introduced alongside them.
-- ============================================================

begin;

-- ============================================================
-- 1. CANONICAL 1:1 ACCOUNT IDENTITY
-- ============================================================

create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  auth_user_id uuid not null
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint accounts_auth_user_id_key unique (auth_user_id)
);

comment on table public.accounts is
  'Canonical KLYX product identity. Exactly one row per Supabase Auth user; legacy client/provider profiles remain compatibility records during migration.';
comment on column public.accounts.auth_user_id is
  'Stable 1:1 link to auth.users. Product capabilities and intentions must migrate toward account identity without turning client/provider into account identity.';

alter table public.accounts enable row level security;

-- Phase 1 is server-only. No browser-facing account API or RLS policy is
-- introduced before the permission model exists.
revoke all privileges on table public.accounts
  from public, anon, authenticated;
grant all privileges on table public.accounts
  to service_role;

-- Every existing Auth identity gets one account, including users that do not
-- currently have a profile. This makes the invariant independent of legacy
-- profile creation state.
insert into public.accounts (auth_user_id)
select auth_user.id
from auth.users as auth_user
on conflict (auth_user_id) do nothing;

-- ============================================================
-- 2. LEGACY PROFILE -> ACCOUNT COMPATIBILITY LINK
-- ============================================================

alter table public.profiles
  add column if not exists account_id uuid;

comment on column public.profiles.account_id is
  'Additive compatibility link to the canonical KLYX account. account_type/current_mode and historical profile ids remain untouched until all dependencies are migrated.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_account_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_id_fkey
      foreign key (account_id)
      references public.accounts(id)
      on delete set null;
  end if;
end
$$;

create index if not exists profiles_account_id_idx
  on public.profiles (account_id);

-- Backfill is deterministic: all legacy profiles with the same owner_user_id
-- point to the exact same account row. No client/provider preference is used.
update public.profiles as profile
set account_id = account.id
from public.accounts as account
where profile.owner_user_id = account.auth_user_id
  and profile.account_id is distinct from account.id;

-- ============================================================
-- 3. KEEP FUTURE PROFILE WRITES CONSISTENT DURING DUAL-MODE MIGRATION
-- ============================================================

create or replace function public.klyx_bind_profile_to_canonical_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  canonical_account_id uuid;
begin
  if new.owner_user_id is null then
    if new.account_id is not null then
      raise exception using
        errcode = '23514',
        message = 'KLYX_PROFILE_ACCOUNT_OWNER_REQUIRED';
    end if;

    return new;
  end if;

  -- Defensive on-demand creation keeps existing profile creation paths working
  -- even if they run in the same Auth transaction as the account trigger.
  insert into public.accounts (auth_user_id)
  values (new.owner_user_id)
  on conflict (auth_user_id) do nothing;

  select account.id
  into canonical_account_id
  from public.accounts as account
  where account.auth_user_id = new.owner_user_id;

  if canonical_account_id is null then
    raise exception using
      errcode = '23514',
      message = 'KLYX_CANONICAL_ACCOUNT_REQUIRED';
  end if;

  if new.account_id is null then
    new.account_id := canonical_account_id;
  elsif new.account_id is distinct from canonical_account_id then
    raise exception using
      errcode = '23514',
      message = 'KLYX_PROFILE_ACCOUNT_OWNER_MISMATCH';
  end if;

  return new;
end;
$$;

alter function public.klyx_bind_profile_to_canonical_account()
  owner to postgres;
revoke all on function public.klyx_bind_profile_to_canonical_account()
  from public, anon, authenticated;
grant execute on function public.klyx_bind_profile_to_canonical_account()
  to service_role;

drop trigger if exists klyx_profiles_bind_canonical_account
  on public.profiles;
create trigger klyx_profiles_bind_canonical_account
before insert or update of owner_user_id, account_id
on public.profiles
for each row
execute function public.klyx_bind_profile_to_canonical_account();

-- ============================================================
-- 4. KEEP NEW AUTH USERS INSIDE THE 1:1 INVARIANT
-- ============================================================

create or replace function public.klyx_create_canonical_account_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.accounts (auth_user_id)
  values (new.id)
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

alter function public.klyx_create_canonical_account_for_auth_user()
  owner to postgres;
revoke all on function public.klyx_create_canonical_account_for_auth_user()
  from public, anon, authenticated;
grant execute on function public.klyx_create_canonical_account_for_auth_user()
  to service_role;

drop trigger if exists klyx_auth_user_create_canonical_account
  on auth.users;
create trigger klyx_auth_user_create_canonical_account
after insert
on auth.users
for each row
execute function public.klyx_create_canonical_account_for_auth_user();

commit;

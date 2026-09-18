-- ============================================================
-- KLYX ACCOUNT-LEVEL STRIPE CONNECT IDENTITY
--
-- Additive migration from legacy profile-owned Connect identity to the
-- canonical KLYX account introduced by 20260912190000.
--
-- Financial invariants:
--   * no booking/payment/refund/webhook row is rewritten;
--   * legacy profiles.stripe_account_id remains as immutable compatibility
--     history during the transition;
--   * exactly one canonical Stripe Connected Account may be linked to a KLYX
--     account;
--   * ambiguous legacy identity is fail-closed and requires manual review;
--   * a historical Stripe id is never silently replaced.
-- ============================================================

begin;

-- ============================================================
-- 1. CANONICAL ACCOUNT-LEVEL CONNECT STATE
-- ============================================================

alter table public.accounts
  add column if not exists stripe_account_id text,
  add column if not exists stripe_connect_state text not null default 'unlinked',
  add column if not exists stripe_onboarding_complete boolean not null default false,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_status_updated_at timestamptz;

do $klyx_account_stripe_state_constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.accounts'::regclass
      and conname = 'accounts_stripe_connect_state_check'
  ) then
    alter table public.accounts
      add constraint accounts_stripe_connect_state_check
      check (stripe_connect_state in ('unlinked', 'linked', 'review_required'));
  end if;
end;
$klyx_account_stripe_state_constraint$;

create unique index if not exists accounts_stripe_account_id_unique
  on public.accounts (stripe_account_id)
  where stripe_account_id is not null;

comment on column public.accounts.stripe_account_id is
  'Canonical Stripe Connect identity for the KLYX account. Legacy profile Stripe ids remain historical compatibility data only.';
comment on column public.accounts.stripe_connect_state is
  'Fail-closed canonical Connect state. review_required forbids automatic creation, replacement, payout routing, or onboarding continuation until manually resolved.';

-- ============================================================
-- 2. SERVER-ONLY MANUAL REVIEW QUEUE
-- ============================================================

create table if not exists public.stripe_connect_identity_reviews (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null
    references public.accounts(id) on delete cascade,
  reason text not null,
  candidate_stripe_account_ids text[] not null default '{}'::text[],
  source_profile_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'pending',
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stripe_connect_identity_reviews_status_check
    check (status in ('pending', 'resolved'))
);

create unique index if not exists stripe_connect_identity_reviews_pending_account_unique
  on public.stripe_connect_identity_reviews (account_id)
  where status = 'pending';

create index if not exists stripe_connect_identity_reviews_status_idx
  on public.stripe_connect_identity_reviews (status, created_at desc);

alter table public.stripe_connect_identity_reviews enable row level security;
revoke all privileges on table public.stripe_connect_identity_reviews
  from public, anon, authenticated;
grant all privileges on table public.stripe_connect_identity_reviews
  to service_role;

comment on table public.stripe_connect_identity_reviews is
  'Server-only fail-closed queue for ambiguous historical Stripe Connect identity. Financial routing must remain blocked while a pending review exists.';

-- ============================================================
-- 3. IDEMPOTENT LEGACY BACKFILL
-- ============================================================

-- First mark every ambiguous account as review_required. No candidate is
-- selected when more than one historical acct_* exists or when existing
-- canonical data disagrees with profile history.
with legacy as (
  select
    profile.account_id,
    array_agg(distinct profile.stripe_account_id order by profile.stripe_account_id)
      filter (where profile.stripe_account_id is not null) as stripe_ids,
    array_agg(profile.id order by profile.id)
      filter (where profile.stripe_account_id is not null) as profile_ids
  from public.profiles as profile
  where profile.account_id is not null
  group by profile.account_id
), conflicts as (
  select
    account.id as account_id,
    coalesce(legacy.stripe_ids, '{}'::text[]) as stripe_ids,
    coalesce(legacy.profile_ids, '{}'::uuid[]) as profile_ids,
    case
      when cardinality(coalesce(legacy.stripe_ids, '{}'::text[])) > 1
        then 'multiple_legacy_stripe_accounts'
      when account.stripe_account_id is not null
       and cardinality(coalesce(legacy.stripe_ids, '{}'::text[])) = 1
       and account.stripe_account_id is distinct from legacy.stripe_ids[1]
        then 'canonical_legacy_stripe_mismatch'
      when exists (
        select 1
        from public.accounts as other_account
        where other_account.id <> account.id
          and other_account.stripe_account_id is not null
          and other_account.stripe_account_id = any(coalesce(legacy.stripe_ids, '{}'::text[]))
      ) then 'stripe_account_linked_to_other_canonical_account'
      else null
    end as reason
  from public.accounts as account
  left join legacy on legacy.account_id = account.id
)
update public.accounts as account
set stripe_connect_state = 'review_required'
from conflicts
where conflicts.account_id = account.id
  and conflicts.reason is not null
  and account.stripe_connect_state is distinct from 'review_required';

with legacy as (
  select
    profile.account_id,
    array_agg(distinct profile.stripe_account_id order by profile.stripe_account_id)
      filter (where profile.stripe_account_id is not null) as stripe_ids,
    array_agg(profile.id order by profile.id)
      filter (where profile.stripe_account_id is not null) as profile_ids
  from public.profiles as profile
  where profile.account_id is not null
  group by profile.account_id
), conflicts as (
  select
    account.id as account_id,
    coalesce(legacy.stripe_ids, '{}'::text[]) as stripe_ids,
    coalesce(legacy.profile_ids, '{}'::uuid[]) as profile_ids,
    case
      when cardinality(coalesce(legacy.stripe_ids, '{}'::text[])) > 1
        then 'multiple_legacy_stripe_accounts'
      when account.stripe_account_id is not null
       and cardinality(coalesce(legacy.stripe_ids, '{}'::text[])) = 1
       and account.stripe_account_id is distinct from legacy.stripe_ids[1]
        then 'canonical_legacy_stripe_mismatch'
      when exists (
        select 1
        from public.accounts as other_account
        where other_account.id <> account.id
          and other_account.stripe_account_id is not null
          and other_account.stripe_account_id = any(coalesce(legacy.stripe_ids, '{}'::text[]))
      ) then 'stripe_account_linked_to_other_canonical_account'
      else null
    end as reason
  from public.accounts as account
  left join legacy on legacy.account_id = account.id
)
insert into public.stripe_connect_identity_reviews (
  account_id,
  reason,
  candidate_stripe_account_ids,
  source_profile_ids
)
select
  conflicts.account_id,
  conflicts.reason,
  case
    when account.stripe_account_id is null
      or account.stripe_account_id = any(conflicts.stripe_ids)
      then conflicts.stripe_ids
    else array_append(conflicts.stripe_ids, account.stripe_account_id)
  end,
  conflicts.profile_ids
from conflicts
join public.accounts as account on account.id = conflicts.account_id
where conflicts.reason is not null
on conflict (account_id) where status = 'pending'
do update set
  reason = excluded.reason,
  candidate_stripe_account_ids = excluded.candidate_stripe_account_ids,
  source_profile_ids = excluded.source_profile_ids,
  updated_at = now();

-- Clean migration path: exactly one historical Stripe id for the account and
-- no conflict. Promote it to the canonical account without modifying the
-- profile history row that originally owned it.
with clean_legacy as (
  select
    profile.account_id,
    min(profile.stripe_account_id) as stripe_account_id,
    bool_and(profile.stripe_onboarding_complete) as stripe_onboarding_complete,
    bool_and(profile.stripe_charges_enabled) as stripe_charges_enabled,
    bool_and(profile.stripe_payouts_enabled) as stripe_payouts_enabled
  from public.profiles as profile
  where profile.account_id is not null
    and profile.stripe_account_id is not null
  group by profile.account_id
  having count(distinct profile.stripe_account_id) = 1
)
update public.accounts as account
set
  stripe_account_id = clean_legacy.stripe_account_id,
  stripe_connect_state = 'linked',
  stripe_onboarding_complete = clean_legacy.stripe_onboarding_complete,
  stripe_charges_enabled = clean_legacy.stripe_charges_enabled,
  stripe_payouts_enabled = clean_legacy.stripe_payouts_enabled,
  stripe_status_updated_at = coalesce(account.stripe_status_updated_at, now())
from clean_legacy
where clean_legacy.account_id = account.id
  and account.stripe_connect_state <> 'review_required'
  and (
    account.stripe_account_id is null
    or account.stripe_account_id = clean_legacy.stripe_account_id
  )
  and not exists (
    select 1
    from public.accounts as other_account
    where other_account.id <> account.id
      and other_account.stripe_account_id = clean_legacy.stripe_account_id
  );

-- ============================================================
-- 4. ATOMIC SERVER-ONLY BINDING FOR NEW CONNECT ACCOUNTS
-- ============================================================

create or replace function public.klyx_bind_account_stripe_connect(
  p_account_id uuid,
  p_stripe_account_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  canonical public.accounts%rowtype;
  legacy_ids text[];
begin
  if p_stripe_account_id is null
     or btrim(p_stripe_account_id) = ''
     or p_stripe_account_id !~ '^acct_[A-Za-z0-9]+$' then
    raise exception using
      errcode = '23514',
      message = 'KLYX_STRIPE_CONNECT_ACCOUNT_ID_INVALID';
  end if;

  select *
  into canonical
  from public.accounts
  where id = p_account_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'KLYX_CANONICAL_ACCOUNT_NOT_FOUND';
  end if;

  select coalesce(
    array_agg(distinct profile.stripe_account_id order by profile.stripe_account_id)
      filter (where profile.stripe_account_id is not null),
    '{}'::text[]
  )
  into legacy_ids
  from public.profiles as profile
  where profile.account_id = p_account_id;

  if canonical.stripe_connect_state = 'review_required'
     or cardinality(legacy_ids) > 1
     or (
       cardinality(legacy_ids) = 1
       and legacy_ids[1] is distinct from p_stripe_account_id
     )
     or (
       canonical.stripe_account_id is not null
       and canonical.stripe_account_id is distinct from p_stripe_account_id
     )
     or exists (
       select 1
       from public.accounts as other_account
       where other_account.id <> p_account_id
         and other_account.stripe_account_id = p_stripe_account_id
     ) then
    update public.accounts
    set stripe_connect_state = 'review_required'
    where id = p_account_id;

    insert into public.stripe_connect_identity_reviews (
      account_id,
      reason,
      candidate_stripe_account_ids,
      source_profile_ids
    )
    select
      p_account_id,
      'runtime_stripe_identity_conflict',
      case
        when p_stripe_account_id = any(legacy_ids)
          then legacy_ids
        else array_append(legacy_ids, p_stripe_account_id)
      end,
      coalesce(
        array_agg(profile.id order by profile.id)
          filter (where profile.stripe_account_id is not null),
        '{}'::uuid[]
      )
    from public.profiles as profile
    where profile.account_id = p_account_id
    on conflict (account_id) where status = 'pending'
    do update set
      reason = excluded.reason,
      candidate_stripe_account_ids = excluded.candidate_stripe_account_ids,
      source_profile_ids = excluded.source_profile_ids,
      updated_at = now();

    raise exception using
      errcode = '23514',
      message = 'KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED';
  end if;

  update public.accounts
  set
    stripe_account_id = p_stripe_account_id,
    stripe_connect_state = 'linked',
    stripe_status_updated_at = now()
  where id = p_account_id;
end;
$function$;

alter function public.klyx_bind_account_stripe_connect(uuid, text)
  owner to postgres;
revoke all on function public.klyx_bind_account_stripe_connect(uuid, text)
  from public, anon, authenticated;
grant execute on function public.klyx_bind_account_stripe_connect(uuid, text)
  to service_role;

-- ============================================================
-- 5. FINAL FAIL-CLOSED INVARIANTS
-- ============================================================

do $klyx_account_stripe_verify$
begin
  if exists (
    select 1
    from public.accounts
    where stripe_connect_state = 'linked'
      and stripe_account_id is null
  ) then
    raise exception 'KLYX_ACCOUNT_STRIPE_LINKED_WITHOUT_ID';
  end if;

  if exists (
    select stripe_account_id
    from public.accounts
    where stripe_account_id is not null
    group by stripe_account_id
    having count(*) > 1
  ) then
    raise exception 'KLYX_ACCOUNT_STRIPE_DUPLICATE_CANONICAL_ID';
  end if;

  if exists (
    select account.id
    from public.accounts as account
    join public.profiles as profile on profile.account_id = account.id
    where account.stripe_connect_state = 'linked'
      and profile.stripe_account_id is not null
    group by account.id, account.stripe_account_id
    having count(distinct profile.stripe_account_id) > 1
       or bool_or(profile.stripe_account_id is distinct from account.stripe_account_id)
  ) then
    raise exception 'KLYX_ACCOUNT_STRIPE_LEGACY_CONFLICT_NOT_BLOCKED';
  end if;
end;
$klyx_account_stripe_verify$;

commit;

-- ============================================================
-- KLYX STRIPE CONNECT IDENTITY CONFLICT RESOLUTION
--
-- Adds an explicit, service-role-only authority for resolving an already
-- detected account-level Stripe Connect identity conflict after external
-- financial review has selected one canonical Stripe account.
--
-- Safety invariants:
-- - never auto-select a winner;
-- - caller must provide the exact conflict set currently recorded by KLYX;
-- - selected Stripe account must already be historical evidence for the account;
-- - selected Stripe account must not appear on another KLYX account/profile;
-- - stale legacy profile projections are cleared, never silently reassigned;
-- - canonical authority and compatibility cleanup happen atomically;
-- - every resolution is append-only audited;
-- - retries with the same correlation id are idempotent;
-- - no booking/payment/ledger/transfer/refund history is rewritten.
-- ============================================================

begin;

create table if not exists public.account_stripe_connect_identity_resolutions (
  id bigint generated always as identity primary key,
  account_id uuid not null
    references public.accounts(id)
    on delete restrict,
  selected_stripe_account_id text not null,
  expected_conflicting_stripe_account_ids text[] not null,
  previous_source_profile_ids uuid[] not null default '{}'::uuid[],
  selected_source_profile_ids uuid[] not null default '{}'::uuid[],
  cleared_profile_ids uuid[] not null default '{}'::uuid[],
  reason_code text not null,
  correlation_id text not null,
  evidence jsonb not null default '{}'::jsonb,
  resolved_at timestamptz not null default now(),

  constraint account_stripe_connect_identity_resolution_selected_check
    check (selected_stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  constraint account_stripe_connect_identity_resolution_conflicts_check
    check (cardinality(expected_conflicting_stripe_account_ids) >= 2),
  constraint account_stripe_connect_identity_resolution_reason_check
    check (reason_code ~ '^[A-Z][A-Z0-9_.:-]{2,127}$'),
  constraint account_stripe_connect_identity_resolution_correlation_check
    check (length(trim(correlation_id)) between 8 and 200)
);

comment on table public.account_stripe_connect_identity_resolutions is
  'Append-only audit of explicit human/operations resolution of canonical Stripe Connect identity conflicts.';

alter table public.account_stripe_connect_identity_resolutions enable row level security;
revoke all privileges on table public.account_stripe_connect_identity_resolutions
  from public, anon, authenticated;
grant select, insert on table public.account_stripe_connect_identity_resolutions
  to service_role;
grant usage, select on sequence public.account_stripe_connect_identity_resolutions_id_seq
  to service_role;

create index if not exists account_stripe_connect_identity_resolutions_account_idx
  on public.account_stripe_connect_identity_resolutions (account_id, resolved_at desc);

create unique index if not exists account_stripe_connect_identity_resolutions_correlation_unique
  on public.account_stripe_connect_identity_resolutions (account_id, correlation_id);

create or replace function public.klyx_resolve_stripe_connect_identity_conflict(
  p_account_id uuid,
  p_selected_stripe_account_id text,
  p_expected_conflicting_stripe_account_ids text[],
  p_reason_code text,
  p_correlation_id text,
  p_evidence jsonb
)
returns table (
  account_id uuid,
  stripe_account_id text,
  cleared_profile_count integer,
  resolution_id bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity public.account_stripe_connect_identities%rowtype;
  v_existing public.account_stripe_connect_identity_resolutions%rowtype;
  v_selected text := trim(coalesce(p_selected_stripe_account_id, ''));
  v_reason text := upper(trim(coalesce(p_reason_code, '')));
  v_correlation text := trim(coalesce(p_correlation_id, ''));
  v_expected text[];
  v_current_conflicts text[];
  v_historical_ids text[];
  v_selected_source_profile_ids uuid[];
  v_cleared_profile_ids uuid[];
  v_other_account uuid;
  v_other_profile uuid;
  v_resolution_id bigint;
begin
  if p_account_id is null then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_ACCOUNT_REQUIRED';
  end if;

  if v_selected !~ '^acct_[A-Za-z0-9]+$' then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_STRIPE_ACCOUNT_INVALID';
  end if;

  if v_reason !~ '^[A-Z][A-Z0-9_.:-]{2,127}$' then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_REASON_INVALID';
  end if;

  if length(v_correlation) < 8 or length(v_correlation) > 200 then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_CORRELATION_INVALID';
  end if;

  if p_evidence is null or jsonb_typeof(p_evidence) <> 'object' or p_evidence = '{}'::jsonb then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_EVIDENCE_REQUIRED';
  end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_expected
  from (
    select distinct trim(item) as value
    from unnest(coalesce(p_expected_conflicting_stripe_account_ids, '{}'::text[])) as item
    where trim(coalesce(item, '')) <> ''
  ) normalized;

  if cardinality(v_expected) < 2 or not (v_selected = any(v_expected)) then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_EXPECTED_SET_INVALID';
  end if;

  -- Idempotent retry path. A timeout after the original commit may cause the
  -- operator to replay the same command. Same correlation + same immutable
  -- decision returns the original result; correlation reuse with different
  -- semantics fails closed.
  select *
    into v_existing
  from public.account_stripe_connect_identity_resolutions as resolution
  where resolution.account_id = p_account_id
    and resolution.correlation_id = v_correlation
  limit 1;

  if found then
    if v_existing.selected_stripe_account_id <> v_selected
      or v_existing.expected_conflicting_stripe_account_ids is distinct from v_expected
      or v_existing.reason_code <> v_reason then
      raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_CORRELATION_REUSE_MISMATCH';
    end if;

    select *
      into v_identity
    from public.account_stripe_connect_identities
    where account_stripe_connect_identities.account_id = p_account_id;

    if not found
      or v_identity.identity_state <> 'linked'
      or v_identity.stripe_account_id <> v_selected
      or cardinality(v_identity.conflicting_stripe_account_ids) <> 0 then
      raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_IDEMPOTENT_STATE_MISMATCH';
    end if;

    return query
    select
      p_account_id,
      v_selected,
      cardinality(v_existing.cleared_profile_ids),
      v_existing.id;
    return;
  end if;

  select *
    into v_identity
  from public.account_stripe_connect_identities
  where account_stripe_connect_identities.account_id = p_account_id
  for update;

  if not found then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_CANONICAL_MISSING';
  end if;

  if v_identity.identity_state <> 'conflict' or v_identity.stripe_account_id is not null then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_NOT_CONFLICTED';
  end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_current_conflicts
  from (
    select distinct trim(item) as value
    from unnest(v_identity.conflicting_stripe_account_ids) as item
    where trim(coalesce(item, '')) <> ''
  ) normalized;

  if v_current_conflicts is distinct from v_expected then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_CONFLICT_SET_DRIFT';
  end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_historical_ids
  from (
    select distinct trim(profile.stripe_account_id) as value
    from public.profiles as profile
    where profile.account_id = p_account_id
      and profile.stripe_account_id is not null
      and trim(profile.stripe_account_id) <> ''
  ) historical;

  if v_historical_ids is distinct from v_expected then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_HISTORY_DRIFT';
  end if;

  select identity.account_id
    into v_other_account
  from public.account_stripe_connect_identities as identity
  where identity.account_id <> p_account_id
    and identity.stripe_account_id = v_selected
  limit 1;

  if v_other_account is not null then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_SELECTED_ALREADY_CANONICAL';
  end if;

  select profile.id
    into v_other_profile
  from public.profiles as profile
  where profile.account_id is distinct from p_account_id
    and profile.stripe_account_id = v_selected
  limit 1;

  if v_other_profile is not null then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_SELECTED_OTHER_ACCOUNT_HISTORY';
  end if;

  select coalesce(array_agg(profile.id order by profile.id), '{}'::uuid[])
    into v_selected_source_profile_ids
  from public.profiles as profile
  where profile.account_id = p_account_id
    and profile.stripe_account_id = v_selected;

  if cardinality(v_selected_source_profile_ids) < 1 then
    raise exception 'KLYX_CONNECT_IDENTITY_RESOLUTION_SELECTED_NOT_HISTORICAL';
  end if;

  select coalesce(array_agg(profile.id order by profile.id), '{}'::uuid[])
    into v_cleared_profile_ids
  from public.profiles as profile
  where profile.account_id = p_account_id
    and profile.stripe_account_id is not null
    and profile.stripe_account_id <> v_selected;

  update public.profiles as profile
     set stripe_account_id = null,
         stripe_onboarding_complete = false,
         stripe_charges_enabled = false,
         stripe_payouts_enabled = false,
         updated_at = now()
   where profile.account_id = p_account_id
     and profile.stripe_account_id is not null
     and profile.stripe_account_id <> v_selected;

  update public.account_stripe_connect_identities as identity
     set stripe_account_id = v_selected,
         identity_state = 'linked',
         source_profile_ids = v_selected_source_profile_ids,
         conflicting_stripe_account_ids = '{}'::text[],
         updated_at = now()
   where identity.account_id = p_account_id;

  insert into public.account_stripe_connect_identity_resolutions (
    account_id,
    selected_stripe_account_id,
    expected_conflicting_stripe_account_ids,
    previous_source_profile_ids,
    selected_source_profile_ids,
    cleared_profile_ids,
    reason_code,
    correlation_id,
    evidence
  ) values (
    p_account_id,
    v_selected,
    v_expected,
    coalesce(v_identity.source_profile_ids, '{}'::uuid[]),
    v_selected_source_profile_ids,
    v_cleared_profile_ids,
    v_reason,
    v_correlation,
    p_evidence
  )
  returning id into v_resolution_id;

  return query
  select
    p_account_id,
    v_selected,
    cardinality(v_cleared_profile_ids),
    v_resolution_id;
end;
$$;

revoke all on function public.klyx_resolve_stripe_connect_identity_conflict(
  uuid, text, text[], text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.klyx_resolve_stripe_connect_identity_conflict(
  uuid, text, text[], text, text, jsonb
) to service_role;

comment on function public.klyx_resolve_stripe_connect_identity_conflict(
  uuid, text, text[], text, text, jsonb
) is
  'Atomically resolves an existing canonical Connect identity conflict after explicit external review. Exact conflict/history set is mandatory; stale legacy projections are cleared and retries are idempotent by account/correlation id.';

commit;

-- KLYX PLATFORM-HELD MULTI-EXECUTOR GROUP SETTLEMENT — STRIPE TEST ONLY
--
-- Financial subject: existing split_booking_batches (multi-provider mission).
-- One platform charge funds many independent provider settlements.
-- This migration is additive and does not alter the certified single-booking
-- booking_settlements engine or the legacy destination-charge split flow.

begin;

create table if not exists public.platform_held_group_settlements (
  batch_id uuid primary key
    references public.split_booking_batches(id) on delete restrict,
  client_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  payment_confirmation_id uuid not null unique
    references public.split_booking_payment_confirmations(id) on delete restrict,
  payment_plan_hash text not null
    check (char_length(payment_plan_hash) = 64),
  payment_mode text not null default 'platform_held'
    check (payment_mode = 'platform_held'),
  currency text not null
    check (char_length(currency) = 3),
  gross_amount_cents bigint not null check (gross_amount_cents > 0),
  platform_fee_cents bigint not null check (platform_fee_cents >= 0),
  provider_amount_cents bigint not null check (provider_amount_cents > 0),
  transfer_group text not null unique,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text unique,
  state text not null default 'checkout_claimed'
    check (state in (
      'checkout_claimed',
      'checkout_failed',
      'pending_payment',
      'held',
      'released',
      'refund_pending',
      'partially_refunded',
      'refunded',
      'review_required'
    )),
  checkout_attempt_number integer not null default 1
    check (checkout_attempt_number >= 1),
  checkout_claim_token uuid,
  checkout_claimed_at timestamptz,
  claimed_provider_amount_cents bigint not null default 0
    check (claimed_provider_amount_cents >= 0),
  released_provider_amount_cents bigint not null default 0
    check (released_provider_amount_cents >= 0),
  reversed_provider_amount_cents bigint not null default 0
    check (reversed_provider_amount_cents >= 0),
  refund_allocated_gross_cents bigint not null default 0
    check (refund_allocated_gross_cents >= 0),
  held_at timestamptz,
  fully_released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_held_group_parent_economics_check
    check (platform_fee_cents + provider_amount_cents = gross_amount_cents),
  constraint platform_held_group_release_cap_check
    check (
      claimed_provider_amount_cents + released_provider_amount_cents
      <= provider_amount_cents
    ),
  constraint platform_held_group_reversal_cap_check
    check (reversed_provider_amount_cents <= released_provider_amount_cents),
  constraint platform_held_group_refund_cap_check
    check (refund_allocated_gross_cents <= gross_amount_cents)
);

create table if not exists public.platform_held_group_member_settlements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.platform_held_group_settlements(batch_id) on delete restrict,
  provider_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  stripe_account_id text not null,
  currency text not null check (char_length(currency) = 3),
  gross_amount_cents bigint not null check (gross_amount_cents > 0),
  platform_fee_cents bigint not null check (platform_fee_cents >= 0),
  provider_amount_cents bigint not null check (provider_amount_cents > 0),
  booking_ids jsonb not null
    check (jsonb_typeof(booking_ids) = 'array'),
  state text not null default 'pending_payment'
    check (state in (
      'pending_payment',
      'held',
      'release_claimed',
      'released',
      'release_failed',
      'refund_pending',
      'partially_reversed',
      'reversed',
      'refunded',
      'review_required'
    )),
  release_attempt_number integer not null default 0
    check (release_attempt_number >= 0),
  release_claim_token uuid,
  release_claimed_at timestamptz,
  stripe_transfer_id text unique,
  released_at timestamptz,
  reversed_amount_cents bigint not null default 0
    check (reversed_amount_cents >= 0),
  refund_allocated_gross_cents bigint not null default 0
    check (refund_allocated_gross_cents >= 0),
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_held_group_member_unique
    unique (batch_id, provider_profile_id),
  constraint platform_held_group_member_economics_check
    check (platform_fee_cents + provider_amount_cents = gross_amount_cents),
  constraint platform_held_group_member_reversal_cap_check
    check (reversed_amount_cents <= provider_amount_cents),
  constraint platform_held_group_member_refund_cap_check
    check (refund_allocated_gross_cents <= gross_amount_cents)
);

create index if not exists platform_held_group_member_batch_state_idx
  on public.platform_held_group_member_settlements(batch_id, state);

create index if not exists platform_held_group_member_provider_idx
  on public.platform_held_group_member_settlements(provider_profile_id, state);

alter table public.platform_held_group_settlements enable row level security;
alter table public.platform_held_group_member_settlements enable row level security;

revoke all privileges on table public.platform_held_group_settlements
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_group_member_settlements
  from public, anon, authenticated;

grant select, insert, update on table public.platform_held_group_settlements
  to service_role;
grant select, insert, update on table public.platform_held_group_member_settlements
  to service_role;

create or replace function public.klyx_guard_platform_held_group_frozen_truth()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.batch_id is distinct from new.batch_id
     or old.client_profile_id is distinct from new.client_profile_id
     or old.payment_confirmation_id is distinct from new.payment_confirmation_id
     or old.payment_plan_hash is distinct from new.payment_plan_hash
     or old.payment_mode is distinct from new.payment_mode
     or old.currency is distinct from new.currency
     or old.gross_amount_cents is distinct from new.gross_amount_cents
     or old.platform_fee_cents is distinct from new.platform_fee_cents
     or old.provider_amount_cents is distinct from new.provider_amount_cents
     or old.transfer_group is distinct from new.transfer_group then
    raise exception 'KLYX_GROUP_HELD_PARENT_TRUTH_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists platform_held_group_frozen_truth_guard
  on public.platform_held_group_settlements;
create trigger platform_held_group_frozen_truth_guard
before update on public.platform_held_group_settlements
for each row execute function public.klyx_guard_platform_held_group_frozen_truth();

create or replace function public.klyx_guard_platform_held_group_member_frozen_truth()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.batch_id is distinct from new.batch_id
     or old.provider_profile_id is distinct from new.provider_profile_id
     or old.stripe_account_id is distinct from new.stripe_account_id
     or old.currency is distinct from new.currency
     or old.gross_amount_cents is distinct from new.gross_amount_cents
     or old.platform_fee_cents is distinct from new.platform_fee_cents
     or old.provider_amount_cents is distinct from new.provider_amount_cents
     or old.booking_ids is distinct from new.booking_ids then
    raise exception 'KLYX_GROUP_HELD_MEMBER_TRUTH_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists platform_held_group_member_frozen_truth_guard
  on public.platform_held_group_member_settlements;
create trigger platform_held_group_member_frozen_truth_guard
before update on public.platform_held_group_member_settlements
for each row execute function public.klyx_guard_platform_held_group_member_frozen_truth();

create or replace function public.klyx_prepare_platform_held_group_checkout(
  p_batch_id uuid,
  p_client_profile_id uuid,
  p_payment_confirmation_id uuid,
  p_payment_plan_hash text,
  p_currency text,
  p_gross_amount_cents bigint,
  p_platform_fee_cents bigint,
  p_provider_amount_cents bigint,
  p_transfer_group text,
  p_members jsonb,
  p_claim_token uuid
)
returns table (
  action text,
  checkout_session_id text,
  attempt_number integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.split_booking_batches%rowtype;
  v_confirmation record;
  v_existing public.platform_held_group_settlements%rowtype;
  v_member jsonb;
  v_provider_id uuid;
  v_stripe_account_id text;
  v_member_currency text;
  v_member_gross bigint;
  v_member_fee bigint;
  v_member_provider bigint;
  v_booking_ids jsonb;
  v_account_id uuid;
  v_canonical_stripe_id text;
  v_identity_state text;
  v_expected_count integer;
  v_payload_count integer;
  v_actual_gross bigint;
  v_actual_currency_count integer;
  v_sum_gross bigint := 0;
  v_sum_fee bigint := 0;
  v_sum_provider bigint := 0;
  v_member_count integer := 0;
begin
  if p_claim_token is null then
    raise exception 'KLYX_GROUP_HELD_CHECKOUT_CLAIM_REQUIRED';
  end if;
  if coalesce(trim(p_payment_plan_hash), '') !~ '^[A-Fa-f0-9]{64}$' then
    raise exception 'KLYX_GROUP_HELD_PLAN_HASH_INVALID';
  end if;
  if upper(coalesce(trim(p_currency), '')) !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_GROUP_HELD_CURRENCY_INVALID';
  end if;
  if p_gross_amount_cents <= 0
     or p_platform_fee_cents < 0
     or p_provider_amount_cents <= 0
     or p_platform_fee_cents + p_provider_amount_cents <> p_gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_PARENT_ECONOMICS_INVALID';
  end if;
  if coalesce(trim(p_transfer_group), '') <> 'klyx:split_batch:' || p_batch_id::text then
    raise exception 'KLYX_GROUP_HELD_TRANSFER_GROUP_INVALID';
  end if;
  if p_members is null
     or jsonb_typeof(p_members) <> 'array'
     or jsonb_array_length(p_members) < 2 then
    raise exception 'KLYX_GROUP_HELD_MEMBERS_INVALID';
  end if;

  select *
    into v_batch
    from public.split_booking_batches
   where id = p_batch_id
     and client_profile_id = p_client_profile_id
   for update;

  if not found then
    raise exception 'KLYX_GROUP_HELD_BATCH_NOT_FOUND';
  end if;
  if v_batch.status <> 'created' or v_batch.provider_count < 2 then
    raise exception 'KLYX_GROUP_HELD_BATCH_NOT_READY';
  end if;

  if exists (
    select 1
      from public.split_booking_payment_runs r
     where r.batch_id = p_batch_id
  ) then
    raise exception 'KLYX_GROUP_HELD_LEGACY_SPLIT_PAYMENT_CONFLICT';
  end if;

  select
    c.id,
    c.batch_id,
    c.client_profile_id,
    c.payment_plan_hash,
    c.provider_count,
    c.payment_unit_count,
    c.total_amount_cents,
    c.currency,
    c.invalidated_at
    into v_confirmation
    from public.split_booking_payment_confirmations c
   where c.id = p_payment_confirmation_id
     and c.batch_id = p_batch_id
     and c.client_profile_id = p_client_profile_id;

  if not found
     or v_confirmation.invalidated_at is not null
     or v_confirmation.payment_plan_hash <> p_payment_plan_hash
     or v_confirmation.provider_count <> v_batch.provider_count
     or v_confirmation.payment_unit_count <> v_batch.provider_count
     or v_confirmation.total_amount_cents <> p_gross_amount_cents
     or upper(v_confirmation.currency) <> upper(p_currency) then
    raise exception 'KLYX_GROUP_HELD_CONFIRMATION_MISMATCH';
  end if;

  select *
    into v_existing
    from public.platform_held_group_settlements
   where batch_id = p_batch_id
   for update;

  if found then
    if v_existing.payment_confirmation_id <> p_payment_confirmation_id
       or v_existing.payment_plan_hash <> p_payment_plan_hash
       or v_existing.currency <> upper(p_currency)
       or v_existing.gross_amount_cents <> p_gross_amount_cents
       or v_existing.platform_fee_cents <> p_platform_fee_cents
       or v_existing.provider_amount_cents <> p_provider_amount_cents
       or v_existing.transfer_group <> p_transfer_group then
      raise exception 'KLYX_GROUP_HELD_EXISTING_PLAN_CONFLICT';
    end if;

    if v_existing.stripe_checkout_session_id is not null
       and v_existing.state in (
         'pending_payment','held','released','refund_pending',
         'partially_refunded','refunded'
       ) then
      return query
        select 'reuse'::text,
               v_existing.stripe_checkout_session_id,
               v_existing.checkout_attempt_number;
      return;
    end if;

    if v_existing.state = 'review_required' then
      return query
        select 'not_ready'::text,
               v_existing.stripe_checkout_session_id,
               v_existing.checkout_attempt_number;
      return;
    end if;

    if v_existing.state = 'checkout_claimed'
       and v_existing.checkout_claimed_at > now() - interval '2 minutes' then
      return query
        select 'busy'::text, null::text, v_existing.checkout_attempt_number;
      return;
    end if;

    update public.platform_held_group_settlements s
       set state = 'checkout_claimed',
           checkout_attempt_number = s.checkout_attempt_number + 1,
           checkout_claim_token = p_claim_token,
           checkout_claimed_at = now(),
           stripe_checkout_session_id = null,
           updated_at = now()
     where s.batch_id = p_batch_id
     returning * into v_existing;

    return query
      select 'create'::text, null::text, v_existing.checkout_attempt_number;
    return;
  end if;

  for v_member in
    select value from jsonb_array_elements(p_members)
  loop
    v_member_count := v_member_count + 1;

    begin
      v_provider_id := (v_member ->> 'provider_profile_id')::uuid;
    exception when others then
      raise exception 'KLYX_GROUP_HELD_MEMBER_PROVIDER_INVALID';
    end;

    v_stripe_account_id := trim(coalesce(v_member ->> 'stripe_account_id', ''));
    v_member_currency := upper(trim(coalesce(v_member ->> 'currency', '')));
    v_booking_ids := v_member -> 'booking_ids';

    begin
      v_member_gross := (v_member ->> 'gross_amount_cents')::bigint;
      v_member_fee := (v_member ->> 'platform_fee_cents')::bigint;
      v_member_provider := (v_member ->> 'provider_amount_cents')::bigint;
    exception when others then
      raise exception 'KLYX_GROUP_HELD_MEMBER_ECONOMICS_INVALID';
    end;

    if v_stripe_account_id !~ '^acct_[A-Za-z0-9]+$'
       or v_member_currency <> upper(p_currency)
       or v_member_gross <= 0
       or v_member_fee < 0
       or v_member_provider <= 0
       or v_member_fee + v_member_provider <> v_member_gross
       or v_booking_ids is null
       or jsonb_typeof(v_booking_ids) <> 'array'
       or jsonb_array_length(v_booking_ids) = 0 then
      raise exception 'KLYX_GROUP_HELD_MEMBER_INVALID';
    end if;

    if exists (
      select 1
        from public.platform_held_group_member_settlements m
       where m.batch_id = p_batch_id
         and m.provider_profile_id = v_provider_id
    ) then
      raise exception 'KLYX_GROUP_HELD_MEMBER_DUPLICATE';
    end if;

    select p.account_id
      into v_account_id
      from public.profiles p
     where p.id = v_provider_id;

    if v_account_id is null then
      raise exception 'KLYX_GROUP_HELD_MEMBER_ACCOUNT_MISSING';
    end if;

    select i.stripe_account_id, i.identity_state
      into v_canonical_stripe_id, v_identity_state
      from public.account_stripe_connect_identities i
     where i.account_id = v_account_id;

    if not found
       or v_identity_state <> 'linked'
       or v_canonical_stripe_id is distinct from v_stripe_account_id then
      raise exception 'KLYX_GROUP_HELD_MEMBER_STRIPE_IDENTITY_MISMATCH';
    end if;

    select count(*)
      into v_expected_count
      from public.split_booking_batch_items bi
     where bi.batch_id = p_batch_id
       and bi.provider_profile_id = v_provider_id;

    v_payload_count := jsonb_array_length(v_booking_ids);

    if v_expected_count = 0 or v_expected_count <> v_payload_count then
      raise exception 'KLYX_GROUP_HELD_MEMBER_BOOKING_COUNT_MISMATCH';
    end if;

    if exists (
      select 1
        from jsonb_array_elements_text(v_booking_ids) j(booking_id)
       where j.booking_id !~ '^[0-9a-fA-F-]{36}$'
          or not exists (
            select 1
              from public.split_booking_batch_items bi
             where bi.batch_id = p_batch_id
               and bi.provider_profile_id = v_provider_id
               and bi.booking_id = j.booking_id::uuid
          )
    ) then
      raise exception 'KLYX_GROUP_HELD_MEMBER_BOOKING_MISMATCH';
    end if;

    select
      coalesce(sum(coalesce(b.estimated_amount_cents, b.amount_total, 0)), 0),
      count(distinct upper(coalesce(b.currency, '')))
      into v_actual_gross, v_actual_currency_count
      from public.split_booking_batch_items bi
      join public.bookings b on b.id = bi.booking_id
     where bi.batch_id = p_batch_id
       and bi.provider_profile_id = v_provider_id;

    if v_actual_gross <> v_member_gross or v_actual_currency_count <> 1 then
      raise exception 'KLYX_GROUP_HELD_MEMBER_BOOKING_ECONOMICS_MISMATCH';
    end if;

    if exists (
      select 1
        from public.split_booking_batch_items bi
        join public.bookings b on b.id = bi.booking_id
       where bi.batch_id = p_batch_id
         and bi.provider_profile_id = v_provider_id
         and upper(coalesce(b.currency, '')) <> upper(p_currency)
    ) then
      raise exception 'KLYX_GROUP_HELD_MEMBER_BOOKING_CURRENCY_MISMATCH';
    end if;

    v_sum_gross := v_sum_gross + v_member_gross;
    v_sum_fee := v_sum_fee + v_member_fee;
    v_sum_provider := v_sum_provider + v_member_provider;
  end loop;

  if v_member_count <> v_batch.provider_count
     or v_sum_gross <> p_gross_amount_cents
     or v_sum_fee <> p_platform_fee_cents
     or v_sum_provider <> p_provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_AGGREGATE_ECONOMICS_MISMATCH';
  end if;

  insert into public.platform_held_group_settlements (
    batch_id,
    client_profile_id,
    payment_confirmation_id,
    payment_plan_hash,
    currency,
    gross_amount_cents,
    platform_fee_cents,
    provider_amount_cents,
    transfer_group,
    state,
    checkout_attempt_number,
    checkout_claim_token,
    checkout_claimed_at
  ) values (
    p_batch_id,
    p_client_profile_id,
    p_payment_confirmation_id,
    p_payment_plan_hash,
    upper(p_currency),
    p_gross_amount_cents,
    p_platform_fee_cents,
    p_provider_amount_cents,
    p_transfer_group,
    'checkout_claimed',
    1,
    p_claim_token,
    now()
  );

  for v_member in
    select value from jsonb_array_elements(p_members)
  loop
    insert into public.platform_held_group_member_settlements (
      batch_id,
      provider_profile_id,
      stripe_account_id,
      currency,
      gross_amount_cents,
      platform_fee_cents,
      provider_amount_cents,
      booking_ids,
      state
    ) values (
      p_batch_id,
      (v_member ->> 'provider_profile_id')::uuid,
      trim(v_member ->> 'stripe_account_id'),
      upper(trim(v_member ->> 'currency')),
      (v_member ->> 'gross_amount_cents')::bigint,
      (v_member ->> 'platform_fee_cents')::bigint,
      (v_member ->> 'provider_amount_cents')::bigint,
      v_member -> 'booking_ids',
      'pending_payment'
    );
  end loop;

  return query select 'create'::text, null::text, 1;
end;
$$;

create or replace function public.klyx_attach_platform_held_group_checkout(
  p_batch_id uuid,
  p_claim_token uuid,
  p_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if coalesce(trim(p_checkout_session_id), '') !~ '^cs_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_GROUP_HELD_CHECKOUT_SESSION_INVALID';
  end if;

  update public.platform_held_group_settlements
     set state = 'pending_payment',
         stripe_checkout_session_id = p_checkout_session_id,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where batch_id = p_batch_id
     and state = 'checkout_claimed'
     and checkout_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_release_platform_held_group_checkout(
  p_batch_id uuid,
  p_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.platform_held_group_settlements
     set state = 'checkout_failed',
         stripe_checkout_session_id = null,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where batch_id = p_batch_id
     and state = 'pending_payment'
     and stripe_checkout_session_id = p_checkout_session_id
     and stripe_payment_intent_id is null
     and stripe_charge_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_attach_platform_held_group_stripe_truth(
  p_batch_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.platform_held_group_settlements%rowtype;
begin
  if coalesce(trim(p_payment_intent_id), '') !~ '^pi_[A-Za-z0-9_]+$'
     or coalesce(trim(p_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_GROUP_HELD_STRIPE_TRUTH_INVALID';
  end if;

  select *
    into v_settlement
    from public.platform_held_group_settlements
   where batch_id = p_batch_id
   for update;

  if not found
     or v_settlement.stripe_checkout_session_id <> p_checkout_session_id
     or v_settlement.state not in ('pending_payment', 'held') then
    return false;
  end if;

  if v_settlement.stripe_payment_intent_id is not null
     and v_settlement.stripe_payment_intent_id <> p_payment_intent_id then
    raise exception 'KLYX_GROUP_HELD_PAYMENT_INTENT_CONFLICT';
  end if;
  if v_settlement.stripe_charge_id is not null
     and v_settlement.stripe_charge_id <> p_charge_id then
    raise exception 'KLYX_GROUP_HELD_CHARGE_CONFLICT';
  end if;

  update public.platform_held_group_settlements
     set state = 'held',
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
         stripe_charge_id = coalesce(stripe_charge_id, p_charge_id),
         held_at = coalesce(held_at, now()),
         updated_at = now()
   where batch_id = p_batch_id;

  update public.platform_held_group_member_settlements
     set state = case when state = 'pending_payment' then 'held' else state end,
         updated_at = now()
   where batch_id = p_batch_id;

  update public.bookings b
     set payment_status = 'paid',
         payment_mode = 'platform_held',
         payment_attempt_token = null,
         payment_checkout_started_at = null,
         payment_failure_code = null,
         payment_failure_message = null,
         payment_failed_at = null,
         paid_at = coalesce(b.paid_at, now()),
         updated_at = now()
   where exists (
     select 1
       from public.split_booking_batch_items bi
      where bi.batch_id = p_batch_id
        and bi.booking_id = b.id
   )
     and coalesce(b.payment_status, '') <> 'paid';

  update public.split_booking_payment_confirmations
     set consumed_at = coalesce(consumed_at, now()),
         updated_at = now()
   where id = v_settlement.payment_confirmation_id;

  return true;
end;
$$;

create or replace function public.klyx_claim_platform_held_group_member_release(
  p_member_id uuid,
  p_claim_token uuid
)
returns table (
  action text,
  attempt_number integer,
  batch_id uuid,
  provider_profile_id uuid,
  stripe_account_id text,
  provider_amount_cents bigint,
  currency text,
  stripe_charge_id text,
  transfer_group text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_member_settlements%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_account_id uuid;
  v_canonical_stripe_id text;
  v_identity_state text;
  v_risk_allowed boolean;
begin
  if p_claim_token is null then
    raise exception 'KLYX_GROUP_HELD_RELEASE_CLAIM_REQUIRED';
  end if;

  select m.*
    into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_id;

  if not found then
    raise exception 'KLYX_GROUP_HELD_MEMBER_NOT_FOUND';
  end if;

  select p.*
    into v_parent
    from public.platform_held_group_settlements p
   where p.batch_id = v_member.batch_id
   for update;

  select m.*
    into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_id
   for update;

  if v_parent.state in ('refund_pending','partially_refunded','refunded','review_required')
     or v_member.state in ('refund_pending','partially_reversed','reversed','refunded','review_required') then
    return query
      select 'not_ready'::text, v_member.release_attempt_number,
             v_member.batch_id, v_member.provider_profile_id,
             v_member.stripe_account_id, v_member.provider_amount_cents,
             v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_member.state = 'released' and v_member.stripe_transfer_id is not null then
    return query
      select 'released'::text, v_member.release_attempt_number,
             v_member.batch_id, v_member.provider_profile_id,
             v_member.stripe_account_id, v_member.provider_amount_cents,
             v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_member.state = 'release_claimed' then
    if v_member.release_claimed_at > now() - interval '10 minutes' then
      return query
        select 'busy'::text, v_member.release_attempt_number,
               v_member.batch_id, v_member.provider_profile_id,
               v_member.stripe_account_id, v_member.provider_amount_cents,
               v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    else
      return query
        select 'reconcile_required'::text, v_member.release_attempt_number,
               v_member.batch_id, v_member.provider_profile_id,
               v_member.stripe_account_id, v_member.provider_amount_cents,
               v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    end if;
    return;
  end if;

  if v_parent.state not in ('held','released')
     or v_parent.stripe_charge_id is null
     or v_member.state not in ('held','release_failed') then
    return query
      select 'not_ready'::text, v_member.release_attempt_number,
             v_member.batch_id, v_member.provider_profile_id,
             v_member.stripe_account_id, v_member.provider_amount_cents,
             v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if exists (
    select 1
      from public.split_booking_batch_items bi
      join public.bookings b on b.id = bi.booking_id
     where bi.batch_id = v_member.batch_id
       and bi.provider_profile_id = v_member.provider_profile_id
       and (
         coalesce(b.status, '') <> 'completed'
         or coalesce(b.payment_status, '') <> 'paid'
       )
  ) then
    return query
      select 'not_ready'::text, v_member.release_attempt_number,
             v_member.batch_id, v_member.provider_profile_id,
             v_member.stripe_account_id, v_member.provider_amount_cents,
             v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select p.account_id
    into v_account_id
    from public.profiles p
   where p.id = v_member.provider_profile_id;

  if v_account_id is null then
    return query
      select 'not_ready'::text, v_member.release_attempt_number,
             v_member.batch_id, v_member.provider_profile_id,
             v_member.stripe_account_id, v_member.provider_amount_cents,
             v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select i.stripe_account_id, i.identity_state
    into v_canonical_stripe_id, v_identity_state
    from public.account_stripe_connect_identities i
   where i.account_id = v_account_id;

  if not found
     or v_identity_state <> 'linked'
     or v_canonical_stripe_id is distinct from v_member.stripe_account_id then
    return query
      select 'not_ready'::text, v_member.release_attempt_number,
             v_member.batch_id, v_member.provider_profile_id,
             v_member.stripe_account_id, v_member.provider_amount_cents,
             v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select exists (
    select 1
      from public.transaction_risk_decisions d
     where d.account_id = v_account_id
       and d.action = 'settlement_release'
       and d.participant = 'settlement_recipient'
       and d.subject_type = 'split_batch'
       and d.subject_id = v_member.batch_id::text
       and d.decision = 'allow'
       and d.risk_assessed_at >= now() - interval '5 minutes'
  ) into v_risk_allowed;

  if not v_risk_allowed then
    return query
      select 'not_ready'::text, v_member.release_attempt_number,
             v_member.batch_id, v_member.provider_profile_id,
             v_member.stripe_account_id, v_member.provider_amount_cents,
             v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_parent.released_provider_amount_cents
       + v_parent.claimed_provider_amount_cents
       + v_member.provider_amount_cents
       > v_parent.provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_AGGREGATE_RELEASE_CAP_EXCEEDED';
  end if;

  update public.platform_held_group_settlements
     set claimed_provider_amount_cents =
           claimed_provider_amount_cents + v_member.provider_amount_cents,
         updated_at = now()
   where batch_id = v_member.batch_id;

  update public.platform_held_group_member_settlements
     set state = 'release_claimed',
         release_attempt_number = release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_id
   returning * into v_member;

  return query
    select 'create'::text, v_member.release_attempt_number,
           v_member.batch_id, v_member.provider_profile_id,
           v_member.stripe_account_id, v_member.provider_amount_cents,
           v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_member_release(
  p_member_id uuid,
  p_claim_token uuid,
  p_stripe_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_member_settlements%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_remaining integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_GROUP_HELD_TRANSFER_ID_INVALID';
  end if;

  select m.*
    into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_id;

  if not found then return false; end if;

  select p.*
    into v_parent
    from public.platform_held_group_settlements p
   where p.batch_id = v_member.batch_id
   for update;

  select m.*
    into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_id
   for update;

  if v_member.state = 'released'
     and v_member.stripe_transfer_id = p_stripe_transfer_id then
    return true;
  end if;

  if v_member.state <> 'release_claimed'
     or v_member.release_claim_token <> p_claim_token then
    return false;
  end if;

  update public.platform_held_group_member_settlements
     set state = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_id;

  update public.platform_held_group_settlements
     set claimed_provider_amount_cents =
           claimed_provider_amount_cents - v_member.provider_amount_cents,
         released_provider_amount_cents =
           released_provider_amount_cents + v_member.provider_amount_cents,
         updated_at = now()
   where batch_id = v_member.batch_id;

  select count(*)
    into v_remaining
    from public.platform_held_group_member_settlements
   where batch_id = v_member.batch_id
     and state not in ('released','reversed','refunded');

  if v_remaining = 0 then
    update public.platform_held_group_settlements
       set state = 'released',
           fully_released_at = coalesce(fully_released_at, now()),
           updated_at = now()
     where batch_id = v_member.batch_id
       and state = 'held';
  end if;

  return true;
end;
$$;

create or replace function public.klyx_fail_platform_held_group_member_release(
  p_member_id uuid,
  p_claim_token uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_member_settlements%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
begin
  select m.*
    into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_id;

  if not found then return false; end if;

  select p.*
    into v_parent
    from public.platform_held_group_settlements p
   where p.batch_id = v_member.batch_id
   for update;

  select m.*
    into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_id
   for update;

  if v_member.state <> 'release_claimed'
     or v_member.release_claim_token <> p_claim_token then
    return false;
  end if;

  update public.platform_held_group_settlements
     set claimed_provider_amount_cents =
           claimed_provider_amount_cents - v_member.provider_amount_cents,
         updated_at = now()
   where batch_id = v_member.batch_id;

  update public.platform_held_group_member_settlements
     set state = 'release_failed',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_error_code, 'group_member_release_failed'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member release failed.'), 1000),
         updated_at = now()
   where id = p_member_id;

  return true;
end;
$$;

revoke all on function public.klyx_prepare_platform_held_group_checkout(
  uuid,uuid,uuid,text,text,bigint,bigint,bigint,text,jsonb,uuid
) from public,anon,authenticated;
revoke all on function public.klyx_attach_platform_held_group_checkout(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.klyx_release_platform_held_group_checkout(uuid,text)
  from public,anon,authenticated;
revoke all on function public.klyx_attach_platform_held_group_stripe_truth(uuid,text,text,text)
  from public,anon,authenticated;
revoke all on function public.klyx_claim_platform_held_group_member_release(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_release(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.klyx_fail_platform_held_group_member_release(uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function public.klyx_prepare_platform_held_group_checkout(
  uuid,uuid,uuid,text,text,bigint,bigint,bigint,text,jsonb,uuid
) to service_role;
grant execute on function public.klyx_attach_platform_held_group_checkout(uuid,uuid,text)
  to service_role;
grant execute on function public.klyx_release_platform_held_group_checkout(uuid,text)
  to service_role;
grant execute on function public.klyx_attach_platform_held_group_stripe_truth(uuid,text,text,text)
  to service_role;
grant execute on function public.klyx_claim_platform_held_group_member_release(uuid,uuid)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_release(uuid,uuid,text)
  to service_role;
grant execute on function public.klyx_fail_platform_held_group_member_release(uuid,uuid,text,text)
  to service_role;

comment on table public.platform_held_group_settlements is
  'TEST-only one-charge multi-executor Platform-Held settlement parent. Immutable gross/commission/provider totals cap all member releases.';
comment on table public.platform_held_group_member_settlements is
  'TEST-only executor settlement ledger. Each executor releases/reverses independently from the shared group charge.';

commit;

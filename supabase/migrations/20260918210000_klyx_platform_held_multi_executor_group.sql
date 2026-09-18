-- KLYX PLATFORM-HELD MULTI-EXECUTOR GROUP SETTLEMENT — TEST-ONLY CONTROL PLANE
--
-- Reuses the canonical split booking run/unit model:
--   one split_booking_payment_run = one captured platform charge;
--   one split_booking_payment_unit = one immutable executor settlement.
--
-- Existing connect_destination_split remains unchanged. This migration only
-- adds an explicit platform_held_split topology and server-only financial
-- control fields/RPCs. Stripe side effects remain in server code.

begin;

alter table public.bookings
  drop constraint if exists bookings_payment_mode_check;

alter table public.bookings
  add constraint bookings_payment_mode_check
  check (
    payment_mode is null
    or payment_mode in (
      'connect_destination',
      'connect_destination_group',
      'connect_destination_split',
      'platform_test_only',
      'platform_held',
      'platform_held_split'
    )
  );

drop index if exists public.bookings_stripe_checkout_session_unique;
create unique index bookings_stripe_checkout_session_unique
  on public.bookings(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null
    and coalesce(payment_mode, '') not in (
      'connect_destination_split',
      'platform_held_split'
    );

drop index if exists public.bookings_stripe_refund_id_unique;
create unique index bookings_stripe_refund_id_unique
  on public.bookings(stripe_refund_id)
  where stripe_refund_id is not null
    and coalesce(payment_mode, '') not in (
      'connect_destination_split',
      'platform_held_split'
    );

alter table public.split_booking_payment_runs
  add column if not exists payment_mode text not null default 'connect_destination_split',
  add column if not exists settlement_state text not null default 'legacy',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists checkout_url text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_charge_id text,
  add column if not exists transfer_group text,
  add column if not exists platform_fee_amount bigint,
  add column if not exists provider_amount_cents bigint,
  add column if not exists refunded_amount_cents bigint not null default 0,
  add column if not exists checkout_attempt_number integer not null default 0,
  add column if not exists checkout_claim_token uuid,
  add column if not exists checkout_claimed_at timestamptz,
  add column if not exists held_at timestamptz,
  add column if not exists settlement_updated_at timestamptz;

alter table public.split_booking_payment_runs
  drop constraint if exists split_booking_payment_runs_payment_mode_check;
alter table public.split_booking_payment_runs
  add constraint split_booking_payment_runs_payment_mode_check
  check (payment_mode in ('connect_destination_split', 'platform_held_split'));

alter table public.split_booking_payment_runs
  drop constraint if exists split_booking_payment_runs_settlement_state_check;
alter table public.split_booking_payment_runs
  add constraint split_booking_payment_runs_settlement_state_check
  check (
    settlement_state in (
      'legacy',
      'pending_payment',
      'held',
      'partially_released',
      'released',
      'refund_pending',
      'partially_refunded',
      'refunded',
      'human_review'
    )
  );

alter table public.split_booking_payment_runs
  drop constraint if exists split_booking_payment_runs_held_economics_check;
alter table public.split_booking_payment_runs
  add constraint split_booking_payment_runs_held_economics_check
  check (
    payment_mode <> 'platform_held_split'
    or (
      platform_fee_amount is not null
      and provider_amount_cents is not null
      and platform_fee_amount >= 0
      and provider_amount_cents >= 0
      and platform_fee_amount + provider_amount_cents = total_amount_cents
      and refunded_amount_cents >= 0
      and refunded_amount_cents <= total_amount_cents
    )
  );

create unique index if not exists split_booking_held_run_checkout_uidx
  on public.split_booking_payment_runs(stripe_checkout_session_id)
  where payment_mode = 'platform_held_split'
    and stripe_checkout_session_id is not null;

create unique index if not exists split_booking_held_run_intent_uidx
  on public.split_booking_payment_runs(stripe_payment_intent_id)
  where payment_mode = 'platform_held_split'
    and stripe_payment_intent_id is not null;

create unique index if not exists split_booking_held_run_transfer_group_uidx
  on public.split_booking_payment_runs(transfer_group)
  where payment_mode = 'platform_held_split'
    and transfer_group is not null;

alter table public.split_booking_payment_units
  add column if not exists settlement_state text not null default 'legacy',
  add column if not exists release_attempt_number integer not null default 0,
  add column if not exists release_claim_token uuid,
  add column if not exists release_claimed_at timestamptz,
  add column if not exists release_amount_cents bigint not null default 0,
  add column if not exists released_amount_cents bigint not null default 0,
  add column if not exists provider_refund_liability_cents bigint not null default 0,
  add column if not exists reversed_amount_cents bigint not null default 0,
  add column if not exists stripe_transfer_id text,
  add column if not exists released_at timestamptz,
  add column if not exists settlement_reason_codes jsonb not null default '[]'::jsonb,
  add column if not exists settlement_last_error text;

alter table public.split_booking_payment_units
  drop constraint if exists split_booking_payment_units_settlement_state_check;
alter table public.split_booking_payment_units
  add constraint split_booking_payment_units_settlement_state_check
  check (
    settlement_state in (
      'legacy',
      'pending_payment',
      'held',
      'release_claimed',
      'released',
      'release_failed',
      'human_review'
    )
  );

alter table public.split_booking_payment_units
  drop constraint if exists split_booking_payment_units_settlement_amounts_check;
alter table public.split_booking_payment_units
  add constraint split_booking_payment_units_settlement_amounts_check
  check (
    release_amount_cents >= 0
    and released_amount_cents >= 0
    and provider_refund_liability_cents >= 0
    and reversed_amount_cents >= 0
    and released_amount_cents <= provider_amount_cents
    and provider_refund_liability_cents <= provider_amount_cents
    and reversed_amount_cents <= released_amount_cents
  );

create unique index if not exists split_booking_held_unit_transfer_uidx
  on public.split_booking_payment_units(stripe_transfer_id)
  where stripe_transfer_id is not null;

create table if not exists public.split_booking_held_refunds (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.split_booking_payment_runs(id) on delete restrict,
  refund_key text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (char_length(currency) = 3),
  stripe_refund_id text,
  status text not null default 'planned'
    check (status in ('planned','processing','succeeded','failed','human_review')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, refund_key)
);

create unique index if not exists split_booking_held_refunds_stripe_uidx
  on public.split_booking_held_refunds(stripe_refund_id)
  where stripe_refund_id is not null;

create table if not exists public.split_booking_held_refund_allocations (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.split_booking_held_refunds(id) on delete restrict,
  run_id uuid not null references public.split_booking_payment_runs(id) on delete restrict,
  unit_id uuid not null references public.split_booking_payment_units(id) on delete restrict,
  gross_refund_amount_cents bigint not null check (gross_refund_amount_cents >= 0),
  provider_liability_delta_cents bigint not null check (provider_liability_delta_cents >= 0),
  reversal_required_cents bigint not null default 0 check (reversal_required_cents >= 0),
  reversal_completed_cents bigint not null default 0 check (reversal_completed_cents >= 0),
  stripe_reversal_id text,
  status text not null default 'planned'
    check (status in ('planned','reversed','succeeded','failed','human_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(refund_id, unit_id)
);

create unique index if not exists split_booking_held_refund_alloc_reversal_uidx
  on public.split_booking_held_refund_allocations(stripe_reversal_id)
  where stripe_reversal_id is not null;

alter table public.split_booking_held_refunds enable row level security;
alter table public.split_booking_held_refund_allocations enable row level security;

revoke all privileges on table public.split_booking_held_refunds
  from public, anon, authenticated;
revoke all privileges on table public.split_booking_held_refund_allocations
  from public, anon, authenticated;
grant select, insert, update, delete on table public.split_booking_held_refunds
  to service_role;
grant select, insert, update, delete on table public.split_booking_held_refund_allocations
  to service_role;

create or replace function public.klyx_claim_split_held_checkout(
  p_run_id uuid,
  p_client_profile_id uuid,
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
  v_run public.split_booking_payment_runs%rowtype;
begin
  if p_claim_token is null then
    raise exception 'KLYX_SPLIT_HELD_CHECKOUT_CLAIM_TOKEN_REQUIRED';
  end if;

  select * into v_run
    from public.split_booking_payment_runs
   where id = p_run_id
   for update;

  if not found
     or v_run.client_profile_id <> p_client_profile_id
     or v_run.payment_mode <> 'platform_held_split' then
    return query select 'not_ready'::text, null::text, 0;
    return;
  end if;

  if v_run.status in ('paid','partially_refunded','refunded') then
    return query select 'paid'::text, v_run.stripe_checkout_session_id, v_run.checkout_attempt_number;
    return;
  end if;

  if v_run.checkout_claim_token is not null
     and v_run.checkout_claimed_at > now() - interval '10 minutes' then
    return query select 'busy'::text, v_run.stripe_checkout_session_id, v_run.checkout_attempt_number;
    return;
  end if;

  if v_run.stripe_checkout_session_id is not null then
    return query select 'reuse'::text, v_run.stripe_checkout_session_id, v_run.checkout_attempt_number;
    return;
  end if;

  update public.split_booking_payment_runs
     set checkout_attempt_number = checkout_attempt_number + 1,
         checkout_claim_token = p_claim_token,
         checkout_claimed_at = now(),
         settlement_state = 'pending_payment',
         settlement_updated_at = now(),
         updated_at = now()
   where id = p_run_id
   returning * into v_run;

  return query select 'create'::text, null::text, v_run.checkout_attempt_number;
end;
$$;

create or replace function public.klyx_attach_split_held_checkout(
  p_run_id uuid,
  p_client_profile_id uuid,
  p_claim_token uuid,
  p_checkout_session_id text,
  p_checkout_url text,
  p_transfer_group text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.split_booking_payment_runs%rowtype;
  v_unit_count integer;
  v_gross bigint;
  v_fee bigint;
  v_provider bigint;
begin
  if coalesce(trim(p_checkout_session_id),'') !~ '^cs_[A-Za-z0-9_]+$'
     or coalesce(trim(p_transfer_group),'') = '' then
    raise exception 'KLYX_SPLIT_HELD_CHECKOUT_TRUTH_INVALID';
  end if;

  select * into v_run
    from public.split_booking_payment_runs
   where id = p_run_id
   for update;

  if not found
     or v_run.client_profile_id <> p_client_profile_id
     or v_run.payment_mode <> 'platform_held_split'
     or v_run.checkout_claim_token is distinct from p_claim_token then
    return false;
  end if;

  select
    count(*),
    coalesce(sum(amount_cents),0),
    coalesce(sum(application_fee_amount),0),
    coalesce(sum(provider_amount_cents),0)
  into v_unit_count, v_gross, v_fee, v_provider
  from public.split_booking_payment_units
  where run_id = p_run_id;

  if v_unit_count <> v_run.payment_unit_count
     or v_unit_count < 2
     or v_gross <> v_run.total_amount_cents
     or v_fee + v_provider <> v_gross then
    raise exception 'KLYX_SPLIT_HELD_FROZEN_ALLOCATION_MISMATCH';
  end if;

  update public.split_booking_payment_runs
     set stripe_checkout_session_id = p_checkout_session_id,
         checkout_url = p_checkout_url,
         transfer_group = p_transfer_group,
         platform_fee_amount = v_fee,
         provider_amount_cents = v_provider,
         settlement_state = 'pending_payment',
         checkout_claim_token = null,
         checkout_claimed_at = null,
         settlement_updated_at = now(),
         status = 'ready',
         ready_at = coalesce(ready_at, now()),
         updated_at = now()
   where id = p_run_id;

  update public.split_booking_payment_units
     set settlement_state = 'pending_payment',
         settlement_last_error = null,
         settlement_reason_codes = '[]'::jsonb,
         updated_at = now()
   where run_id = p_run_id;

  update public.split_booking_payment_confirmations
     set consumed_at = coalesce(consumed_at, now()),
         updated_at = now()
   where id = v_run.payment_confirmation_id;

  return true;
end;
$$;

create or replace function public.klyx_release_split_held_checkout(
  p_run_id uuid,
  p_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  update public.split_booking_payment_runs
     set stripe_checkout_session_id = null,
         checkout_url = null,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         settlement_state = 'pending_payment',
         settlement_updated_at = now(),
         updated_at = now()
   where id = p_run_id
     and payment_mode = 'platform_held_split'
     and stripe_checkout_session_id = p_checkout_session_id
     and status not in ('paid','partially_refunded','refunded');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_split_held_paid(
  p_run_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  if coalesce(trim(p_payment_intent_id),'') !~ '^pi_[A-Za-z0-9_]+$'
     or coalesce(trim(p_charge_id),'') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_SPLIT_HELD_PAYMENT_TRUTH_INVALID';
  end if;

  update public.split_booking_payment_runs
     set status = 'paid',
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
         stripe_charge_id = coalesce(stripe_charge_id, p_charge_id),
         settlement_state = case
           when settlement_state = 'pending_payment' then 'held'
           else settlement_state
         end,
         held_at = coalesce(held_at, now()),
         paid_at = coalesce(paid_at, now()),
         checkout_url = null,
         settlement_updated_at = now(),
         updated_at = now()
   where id = p_run_id
     and payment_mode = 'platform_held_split'
     and stripe_checkout_session_id = p_checkout_session_id
     and (stripe_payment_intent_id is null or stripe_payment_intent_id = p_payment_intent_id)
     and (stripe_charge_id is null or stripe_charge_id = p_charge_id);

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return false;
  end if;

  update public.split_booking_payment_units
     set status = 'paid',
         settlement_state = case
           when settlement_state = 'pending_payment' then 'held'
           else settlement_state
         end,
         paid_at = coalesce(paid_at, now()),
         updated_at = now()
   where run_id = p_run_id;

  return true;
end;
$$;

create or replace function public.klyx_mark_split_executor_human_review(
  p_unit_id uuid,
  p_reason_codes text[],
  p_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  update public.split_booking_payment_units
     set settlement_state = 'human_review',
         settlement_reason_codes = to_jsonb(coalesce(p_reason_codes,array[]::text[])),
         settlement_last_error = left(coalesce(p_message,'human_review'),1000),
         release_claim_token = null,
         release_claimed_at = null,
         updated_at = now()
   where id = p_unit_id
     and settlement_state <> 'released';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_claim_split_executor_release(
  p_unit_id uuid,
  p_claim_token uuid
)
returns table (
  action text,
  attempt_number integer,
  run_id uuid,
  provider_profile_id uuid,
  stripe_account_id text,
  release_amount_cents bigint,
  currency text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  transfer_group text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit public.split_booking_payment_units%rowtype;
  v_run public.split_booking_payment_runs%rowtype;
  v_profile_account_id uuid;
  v_profile_owner_user_id uuid;
  v_account_id uuid;
  v_identity_stripe_id text;
  v_identity_state text;
  v_release bigint;
  v_other_committed bigint;
  v_all_complete boolean;
  v_risk_allowed boolean;
begin
  if p_claim_token is null then
    raise exception 'KLYX_SPLIT_HELD_RELEASE_CLAIM_TOKEN_REQUIRED';
  end if;

  select * into v_unit
    from public.split_booking_payment_units
   where id = p_unit_id;

  if not found then
    return query select 'not_ready'::text,0,null::uuid,null::uuid,null::text,0::bigint,null::text,null::text,null::text,null::text;
    return;
  end if;

  select * into v_run
    from public.split_booking_payment_runs
   where id = v_unit.run_id
   for update;

  select * into v_unit
    from public.split_booking_payment_units
   where id = p_unit_id
   for update;

  if v_run.payment_mode <> 'platform_held_split'
     or v_run.status not in ('paid','partially_refunded')
     or v_run.settlement_state in ('pending_payment','refund_pending','refunded','human_review')
     or v_run.stripe_payment_intent_id is null
     or v_run.stripe_charge_id is null
     or v_run.transfer_group is null then
    return query select 'not_ready'::text,v_unit.release_attempt_number,v_run.id,v_unit.provider_profile_id,
      v_unit.stripe_account_id,0::bigint,v_unit.currency,v_run.stripe_payment_intent_id,
      v_run.stripe_charge_id,v_run.transfer_group;
    return;
  end if;

  if v_unit.settlement_state = 'released' then
    return query select 'released'::text,v_unit.release_attempt_number,v_run.id,v_unit.provider_profile_id,
      v_unit.stripe_account_id,v_unit.released_amount_cents,v_unit.currency,v_run.stripe_payment_intent_id,
      v_run.stripe_charge_id,v_run.transfer_group;
    return;
  end if;

  if v_unit.settlement_state = 'human_review' then
    return query select 'not_ready'::text,v_unit.release_attempt_number,v_run.id,v_unit.provider_profile_id,
      v_unit.stripe_account_id,0::bigint,v_unit.currency,v_run.stripe_payment_intent_id,
      v_run.stripe_charge_id,v_run.transfer_group;
    return;
  end if;

  if v_unit.settlement_state = 'release_claimed'
     and v_unit.release_claimed_at > now() - interval '10 minutes' then
    return query select 'busy'::text,v_unit.release_attempt_number,v_run.id,v_unit.provider_profile_id,
      v_unit.stripe_account_id,v_unit.release_amount_cents,v_unit.currency,v_run.stripe_payment_intent_id,
      v_run.stripe_charge_id,v_run.transfer_group;
    return;
  end if;

  select not exists (
    select 1
      from jsonb_array_elements_text(v_unit.booking_ids) as item(booking_id)
      left join public.bookings b on b.id = item.booking_id::uuid
     where b.id is null or b.status <> 'completed'
  ) into v_all_complete;

  if not v_all_complete then
    return query select 'not_ready'::text,v_unit.release_attempt_number,v_run.id,v_unit.provider_profile_id,
      v_unit.stripe_account_id,0::bigint,v_unit.currency,v_run.stripe_payment_intent_id,
      v_run.stripe_charge_id,v_run.transfer_group;
    return;
  end if;

  select account_id, owner_user_id
    into v_profile_account_id, v_profile_owner_user_id
    from public.profiles
   where id = v_unit.provider_profile_id;

  v_account_id := v_profile_account_id;
  if v_account_id is null then
    select id into v_account_id
      from public.accounts
     where auth_user_id = v_profile_owner_user_id
     limit 1;
  end if;

  if v_account_id is null then
    return query select 'not_ready'::text,v_unit.release_attempt_number,v_run.id,v_unit.provider_profile_id,
      v_unit.stripe_account_id,0::bigint,v_unit.currency,v_run.stripe_payment_intent_id,
      v_run.stripe_charge_id,v_run.transfer_group;
    return;
  end if;

  select stripe_account_id, identity_state
    into v_identity_stripe_id, v_identity_state
    from public.account_stripe_connect_identities
   where account_id = v_account_id;

  if not found
     or v_identity_state <> 'linked'
     or v_identity_stripe_id is distinct from v_unit.stripe_account_id then
    return query select 'not_ready'::text,v_unit.release_attempt_number,v_run.id,v_unit.provider_profile_id,
      v_unit.stripe_account_id,0::bigint,v_unit.currency,v_run.stripe_payment_intent_id,
      v_run.stripe_charge_id,v_run.transfer_group;
    return;
  end if;

  select exists (
    select 1
      from public.transaction_risk_decisions d
     where d.account_id = v_account_id
       and d.action = 'settlement_release'
       and d.participant = 'settlement_recipient'
       and d.subject_type = 'split_batch'
       and d.subject_id = p_unit_id::text
       and d.decision = 'allow'
       and d.risk_assessed_at >= now() - interval '5 minutes'
  ) into v_risk_allowed;

  if not v_risk_allowed then
    return query select 'not_ready'::text,v_unit.release_attempt_number,v_run.id,v_unit.provider_profile_id,
      v_unit.stripe_account_id,0::bigint,v_unit.currency,v_run.stripe_payment_intent_id,
      v_run.stripe_charge_id,v_run.transfer_group;
    return;
  end if;

  v_release := greatest(v_unit.provider_amount_cents - v_unit.provider_refund_liability_cents, 0);

  if v_release <= 0 then
    return query select 'not_ready'::text,v_unit.release_attempt_number,v_run.id,v_unit.provider_profile_id,
      v_unit.stripe_account_id,0::bigint,v_unit.currency,v_run.stripe_payment_intent_id,
      v_run.stripe_charge_id,v_run.transfer_group;
    return;
  end if;

  select coalesce(sum(
    released_amount_cents +
    case
      when settlement_state = 'release_claimed' then release_amount_cents
      else 0
    end
  ),0)
  into v_other_committed
  from public.split_booking_payment_units
  where run_id = v_run.id
    and id <> p_unit_id;

  if v_other_committed + v_release > v_run.provider_amount_cents
     or v_other_committed + v_release > v_run.total_amount_cents then
    raise exception 'KLYX_SPLIT_HELD_AGGREGATE_OVER_TRANSFER_GUARD';
  end if;

  update public.split_booking_payment_units
     set settlement_state = 'release_claimed',
         release_attempt_number = release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         release_amount_cents = v_release,
         settlement_last_error = null,
         updated_at = now()
   where id = p_unit_id
   returning * into v_unit;

  return query select 'create'::text,v_unit.release_attempt_number,v_run.id,v_unit.provider_profile_id,
    v_unit.stripe_account_id,v_unit.release_amount_cents,v_unit.currency,v_run.stripe_payment_intent_id,
    v_run.stripe_charge_id,v_run.transfer_group;
end;
$$;

create or replace function public.klyx_finalize_split_executor_release(
  p_unit_id uuid,
  p_claim_token uuid,
  p_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit public.split_booking_payment_units%rowtype;
  v_remaining integer;
begin
  if coalesce(trim(p_transfer_id),'') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_SPLIT_HELD_TRANSFER_ID_INVALID';
  end if;

  update public.split_booking_payment_units
     set settlement_state = 'released',
         stripe_transfer_id = coalesce(stripe_transfer_id,p_transfer_id),
         released_amount_cents = release_amount_cents,
         released_at = coalesce(released_at,now()),
         release_claim_token = null,
         release_claimed_at = null,
         settlement_last_error = null,
         updated_at = now()
   where id = p_unit_id
     and settlement_state = 'release_claimed'
     and release_claim_token = p_claim_token
     and (stripe_transfer_id is null or stripe_transfer_id = p_transfer_id)
   returning * into v_unit;

  if not found then
    return false;
  end if;

  select count(*) into v_remaining
    from public.split_booking_payment_units
   where run_id = v_unit.run_id
     and greatest(provider_amount_cents - provider_refund_liability_cents,0) > 0
     and settlement_state <> 'released';

  update public.split_booking_payment_runs
     set settlement_state = case when v_remaining = 0 then 'released' else 'partially_released' end,
         settlement_updated_at = now(),
         updated_at = now()
   where id = v_unit.run_id
     and settlement_state <> 'refund_pending';

  return true;
end;
$$;

create or replace function public.klyx_fail_split_executor_release(
  p_unit_id uuid,
  p_claim_token uuid,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  update public.split_booking_payment_units
     set settlement_state = 'release_failed',
         release_claim_token = null,
         release_claimed_at = null,
         settlement_last_error = left(coalesce(p_error,'release_failed'),1000),
         updated_at = now()
   where id = p_unit_id
     and settlement_state = 'release_claimed'
     and release_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_plan_split_held_refund(
  p_run_id uuid,
  p_refund_key text,
  p_amount_cents bigint
)
returns table (
  refund_id uuid,
  unit_id uuid,
  gross_refund_amount_cents bigint,
  provider_liability_delta_cents bigint,
  reversal_required_cents bigint,
  stripe_transfer_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.split_booking_payment_runs%rowtype;
  v_refund public.split_booking_held_refunds%rowtype;
  v_unit public.split_booking_payment_units%rowtype;
  v_count integer;
  v_index integer := 0;
  v_remaining bigint;
  v_alloc bigint;
  v_new_unit_refunded bigint;
  v_target_liability bigint;
  v_liability_delta bigint;
  v_reversal_required bigint;
begin
  if coalesce(trim(p_refund_key),'') = '' or p_amount_cents <= 0 then
    raise exception 'KLYX_SPLIT_HELD_REFUND_INPUT_INVALID';
  end if;

  select * into v_run
    from public.split_booking_payment_runs
   where id = p_run_id
   for update;

  if not found
     or v_run.payment_mode <> 'platform_held_split'
     or v_run.status not in ('paid','partially_refunded')
     or v_run.stripe_payment_intent_id is null
     or v_run.stripe_charge_id is null then
    raise exception 'KLYX_SPLIT_HELD_REFUND_RUN_NOT_READY';
  end if;

  select * into v_refund
    from public.split_booking_held_refunds
   where run_id = p_run_id and refund_key = p_refund_key;

  if found then
    return query
      select
        a.refund_id,
        a.unit_id,
        a.gross_refund_amount_cents,
        a.provider_liability_delta_cents,
        greatest(a.reversal_required_cents - a.reversal_completed_cents,0),
        u.stripe_transfer_id
      from public.split_booking_held_refund_allocations a
      join public.split_booking_payment_units u on u.id = a.unit_id
      where a.refund_id = v_refund.id
      order by u.provider_profile_id, u.id;
    return;
  end if;

  if v_run.settlement_state = 'refund_pending'
     or v_run.settlement_state = 'human_review'
     or exists (
       select 1 from public.split_booking_payment_units
        where run_id = p_run_id and settlement_state = 'release_claimed'
     ) then
    raise exception 'KLYX_SPLIT_HELD_REFUND_RELEASE_RACE';
  end if;

  if v_run.refunded_amount_cents + p_amount_cents > v_run.total_amount_cents then
    raise exception 'KLYX_SPLIT_HELD_REFUND_EXCEEDS_CAPTURE';
  end if;

  insert into public.split_booking_held_refunds (
    run_id, refund_key, amount_cents, currency, status
  ) values (
    p_run_id, p_refund_key, p_amount_cents, v_run.currency, 'planned'
  )
  returning * into v_refund;

  select count(*) into v_count
    from public.split_booking_payment_units
   where run_id = p_run_id;

  v_remaining := p_amount_cents;

  for v_unit in
    select * from public.split_booking_payment_units
     where run_id = p_run_id
     order by provider_profile_id, id
     for update
  loop
    v_index := v_index + 1;

    if v_index = v_count then
      v_alloc := v_remaining;
    else
      v_alloc := floor(
        p_amount_cents::numeric * v_unit.amount_cents::numeric /
        v_run.total_amount_cents::numeric
      )::bigint;
      v_alloc := least(v_alloc, v_remaining);
    end if;

    v_remaining := v_remaining - v_alloc;
    v_new_unit_refunded := v_unit.refunded_amount_cents + v_alloc;

    if v_new_unit_refunded > v_unit.amount_cents then
      raise exception 'KLYX_SPLIT_HELD_UNIT_REFUND_EXCEEDS_GROSS';
    end if;

    if v_new_unit_refunded = v_unit.amount_cents then
      v_target_liability := v_unit.provider_amount_cents;
    else
      v_target_liability := floor(
        v_unit.provider_amount_cents::numeric *
        v_new_unit_refunded::numeric /
        v_unit.amount_cents::numeric
      )::bigint;
    end if;

    v_liability_delta := greatest(
      v_target_liability - v_unit.provider_refund_liability_cents,
      0
    );

    v_reversal_required := greatest(
      least(v_target_liability, v_unit.released_amount_cents)
      - v_unit.reversed_amount_cents,
      0
    );

    insert into public.split_booking_held_refund_allocations (
      refund_id,
      run_id,
      unit_id,
      gross_refund_amount_cents,
      provider_liability_delta_cents,
      reversal_required_cents
    ) values (
      v_refund.id,
      p_run_id,
      v_unit.id,
      v_alloc,
      v_liability_delta,
      v_reversal_required
    );

    update public.split_booking_payment_units
       set refunded_amount_cents = v_new_unit_refunded,
           provider_refund_liability_cents = v_target_liability,
           updated_at = now()
     where id = v_unit.id;
  end loop;

  if v_remaining <> 0 then
    raise exception 'KLYX_SPLIT_HELD_REFUND_ALLOCATION_REMAINDER';
  end if;

  update public.split_booking_payment_runs
     set refunded_amount_cents = refunded_amount_cents + p_amount_cents,
         settlement_state = 'refund_pending',
         settlement_updated_at = now(),
         updated_at = now()
   where id = p_run_id;

  return query
    select
      a.refund_id,
      a.unit_id,
      a.gross_refund_amount_cents,
      a.provider_liability_delta_cents,
      a.reversal_required_cents,
      u.stripe_transfer_id
    from public.split_booking_held_refund_allocations a
    join public.split_booking_payment_units u on u.id = a.unit_id
    where a.refund_id = v_refund.id
    order by u.provider_profile_id, u.id;
end;
$$;

create or replace function public.klyx_finalize_split_executor_reversal(
  p_refund_id uuid,
  p_unit_id uuid,
  p_transfer_id text,
  p_reversal_id text,
  p_amount_cents bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allocation public.split_booking_held_refund_allocations%rowtype;
  v_updated integer;
begin
  if p_amount_cents <= 0
     or coalesce(trim(p_transfer_id),'') !~ '^tr_[A-Za-z0-9]+$'
     or coalesce(trim(p_reversal_id),'') !~ '^trr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_SPLIT_HELD_REVERSAL_INPUT_INVALID';
  end if;

  select * into v_allocation
    from public.split_booking_held_refund_allocations
   where refund_id = p_refund_id and unit_id = p_unit_id
   for update;

  if not found
     or v_allocation.reversal_required_cents <> p_amount_cents
     or v_allocation.reversal_completed_cents not in (0,p_amount_cents) then
    return false;
  end if;

  update public.split_booking_held_refund_allocations
     set reversal_completed_cents = p_amount_cents,
         stripe_reversal_id = coalesce(stripe_reversal_id,p_reversal_id),
         status = 'reversed',
         updated_at = now()
   where id = v_allocation.id
     and (stripe_reversal_id is null or stripe_reversal_id = p_reversal_id);

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return false;
  end if;

  update public.split_booking_payment_units
     set reversed_amount_cents = reversed_amount_cents + p_amount_cents,
         updated_at = now()
   where id = p_unit_id
     and stripe_transfer_id = p_transfer_id
     and reversed_amount_cents + p_amount_cents <= released_amount_cents;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_split_held_refund_reversals_ready(
  p_refund_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
      from public.split_booking_held_refund_allocations
     where refund_id = p_refund_id
       and reversal_completed_cents < reversal_required_cents
  );
$$;

create or replace function public.klyx_finalize_split_held_refund(
  p_refund_id uuid,
  p_stripe_refund_id text,
  p_status text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.split_booking_held_refunds%rowtype;
  v_run public.split_booking_payment_runs%rowtype;
  v_status text;
begin
  if p_status not in ('processing','succeeded','failed') then
    raise exception 'KLYX_SPLIT_HELD_REFUND_STATUS_INVALID';
  end if;

  select * into v_refund
    from public.split_booking_held_refunds
   where id = p_refund_id
   for update;

  if not found then
    return false;
  end if;

  select * into v_run
    from public.split_booking_payment_runs
   where id = v_refund.run_id
   for update;

  if p_status = 'failed' then
    update public.split_booking_held_refunds
       set status = 'human_review',
           stripe_refund_id = coalesce(stripe_refund_id,p_stripe_refund_id),
           last_error = left(coalesce(p_error,'stripe_refund_failed_after_financial_fence'),1000),
           updated_at = now()
     where id = p_refund_id;

    update public.split_booking_payment_runs
       set settlement_state = 'human_review',
           settlement_updated_at = now(),
           updated_at = now()
     where id = v_refund.run_id;

    update public.split_booking_held_refund_allocations
       set status = 'human_review', updated_at = now()
     where refund_id = p_refund_id;

    return true;
  end if;

  if p_status = 'processing' then
    v_status := 'processing';

    update public.split_booking_held_refunds
       set status = v_status,
           stripe_refund_id = coalesce(stripe_refund_id,p_stripe_refund_id),
           updated_at = now()
     where id = p_refund_id
       and (stripe_refund_id is null or stripe_refund_id = p_stripe_refund_id);

    return true;
  end if;

  if not public.klyx_split_held_refund_reversals_ready(p_refund_id) then
    raise exception 'KLYX_SPLIT_HELD_REFUND_REVERSAL_REQUIRED';
  end if;

  update public.split_booking_held_refunds
     set status = 'succeeded',
         stripe_refund_id = coalesce(stripe_refund_id,p_stripe_refund_id),
         last_error = null,
         updated_at = now()
   where id = p_refund_id
     and (stripe_refund_id is null or stripe_refund_id = p_stripe_refund_id);

  update public.split_booking_held_refund_allocations
     set status = 'succeeded', updated_at = now()
   where refund_id = p_refund_id;

  update public.split_booking_payment_units u
     set refund_status = case
           when u.refunded_amount_cents = u.amount_cents then 'refunded'
           else 'partially_refunded'
         end,
         stripe_refund_id = p_stripe_refund_id,
         refund_updated_at = now(),
         updated_at = now()
   where u.run_id = v_refund.run_id;

  update public.split_booking_payment_runs
     set status = case
           when refunded_amount_cents = total_amount_cents then 'refunded'
           else 'partially_refunded'
         end,
         settlement_state = case
           when refunded_amount_cents = total_amount_cents then 'refunded'
           else 'partially_refunded'
         end,
         settlement_updated_at = now(),
         updated_at = now()
   where id = v_refund.run_id;

  return true;
end;
$$;

revoke all on function public.klyx_claim_split_held_checkout(uuid,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_attach_split_held_checkout(uuid,uuid,uuid,text,text,text)
  from public, anon, authenticated;
revoke all on function public.klyx_release_split_held_checkout(uuid,text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_split_held_paid(uuid,text,text,text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_split_executor_human_review(uuid,text[],text)
  from public, anon, authenticated;
revoke all on function public.klyx_claim_split_executor_release(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_split_executor_release(uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_split_executor_release(uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.klyx_plan_split_held_refund(uuid,text,bigint)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_split_executor_reversal(uuid,uuid,text,text,bigint)
  from public, anon, authenticated;
revoke all on function public.klyx_split_held_refund_reversals_ready(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_split_held_refund(uuid,text,text,text)
  from public, anon, authenticated;

grant execute on function public.klyx_claim_split_held_checkout(uuid,uuid,uuid)
  to service_role;
grant execute on function public.klyx_attach_split_held_checkout(uuid,uuid,uuid,text,text,text)
  to service_role;
grant execute on function public.klyx_release_split_held_checkout(uuid,text)
  to service_role;
grant execute on function public.klyx_mark_split_held_paid(uuid,text,text,text)
  to service_role;
grant execute on function public.klyx_mark_split_executor_human_review(uuid,text[],text)
  to service_role;
grant execute on function public.klyx_claim_split_executor_release(uuid,uuid)
  to service_role;
grant execute on function public.klyx_finalize_split_executor_release(uuid,uuid,text)
  to service_role;
grant execute on function public.klyx_fail_split_executor_release(uuid,uuid,text)
  to service_role;
grant execute on function public.klyx_plan_split_held_refund(uuid,text,bigint)
  to service_role;
grant execute on function public.klyx_finalize_split_executor_reversal(uuid,uuid,text,text,bigint)
  to service_role;
grant execute on function public.klyx_split_held_refund_reversals_ready(uuid)
  to service_role;
grant execute on function public.klyx_finalize_split_held_refund(uuid,text,text,text)
  to service_role;

comment on column public.split_booking_payment_runs.payment_mode is
  'connect_destination_split keeps legacy per-provider destination charges; platform_held_split means one platform charge for the whole run and later executor Transfers.';
comment on column public.split_booking_payment_units.settlement_state is
  'Executor-level settlement state. platform_held_split releases are independently claimed while the run row serializes aggregate over-transfer checks.';
comment on table public.split_booking_held_refunds is
  'Server-only shared-charge refund truth for TEST-only multi-executor platform-held settlement.';
comment on table public.split_booking_held_refund_allocations is
  'Server-only deterministic per-executor refund/reversal allocation truth.';

commit;

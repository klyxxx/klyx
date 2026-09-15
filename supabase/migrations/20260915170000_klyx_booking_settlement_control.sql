-- KLYX BOOKING SETTLEMENT CONTROL — PHASE 1
--
-- This migration creates the server-only control plane required before KLYX can
-- move from destination charges to a platform-held separate-charge/transfer
-- model. It does not change any Stripe payout schedule and does not execute any
-- Stripe side effect by itself.

begin;

create extension if not exists pgcrypto;

create table if not exists public.booking_settlements (
  booking_id uuid primary key
    references public.bookings(id) on delete restrict,
  provider_profile_id uuid not null,
  stripe_account_id text not null
    check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  payment_mode text not null default 'platform_held'
    check (payment_mode = 'platform_held'),
  currency text not null
    check (currency ~ '^[A-Z]{3}$'),
  gross_amount_cents integer not null
    check (gross_amount_cents > 0),
  platform_fee_cents integer not null
    check (platform_fee_cents >= 0),
  provider_amount_cents integer not null
    check (provider_amount_cents >= 0),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_transfer_id text unique,
  transfer_group text not null,
  state text not null default 'pending_payment'
    check (
      state in (
        'pending_payment',
        'held',
        'review_required',
        'release_claimed',
        'released',
        'release_failed',
        'refund_pending',
        'refunded'
      )
    ),
  release_reason_codes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(release_reason_codes) = 'array'),
  release_attempt_number integer not null default 0
    check (release_attempt_number >= 0),
  release_claim_token uuid,
  release_claimed_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (platform_fee_cents + provider_amount_cents = gross_amount_cents),
  check (
    (state = 'released' and stripe_transfer_id is not null and released_at is not null)
    or state <> 'released'
  )
);

create index if not exists booking_settlements_state_idx
  on public.booking_settlements(state, updated_at);

create index if not exists booking_settlements_provider_idx
  on public.booking_settlements(provider_profile_id, state, updated_at);

alter table public.booking_settlements enable row level security;

revoke all privileges on table public.booking_settlements
  from public, anon, authenticated;
grant select, insert, update, delete on table public.booking_settlements
  to service_role;

comment on table public.booking_settlements is
  'Server-only KLYX settlement control plane. No client role may claim or release provider funds.';

create or replace function public.klyx_claim_booking_settlement_release(
  p_booking_id uuid,
  p_claim_token uuid
)
returns table (
  action text,
  attempt_number integer,
  provider_profile_id uuid,
  stripe_account_id text,
  provider_amount_cents integer,
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
  v_settlement public.booking_settlements%rowtype;
  v_booking record;
begin
  if p_claim_token is null then
    raise exception 'KLYX_SETTLEMENT_CLAIM_TOKEN_REQUIRED';
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if not found then
    return query
      select 'not_ready'::text, 0, null::uuid, null::text, null::integer,
             null::text, null::text, null::text, null::text;
    return;
  end if;

  if v_settlement.state = 'released' then
    return query
      select 'released'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  if v_settlement.state in ('refund_pending', 'refunded', 'review_required') then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  if v_settlement.state = 'release_claimed'
     and v_settlement.release_claimed_at is not null
     and v_settlement.release_claimed_at > now() - interval '10 minutes' then
    return query
      select 'busy'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  select status, payment_status, refund_status
    into v_booking
    from public.bookings
   where id = p_booking_id;

  if not found
     or coalesce(v_booking.status, '') <> 'completed'
     or coalesce(v_booking.payment_status, '') <> 'paid'
     or coalesce(v_booking.refund_status, '') in ('processing', 'succeeded')
     or v_settlement.state not in ('held', 'release_failed', 'release_claimed') then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             v_settlement.provider_amount_cents,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  update public.booking_settlements
     set state = 'release_claimed',
         release_attempt_number = release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where booking_id = p_booking_id
   returning * into v_settlement;

  return query
    select 'create'::text,
           v_settlement.release_attempt_number,
           v_settlement.provider_profile_id,
           v_settlement.stripe_account_id,
           v_settlement.provider_amount_cents,
           v_settlement.currency,
           v_settlement.stripe_payment_intent_id,
           v_settlement.stripe_charge_id,
           v_settlement.transfer_group;
end;
$$;

create or replace function public.klyx_finalize_booking_settlement_release(
  p_booking_id uuid,
  p_claim_token uuid,
  p_stripe_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_SETTLEMENT_TRANSFER_ID_INVALID';
  end if;

  update public.booking_settlements
     set state = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         released_at = now(),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where booking_id = p_booking_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_fail_booking_settlement_release(
  p_booking_id uuid,
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
  v_updated integer;
begin
  update public.booking_settlements
     set state = 'release_failed',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_error_code, 'settlement_release_failed'), 120),
         last_error_message = left(coalesce(p_error_message, 'Settlement release failed.'), 1000),
         updated_at = now()
   where booking_id = p_booking_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_booking_settlement_refunded(
  p_booking_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.booking_settlements
     set state = 'refunded',
         refunded_at = coalesce(refunded_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         updated_at = now()
   where booking_id = p_booking_id
     and state <> 'released';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.klyx_claim_booking_settlement_release(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_booking_settlement_release(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_booking_settlement_release(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_booking_settlement_refunded(uuid)
  from public, anon, authenticated;

grant execute on function public.klyx_claim_booking_settlement_release(uuid, uuid)
  to service_role;
grant execute on function public.klyx_finalize_booking_settlement_release(uuid, uuid, text)
  to service_role;
grant execute on function public.klyx_fail_booking_settlement_release(uuid, uuid, text, text)
  to service_role;
grant execute on function public.klyx_mark_booking_settlement_refunded(uuid)
  to service_role;

commit;

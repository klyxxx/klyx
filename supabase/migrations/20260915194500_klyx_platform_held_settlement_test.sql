-- KLYX PLATFORM-HELD SETTLEMENT — PHASE 2 (STRIPE TEST ONLY)
--
-- This migration activates no Stripe side effect by itself. It extends the
-- server-only settlement control plane so a single booking can be persisted as
-- a platform-held Checkout, reconciled to a paid Stripe charge, risk-reviewed,
-- released exactly once, and made refund-safe. Live Stripe remains forbidden by
-- application code in this phase.

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
      'platform_held'
    )
  );

alter table public.transaction_risk_decisions
  drop constraint if exists transaction_risk_decisions_action_check;

alter table public.transaction_risk_decisions
  add constraint transaction_risk_decisions_action_check
  check (action in ('checkout_create', 'refund_create', 'settlement_release'));

alter table public.transaction_risk_decisions
  drop constraint if exists transaction_risk_decisions_participant_check;

alter table public.transaction_risk_decisions
  add constraint transaction_risk_decisions_participant_check
  check (
    participant in (
      'payer',
      'recipient',
      'requester',
      'refund_recipient',
      'settlement_recipient'
    )
  );

comment on table public.transaction_risk_decisions is
  'Server-only canonical KLYX transaction-risk decisions for checkout, refund and settlement release. This table does not represent a permanent account suspension.';

alter table public.booking_settlements
  add column if not exists stripe_transfer_reversal_id text,
  add column if not exists transfer_reversed_at timestamptz;

create unique index if not exists booking_settlements_checkout_session_uidx
  on public.booking_settlements(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists booking_settlements_transfer_reversal_uidx
  on public.booking_settlements(stripe_transfer_reversal_id)
  where stripe_transfer_reversal_id is not null;

create or replace function public.klyx_persist_platform_held_checkout(
  p_booking_id uuid,
  p_client_profile_id uuid,
  p_attempt_token uuid,
  p_checkout_session_id text,
  p_provider_profile_id uuid,
  p_service_id uuid,
  p_user_service_id uuid,
  p_stripe_account_id text,
  p_currency text,
  p_gross_amount_cents integer,
  p_platform_fee_cents integer,
  p_provider_amount_cents integer,
  p_transfer_group text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_settlement public.booking_settlements%rowtype;
begin
  if p_attempt_token is null then
    raise exception 'KLYX_PLATFORM_HELD_ATTEMPT_TOKEN_REQUIRED';
  end if;

  if coalesce(trim(p_checkout_session_id), '') !~ '^cs_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_PLATFORM_HELD_CHECKOUT_SESSION_INVALID';
  end if;

  if coalesce(trim(p_stripe_account_id), '') !~ '^acct_[A-Za-z0-9]+$' then
    raise exception 'KLYX_PLATFORM_HELD_STRIPE_ACCOUNT_INVALID';
  end if;

  if coalesce(trim(p_currency), '') !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_PLATFORM_HELD_CURRENCY_INVALID';
  end if;

  if p_gross_amount_cents <= 0
     or p_platform_fee_cents < 0
     or p_provider_amount_cents < 0
     or p_platform_fee_cents + p_provider_amount_cents <> p_gross_amount_cents then
    raise exception 'KLYX_PLATFORM_HELD_ECONOMICS_INVALID';
  end if;

  if coalesce(trim(p_transfer_group), '') = '' then
    raise exception 'KLYX_PLATFORM_HELD_TRANSFER_GROUP_REQUIRED';
  end if;

  select *
    into v_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception 'KLYX_PLATFORM_HELD_BOOKING_NOT_FOUND';
  end if;

  if v_booking.parent_id <> p_client_profile_id then
    raise exception 'KLYX_PLATFORM_HELD_BOOKING_OWNER_MISMATCH';
  end if;

  if v_booking.booking_group_id is not null then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_NOT_SUPPORTED';
  end if;

  if coalesce(v_booking.status, '') <> 'accepted'
     or coalesce(v_booking.payment_status, '') <> 'creating_checkout'
     or v_booking.payment_attempt_token is distinct from p_attempt_token then
    raise exception 'KLYX_PLATFORM_HELD_PAYMENT_CLAIM_LOST';
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if found then
    if v_settlement.state <> 'pending_payment' then
      raise exception 'KLYX_PLATFORM_HELD_SETTLEMENT_ALREADY_ACTIVE';
    end if;

    if v_settlement.provider_profile_id <> p_provider_profile_id
       or v_settlement.stripe_account_id <> p_stripe_account_id
       or v_settlement.currency <> p_currency
       or v_settlement.gross_amount_cents <> p_gross_amount_cents
       or v_settlement.platform_fee_cents <> p_platform_fee_cents
       or v_settlement.provider_amount_cents <> p_provider_amount_cents
       or v_settlement.transfer_group <> p_transfer_group then
      raise exception 'KLYX_PLATFORM_HELD_IMMUTABLE_TRUTH_MISMATCH';
    end if;

    update public.booking_settlements
       set stripe_checkout_session_id = p_checkout_session_id,
           updated_at = now()
     where booking_id = p_booking_id;
  else
    insert into public.booking_settlements (
      booking_id,
      provider_profile_id,
      stripe_account_id,
      payment_mode,
      currency,
      gross_amount_cents,
      platform_fee_cents,
      provider_amount_cents,
      stripe_checkout_session_id,
      transfer_group,
      state
    ) values (
      p_booking_id,
      p_provider_profile_id,
      p_stripe_account_id,
      'platform_held',
      p_currency,
      p_gross_amount_cents,
      p_platform_fee_cents,
      p_provider_amount_cents,
      p_checkout_session_id,
      p_transfer_group,
      'pending_payment'
    );
  end if;

  update public.bookings
     set provider_id = p_provider_profile_id,
         service_id = p_service_id,
         user_service_id = p_user_service_id,
         payment_status = 'checkout_created',
         stripe_checkout_session_id = p_checkout_session_id,
         amount_total = p_gross_amount_cents,
         payment_mode = 'platform_held',
         application_fee_amount = p_platform_fee_cents,
         platform_fee_amount = p_platform_fee_cents,
         provider_amount = p_provider_amount_cents,
         payment_attempt_token = null,
         payment_checkout_started_at = null,
         updated_at = now()
   where id = p_booking_id;

  return true;
end;
$$;

create or replace function public.klyx_guard_platform_held_booking_economics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.booking_settlements%rowtype;
begin
  if new.payment_mode <> 'platform_held' or new.payment_status <> 'paid' then
    return new;
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = new.id;

  if not found then
    raise exception 'KLYX_PLATFORM_HELD_SETTLEMENT_MISSING';
  end if;

  if coalesce(trim(new.stripe_payment_intent_id), '') !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_PLATFORM_HELD_PAYMENT_INTENT_REQUIRED';
  end if;

  new.amount_total := v_settlement.gross_amount_cents;
  new.currency := v_settlement.currency;
  new.application_fee_amount := v_settlement.platform_fee_cents;
  new.platform_fee_amount := v_settlement.platform_fee_cents;
  new.provider_amount := v_settlement.provider_amount_cents;

  return new;
end;
$$;

drop trigger if exists bookings_platform_held_economics_guard
  on public.bookings;

create trigger bookings_platform_held_economics_guard
before update on public.bookings
for each row
execute function public.klyx_guard_platform_held_booking_economics();

create or replace function public.klyx_mark_platform_held_booking_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if new.payment_mode <> 'platform_held'
     or new.payment_status <> 'paid'
     or old.payment_status = 'paid' then
    return new;
  end if;

  update public.booking_settlements
     set state = case
           when state = 'pending_payment' then 'held'
           else state
         end,
         stripe_checkout_session_id = coalesce(stripe_checkout_session_id, new.stripe_checkout_session_id),
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id, new.stripe_payment_intent_id),
         updated_at = now()
   where booking_id = new.id
     and state in ('pending_payment', 'held');

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'KLYX_PLATFORM_HELD_PAID_SETTLEMENT_NOT_WRITABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_platform_held_paid_reconcile
  on public.bookings;

create trigger bookings_platform_held_paid_reconcile
after update on public.bookings
for each row
execute function public.klyx_mark_platform_held_booking_paid();

create or replace function public.klyx_guard_platform_held_ledger_economics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.booking_settlements%rowtype;
  v_mode text;
begin
  if new.entry_type <> 'payment_succeeded' then
    return new;
  end if;

  select payment_mode
    into v_mode
    from public.bookings
   where id = new.booking_id;

  if coalesce(v_mode, '') <> 'platform_held' then
    return new;
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = new.booking_id;

  if not found then
    raise exception 'KLYX_PLATFORM_HELD_LEDGER_SETTLEMENT_MISSING';
  end if;

  new.payment_mode := 'platform_held';
  new.currency := v_settlement.currency;
  new.gross_amount_cents := v_settlement.gross_amount_cents;
  new.platform_fee_cents := v_settlement.platform_fee_cents;
  new.provider_amount_cents := v_settlement.provider_amount_cents;

  return new;
end;
$$;

drop trigger if exists booking_financial_ledger_platform_held_guard
  on public.booking_financial_ledger;

create trigger booking_financial_ledger_platform_held_guard
before insert or update on public.booking_financial_ledger
for each row
execute function public.klyx_guard_platform_held_ledger_economics();

create or replace function public.klyx_attach_booking_settlement_stripe_truth(
  p_booking_id uuid,
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
  v_settlement public.booking_settlements%rowtype;
  v_booking record;
begin
  if coalesce(trim(p_checkout_session_id), '') !~ '^cs_[A-Za-z0-9_]+$'
     or coalesce(trim(p_payment_intent_id), '') !~ '^pi_[A-Za-z0-9_]+$'
     or coalesce(trim(p_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_PLATFORM_HELD_STRIPE_TRUTH_INVALID';
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if not found then
    return false;
  end if;

  select payment_status, payment_mode, stripe_checkout_session_id, stripe_payment_intent_id
    into v_booking
    from public.bookings
   where id = p_booking_id;

  if not found
     or coalesce(v_booking.payment_status, '') <> 'paid'
     or coalesce(v_booking.payment_mode, '') <> 'platform_held' then
    return false;
  end if;

  if v_booking.stripe_checkout_session_id is distinct from p_checkout_session_id
     or v_booking.stripe_payment_intent_id is distinct from p_payment_intent_id
     or v_settlement.stripe_checkout_session_id is distinct from p_checkout_session_id
     or (v_settlement.stripe_payment_intent_id is not null and v_settlement.stripe_payment_intent_id <> p_payment_intent_id)
     or (v_settlement.stripe_charge_id is not null and v_settlement.stripe_charge_id <> p_charge_id) then
    raise exception 'KLYX_PLATFORM_HELD_STRIPE_TRUTH_MISMATCH';
  end if;

  if v_settlement.state not in ('held', 'release_failed', 'review_required') then
    return v_settlement.state in ('release_claimed', 'released', 'refund_pending', 'refunded');
  end if;

  update public.booking_settlements
     set stripe_payment_intent_id = p_payment_intent_id,
         stripe_charge_id = p_charge_id,
         updated_at = now()
   where booking_id = p_booking_id;

  return true;
end;
$$;

create or replace function public.klyx_mark_booking_settlement_review_required(
  p_booking_id uuid,
  p_reason_codes jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_reason_codes is null or jsonb_typeof(p_reason_codes) <> 'array' then
    raise exception 'KLYX_SETTLEMENT_REVIEW_REASONS_INVALID';
  end if;

  update public.booking_settlements
     set state = 'review_required',
         release_reason_codes = p_reason_codes,
         release_claim_token = null,
         release_claimed_at = null,
         updated_at = now()
   where booking_id = p_booking_id
     and state in ('held', 'release_failed', 'review_required');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_prepare_booking_settlement_refund(
  p_booking_id uuid
)
returns table (
  action text,
  stripe_transfer_id text,
  provider_amount_cents integer,
  stripe_transfer_reversal_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.booking_settlements%rowtype;
begin
  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if not found then
    return query select 'not_applicable'::text, null::text, null::integer, null::text;
    return;
  end if;

  if v_settlement.state = 'refunded' then
    return query
      select 'refunded'::text,
             v_settlement.stripe_transfer_id,
             v_settlement.provider_amount_cents,
             v_settlement.stripe_transfer_reversal_id;
    return;
  end if;

  if v_settlement.state = 'release_claimed'
     and v_settlement.release_claimed_at is not null
     and v_settlement.release_claimed_at > now() - interval '10 minutes' then
    return query
      select 'busy'::text,
             v_settlement.stripe_transfer_id,
             v_settlement.provider_amount_cents,
             v_settlement.stripe_transfer_reversal_id;
    return;
  end if;

  if v_settlement.state = 'released' then
    update public.booking_settlements
       set state = 'refund_pending',
           updated_at = now()
     where booking_id = p_booking_id
     returning * into v_settlement;
  elsif v_settlement.state in (
    'pending_payment',
    'held',
    'review_required',
    'release_failed',
    'release_claimed'
  ) then
    update public.booking_settlements
       set state = 'refund_pending',
           release_claim_token = null,
           release_claimed_at = null,
           updated_at = now()
     where booking_id = p_booking_id
     returning * into v_settlement;
  elsif v_settlement.state <> 'refund_pending' then
    return query
      select 'not_ready'::text,
             v_settlement.stripe_transfer_id,
             v_settlement.provider_amount_cents,
             v_settlement.stripe_transfer_reversal_id;
    return;
  end if;

  if v_settlement.stripe_transfer_id is not null
     and v_settlement.stripe_transfer_reversal_id is null then
    return query
      select 'reverse_transfer'::text,
             v_settlement.stripe_transfer_id,
             v_settlement.provider_amount_cents,
             null::text;
    return;
  end if;

  return query
    select 'refund_ready'::text,
           v_settlement.stripe_transfer_id,
           v_settlement.provider_amount_cents,
           v_settlement.stripe_transfer_reversal_id;
end;
$$;

create or replace function public.klyx_finalize_booking_settlement_reversal(
  p_booking_id uuid,
  p_stripe_transfer_id text,
  p_stripe_transfer_reversal_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$'
     or coalesce(trim(p_stripe_transfer_reversal_id), '') !~ '^trr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_SETTLEMENT_REVERSAL_ID_INVALID';
  end if;

  update public.booking_settlements
     set stripe_transfer_reversal_id = p_stripe_transfer_reversal_id,
         transfer_reversed_at = coalesce(transfer_reversed_at, now()),
         updated_at = now()
   where booking_id = p_booking_id
     and state = 'refund_pending'
     and stripe_transfer_id = p_stripe_transfer_id
     and (
       stripe_transfer_reversal_id is null
       or stripe_transfer_reversal_id = p_stripe_transfer_reversal_id
     );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_platform_held_refunded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_mode = 'platform_held'
     and new.refund_status = 'succeeded'
     and (old.refund_status is distinct from 'succeeded') then
    perform public.klyx_mark_booking_settlement_refunded(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_platform_held_refund_reconcile
  on public.bookings;

create trigger bookings_platform_held_refund_reconcile
after update on public.bookings
for each row
execute function public.klyx_mark_platform_held_refunded();

revoke all on function public.klyx_persist_platform_held_checkout(uuid, uuid, uuid, text, uuid, uuid, uuid, text, text, integer, integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.klyx_attach_booking_settlement_stripe_truth(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_booking_settlement_review_required(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.klyx_prepare_booking_settlement_refund(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_booking_settlement_reversal(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.klyx_persist_platform_held_checkout(uuid, uuid, uuid, text, uuid, uuid, uuid, text, text, integer, integer, integer, text)
  to service_role;
grant execute on function public.klyx_attach_booking_settlement_stripe_truth(uuid, text, text, text)
  to service_role;
grant execute on function public.klyx_mark_booking_settlement_review_required(uuid, jsonb)
  to service_role;
grant execute on function public.klyx_prepare_booking_settlement_refund(uuid)
  to service_role;
grant execute on function public.klyx_finalize_booking_settlement_reversal(uuid, text, text)
  to service_role;

commit;

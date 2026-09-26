begin;

-- Single-booking Platform-Held partial refunds.
--
-- This migration is additive. It does not activate Stripe LIVE.
-- It makes Settlement truth cumulative so partial refunds/reversals can be
-- reconciled cent-for-cent against the canonical ledger and Stripe.

alter table public.bookings
  drop constraint if exists bookings_refund_status_check;

alter table public.bookings
  add constraint bookings_refund_status_check
  check (
    refund_status is null
    or refund_status in (
      'processing',
      'partially_refunded',
      'succeeded',
      'failed'
    )
  );

alter table public.booking_settlements
  add column if not exists refunded_amount_cents bigint not null default 0,
  add column if not exists refunded_platform_fee_cents bigint not null default 0,
  add column if not exists refunded_provider_amount_cents bigint not null default 0,
  add column if not exists released_provider_amount_cents bigint not null default 0,
  add column if not exists reversed_provider_amount_cents bigint not null default 0;

update public.booking_settlements s
   set refunded_amount_cents = least(
         s.gross_amount_cents,
         greatest(coalesce(b.refunded_amount_cents, 0), 0)
       ),
       refunded_platform_fee_cents = case
         when s.gross_amount_cents > 0 then (
           s.platform_fee_cents
             * least(
                 s.gross_amount_cents,
                 greatest(coalesce(b.refunded_amount_cents, 0), 0)
               )
             + s.gross_amount_cents / 2
         ) / s.gross_amount_cents
         else 0
       end,
       refunded_provider_amount_cents = case
         when s.gross_amount_cents > 0 then
           least(
             s.gross_amount_cents,
             greatest(coalesce(b.refunded_amount_cents, 0), 0)
           ) - (
             s.platform_fee_cents
               * least(
                   s.gross_amount_cents,
                   greatest(coalesce(b.refunded_amount_cents, 0), 0)
                 )
               + s.gross_amount_cents / 2
           ) / s.gross_amount_cents
         else 0
       end,
       released_provider_amount_cents = case
         when s.stripe_transfer_id is not null then s.provider_amount_cents
         else 0
       end,
       reversed_provider_amount_cents = case
         when s.stripe_transfer_reversal_id is not null then s.provider_amount_cents
         else 0
       end
  from public.bookings b
 where b.id = s.booking_id;

alter table public.booking_settlements
  drop constraint if exists booking_settlements_partial_refund_economics_check;

alter table public.booking_settlements
  add constraint booking_settlements_partial_refund_economics_check
  check (
    refunded_amount_cents >= 0
    and refunded_platform_fee_cents >= 0
    and refunded_provider_amount_cents >= 0
    and released_provider_amount_cents >= 0
    and reversed_provider_amount_cents >= 0
    and refunded_amount_cents <= gross_amount_cents
    and refunded_platform_fee_cents <= platform_fee_cents
    and refunded_provider_amount_cents <= provider_amount_cents
    and refunded_platform_fee_cents + refunded_provider_amount_cents
      = refunded_amount_cents
    and released_provider_amount_cents <= provider_amount_cents
    and reversed_provider_amount_cents <= released_provider_amount_cents
  );

alter table public.booking_settlements
  drop constraint if exists booking_settlements_refunded_transfer_reversal_check;

alter table public.booking_settlements
  add constraint booking_settlements_refunded_transfer_reversal_check
  check (
    state <> 'refunded'
    or stripe_transfer_id is null
    or reversed_provider_amount_cents >= released_provider_amount_cents
  );

create table if not exists public.platform_held_booking_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.booking_settlements(booking_id) on delete restrict,
  request_key text not null,
  currency text not null check (char_length(currency) = 3),
  amount_cents bigint not null check (amount_cents > 0),
  platform_fee_refund_cents bigint not null
    check (platform_fee_refund_cents >= 0),
  provider_refund_cents bigint not null
    check (provider_refund_cents >= 0),
  settlement_state_before text not null
    check (
      settlement_state_before in (
        'held',
        'release_failed',
        'released'
      )
    ),
  state text not null default 'ready'
    check (
      state in (
        'reversing',
        'ready',
        'refunding',
        'succeeded',
        'failed',
        'review_required'
      )
    ),
  stripe_refund_id text,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint platform_held_booking_refund_request_unique
    unique (booking_id, request_key),
  constraint platform_held_booking_refund_economics_check
    check (
      platform_fee_refund_cents + provider_refund_cents = amount_cents
    )
);

create unique index if not exists platform_held_booking_refund_stripe_uidx
  on public.platform_held_booking_refunds(stripe_refund_id)
  where stripe_refund_id is not null;

create index if not exists platform_held_booking_refund_booking_state_idx
  on public.platform_held_booking_refunds(booking_id, state, created_at);

create table if not exists public.platform_held_booking_refund_reversals (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null unique
    references public.platform_held_booking_refunds(id) on delete restrict,
  booking_id uuid not null
    references public.booking_settlements(booking_id) on delete restrict,
  stripe_transfer_id text not null,
  stripe_transfer_reversal_id text not null unique,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

alter table public.platform_held_booking_refunds enable row level security;
alter table public.platform_held_booking_refund_reversals enable row level security;

revoke all privileges on table public.platform_held_booking_refunds
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_booking_refund_reversals
  from public, anon, authenticated;

grant select, insert, update, delete on table public.platform_held_booking_refunds
  to service_role;
grant select, insert on table public.platform_held_booking_refund_reversals
  to service_role;

create or replace function public.klyx_immutable_single_booking_refund_reversal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'KLYX_SINGLE_HELD_REFUND_REVERSAL_IMMUTABLE';
end;
$$;

drop trigger if exists platform_held_booking_refund_reversals_immutable
  on public.platform_held_booking_refund_reversals;
create trigger platform_held_booking_refund_reversals_immutable
before update or delete on public.platform_held_booking_refund_reversals
for each row execute function public.klyx_immutable_single_booking_refund_reversal();

revoke all on function public.klyx_immutable_single_booking_refund_reversal()
  from public, anon, authenticated;

create or replace function public.klyx_create_platform_held_booking_refund_plan(
  p_booking_id uuid,
  p_request_key text,
  p_amount_cents bigint,
  p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.booking_settlements%rowtype;
  v_booking public.bookings%rowtype;
  v_existing public.platform_held_booking_refunds%rowtype;
  v_refund_id uuid;
  v_cumulative_gross bigint;
  v_cumulative_fee bigint;
  v_cumulative_provider bigint;
  v_fee_delta bigint;
  v_provider_delta bigint;
  v_state text;
begin
  if p_booking_id is null
     or char_length(trim(coalesce(p_request_key, ''))) < 3
     or char_length(trim(coalesce(p_request_key, ''))) > 128
     or trim(coalesce(p_request_key, '')) !~ '^[A-Za-z0-9:_-]+$'
     or p_amount_cents <= 0
     or char_length(upper(coalesce(p_currency, ''))) <> 3 then
    raise exception 'KLYX_SINGLE_HELD_REFUND_PLAN_INVALID';
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if not found
     or v_settlement.payment_mode <> 'platform_held'
     or v_settlement.state not in ('held', 'release_failed', 'released')
     or v_settlement.currency <> upper(p_currency)
     or v_settlement.gross_amount_cents <= 0
     or coalesce(trim(v_settlement.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_SINGLE_HELD_REFUND_NOT_READY';
  end if;

  select *
    into v_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if not found
     or v_booking.payment_mode <> 'platform_held'
     or v_booking.booking_group_id is not null
     or coalesce(v_booking.payment_status, '') <> 'paid'
     or coalesce(v_booking.refund_status, '') = 'succeeded' then
    raise exception 'KLYX_SINGLE_HELD_REFUND_BOOKING_NOT_READY';
  end if;

  select *
    into v_existing
    from public.platform_held_booking_refunds
   where booking_id = p_booking_id
     and request_key = trim(p_request_key);

  if found then
    if v_existing.amount_cents = p_amount_cents
       and v_existing.currency = upper(p_currency) then
      return v_existing.id;
    end if;

    raise exception 'KLYX_SINGLE_HELD_REFUND_KEY_CONFLICT';
  end if;

  if exists (
    select 1
      from public.platform_held_booking_refunds r
     where r.booking_id = p_booking_id
       and r.state in ('reversing', 'ready', 'refunding', 'review_required')
  ) then
    raise exception 'KLYX_SINGLE_HELD_REFUND_ALREADY_ACTIVE';
  end if;

  if v_settlement.refunded_amount_cents + p_amount_cents
       > v_settlement.gross_amount_cents then
    raise exception 'KLYX_SINGLE_HELD_REFUND_EXCEEDS_GROSS';
  end if;

  v_cumulative_gross :=
    v_settlement.refunded_amount_cents + p_amount_cents;

  v_cumulative_fee := (
    v_settlement.platform_fee_cents * v_cumulative_gross
      + v_settlement.gross_amount_cents / 2
  ) / v_settlement.gross_amount_cents;

  v_cumulative_provider := v_cumulative_gross - v_cumulative_fee;
  v_fee_delta :=
    v_cumulative_fee - v_settlement.refunded_platform_fee_cents;
  v_provider_delta :=
    v_cumulative_provider - v_settlement.refunded_provider_amount_cents;

  if v_fee_delta < 0
     or v_provider_delta < 0
     or v_fee_delta + v_provider_delta <> p_amount_cents
     or v_cumulative_fee > v_settlement.platform_fee_cents
     or v_cumulative_provider > v_settlement.provider_amount_cents then
    raise exception 'KLYX_SINGLE_HELD_REFUND_ACCOUNTING_MISMATCH';
  end if;

  v_state := case
    when v_settlement.stripe_transfer_id is not null
     and v_provider_delta > 0
      then 'reversing'
    else 'ready'
  end;

  insert into public.platform_held_booking_refunds (
    booking_id,
    request_key,
    currency,
    amount_cents,
    platform_fee_refund_cents,
    provider_refund_cents,
    settlement_state_before,
    state
  ) values (
    p_booking_id,
    trim(p_request_key),
    upper(p_currency),
    p_amount_cents,
    v_fee_delta,
    v_provider_delta,
    v_settlement.state,
    v_state
  )
  returning id into v_refund_id;

  update public.booking_settlements
     set state = 'refund_pending',
         updated_at = now()
   where booking_id = p_booking_id;

  return v_refund_id;
end;
$$;

create or replace function public.klyx_finalize_platform_held_booking_refund_reversal(
  p_refund_id uuid,
  p_stripe_transfer_id text,
  p_stripe_transfer_reversal_id text,
  p_amount_cents bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.platform_held_booking_refunds%rowtype;
  v_settlement public.booking_settlements%rowtype;
  v_existing public.platform_held_booking_refund_reversals%rowtype;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$'
     or coalesce(trim(p_stripe_transfer_reversal_id), '') !~ '^trr_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_SINGLE_HELD_REVERSAL_TRUTH_INVALID';
  end if;

  select *
    into v_refund
    from public.platform_held_booking_refunds
   where id = p_refund_id
   for update;

  if not found
     or v_refund.state not in ('reversing', 'ready')
     or v_refund.provider_refund_cents <> p_amount_cents then
    return false;
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = v_refund.booking_id
   for update;

  if not found
     or v_settlement.stripe_transfer_id is distinct from p_stripe_transfer_id
     or v_settlement.reversed_provider_amount_cents + p_amount_cents
          > v_settlement.released_provider_amount_cents then
    raise exception 'KLYX_SINGLE_HELD_REVERSAL_SETTLEMENT_MISMATCH';
  end if;

  select *
    into v_existing
    from public.platform_held_booking_refund_reversals
   where refund_id = p_refund_id;

  if found then
    return v_existing.stripe_transfer_id = p_stripe_transfer_id
       and v_existing.stripe_transfer_reversal_id =
             p_stripe_transfer_reversal_id
       and v_existing.amount_cents = p_amount_cents;
  end if;

  insert into public.platform_held_booking_refund_reversals (
    refund_id,
    booking_id,
    stripe_transfer_id,
    stripe_transfer_reversal_id,
    amount_cents
  ) values (
    p_refund_id,
    v_refund.booking_id,
    p_stripe_transfer_id,
    p_stripe_transfer_reversal_id,
    p_amount_cents
  );

  update public.booking_settlements
     set reversed_provider_amount_cents =
           reversed_provider_amount_cents + p_amount_cents,
         stripe_transfer_reversal_id = case
           when reversed_provider_amount_cents + p_amount_cents
                  >= released_provider_amount_cents
             then p_stripe_transfer_reversal_id
           else stripe_transfer_reversal_id
         end,
         transfer_reversed_at = case
           when reversed_provider_amount_cents + p_amount_cents
                  >= released_provider_amount_cents
             then coalesce(transfer_reversed_at, now())
           else transfer_reversed_at
         end,
         updated_at = now()
   where booking_id = v_refund.booking_id;

  update public.platform_held_booking_refunds
     set state = 'ready',
         updated_at = now()
   where id = p_refund_id;

  return true;
end;
$$;

create or replace function public.klyx_mark_platform_held_booking_refund_inflight(
  p_refund_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.platform_held_booking_refunds
     set state = 'refunding',
         updated_at = now()
   where id = p_refund_id
     and state = 'ready';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_platform_held_booking_refund_review(
  p_refund_id uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.platform_held_booking_refunds%rowtype;
begin
  update public.platform_held_booking_refunds
     set state = 'review_required',
         failure_code = left(
           coalesce(p_error_code, 'single_refund_review_required'),
           120
         ),
         failure_message = left(
           coalesce(p_error_message, 'Single refund requires review.'),
           1000
         ),
         updated_at = now()
   where id = p_refund_id
     and state <> 'succeeded'
   returning * into v_refund;

  if not found then
    return false;
  end if;

  update public.booking_settlements
     set state = 'human_review',
         human_review_at = coalesce(human_review_at, now()),
         last_error_code = left(
           coalesce(p_error_code, 'single_refund_review_required'),
           120
         ),
         last_error_message = left(
           coalesce(p_error_message, 'Single refund requires review.'),
           1000
         ),
         updated_at = now()
   where booking_id = v_refund.booking_id;

  return true;
end;
$$;

create or replace function public.klyx_fail_platform_held_booking_refund(
  p_refund_id uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.platform_held_booking_refunds%rowtype;
  v_has_reversal boolean := false;
begin
  select *
    into v_refund
    from public.platform_held_booking_refunds
   where id = p_refund_id
   for update;

  if not found or v_refund.state = 'succeeded' then
    return false;
  end if;

  select exists (
    select 1
      from public.platform_held_booking_refund_reversals r
     where r.refund_id = p_refund_id
  ) into v_has_reversal;

  if v_has_reversal then
    return public.klyx_mark_platform_held_booking_refund_review(
      p_refund_id,
      coalesce(p_error_code, 'single_refund_failed_after_reversal'),
      coalesce(
        p_error_message,
        'Stripe refund failed after provider funds were reversed.'
      )
    );
  end if;

  update public.platform_held_booking_refunds
     set state = 'failed',
         failure_code = left(
           coalesce(p_error_code, 'single_refund_failed'),
           120
         ),
         failure_message = left(
           coalesce(p_error_message, 'Single refund failed.'),
           1000
         ),
         updated_at = now()
   where id = p_refund_id;

  update public.booking_settlements
     set state = v_refund.settlement_state_before,
         last_error_code = left(
           coalesce(p_error_code, 'single_refund_failed'),
           120
         ),
         last_error_message = left(
           coalesce(p_error_message, 'Single refund failed.'),
           1000
         ),
         updated_at = now()
   where booking_id = v_refund.booking_id
     and state = 'refund_pending';

  return true;
end;
$$;

create or replace function public.klyx_finalize_platform_held_booking_refund(
  p_refund_id uuid,
  p_stripe_refund_id text,
  p_amount_cents bigint,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.platform_held_booking_refunds%rowtype;
  v_settlement public.booking_settlements%rowtype;
  v_total_refunded bigint;
  v_total_fee bigint;
  v_total_provider bigint;
  v_full boolean;
begin
  if coalesce(trim(p_stripe_refund_id), '') !~ '^re_[A-Za-z0-9]+$'
     or p_amount_cents <= 0
     or char_length(upper(coalesce(p_currency, ''))) <> 3 then
    raise exception 'KLYX_SINGLE_HELD_REFUND_TRUTH_INVALID';
  end if;

  select *
    into v_refund
    from public.platform_held_booking_refunds
   where id = p_refund_id
   for update;

  if not found then
    return false;
  end if;

  if v_refund.state = 'succeeded' then
    return v_refund.stripe_refund_id = p_stripe_refund_id
       and v_refund.amount_cents = p_amount_cents
       and v_refund.currency = upper(p_currency);
  end if;

  if v_refund.state not in ('ready', 'refunding')
     or v_refund.amount_cents <> p_amount_cents
     or v_refund.currency <> upper(p_currency) then
    return false;
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = v_refund.booking_id
   for update;

  if not found
     or v_settlement.state <> 'refund_pending' then
    return false;
  end if;

  if v_settlement.stripe_transfer_id is not null
     and v_refund.provider_refund_cents > 0
     and not exists (
       select 1
         from public.platform_held_booking_refund_reversals r
        where r.refund_id = v_refund.id
          and r.amount_cents = v_refund.provider_refund_cents
          and r.stripe_transfer_id = v_settlement.stripe_transfer_id
     ) then
    return false;
  end if;

  v_total_refunded :=
    v_settlement.refunded_amount_cents + v_refund.amount_cents;
  v_total_fee :=
    v_settlement.refunded_platform_fee_cents
      + v_refund.platform_fee_refund_cents;
  v_total_provider :=
    v_settlement.refunded_provider_amount_cents
      + v_refund.provider_refund_cents;

  if v_total_refunded > v_settlement.gross_amount_cents
     or v_total_fee > v_settlement.platform_fee_cents
     or v_total_provider > v_settlement.provider_amount_cents
     or v_total_fee + v_total_provider <> v_total_refunded then
    raise exception 'KLYX_SINGLE_HELD_REFUND_FINAL_TOTAL_MISMATCH';
  end if;

  v_full := v_total_refunded = v_settlement.gross_amount_cents;

  if v_full
     and v_settlement.stripe_transfer_id is not null
     and v_settlement.reversed_provider_amount_cents
           < v_settlement.released_provider_amount_cents then
    raise exception 'KLYX_SINGLE_HELD_FULL_REFUND_REVERSAL_INCOMPLETE';
  end if;

  update public.platform_held_booking_refunds
     set state = 'succeeded',
         stripe_refund_id = p_stripe_refund_id,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = v_refund.id;

  update public.booking_settlements
     set refunded_amount_cents = v_total_refunded,
         refunded_platform_fee_cents = v_total_fee,
         refunded_provider_amount_cents = v_total_provider,
         state = case
           when v_full then 'refunded'
           else v_refund.settlement_state_before
         end,
         refunded_at = case
           when v_full then coalesce(refunded_at, now())
           else refunded_at
         end,
         release_claim_token = case
           when v_full then null
           else release_claim_token
         end,
         release_claimed_at = case
           when v_full then null
           else release_claimed_at
         end,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where booking_id = v_refund.booking_id;

  update public.bookings
     set refund_status = case
           when v_full then 'succeeded'
           else 'partially_refunded'
         end,
         payment_status = case
           when v_full then 'refunded'
           else payment_status
         end,
         stripe_refund_id = p_stripe_refund_id,
         refunded_amount_cents = v_total_refunded,
         refunded_at = case
           when v_full then coalesce(refunded_at, now())
           else refunded_at
         end,
         updated_at = now()
   where id = v_refund.booking_id;

  return true;
end;
$$;

create or replace function public.klyx_booking_settlement_remaining_provider_amount(
  p_booking_id uuid,
  p_claim_token uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.booking_settlements%rowtype;
  v_remaining bigint;
begin
  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token;

  if not found then
    raise exception 'KLYX_SETTLEMENT_RELEASE_CLAIM_NOT_OWNED';
  end if;

  v_remaining :=
    v_settlement.provider_amount_cents
      - v_settlement.refunded_provider_amount_cents;

  if v_remaining <= 0 then
    raise exception 'KLYX_SETTLEMENT_PROVIDER_LIABILITY_EXHAUSTED';
  end if;

  return v_remaining;
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
         released_provider_amount_cents =
           provider_amount_cents - refunded_provider_amount_cents,
         released_at = now(),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where booking_id = p_booking_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token
     and provider_amount_cents - refunded_provider_amount_cents > 0;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_finalize_platform_held_settlement_on_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.booking_settlements%rowtype;
begin
  if coalesce(new.payment_mode, '') <> 'platform_held' then
    return new;
  end if;

  if coalesce(new.payment_status, '') <> 'refunded'
     and coalesce(new.refund_status, '') <> 'succeeded' then
    return new;
  end if;

  if coalesce(old.payment_status, '') = 'refunded'
     and coalesce(old.refund_status, '') = 'succeeded' then
    return new;
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = new.id
   for update;

  if not found then
    raise exception 'KLYX_SETTLEMENT_REFUND_SETTLEMENT_MISSING';
  end if;

  if v_settlement.state = 'release_claimed' then
    raise exception 'KLYX_SETTLEMENT_REFUND_RELEASE_CLAIM_ACTIVE';
  end if;

  if v_settlement.refunded_amount_cents < v_settlement.gross_amount_cents then
    raise exception 'KLYX_SETTLEMENT_FULL_REFUND_TRUTH_INCOMPLETE';
  end if;

  if v_settlement.stripe_transfer_id is not null
     and v_settlement.reversed_provider_amount_cents
           < v_settlement.released_provider_amount_cents then
    raise exception 'KLYX_SETTLEMENT_REFUND_REVERSAL_REQUIRED';
  end if;

  update public.booking_settlements
     set state = 'refunded',
         refunded_at = coalesce(refunded_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where booking_id = new.id;

  return new;
end;
$$;

-- Replace the historical Single Settlement ledger mirror so partial
-- pre-release refunds cannot overstate Transfer/provider-liability discharge.
-- New refund reversals are appended by the server state machine and therefore
-- suppress the legacy one-reversal mirror to prevent double counting.
create or replace function public.klyx_mirror_booking_settlement_to_central()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_payment_identity text;
  v_occurred_at timestamptz := coalesce(new.updated_at, now());
  v_released_provider_amount bigint;
begin
  select coalesce(b.provider_id, b.babysitter_id)
    into v_provider_id
    from public.bookings as b
   where b.id = new.booking_id;

  if v_provider_id is null then
    v_provider_id := new.provider_profile_id;
  end if;

  v_payment_identity := coalesce(
    nullif(trim(new.stripe_payment_intent_id), ''),
    nullif(trim(new.stripe_checkout_session_id), ''),
    new.booking_id::text
  );

  v_released_provider_amount := case
    when coalesce(new.released_provider_amount_cents, 0) > 0
      then new.released_provider_amount_cents
    else new.provider_amount_cents
  end;

  if new.stripe_charge_id is not null
     and (
       tg_op = 'INSERT'
       or old.stripe_charge_id is distinct from new.stripe_charge_id
     ) then
    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':charge:', v_payment_identity),
      concat('settlement:', new.booking_id, ':charge:', new.stripe_charge_id),
      'charge',
      greatest(new.gross_amount_cents, 0),
      new.currency,
      new.booking_id,
      'platform',
      'klyx',
      'settlement_charge_truth_observed',
      'settlement',
      case when tg_op = 'UPDATE' then old.state else null end,
      new.state,
      v_occurred_at,
      new.stripe_account_id,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      new.stripe_charge_id,
      new.stripe_transfer_id,
      new.stripe_transfer_reversal_id,
      null,
      null,
      '{}'::jsonb
    );
  end if;

  if new.stripe_transfer_id is not null
     and (
       tg_op = 'INSERT'
       or old.stripe_transfer_id is distinct from new.stripe_transfer_id
     ) then
    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':transfer:', new.stripe_transfer_id),
      concat('settlement:', new.booking_id, ':transfer:', new.stripe_transfer_id),
      'transfer',
      greatest(v_released_provider_amount, 0),
      new.currency,
      new.booking_id,
      'provider',
      public.klyx_financial_beneficiary_account_ref(v_provider_id, new.booking_id, 'provider'),
      'settlement_release',
      'settlement',
      case when tg_op = 'UPDATE' then old.state else null end,
      new.state,
      v_occurred_at,
      new.stripe_account_id,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      new.stripe_charge_id,
      new.stripe_transfer_id,
      new.stripe_transfer_reversal_id,
      null,
      null,
      jsonb_build_object('transfer_group', new.transfer_group)
    );

    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':provider-liability:', v_payment_identity),
      concat('settlement:', new.booking_id, ':provider-liability:released:', new.stripe_transfer_id),
      'provider_liability',
      greatest(v_released_provider_amount, 0),
      new.currency,
      new.booking_id,
      'provider',
      public.klyx_financial_beneficiary_account_ref(v_provider_id, new.booking_id, 'provider'),
      'settlement_release',
      'settlement',
      'recognized',
      'discharged',
      v_occurred_at,
      new.stripe_account_id,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      new.stripe_charge_id,
      new.stripe_transfer_id,
      null,
      null,
      null,
      jsonb_build_object('transfer_group', new.transfer_group)
    );
  end if;

  if new.stripe_transfer_reversal_id is not null
     and (
       tg_op = 'INSERT'
       or old.stripe_transfer_reversal_id is distinct from new.stripe_transfer_reversal_id
     )
     and not exists (
       select 1
         from public.platform_held_booking_refund_reversals r
        where r.booking_id = new.booking_id
     ) then
    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':reversal:', new.stripe_transfer_reversal_id),
      concat('settlement:', new.booking_id, ':reversal:', new.stripe_transfer_reversal_id),
      'reversal',
      greatest(v_released_provider_amount, 0),
      new.currency,
      new.booking_id,
      'platform',
      'klyx',
      'provider_transfer_reversal',
      'settlement',
      case when tg_op = 'UPDATE' then old.state else null end,
      new.state,
      v_occurred_at,
      new.stripe_account_id,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      new.stripe_charge_id,
      new.stripe_transfer_id,
      new.stripe_transfer_reversal_id,
      null,
      null,
      jsonb_build_object('transfer_group', new.transfer_group)
    );

    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':provider-liability:', v_payment_identity),
      concat('settlement:', new.booking_id, ':provider-liability:reversed:', new.stripe_transfer_reversal_id),
      'provider_liability',
      greatest(v_released_provider_amount, 0),
      new.currency,
      new.booking_id,
      'provider',
      public.klyx_financial_beneficiary_account_ref(v_provider_id, new.booking_id, 'provider'),
      'provider_transfer_reversal',
      'settlement',
      'discharged',
      'reversed',
      v_occurred_at,
      new.stripe_account_id,
      new.stripe_checkout_session_id,
      new.stripe_payment_intent_id,
      new.stripe_charge_id,
      new.stripe_transfer_id,
      new.stripe_transfer_reversal_id,
      null,
      null,
      jsonb_build_object('transfer_group', new.transfer_group)
    );
  end if;

  return new;
end;
$$;

create or replace function public.klyx_reconcile_booking_settlement_release(
  p_booking_id uuid,
  p_stripe_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
  v_settlement public.booking_settlements%rowtype;
  v_release_amount bigint;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_SETTLEMENT_TRANSFER_ID_INVALID';
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if not found then
    return false;
  end if;

  v_release_amount :=
    v_settlement.provider_amount_cents
      - v_settlement.refunded_provider_amount_cents;

  if v_release_amount <= 0 then
    return false;
  end if;

  if v_settlement.stripe_transfer_id is not null then
    if v_settlement.stripe_transfer_id <> p_stripe_transfer_id then
      return false;
    end if;

    update public.booking_settlements
       set released_provider_amount_cents = v_release_amount,
           updated_at = now()
     where booking_id = p_booking_id
       and released_provider_amount_cents is distinct from v_release_amount;

    return true;
  end if;

  update public.booking_settlements
     set state = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         released_provider_amount_cents = v_release_amount,
         released_at = now(),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where booking_id = p_booking_id
     and state = 'release_claimed';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_reconcile_booking_settlement_released(
  p_booking_id uuid,
  p_stripe_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.booking_settlements%rowtype;
  v_booking record;
  v_release_amount bigint;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_SETTLEMENT_TRANSFER_ID_INVALID';
  end if;

  select s.*
    into v_settlement
    from public.booking_settlements as s
   where s.booking_id = p_booking_id
   for update;

  if not found then
    return false;
  end if;

  select
    b.status,
    b.payment_status,
    b.refund_status,
    b.payment_mode,
    b.booking_group_id
    into v_booking
    from public.bookings as b
   where b.id = p_booking_id;

  if not found then
    return false;
  end if;

  if v_settlement.stripe_transfer_id is distinct from p_stripe_transfer_id then
    return false;
  end if;

  if v_settlement.state in ('human_review', 'refund_pending', 'refunded')
     or coalesce(v_booking.refund_status, '') in ('processing', 'succeeded')
     or coalesce(v_booking.payment_status, '') = 'refunded' then
    return false;
  end if;

  if coalesce(v_booking.status, '') <> 'completed'
     or coalesce(v_booking.payment_status, '') <> 'paid'
     or coalesce(v_booking.payment_mode, '') <> 'platform_held'
     or v_booking.booking_group_id is not null
     or v_settlement.state not in (
       'held',
       'release_claimed',
       'release_failed',
       'released'
     ) then
    return false;
  end if;

  v_release_amount :=
    v_settlement.provider_amount_cents
      - v_settlement.refunded_provider_amount_cents;

  if v_release_amount <= 0 then
    return false;
  end if;

  update public.booking_settlements
     set state = 'released',
         released_provider_amount_cents = v_release_amount,
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         last_reconciled_at = now(),
         updated_at = now()
   where booking_id = p_booking_id;

  return true;
end;
$$;

revoke all on function public.klyx_create_platform_held_booking_refund_plan(
  uuid, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_booking_refund_reversal(
  uuid, text, text, bigint
) from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_booking_refund_inflight(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_booking_refund_review(
  uuid, text, text
) from public, anon, authenticated;
revoke all on function public.klyx_fail_platform_held_booking_refund(
  uuid, text, text
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_booking_refund(
  uuid, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.klyx_booking_settlement_remaining_provider_amount(
  uuid, uuid
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_booking_settlement_release(
  uuid, uuid, text
) from public, anon, authenticated;

grant execute on function public.klyx_create_platform_held_booking_refund_plan(
  uuid, text, bigint, text
) to service_role;
grant execute on function public.klyx_finalize_platform_held_booking_refund_reversal(
  uuid, text, text, bigint
) to service_role;
grant execute on function public.klyx_mark_platform_held_booking_refund_inflight(uuid)
  to service_role;
grant execute on function public.klyx_mark_platform_held_booking_refund_review(
  uuid, text, text
) to service_role;
grant execute on function public.klyx_fail_platform_held_booking_refund(
  uuid, text, text
) to service_role;
grant execute on function public.klyx_finalize_platform_held_booking_refund(
  uuid, text, bigint, text
) to service_role;
grant execute on function public.klyx_booking_settlement_remaining_provider_amount(
  uuid, uuid
) to service_role;
grant execute on function public.klyx_finalize_booking_settlement_release(
  uuid, uuid, text
) to service_role;

comment on table public.platform_held_booking_refunds is
  'Server-only idempotent refund plans for single-booking Platform-Held settlement.';
comment on table public.platform_held_booking_refund_reversals is
  'Immutable Stripe TransferReversal truth for single-booking Platform-Held refund plans.';
comment on column public.booking_settlements.refunded_amount_cents is
  'Cumulative succeeded gross refund truth for the single settlement.';
comment on column public.booking_settlements.refunded_platform_fee_cents is
  'Cumulative succeeded KLYX commission refund allocated with canonical nearest-cent rounding.';
comment on column public.booking_settlements.refunded_provider_amount_cents is
  'Cumulative succeeded provider-liability refund allocation.';
comment on column public.booking_settlements.released_provider_amount_cents is
  'Actual provider amount released by Stripe Transfer after pre-release refunds.';
comment on column public.booking_settlements.reversed_provider_amount_cents is
  'Cumulative provider funds reversed from Stripe Transfers.';

commit;

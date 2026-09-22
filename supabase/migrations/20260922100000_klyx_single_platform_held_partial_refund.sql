-- KLYX Single Platform-Held partial refund authority.
--
-- Additive only:
-- - immutable/idempotent child refund plans per booking + request_key;
-- - multiple child TransferReversal truths;
-- - cumulative actual Settlement amounts on booking_settlements;
-- - release after a successful pre-release partial refund transfers only the
--   remaining provider liability;
-- - canonical ledger mirrors actual net Transfer and every child Reversal.
--
-- No Stripe side effect is executed by this migration.

begin;

alter table public.booking_settlements
  add column if not exists release_claim_amount_cents bigint not null default 0,
  add column if not exists released_amount_cents bigint not null default 0,
  add column if not exists refunded_gross_amount_cents bigint not null default 0,
  add column if not exists refunded_platform_fee_cents bigint not null default 0,
  add column if not exists refunded_provider_amount_cents bigint not null default 0,
  add column if not exists reversed_amount_cents bigint not null default 0;

with truth as (
  select
    s.booking_id,
    case
      when s.stripe_transfer_id is not null
        then s.provider_amount_cents::bigint
      else 0::bigint
    end as released_amount,
    case
      when s.stripe_transfer_reversal_id is not null
        then s.provider_amount_cents::bigint
      else 0::bigint
    end as reversed_amount,
    least(
      s.gross_amount_cents::bigint,
      greatest(
        coalesce(b.refunded_amount_cents, 0)::bigint,
        case
          when s.state = 'refunded' then s.gross_amount_cents::bigint
          else 0::bigint
        end
      )
    ) as refunded_gross
  from public.booking_settlements s
  join public.bookings b on b.id = s.booking_id
)
update public.booking_settlements s
   set released_amount_cents = greatest(s.released_amount_cents, t.released_amount),
       reversed_amount_cents = greatest(s.reversed_amount_cents, t.reversed_amount),
       refunded_gross_amount_cents =
         greatest(s.refunded_gross_amount_cents, t.refunded_gross),
       refunded_platform_fee_cents =
         greatest(
           s.refunded_platform_fee_cents,
           case
             when t.refunded_gross > 0 then
               round(
                 s.platform_fee_cents::numeric
                 * t.refunded_gross::numeric
                 / s.gross_amount_cents::numeric
               )::bigint
             else 0::bigint
           end
         ),
       refunded_provider_amount_cents =
         greatest(
           s.refunded_provider_amount_cents,
           t.refunded_gross -
             case
               when t.refunded_gross > 0 then
                 round(
                   s.platform_fee_cents::numeric
                   * t.refunded_gross::numeric
                   / s.gross_amount_cents::numeric
                 )::bigint
               else 0::bigint
             end
         )
  from truth t
 where t.booking_id = s.booking_id;

alter table public.booking_settlements
  drop constraint if exists klyx_booking_settlement_actual_amounts_check;
alter table public.booking_settlements
  add constraint klyx_booking_settlement_actual_amounts_check
  check (
    release_claim_amount_cents >= 0
    and release_claim_amount_cents <= provider_amount_cents
    and released_amount_cents >= 0
    and released_amount_cents <= provider_amount_cents
    and reversed_amount_cents >= 0
    and reversed_amount_cents <= released_amount_cents
    and refunded_gross_amount_cents >= 0
    and refunded_gross_amount_cents <= gross_amount_cents
    and refunded_platform_fee_cents >= 0
    and refunded_platform_fee_cents <= platform_fee_cents
    and refunded_provider_amount_cents >= 0
    and refunded_provider_amount_cents <= provider_amount_cents
    and refunded_platform_fee_cents + refunded_provider_amount_cents
      = refunded_gross_amount_cents
  );

create table if not exists public.platform_held_booking_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.booking_settlements(booking_id) on delete restrict,
  request_key text not null
    check (char_length(request_key) between 3 and 128),
  currency text not null
    check (currency ~ '^[A-Z]{3}$'),
  gross_refund_cents bigint not null
    check (gross_refund_cents > 0),
  platform_fee_refund_cents bigint not null
    check (platform_fee_refund_cents >= 0),
  provider_refund_cents bigint not null
    check (provider_refund_cents >= 0),
  state text not null
    check (state in (
      'ready',
      'reversal_required',
      'refunding',
      'succeeded',
      'failed',
      'review_required'
    )),
  stripe_refund_id text,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint klyx_platform_held_booking_refund_request_unique
    unique (booking_id, request_key),
  constraint klyx_platform_held_booking_refund_economics
    check (
      platform_fee_refund_cents + provider_refund_cents
      = gross_refund_cents
    )
);

create unique index if not exists platform_held_booking_refund_stripe_uidx
  on public.platform_held_booking_refunds(stripe_refund_id)
  where stripe_refund_id is not null;

create index if not exists platform_held_booking_refund_booking_state_idx
  on public.platform_held_booking_refunds(booking_id, state, created_at);

create table if not exists public.platform_held_booking_reversals (
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
alter table public.platform_held_booking_reversals enable row level security;

revoke all privileges on table public.platform_held_booking_refunds
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_booking_reversals
  from public, anon, authenticated;
grant select, insert, update, delete on table public.platform_held_booking_refunds
  to service_role;
grant select, insert, update, delete on table public.platform_held_booking_reversals
  to service_role;

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
  v_parent public.booking_settlements%rowtype;
  v_booking record;
  v_existing public.platform_held_booking_refunds%rowtype;
  v_pending_gross bigint := 0;
  v_pending_fee bigint := 0;
  v_pending_provider bigint := 0;
  v_prior_gross bigint := 0;
  v_prior_fee bigint := 0;
  v_prior_provider bigint := 0;
  v_cumulative_gross bigint := 0;
  v_target_fee bigint := 0;
  v_target_provider bigint := 0;
  v_delta_fee bigint := 0;
  v_delta_provider bigint := 0;
  v_state text;
  v_id uuid;
begin
  if p_booking_id is null
     or coalesce(trim(p_request_key), '') !~ '^[A-Za-z0-9:_-]{3,128}$'
     or p_amount_cents <= 0
     or upper(coalesce(trim(p_currency), '')) !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_SINGLE_REFUND_REQUEST_INVALID';
  end if;

  select s.*
    into v_parent
    from public.booking_settlements s
   where s.booking_id = p_booking_id
   for update;

  if not found
     or v_parent.payment_mode <> 'platform_held'
     or v_parent.state in ('refund_pending', 'refunded', 'review_required', 'human_review')
     or coalesce(trim(v_parent.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_SINGLE_REFUND_SETTLEMENT_NOT_READY';
  end if;

  select
    b.parent_id,
    b.booking_group_id,
    b.payment_status,
    b.payment_mode
    into v_booking
    from public.bookings b
   where b.id = p_booking_id;

  if not found
     or v_booking.booking_group_id is not null
     or coalesce(v_booking.payment_mode, '') <> 'platform_held'
     or coalesce(v_booking.payment_status, '') not in ('paid', 'refunded') then
    raise exception 'KLYX_SINGLE_REFUND_BOOKING_NOT_READY';
  end if;

  select *
    into v_existing
    from public.platform_held_booking_refunds
   where booking_id = p_booking_id
     and request_key = trim(p_request_key);

  if found then
    if v_existing.gross_refund_cents = p_amount_cents
       and v_existing.currency = upper(trim(p_currency)) then
      return v_existing.id;
    end if;
    raise exception 'KLYX_SINGLE_REFUND_REQUEST_KEY_CONFLICT';
  end if;

  if v_parent.release_claim_token is not null
     or v_parent.state = 'release_claimed' then
    raise exception 'KLYX_SINGLE_REFUND_RELEASE_BUSY';
  end if;

  if exists (
    select 1
      from public.platform_held_booking_refunds r
     where r.booking_id = p_booking_id
       and r.state = 'review_required'
  ) then
    raise exception 'KLYX_SINGLE_REFUND_REVIEW_REQUIRED';
  end if;

  select
    coalesce(sum(r.gross_refund_cents), 0),
    coalesce(sum(r.platform_fee_refund_cents), 0),
    coalesce(sum(r.provider_refund_cents), 0)
    into v_pending_gross, v_pending_fee, v_pending_provider
    from public.platform_held_booking_refunds r
   where r.booking_id = p_booking_id
     and r.state in ('ready', 'reversal_required', 'refunding');

  v_prior_gross :=
    v_parent.refunded_gross_amount_cents + v_pending_gross;
  v_prior_fee :=
    v_parent.refunded_platform_fee_cents + v_pending_fee;
  v_prior_provider :=
    v_parent.refunded_provider_amount_cents + v_pending_provider;

  v_cumulative_gross := v_prior_gross + p_amount_cents;

  if v_cumulative_gross > v_parent.gross_amount_cents then
    raise exception 'KLYX_SINGLE_REFUND_EXCEEDS_GROSS';
  end if;

  v_target_fee := round(
    v_parent.platform_fee_cents::numeric
      * v_cumulative_gross::numeric
      / v_parent.gross_amount_cents::numeric
  )::bigint;
  v_target_provider := v_cumulative_gross - v_target_fee;
  v_delta_fee := v_target_fee - v_prior_fee;
  v_delta_provider := v_target_provider - v_prior_provider;

  if v_delta_fee < 0
     or v_delta_provider < 0
     or v_delta_fee + v_delta_provider <> p_amount_cents then
    raise exception 'KLYX_SINGLE_REFUND_ALLOCATION_MISMATCH';
  end if;

  if v_parent.stripe_transfer_id is not null
     and v_delta_provider > 0 then
    if v_parent.released_amount_cents - v_parent.reversed_amount_cents
       < v_delta_provider then
      raise exception 'KLYX_SINGLE_REFUND_REVERSAL_EXCEEDS_RELEASED';
    end if;
    v_state := 'reversal_required';
  else
    v_state := 'ready';
  end if;

  insert into public.platform_held_booking_refunds (
    booking_id,
    request_key,
    currency,
    gross_refund_cents,
    platform_fee_refund_cents,
    provider_refund_cents,
    state
  ) values (
    p_booking_id,
    trim(p_request_key),
    upper(trim(p_currency)),
    p_amount_cents,
    v_delta_fee,
    v_delta_provider,
    v_state
  )
  returning id into v_id;

  return v_id;
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
  v_state text;
begin
  select state
    into v_state
    from public.platform_held_booking_refunds
   where id = p_refund_id
   for update;

  if not found then return false; end if;
  if v_state in ('refunding', 'succeeded') then return true; end if;
  if v_state <> 'ready' then return false; end if;

  update public.platform_held_booking_refunds
     set state = 'refunding',
         updated_at = now()
   where id = p_refund_id;

  return true;
end;
$$;

create or replace function public.klyx_finalize_platform_held_booking_reversal(
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
  v_parent public.booking_settlements%rowtype;
  v_existing public.platform_held_booking_reversals%rowtype;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9_]+$'
     or coalesce(trim(p_stripe_transfer_reversal_id), '') !~ '^trr_[A-Za-z0-9_]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_SINGLE_REVERSAL_TRUTH_INVALID';
  end if;

  select *
    into v_refund
    from public.platform_held_booking_refunds
   where id = p_refund_id
   for update;

  if not found then return false; end if;

  select *
    into v_existing
    from public.platform_held_booking_reversals
   where refund_id = p_refund_id;

  if found then
    return v_existing.stripe_transfer_id = p_stripe_transfer_id
       and v_existing.stripe_transfer_reversal_id = p_stripe_transfer_reversal_id
       and v_existing.amount_cents = p_amount_cents;
  end if;

  if v_refund.state <> 'reversal_required'
     or v_refund.provider_refund_cents <> p_amount_cents then
    return false;
  end if;

  select *
    into v_parent
    from public.booking_settlements
   where booking_id = v_refund.booking_id
   for update;

  if not found
     or v_parent.stripe_transfer_id <> p_stripe_transfer_id
     or v_parent.reversed_amount_cents + p_amount_cents
        > v_parent.released_amount_cents then
    return false;
  end if;

  insert into public.platform_held_booking_reversals (
    refund_id,
    booking_id,
    stripe_transfer_id,
    stripe_transfer_reversal_id,
    amount_cents
  ) values (
    v_refund.id,
    v_refund.booking_id,
    p_stripe_transfer_id,
    p_stripe_transfer_reversal_id,
    p_amount_cents
  );

  update public.booking_settlements
     set reversed_amount_cents = reversed_amount_cents + p_amount_cents,
         updated_at = now()
   where booking_id = v_refund.booking_id;

  update public.platform_held_booking_refunds
     set state = 'ready',
         updated_at = now()
   where id = v_refund.id;

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
  v_parent public.booking_settlements%rowtype;
  v_new_gross bigint;
  v_new_fee bigint;
  v_new_provider bigint;
begin
  if coalesce(trim(p_stripe_refund_id), '') !~ '^re_[A-Za-z0-9_]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_SINGLE_REFUND_TRUTH_INVALID';
  end if;

  select *
    into v_refund
    from public.platform_held_booking_refunds
   where id = p_refund_id
   for update;

  if not found then return false; end if;

  if v_refund.state = 'succeeded' then
    return v_refund.stripe_refund_id = p_stripe_refund_id
       and v_refund.gross_refund_cents = p_amount_cents
       and v_refund.currency = upper(trim(p_currency));
  end if;

  if v_refund.state not in ('ready', 'refunding')
     or v_refund.gross_refund_cents <> p_amount_cents
     or v_refund.currency <> upper(trim(p_currency))
     or (
       v_refund.provider_refund_cents > 0
       and exists (
         select 1
           from public.booking_settlements s
          where s.booking_id = v_refund.booking_id
            and s.stripe_transfer_id is not null
       )
       and not exists (
         select 1
           from public.platform_held_booking_reversals r
          where r.refund_id = v_refund.id
       )
     ) then
    return false;
  end if;

  select *
    into v_parent
    from public.booking_settlements
   where booking_id = v_refund.booking_id
   for update;

  v_new_gross :=
    v_parent.refunded_gross_amount_cents + v_refund.gross_refund_cents;
  v_new_fee :=
    v_parent.refunded_platform_fee_cents + v_refund.platform_fee_refund_cents;
  v_new_provider :=
    v_parent.refunded_provider_amount_cents + v_refund.provider_refund_cents;

  if v_new_gross > v_parent.gross_amount_cents
     or v_new_fee > v_parent.platform_fee_cents
     or v_new_provider > v_parent.provider_amount_cents
     or v_new_fee + v_new_provider <> v_new_gross then
    raise exception 'KLYX_SINGLE_REFUND_CUMULATIVE_ACCOUNTING_MISMATCH';
  end if;

  update public.platform_held_booking_refunds
     set state = 'succeeded',
         stripe_refund_id = p_stripe_refund_id,
         completed_at = coalesce(completed_at, now()),
         failure_code = null,
         failure_message = null,
         updated_at = now()
   where id = v_refund.id;

  update public.booking_settlements
     set refunded_gross_amount_cents = v_new_gross,
         refunded_platform_fee_cents = v_new_fee,
         refunded_provider_amount_cents = v_new_provider,
         state = case
           when v_new_gross = gross_amount_cents
             and reversed_amount_cents >= released_amount_cents
             then 'refunded'
           else state
         end,
         refunded_at = case
           when v_new_gross = gross_amount_cents
             and reversed_amount_cents >= released_amount_cents
             then coalesce(refunded_at, now())
           else refunded_at
         end,
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

  if not found then return false; end if;

  select exists (
    select 1
      from public.platform_held_booking_reversals r
     where r.refund_id = p_refund_id
  ) into v_has_reversal;

  if v_has_reversal then
    update public.platform_held_booking_refunds
       set state = 'review_required',
           failure_code = left(coalesce(p_error_code, 'single_refund_failed_after_reversal'), 120),
           failure_message = left(coalesce(p_error_message, 'Refund failed after provider reversal.'), 1000),
           updated_at = now()
     where id = p_refund_id;

    update public.booking_settlements
       set state = 'review_required',
           last_error_code = 'single_refund_failed_after_reversal',
           last_error_message = left(
             coalesce(p_error_message, 'Refund failed after provider reversal.'),
             1000
           ),
           updated_at = now()
     where booking_id = v_refund.booking_id;

    return true;
  end if;

  update public.platform_held_booking_refunds
     set state = 'failed',
         failure_code = left(coalesce(p_error_code, 'single_refund_failed'), 120),
         failure_message = left(coalesce(p_error_message, 'Refund failed.'), 1000),
         updated_at = now()
   where id = p_refund_id
     and state in ('ready', 'refunding', 'reversal_required');

  return found;
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
  v_booking_id uuid;
begin
  update public.platform_held_booking_refunds
     set state = 'review_required',
         failure_code = left(coalesce(p_error_code, 'single_refund_review_required'), 120),
         failure_message = left(coalesce(p_error_message, 'Single refund requires review.'), 1000),
         updated_at = now()
   where id = p_refund_id
   returning booking_id into v_booking_id;

  if not found then return false; end if;

  update public.booking_settlements
     set state = 'review_required',
         last_error_code = left(coalesce(p_error_code, 'single_refund_review_required'), 120),
         last_error_message = left(coalesce(p_error_message, 'Single refund requires review.'), 1000),
         updated_at = now()
   where booking_id = v_booking_id;

  return true;
end;
$$;

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
  v_profile_account_id uuid;
  v_profile_owner_user_id uuid;
  v_account_id uuid;
  v_account_stripe_id text;
  v_account_connect_state text;
  v_economic_allowed boolean := false;
  v_risk_allowed boolean := false;
  v_child_refund_count integer := 0;
  v_active_refund_count integer := 0;
  v_release_amount bigint := 0;
begin
  if p_claim_token is null then
    raise exception 'KLYX_SETTLEMENT_CLAIM_TOKEN_REQUIRED';
  end if;

  select s.*
    into v_settlement
    from public.booking_settlements as s
   where s.booking_id = p_booking_id
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
             (
               case
                 when v_settlement.released_amount_cents > 0
                   then v_settlement.released_amount_cents
                 else v_settlement.provider_amount_cents::bigint
               end
             )::integer,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  if v_settlement.state in ('refund_pending', 'refunded', 'review_required', 'human_review') then
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

  select b.status, b.payment_status, b.refund_status, b.payment_mode, b.booking_group_id
    into v_booking
    from public.bookings as b
   where b.id = p_booking_id;

  if not found
     or coalesce(v_booking.status, '') <> 'completed'
     or coalesce(v_booking.payment_status, '') <> 'paid'
     or coalesce(v_booking.payment_mode, '') <> 'platform_held'
     or v_booking.booking_group_id is not null
     or coalesce(v_booking.refund_status, '') = 'succeeded'
     or v_settlement.state not in ('held', 'release_failed', 'release_claimed')
     or coalesce(trim(v_settlement.stripe_payment_intent_id), '') = ''
     or coalesce(trim(v_settlement.stripe_charge_id), '') = '' then
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

  select
    count(*),
    count(*) filter (
      where r.state in (
        'ready',
        'reversal_required',
        'refunding',
        'review_required'
      )
    )
    into v_child_refund_count, v_active_refund_count
    from public.platform_held_booking_refunds as r
   where r.booking_id = p_booking_id
     and r.state <> 'failed';

  -- A legacy refund that is processing without a child plan remains blocked.
  -- New partial refunds may leave bookings.refund_status='processing' after
  -- Stripe success; the child authority + parent cumulative amounts are then
  -- the settlement source of truth.
  if v_active_refund_count > 0
     or (
       coalesce(v_booking.refund_status, '') = 'processing'
       and v_child_refund_count = 0
     ) then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             0::integer,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  v_release_amount :=
    v_settlement.provider_amount_cents
      - v_settlement.refunded_provider_amount_cents;

  if v_release_amount <= 0 then
    return query
      select 'not_ready'::text,
             v_settlement.release_attempt_number,
             v_settlement.provider_profile_id,
             v_settlement.stripe_account_id,
             0::integer,
             v_settlement.currency,
             v_settlement.stripe_payment_intent_id,
             v_settlement.stripe_charge_id,
             v_settlement.transfer_group;
    return;
  end if;

  select p.account_id, p.owner_user_id
    into v_profile_account_id, v_profile_owner_user_id
    from public.profiles as p
   where p.id = v_settlement.provider_profile_id;

  if not found then
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

  v_account_id := v_profile_account_id;

  if v_account_id is null then
    select a.id
      into v_account_id
      from public.accounts as a
     where a.auth_user_id = v_profile_owner_user_id
     limit 1;
  end if;

  if v_account_id is null then
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

  select identity.stripe_account_id, identity.identity_state
    into v_account_stripe_id, v_account_connect_state
    from public.account_stripe_connect_identities as identity
   where identity.account_id = v_account_id;

  if not found
     or coalesce(v_account_connect_state, '') <> 'linked'
     or v_account_stripe_id is distinct from v_settlement.stripe_account_id then
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

  select exists (
    select 1
      from public.economic_settlement_eligibility_decisions as d
     where d.account_id = v_account_id
       and d.subject_type = 'booking'
       and d.subject_id = p_booking_id::text
       and d.stripe_account_id = v_settlement.stripe_account_id
       and d.decision = 'allowed'
       and d.evaluated_at >= now() - interval '5 minutes'
       and d.expires_at > now()
  ) into v_economic_allowed;

  if not v_economic_allowed then
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

  select exists (
    select 1
      from public.transaction_risk_decisions as d
     where d.account_id = v_account_id
       and d.action = 'settlement_release'
       and d.participant = 'settlement_recipient'
       and d.subject_type = 'booking'
       and d.subject_id = p_booking_id::text
       and d.decision = 'allow'
       and d.risk_assessed_at >= now() - interval '5 minutes'
  ) into v_risk_allowed;

  if not v_risk_allowed then
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

  update public.booking_settlements as s
     set state = 'release_claimed',
         release_attempt_number = s.release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         release_claim_amount_cents = v_release_amount,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where s.booking_id = p_booking_id
   returning s.* into v_settlement;

  return query
    select 'create'::text,
           v_settlement.release_attempt_number,
           v_settlement.provider_profile_id,
           v_settlement.stripe_account_id,
           v_settlement.release_claim_amount_cents::integer,
           v_settlement.currency,
           v_settlement.stripe_payment_intent_id,
           v_settlement.stripe_charge_id,
           v_settlement.transfer_group;
end;
$;

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
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_SETTLEMENT_TRANSFER_ID_INVALID';
  end if;

  update public.booking_settlements
     set state = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         released_amount_cents = release_claim_amount_cents,
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = 0,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where booking_id = p_booking_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token
     and release_claim_amount_cents > 0;

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
         release_claim_amount_cents = 0,
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
  v_settlement public.booking_settlements%rowtype;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_SETTLEMENT_TRANSFER_ID_INVALID';
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if not found then return false; end if;

  if v_settlement.stripe_transfer_id is not null then
    return v_settlement.stripe_transfer_id = p_stripe_transfer_id;
  end if;

  if v_settlement.state <> 'release_claimed'
     or v_settlement.release_claim_amount_cents <= 0 then
    return false;
  end if;

  update public.booking_settlements
     set state = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         released_amount_cents = release_claim_amount_cents,
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = 0,
         last_error_code = null,
         last_error_message = null,
         last_reconciled_at = now(),
         updated_at = now()
   where booking_id = p_booking_id;

  return true;
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
  v_settlement public.booking_settlements%rowtype;
begin
  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if not found or v_settlement.state = 'human_review' then
    return false;
  end if;

  -- Backward-compatible legacy full-refund truth.
  if v_settlement.refunded_gross_amount_cents = 0 then
    update public.booking_settlements
       set refunded_gross_amount_cents = gross_amount_cents,
           refunded_platform_fee_cents = platform_fee_cents,
           refunded_provider_amount_cents = provider_amount_cents,
           reversed_amount_cents = case
             when stripe_transfer_reversal_id is not null
               then greatest(reversed_amount_cents, released_amount_cents)
             else reversed_amount_cents
           end
     where booking_id = p_booking_id
     returning * into v_settlement;
  end if;

  if v_settlement.refunded_gross_amount_cents <> v_settlement.gross_amount_cents
     or (
       v_settlement.stripe_transfer_id is not null
       and v_settlement.reversed_amount_cents < v_settlement.released_amount_cents
     ) then
    return false;
  end if;

  update public.booking_settlements
     set state = 'refunded',
         refunded_at = coalesce(refunded_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = 0,
         last_reconciled_at = now(),
         updated_at = now()
   where booking_id = p_booking_id;

  return true;
end;
$$;

create or replace function public.klyx_reconcile_booking_settlement_refund_terminal(
  p_booking_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
begin
  select payment_status, refund_status, payment_mode
    into v_booking
    from public.bookings
   where id = p_booking_id;

  if not found
     or coalesce(v_booking.payment_mode, '') <> 'platform_held'
     or (
       coalesce(v_booking.payment_status, '') <> 'refunded'
       and coalesce(v_booking.refund_status, '') <> 'succeeded'
     ) then
    return false;
  end if;

  return public.klyx_mark_booking_settlement_refunded(p_booking_id);
end;
$$;

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
      greatest(
        case
          when new.released_amount_cents > 0
            then new.released_amount_cents
          else new.provider_amount_cents
        end,
        0
      ),
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
      greatest(new.provider_amount_cents, 0),
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
     ) then
    perform public.klyx_append_financial_ledger_event(
      concat('booking:', new.booking_id, ':reversal:', new.stripe_transfer_reversal_id),
      concat('settlement:', new.booking_id, ':reversal:', new.stripe_transfer_reversal_id),
      'reversal',
      greatest(new.provider_amount_cents, 0),
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
      greatest(new.provider_amount_cents, 0),
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

create or replace function public.klyx_mirror_platform_held_booking_reversal_to_central()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.booking_settlements%rowtype;
begin
  select *
    into v_parent
    from public.booking_settlements
   where booking_id = new.booking_id;

  if not found then
    raise exception 'KLYX_SINGLE_REVERSAL_SETTLEMENT_REQUIRED';
  end if;

  perform public.klyx_append_financial_ledger_event(
    concat('booking:', new.booking_id, ':reversal:', new.stripe_transfer_reversal_id),
    concat('single-refund-reversal:', new.id),
    'reversal',
    new.amount_cents,
    v_parent.currency,
    new.booking_id,
    'platform',
    'klyx',
    'single_settlement_transfer_reversal',
    'settlement',
    'released',
    'reversal_recorded',
    new.created_at,
    v_parent.stripe_account_id,
    v_parent.stripe_checkout_session_id,
    v_parent.stripe_payment_intent_id,
    v_parent.stripe_charge_id,
    new.stripe_transfer_id,
    new.stripe_transfer_reversal_id,
    null,
    null,
    jsonb_build_object(
      'settlement_model', 'platform_held',
      'refund_id', new.refund_id
    )
  );

  return new;
end;
$$;

drop trigger if exists platform_held_booking_reversal_central_ledger_mirror
  on public.platform_held_booking_reversals;
create trigger platform_held_booking_reversal_central_ledger_mirror
after insert on public.platform_held_booking_reversals
for each row
execute function public.klyx_mirror_platform_held_booking_reversal_to_central();

revoke all on function public.klyx_create_platform_held_booking_refund_plan(uuid, text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_booking_refund_inflight(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_booking_reversal(uuid, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_booking_refund(uuid, text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_platform_held_booking_refund(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_booking_refund_review(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mirror_platform_held_booking_reversal_to_central()
  from public, anon, authenticated;

grant execute on function public.klyx_create_platform_held_booking_refund_plan(uuid, text, bigint, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_booking_refund_inflight(uuid)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_booking_reversal(uuid, text, text, bigint)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_booking_refund(uuid, text, bigint, text)
  to service_role;
grant execute on function public.klyx_fail_platform_held_booking_refund(uuid, text, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_booking_refund_review(uuid, text, text)
  to service_role;

comment on table public.platform_held_booking_refunds is
  'Server-only immutable/idempotent Single Platform-Held refund plans. Frozen delta economics prevent penny drift across repeated partial refunds.';
comment on table public.platform_held_booking_reversals is
  'One observed Stripe TransferReversal per Single refund plan. Multiple partial reversals are represented as child truth instead of overwriting booking_settlements.stripe_transfer_reversal_id.';
comment on function public.klyx_create_platform_held_booking_refund_plan(uuid, text, bigint, text) is
  'Serializes Single refund planning on booking_settlements and freezes cumulative KLYX/provider allocation deltas.';
comment on function public.klyx_finalize_platform_held_booking_refund(uuid, text, bigint, text) is
  'Finalizes one succeeded Stripe refund into cumulative Single Settlement truth without silently correcting divergent Stripe data.';

commit;

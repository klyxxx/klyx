-- KLYX Single Platform-Held partial refund authority.
--
-- Additive only:
--   * no Stripe side effect is executed by SQL;
--   * no LIVE activation;
--   * existing legacy full-refund path remains compatible when no child plan exists.
--
-- Canonical rule:
-- cumulative gross refund -> cumulative rounded platform fee target -> delta
-- provider refund. This is the SQL equivalent of calculateCumulativeRefundDelta.

begin;

create table public.platform_held_booking_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.booking_settlements(booking_id) on delete restrict,
  request_key text not null
    check (request_key ~ '^[A-Za-z0-9:_-]{3,128}$'),
  currency text not null
    check (currency ~ '^[A-Z]{3}$'),
  gross_refund_cents bigint not null check (gross_refund_cents > 0),
  platform_fee_refund_cents bigint not null
    check (platform_fee_refund_cents >= 0),
  provider_refund_cents bigint not null
    check (provider_refund_cents >= 0),
  state text not null
    check (
      state in (
        'ready',
        'reversal_required',
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
  constraint klyx_platform_held_booking_refund_request_unique
    unique (booking_id, request_key),
  constraint klyx_platform_held_booking_refund_economics
    check (
      platform_fee_refund_cents + provider_refund_cents
      = gross_refund_cents
    )
);

create unique index platform_held_booking_refund_stripe_uidx
  on public.platform_held_booking_refunds(stripe_refund_id)
  where stripe_refund_id is not null;

create index platform_held_booking_refund_booking_state_idx
  on public.platform_held_booking_refunds(booking_id, state, created_at);

create table public.platform_held_booking_reversals (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null unique
    references public.platform_held_booking_refunds(id) on delete restrict,
  booking_id uuid not null
    references public.booking_settlements(booking_id) on delete restrict,
  stripe_transfer_id text not null
    check (stripe_transfer_id ~ '^tr_[A-Za-z0-9]+$'),
  stripe_transfer_reversal_id text not null unique
    check (stripe_transfer_reversal_id ~ '^trr_[A-Za-z0-9]+$'),
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

create index platform_held_booking_reversals_booking_idx
  on public.platform_held_booking_reversals(booking_id, created_at);

alter table public.platform_held_booking_refunds enable row level security;
alter table public.platform_held_booking_reversals enable row level security;

revoke all privileges on table public.platform_held_booking_refunds
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_booking_reversals
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.platform_held_booking_refunds to service_role;
grant select, insert, update, delete
  on table public.platform_held_booking_reversals to service_role;

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
  v_booking record;
  v_existing public.platform_held_booking_refunds%rowtype;
  v_prior_gross bigint := 0;
  v_prior_fee bigint := 0;
  v_prior_provider bigint := 0;
  v_cumulative_gross bigint;
  v_target_fee bigint;
  v_target_provider bigint;
  v_delta_fee bigint;
  v_delta_provider bigint;
  v_refund_id uuid;
begin
  if p_booking_id is null
     or coalesce(trim(p_request_key), '') !~ '^[A-Za-z0-9:_-]{3,128}$'
     or p_amount_cents <= 0
     or upper(coalesce(trim(p_currency), '')) !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_SINGLE_REFUND_REQUEST_INVALID';
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if not found
     or v_settlement.payment_mode <> 'platform_held'
     or v_settlement.state <> 'released'
     or coalesce(trim(v_settlement.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9]+$'
     or coalesce(trim(v_settlement.stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$'
     or upper(trim(v_settlement.currency)) <> upper(trim(p_currency)) then
    raise exception 'KLYX_SINGLE_REFUND_SETTLEMENT_NOT_READY';
  end if;

  select payment_mode, payment_status, booking_group_id
    into v_booking
    from public.bookings
   where id = p_booking_id;

  if not found
     or coalesce(v_booking.payment_mode, '') <> 'platform_held'
     or coalesce(v_booking.payment_status, '') not in ('paid', 'refunded')
     or v_booking.booking_group_id is not null then
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

  if exists (
    select 1
      from public.platform_held_booking_refunds
     where booking_id = p_booking_id
       and state = 'review_required'
  ) then
    raise exception 'KLYX_SINGLE_REFUND_REVIEW_REQUIRED';
  end if;

  -- One non-terminal plan at a time. This keeps the Stripe side-effect fence
  -- simple while still allowing any number of sequential partial refunds.
  if exists (
    select 1
      from public.platform_held_booking_refunds
     where booking_id = p_booking_id
       and state in ('ready', 'reversal_required', 'refunding')
  ) then
    raise exception 'KLYX_SINGLE_REFUND_ALREADY_IN_FLIGHT';
  end if;

  select
    coalesce(sum(gross_refund_cents), 0),
    coalesce(sum(platform_fee_refund_cents), 0),
    coalesce(sum(provider_refund_cents), 0)
    into v_prior_gross, v_prior_fee, v_prior_provider
    from public.platform_held_booking_refunds
   where booking_id = p_booking_id
     and state = 'succeeded';

  if v_prior_fee + v_prior_provider <> v_prior_gross then
    raise exception 'KLYX_SINGLE_REFUND_PRIOR_ACCOUNTING_MISMATCH';
  end if;

  v_cumulative_gross := v_prior_gross + p_amount_cents;

  if v_cumulative_gross > v_settlement.gross_amount_cents then
    raise exception 'KLYX_SINGLE_REFUND_EXCEEDS_GROSS';
  end if;

  -- Same exact integer rule as calculateCumulativeRefundDelta:
  -- (fee * cumulativeGross + floor(gross / 2)) / gross.
  v_target_fee := floor(
    (
      v_settlement.platform_fee_cents::numeric
      * v_cumulative_gross::numeric
      + floor(v_settlement.gross_amount_cents::numeric / 2)
    )
    / v_settlement.gross_amount_cents::numeric
  )::bigint;

  v_target_provider := v_cumulative_gross - v_target_fee;
  v_delta_fee := v_target_fee - v_prior_fee;
  v_delta_provider := v_target_provider - v_prior_provider;

  if v_delta_fee < 0
     or v_delta_provider < 0
     or v_delta_fee + v_delta_provider <> p_amount_cents
     or v_target_fee > v_settlement.platform_fee_cents
     or v_target_provider > v_settlement.provider_amount_cents then
    raise exception 'KLYX_SINGLE_REFUND_ALLOCATION_MISMATCH';
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
    case when v_delta_provider > 0 then 'reversal_required' else 'ready' end
  )
  returning id into v_refund_id;

  return v_refund_id;
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
  v_settlement public.booking_settlements%rowtype;
  v_existing public.platform_held_booking_reversals%rowtype;
  v_reversed_total bigint;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$'
     or coalesce(trim(p_stripe_transfer_reversal_id), '') !~ '^trr_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_SINGLE_REFUND_REVERSAL_INPUT_INVALID';
  end if;

  select *
    into v_refund
    from public.platform_held_booking_refunds
   where id = p_refund_id
   for update;

  if not found then return false; end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = v_refund.booking_id
   for update;

  if not found
     or v_refund.state not in ('reversal_required', 'ready', 'refunding')
     or v_refund.provider_refund_cents <> p_amount_cents
     or v_settlement.stripe_transfer_id <> p_stripe_transfer_id then
    return false;
  end if;

  select *
    into v_existing
    from public.platform_held_booking_reversals
   where refund_id = p_refund_id;

  if found then
    if v_existing.stripe_transfer_id = p_stripe_transfer_id
       and v_existing.stripe_transfer_reversal_id = p_stripe_transfer_reversal_id
       and v_existing.amount_cents = p_amount_cents then
      update public.platform_held_booking_refunds
         set state = case when state = 'reversal_required' then 'ready' else state end,
             updated_at = now()
       where id = p_refund_id;
      return true;
    end if;

    raise exception 'KLYX_SINGLE_REFUND_REVERSAL_CONFLICT';
  end if;

  select coalesce(sum(amount_cents), 0)
    into v_reversed_total
    from public.platform_held_booking_reversals
   where booking_id = v_refund.booking_id;

  if v_reversed_total + p_amount_cents > v_settlement.provider_amount_cents then
    raise exception 'KLYX_SINGLE_REFUND_REVERSAL_EXCEEDS_TRANSFER';
  end if;

  insert into public.platform_held_booking_reversals (
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

  update public.platform_held_booking_refunds
     set state = case when state = 'reversal_required' then 'ready' else state end,
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
  v_gross_total bigint;
  v_provider_total bigint;
  v_reversal_total bigint;
begin
  if coalesce(trim(p_stripe_refund_id), '') !~ '^re_[A-Za-z0-9]+$'
     or p_amount_cents <= 0
     or upper(coalesce(trim(p_currency), '')) !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_SINGLE_REFUND_FINALIZE_INPUT_INVALID';
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

  if v_refund.state <> 'refunding'
     or v_refund.gross_refund_cents <> p_amount_cents
     or v_refund.currency <> upper(trim(p_currency)) then
    return false;
  end if;

  if v_refund.provider_refund_cents > 0
     and not exists (
       select 1
         from public.platform_held_booking_reversals
        where refund_id = p_refund_id
          and amount_cents = v_refund.provider_refund_cents
     ) then
    return false;
  end if;

  update public.platform_held_booking_refunds
     set state = 'succeeded',
         stripe_refund_id = p_stripe_refund_id,
         failure_code = null,
         failure_message = null,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = p_refund_id;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = v_refund.booking_id
   for update;

  if not found then
    raise exception 'KLYX_SINGLE_REFUND_SETTLEMENT_MISSING';
  end if;

  select
    coalesce(sum(gross_refund_cents), 0),
    coalesce(sum(provider_refund_cents), 0)
    into v_gross_total, v_provider_total
    from public.platform_held_booking_refunds
   where booking_id = v_refund.booking_id
     and state = 'succeeded';

  select coalesce(sum(amount_cents), 0)
    into v_reversal_total
    from public.platform_held_booking_reversals
   where booking_id = v_refund.booking_id;

  if v_gross_total > v_settlement.gross_amount_cents
     or v_provider_total > v_settlement.provider_amount_cents
     or v_reversal_total > v_settlement.provider_amount_cents then
    raise exception 'KLYX_SINGLE_REFUND_CUMULATIVE_TRUTH_INVALID';
  end if;

  if v_gross_total = v_settlement.gross_amount_cents then
    if v_provider_total <> v_settlement.provider_amount_cents
       or v_reversal_total <> v_settlement.provider_amount_cents then
      raise exception 'KLYX_SINGLE_REFUND_FULL_TRUTH_INCOMPLETE';
    end if;

    update public.booking_settlements
       set state = 'refunded',
           refunded_at = coalesce(refunded_at, now()),
           release_claim_token = null,
           release_claimed_at = null,
           updated_at = now()
     where booking_id = v_refund.booking_id;
  end if;

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
  v_has_reversal boolean;
begin
  select exists (
    select 1
      from public.platform_held_booking_reversals
     where refund_id = p_refund_id
  )
  into v_has_reversal;

  if v_has_reversal then
    update public.platform_held_booking_refunds
       set state = 'review_required',
           failure_code = left(coalesce(p_error_code, 'stripe_refund_failed_after_reversal'), 120),
           failure_message = left(coalesce(p_error_message, 'Stripe refund failed after provider reversal.'), 1000),
           updated_at = now()
     where id = p_refund_id
       and state in ('ready', 'refunding', 'reversal_required');

    if found then
      perform public.klyx_open_financial_reconciliation_case(
        concat('single-refund:', p_refund_id, ':failed-after-reversal'),
        (
          select booking_id
            from public.platform_held_booking_refunds
           where id = p_refund_id
        ),
        'human_review',
        'settlement',
        'single_refund_failed_after_provider_reversal',
        jsonb_build_object('refund_id', p_refund_id, 'provider_reversal', true),
        jsonb_build_object(
          'error_code',
          left(coalesce(p_error_code, 'stripe_refund_failed_after_reversal'), 120)
        ),
        'single_refund_failure_after_reversal'
      );
      return true;
    end if;

    return false;
  end if;

  update public.platform_held_booking_refunds
     set state = 'failed',
         failure_code = left(coalesce(p_error_code, 'stripe_refund_failed'), 120),
         failure_message = left(coalesce(p_error_message, 'Stripe refund failed.'), 1000),
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
     and state <> 'succeeded'
  returning booking_id into v_booking_id;

  if not found then
    return false;
  end if;

  perform public.klyx_open_financial_reconciliation_case(
    concat('single-refund:', p_refund_id, ':review'),
    v_booking_id,
    'human_review',
    'settlement',
    left(coalesce(p_error_code, 'single_refund_review_required'), 120),
    jsonb_build_object('refund_id', p_refund_id),
    jsonb_build_object(
      'message',
      left(coalesce(p_error_message, 'Single refund requires review.'), 1000)
    ),
    'single_refund_truth_divergence'
  );

  return true;
end;
$;

-- Preserve legacy full-refund compatibility when there are no child plans.
-- Once child plans exist, terminal truth is cumulative and may contain many
-- TransferReversal objects.
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
  v_child_count bigint;
  v_gross_total bigint;
  v_provider_total bigint;
  v_reversal_total bigint;
begin
  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = p_booking_id
   for update;

  if not found or v_settlement.state in ('human_review', 'review_required') then
    return false;
  end if;

  select
    count(*),
    coalesce(sum(gross_refund_cents) filter (where state = 'succeeded'), 0),
    coalesce(sum(provider_refund_cents) filter (where state = 'succeeded'), 0)
    into v_child_count, v_gross_total, v_provider_total
    from public.platform_held_booking_refunds
   where booking_id = p_booking_id;

  if v_child_count > 0 then
    select coalesce(sum(amount_cents), 0)
      into v_reversal_total
      from public.platform_held_booking_reversals
     where booking_id = p_booking_id;

    if v_gross_total <> v_settlement.gross_amount_cents
       or v_provider_total <> v_settlement.provider_amount_cents
       or (
         v_settlement.stripe_transfer_id is not null
         and v_reversal_total <> v_settlement.provider_amount_cents
       ) then
      return false;
    end if;
  else
    if v_settlement.stripe_transfer_id is not null
       and v_settlement.stripe_transfer_reversal_id is null then
      return false;
    end if;
  end if;

  update public.booking_settlements
     set state = 'refunded',
         refunded_at = coalesce(refunded_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         last_reconciled_at = now(),
         updated_at = now()
   where booking_id = p_booking_id;

  return true;
end;
$$;

create or replace function public.klyx_mirror_single_booking_reversal_to_central()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.platform_held_booking_refunds%rowtype;
  v_settlement public.booking_settlements%rowtype;
  v_provider_id uuid;
  v_payment_identity text;
  v_reversal_total bigint;
  v_liability_state text;
begin
  select * into v_refund
    from public.platform_held_booking_refunds
   where id = new.refund_id;

  select * into v_settlement
    from public.booking_settlements
   where booking_id = new.booking_id;

  if not found or v_refund.id is null then
    raise exception 'KLYX_SINGLE_REVERSAL_PARENT_TRUTH_REQUIRED';
  end if;

  select coalesce(provider_id, babysitter_id)
    into v_provider_id
    from public.bookings
   where id = new.booking_id;

  if v_provider_id is null then
    v_provider_id := v_settlement.provider_profile_id;
  end if;

  v_payment_identity := coalesce(
    nullif(trim(v_settlement.stripe_payment_intent_id), ''),
    nullif(trim(v_settlement.stripe_checkout_session_id), ''),
    new.booking_id::text
  );

  perform public.klyx_append_financial_ledger_event(
    concat('booking:', new.booking_id, ':reversal:', new.stripe_transfer_reversal_id),
    concat('single-refund:', new.refund_id, ':reversal:', new.stripe_transfer_reversal_id),
    'reversal',
    new.amount_cents,
    v_settlement.currency,
    new.booking_id,
    'platform',
    'klyx',
    'single_settlement_transfer_reversal',
    'settlement',
    'released',
    'reversal_recorded',
    new.created_at,
    v_settlement.stripe_account_id,
    v_settlement.stripe_checkout_session_id,
    v_settlement.stripe_payment_intent_id,
    v_settlement.stripe_charge_id,
    new.stripe_transfer_id,
    new.stripe_transfer_reversal_id,
    null,
    null,
    jsonb_build_object(
      'settlement_model', 'platform_held',
      'single_refund_id', new.refund_id,
      'request_key', v_refund.request_key
    )
  );

  select coalesce(sum(amount_cents), 0)
    into v_reversal_total
    from public.platform_held_booking_reversals
   where booking_id = new.booking_id;

  v_liability_state := case
    when v_reversal_total >= v_settlement.provider_amount_cents
      then 'reversed'
    else 'partially_reversed'
  end;

  perform public.klyx_append_financial_ledger_event(
    concat('booking:', new.booking_id, ':provider-liability:', v_payment_identity),
    concat(
      'single-refund:',
      new.refund_id,
      ':provider-liability:',
      v_liability_state,
      ':',
      v_reversal_total
    ),
    'provider_liability',
    v_settlement.provider_amount_cents,
    v_settlement.currency,
    new.booking_id,
    'provider',
    public.klyx_financial_beneficiary_account_ref(
      v_provider_id,
      new.booking_id,
      'provider'
    ),
    'single_settlement_transfer_reversal',
    'settlement',
    'discharged',
    v_liability_state,
    new.created_at,
    v_settlement.stripe_account_id,
    v_settlement.stripe_checkout_session_id,
    v_settlement.stripe_payment_intent_id,
    v_settlement.stripe_charge_id,
    new.stripe_transfer_id,
    null,
    null,
    null,
    jsonb_build_object(
      'settlement_model', 'platform_held',
      'single_refund_id', new.refund_id,
      'reversed_amount_cents', v_reversal_total
    )
  );

  return new;
end;
$$;

create trigger platform_held_booking_reversal_central_mirror
after insert on public.platform_held_booking_reversals
for each row
execute function public.klyx_mirror_single_booking_reversal_to_central();

revoke all on function public.klyx_create_platform_held_booking_refund_plan(uuid, text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_booking_reversal(uuid, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_booking_refund_inflight(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_booking_refund(uuid, text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_platform_held_booking_refund(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_booking_refund_review(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_booking_settlement_refunded(uuid)
  from public, anon, authenticated;

grant execute on function public.klyx_create_platform_held_booking_refund_plan(uuid, text, bigint, text)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_booking_reversal(uuid, text, text, bigint)
  to service_role;
grant execute on function public.klyx_mark_platform_held_booking_refund_inflight(uuid)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_booking_refund(uuid, text, bigint, text)
  to service_role;
grant execute on function public.klyx_fail_platform_held_booking_refund(uuid, text, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_booking_refund_review(uuid, text, text)
  to service_role;
grant execute on function public.klyx_mark_booking_settlement_refunded(uuid)
  to service_role;

comment on table public.platform_held_booking_refunds is
  'Server-only immutable refund-plan authority for Single Platform-Held partial/total refunds.';
comment on table public.platform_held_booking_reversals is
  'Server-only Stripe TransferReversal truth for Single Platform-Held refund plans.';

commit;

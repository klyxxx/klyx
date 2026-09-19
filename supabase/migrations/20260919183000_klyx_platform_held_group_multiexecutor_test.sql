-- KLYX PLATFORM-HELD MULTI-EXECUTOR GROUP SETTLEMENT — STRIPE TEST ONLY
--
-- Financial model:
--   one platform charge per multi-provider split batch;
--   one immutable member settlement per canonical executor account;
--   independent member release / failure / reversal;
--   aggregate release reservations serialized through the parent row;
--   explicit total/partial refund allocations.
--
-- This migration performs no Stripe side effect.

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
      'platform_held_group'
    )
  );

create table if not exists public.platform_held_group_charges (
  batch_id uuid primary key
    references public.split_booking_batches(id) on delete restrict,
  client_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  payment_confirmation_id uuid not null unique
    references public.split_booking_payment_confirmations(id) on delete restrict,
  payment_plan_hash text not null
    check (char_length(payment_plan_hash) = 64),
  payment_mode text not null default 'platform_held_group'
    check (payment_mode = 'platform_held_group'),
  currency text not null
    check (currency ~ '^[A-Z]{3}$'),
  gross_amount_cents bigint not null
    check (gross_amount_cents > 0),
  platform_fee_cents bigint not null
    check (platform_fee_cents >= 0),
  provider_amount_cents bigint not null
    check (provider_amount_cents >= 0),
  member_count integer not null
    check (member_count >= 2),
  transfer_group text not null unique,
  checkout_attempt_number integer not null default 0
    check (checkout_attempt_number >= 0),
  checkout_claim_token uuid,
  checkout_claimed_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  refunded_amount_cents bigint not null default 0
    check (refunded_amount_cents >= 0),
  state text not null default 'pending_payment'
    check (state in (
      'pending_payment',
      'held',
      'partially_released',
      'released',
      'refund_pending',
      'partially_refunded',
      'refunded',
      'review_required'
    )),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_held_group_charge_economics_check
    check (
      platform_fee_cents + provider_amount_cents = gross_amount_cents
      and refunded_amount_cents <= gross_amount_cents
    )
);

create unique index if not exists platform_held_group_charge_checkout_uidx
  on public.platform_held_group_charges(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists platform_held_group_charge_intent_uidx
  on public.platform_held_group_charges(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists platform_held_group_charge_charge_uidx
  on public.platform_held_group_charges(stripe_charge_id)
  where stripe_charge_id is not null;

create table if not exists public.platform_held_group_member_settlements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.platform_held_group_charges(batch_id) on delete restrict,
  provider_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  account_id uuid not null
    references public.accounts(id) on delete restrict,
  stripe_account_id text not null,
  currency text not null
    check (currency ~ '^[A-Z]{3}$'),
  gross_amount_cents bigint not null
    check (gross_amount_cents > 0),
  platform_fee_cents bigint not null
    check (platform_fee_cents >= 0),
  provider_amount_cents bigint not null
    check (provider_amount_cents >= 0),
  booking_ids jsonb not null
    check (jsonb_typeof(booking_ids) = 'array'),
  release_attempt_number integer not null default 0
    check (release_attempt_number >= 0),
  release_claim_token uuid,
  release_claimed_at timestamptz,
  release_claim_amount_cents bigint not null default 0
    check (release_claim_amount_cents >= 0),
  release_observation_key text,
  stripe_transfer_id text,
  released_amount_cents bigint not null default 0
    check (released_amount_cents >= 0),
  provider_refund_cents_at_release bigint not null default 0
    check (provider_refund_cents_at_release >= 0),
  refund_allocated_gross_cents bigint not null default 0
    check (refund_allocated_gross_cents >= 0),
  provider_refund_cents bigint not null default 0
    check (provider_refund_cents >= 0),
  reversed_amount_cents bigint not null default 0
    check (reversed_amount_cents >= 0),
  last_error_code text,
  last_error_message text,
  state text not null default 'pending_payment'
    check (state in (
      'pending_payment',
      'held',
      'release_claimed',
      'release_failed',
      'released',
      'refund_pending',
      'refunded',
      'review_required'
    )),
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_held_group_member_economics_check
    check (
      platform_fee_cents + provider_amount_cents = gross_amount_cents
      and release_claim_amount_cents <= provider_amount_cents
      and released_amount_cents <= provider_amount_cents
      and provider_refund_cents_at_release <= provider_amount_cents
      and provider_refund_cents <= provider_amount_cents
      and reversed_amount_cents <= released_amount_cents
      and refund_allocated_gross_cents <= gross_amount_cents
    ),
  constraint platform_held_group_member_provider_unique
    unique (batch_id, provider_profile_id),
  constraint platform_held_group_member_account_unique
    unique (batch_id, account_id)
);

create unique index if not exists platform_held_group_member_transfer_uidx
  on public.platform_held_group_member_settlements(stripe_transfer_id)
  where stripe_transfer_id is not null;

create index if not exists platform_held_group_member_batch_state_idx
  on public.platform_held_group_member_settlements(batch_id, state);

create table if not exists public.platform_held_group_refund_requests (
  id uuid primary key,
  batch_id uuid not null
    references public.platform_held_group_charges(batch_id) on delete restrict,
  requested_amount_cents bigint not null
    check (requested_amount_cents > 0),
  currency text not null
    check (currency ~ '^[A-Z]{3}$'),
  state text not null default 'claimed'
    check (state in (
      'claimed',
      'refund_pending',
      'succeeded',
      'review_required'
    )),
  stripe_refund_id text,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz
);

create unique index if not exists platform_held_group_refund_stripe_uidx
  on public.platform_held_group_refund_requests(stripe_refund_id)
  where stripe_refund_id is not null;

create unique index if not exists platform_held_group_one_active_refund_uidx
  on public.platform_held_group_refund_requests(batch_id)
  where state in ('claimed', 'refund_pending', 'review_required');

create table if not exists public.platform_held_group_refund_allocations (
  request_id uuid not null
    references public.platform_held_group_refund_requests(id) on delete restrict,
  member_settlement_id uuid not null
    references public.platform_held_group_member_settlements(id) on delete restrict,
  refund_gross_cents bigint not null
    check (refund_gross_cents > 0),
  target_refunded_gross_cents bigint not null
    check (target_refunded_gross_cents > 0),
  target_provider_refund_cents bigint not null
    check (target_provider_refund_cents >= 0),
  provider_reversal_due_cents bigint not null
    check (provider_reversal_due_cents >= 0),
  stripe_transfer_reversal_id text,
  state text not null
    check (state in (
      'pending_reversal',
      'no_reversal_required',
      'reversed',
      'review_required'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (request_id, member_settlement_id)
);

create unique index if not exists platform_held_group_refund_reversal_uidx
  on public.platform_held_group_refund_allocations(stripe_transfer_reversal_id)
  where stripe_transfer_reversal_id is not null;

alter table public.platform_held_group_charges enable row level security;
alter table public.platform_held_group_member_settlements enable row level security;
alter table public.platform_held_group_refund_requests enable row level security;
alter table public.platform_held_group_refund_allocations enable row level security;

revoke all privileges on table public.platform_held_group_charges
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_group_member_settlements
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_group_refund_requests
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_group_refund_allocations
  from public, anon, authenticated;

grant select, insert, update on table public.platform_held_group_charges
  to service_role;
grant select, insert, update on table public.platform_held_group_member_settlements
  to service_role;
grant select, insert, update on table public.platform_held_group_refund_requests
  to service_role;
grant select, insert, update on table public.platform_held_group_refund_allocations
  to service_role;

create or replace function public.klyx_block_platform_held_group_reconfirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
      from public.platform_held_group_charges c
     where c.batch_id = new.batch_id
  ) then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_PAYMENT_PLAN_LOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists klyx_block_platform_held_group_reconfirmation
  on public.split_booking_payment_confirmations;

create trigger klyx_block_platform_held_group_reconfirmation
before insert on public.split_booking_payment_confirmations
for each row execute function public.klyx_block_platform_held_group_reconfirmation();

create or replace function public.klyx_init_platform_held_group_settlement(
  p_batch_id uuid,
  p_client_profile_id uuid,
  p_payment_confirmation_id uuid,
  p_payment_plan_hash text,
  p_currency text,
  p_gross_amount_cents bigint,
  p_platform_fee_cents bigint,
  p_provider_amount_cents bigint,
  p_transfer_group text,
  p_members jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_confirmation record;
  v_existing public.platform_held_group_charges%rowtype;
  v_member_count integer;
  v_distinct_booking_count integer;
  v_booking_count integer;
  v_batch_booking_count integer;
  v_gross bigint;
  v_fee bigint;
  v_provider bigint;
begin
  if coalesce(trim(p_payment_plan_hash), '') !~ '^[A-Fa-f0-9]{64}$' then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_PLAN_HASH_INVALID';
  end if;

  if coalesce(trim(p_currency), '') !~ '^[A-Z]{3}$'
     or coalesce(trim(p_transfer_group), '') = ''
     or p_gross_amount_cents <= 0
     or p_platform_fee_cents < 0
     or p_provider_amount_cents < 0
     or p_platform_fee_cents + p_provider_amount_cents <> p_gross_amount_cents
     or jsonb_typeof(p_members) <> 'array'
     or jsonb_array_length(p_members) < 2 then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_ECONOMICS_INVALID';
  end if;

  select b.*
    into v_batch
    from public.split_booking_batches b
   where b.id = p_batch_id
   for update;

  if not found
     or v_batch.client_profile_id <> p_client_profile_id
     or v_batch.status <> 'created'
     or v_batch.provider_count < 2 then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_BATCH_NOT_READY';
  end if;

  select c.*
    into v_confirmation
    from public.split_booking_payment_confirmations c
   where c.id = p_payment_confirmation_id
   for update;

  if not found
     or v_confirmation.batch_id <> p_batch_id
     or v_confirmation.client_profile_id <> p_client_profile_id
     or v_confirmation.invalidated_at is not null
     or v_confirmation.consumed_at is not null
     or v_confirmation.payment_plan_hash <> p_payment_plan_hash
     or upper(v_confirmation.currency) <> p_currency
     or v_confirmation.total_amount_cents <> p_gross_amount_cents
     or v_confirmation.provider_count <> jsonb_array_length(p_members)
     or v_confirmation.payment_unit_count <> jsonb_array_length(p_members) then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_CONFIRMATION_MISMATCH';
  end if;

  select *
    into v_existing
    from public.platform_held_group_charges c
   where c.batch_id = p_batch_id
   for update;

  if found then
    if v_existing.client_profile_id <> p_client_profile_id
       or v_existing.payment_confirmation_id <> p_payment_confirmation_id
       or v_existing.payment_plan_hash <> p_payment_plan_hash
       or v_existing.currency <> p_currency
       or v_existing.gross_amount_cents <> p_gross_amount_cents
       or v_existing.platform_fee_cents <> p_platform_fee_cents
       or v_existing.provider_amount_cents <> p_provider_amount_cents
       or v_existing.member_count <> jsonb_array_length(p_members)
       or v_existing.transfer_group <> p_transfer_group then
      raise exception 'KLYX_PLATFORM_HELD_GROUP_IMMUTABLE_TRUTH_MISMATCH';
    end if;
    return true;
  end if;

  insert into public.platform_held_group_charges (
    batch_id,
    client_profile_id,
    payment_confirmation_id,
    payment_plan_hash,
    currency,
    gross_amount_cents,
    platform_fee_cents,
    provider_amount_cents,
    member_count,
    transfer_group
  ) values (
    p_batch_id,
    p_client_profile_id,
    p_payment_confirmation_id,
    lower(p_payment_plan_hash),
    p_currency,
    p_gross_amount_cents,
    p_platform_fee_cents,
    p_provider_amount_cents,
    jsonb_array_length(p_members),
    p_transfer_group
  );

  insert into public.platform_held_group_member_settlements (
    batch_id,
    provider_profile_id,
    account_id,
    stripe_account_id,
    currency,
    gross_amount_cents,
    platform_fee_cents,
    provider_amount_cents,
    booking_ids
  )
  select
    p_batch_id,
    m.provider_profile_id,
    m.account_id,
    m.stripe_account_id,
    upper(m.currency),
    m.gross_amount_cents,
    m.platform_fee_cents,
    m.provider_amount_cents,
    m.booking_ids
  from jsonb_to_recordset(p_members) as m(
    provider_profile_id uuid,
    account_id uuid,
    stripe_account_id text,
    currency text,
    gross_amount_cents bigint,
    platform_fee_cents bigint,
    provider_amount_cents bigint,
    booking_ids jsonb
  );

  select
    count(*),
    coalesce(sum(gross_amount_cents), 0),
    coalesce(sum(platform_fee_cents), 0),
    coalesce(sum(provider_amount_cents), 0),
    coalesce(sum(jsonb_array_length(booking_ids)), 0)
  into
    v_member_count,
    v_gross,
    v_fee,
    v_provider,
    v_booking_count
  from public.platform_held_group_member_settlements
  where batch_id = p_batch_id;

  if v_member_count <> jsonb_array_length(p_members)
     or v_gross <> p_gross_amount_cents
     or v_fee <> p_platform_fee_cents
     or v_provider <> p_provider_amount_cents then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_TOTAL_INVARIANT_BROKEN';
  end if;

  if exists (
    select 1
      from public.platform_held_group_member_settlements m
     where m.batch_id = p_batch_id
       and (
         m.stripe_account_id !~ '^acct_[A-Za-z0-9]+$'
         or m.currency <> p_currency
         or m.platform_fee_cents + m.provider_amount_cents <> m.gross_amount_cents
         or jsonb_array_length(m.booking_ids) = 0
         or not exists (
           select 1
             from public.profiles p
             join public.account_stripe_connect_identities i
               on i.account_id = p.account_id
            where p.id = m.provider_profile_id
              and p.account_id = m.account_id
              and i.identity_state = 'linked'
              and i.stripe_account_id = m.stripe_account_id
         )
       )
  ) then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_MEMBER_IDENTITY_INVALID';
  end if;

  select count(*)
    into v_batch_booking_count
    from public.split_booking_batch_items i
   where i.batch_id = p_batch_id;

  select count(distinct j.booking_id)
    into v_distinct_booking_count
    from public.platform_held_group_member_settlements m
    cross join lateral jsonb_array_elements_text(m.booking_ids) as j(booking_id)
   where m.batch_id = p_batch_id;

  if v_booking_count <> v_batch_booking_count
     or v_distinct_booking_count <> v_batch_booking_count
     or exists (
       select 1
         from public.platform_held_group_member_settlements m
         cross join lateral jsonb_array_elements_text(m.booking_ids) as j(booking_id)
         left join public.split_booking_batch_items i
           on i.batch_id = p_batch_id
          and i.booking_id::text = j.booking_id
          and i.provider_profile_id = m.provider_profile_id
        where m.batch_id = p_batch_id
          and i.id is null
     ) then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_BOOKING_MEMBERSHIP_MISMATCH';
  end if;

  update public.split_booking_payment_confirmations
     set consumed_at = coalesce(consumed_at, now()),
         updated_at = now()
   where id = p_payment_confirmation_id
     and invalidated_at is null;

  return true;
end;
$$;

create or replace function public.klyx_claim_platform_held_group_checkout(
  p_batch_id uuid,
  p_claim_token uuid
)
returns table (
  action text,
  attempt_number integer,
  checkout_session_id text,
  gross_amount_cents bigint,
  currency text,
  transfer_group text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge public.platform_held_group_charges%rowtype;
begin
  select * into v_charge
    from public.platform_held_group_charges
   where batch_id = p_batch_id
   for update;

  if not found then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_CHARGE_NOT_FOUND';
  end if;

  if v_charge.state <> 'pending_payment' then
    return query select
      'paid'::text,
      v_charge.checkout_attempt_number,
      v_charge.stripe_checkout_session_id,
      v_charge.gross_amount_cents,
      v_charge.currency,
      v_charge.transfer_group;
    return;
  end if;

  if v_charge.stripe_checkout_session_id is not null then
    return query select
      'reuse'::text,
      v_charge.checkout_attempt_number,
      v_charge.stripe_checkout_session_id,
      v_charge.gross_amount_cents,
      v_charge.currency,
      v_charge.transfer_group;
    return;
  end if;

  if v_charge.checkout_claim_token is not null
     and v_charge.checkout_claimed_at > now() - interval '2 minutes' then
    return query select
      'busy'::text,
      v_charge.checkout_attempt_number,
      null::text,
      v_charge.gross_amount_cents,
      v_charge.currency,
      v_charge.transfer_group;
    return;
  end if;

  update public.platform_held_group_charges
     set checkout_attempt_number = checkout_attempt_number + 1,
         checkout_claim_token = p_claim_token,
         checkout_claimed_at = now(),
         updated_at = now()
   where batch_id = p_batch_id
   returning * into v_charge;

  return query select
    'create'::text,
    v_charge.checkout_attempt_number,
    null::text,
    v_charge.gross_amount_cents,
    v_charge.currency,
    v_charge.transfer_group;
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
    raise exception 'KLYX_PLATFORM_HELD_GROUP_CHECKOUT_INVALID';
  end if;

  update public.platform_held_group_charges
     set stripe_checkout_session_id = p_checkout_session_id,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where batch_id = p_batch_id
     and state = 'pending_payment'
     and checkout_claim_token = p_claim_token
     and stripe_checkout_session_id is null;

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
  update public.platform_held_group_charges
     set stripe_checkout_session_id = null,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where batch_id = p_batch_id
     and state = 'pending_payment'
     and stripe_checkout_session_id = p_checkout_session_id;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_attach_platform_held_group_payment_truth(
  p_batch_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text,
  p_amount_cents bigint,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge public.platform_held_group_charges%rowtype;
  v_expected_bookings integer;
  v_updated_bookings integer;
begin
  if coalesce(trim(p_payment_intent_id), '') !~ '^pi_[A-Za-z0-9_]+$'
     or coalesce(trim(p_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_STRIPE_TRUTH_INVALID';
  end if;

  select * into v_charge
    from public.platform_held_group_charges
   where batch_id = p_batch_id
   for update;

  if not found
     or v_charge.stripe_checkout_session_id is distinct from p_checkout_session_id
     or v_charge.gross_amount_cents <> p_amount_cents
     or v_charge.currency <> upper(p_currency) then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_PAYMENT_TRUTH_MISMATCH';
  end if;

  if v_charge.state <> 'pending_payment' then
    if v_charge.stripe_payment_intent_id = p_payment_intent_id
       and v_charge.stripe_charge_id = p_charge_id then
      return true;
    end if;
    raise exception 'KLYX_PLATFORM_HELD_GROUP_PAYMENT_ALREADY_FINALIZED';
  end if;

  select count(*) into v_expected_bookings
    from public.split_booking_batch_items
   where batch_id = p_batch_id;

  update public.platform_held_group_charges
     set stripe_payment_intent_id = p_payment_intent_id,
         stripe_charge_id = p_charge_id,
         state = 'held',
         paid_at = coalesce(paid_at, now()),
         updated_at = now()
   where batch_id = p_batch_id;

  update public.platform_held_group_member_settlements
     set state = case when state = 'pending_payment' then 'held' else state end,
         updated_at = now()
   where batch_id = p_batch_id;

  update public.bookings b
     set payment_status = 'paid',
         payment_mode = 'platform_held_group',
         stripe_checkout_session_id = p_checkout_session_id,
         stripe_payment_intent_id = null,
         paid_at = coalesce(b.paid_at, now()),
         payment_attempt_token = null,
         payment_checkout_started_at = null,
         payment_failure_code = null,
         payment_failure_message = null,
         payment_failed_at = null,
         updated_at = now()
   where exists (
     select 1
       from public.split_booking_batch_items i
      where i.batch_id = p_batch_id
        and i.booking_id = b.id
   );

  get diagnostics v_updated_bookings = row_count;

  if v_updated_bookings <> v_expected_bookings then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_PAID_BOOKING_COUNT_MISMATCH';
  end if;

  return true;
end;
$$;

create or replace function public.klyx_claim_platform_held_group_member_release(
  p_member_settlement_id uuid,
  p_claim_token uuid,
  p_stripe_absence_observation_key text default null
)
returns table (
  action text,
  attempt_number integer,
  batch_id uuid,
  provider_profile_id uuid,
  account_id uuid,
  stripe_account_id text,
  release_amount_cents bigint,
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
  v_charge public.platform_held_group_charges%rowtype;
  v_identity record;
  v_release_amount bigint;
  v_provider_budget bigint;
  v_reserved_or_net_released bigint;
  v_risk_allowed boolean;
begin
  select m.* into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_settlement_id;

  if not found then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_MEMBER_NOT_FOUND';
  end if;

  select c.* into v_charge
    from public.platform_held_group_charges c
   where c.batch_id = v_member.batch_id
   for update;

  select m.* into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_settlement_id
   for update;

  if v_charge.state not in ('held', 'partially_released', 'partially_refunded') then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      0::bigint, v_member.currency, v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  if v_member.state = 'released' and v_member.stripe_transfer_id is not null then
    return query select
      'released'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      v_member.released_amount_cents, v_member.currency,
      v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  if v_member.state = 'refunded' then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      0::bigint, v_member.currency, v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  if v_member.state = 'review_required' then
    return query select
      'review_required'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      v_member.release_claim_amount_cents, v_member.currency,
      v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  if v_member.state = 'release_claimed'
     and v_member.release_claimed_at > now() - interval '10 minutes' then
    return query select
      'busy'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      v_member.release_claim_amount_cents, v_member.currency,
      v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  if v_member.state = 'release_claimed'
     and coalesce(trim(p_stripe_absence_observation_key), '') = '' then
    return query select
      'reconciliation_required'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      v_member.release_claim_amount_cents, v_member.currency,
      v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  if coalesce(trim(v_charge.stripe_charge_id), '') = '' then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      0::bigint, v_member.currency, v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  if exists (
    select 1
      from jsonb_array_elements_text(v_member.booking_ids) j(booking_id)
      left join public.bookings b on b.id::text = j.booking_id
     where b.id is null
        or coalesce(b.payment_status, '') <> 'paid'
        or (
          coalesce(b.status, '') <> 'completed'
          and coalesce(b.service_status, '') <> 'completed'
        )
  ) then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      0::bigint, v_member.currency, v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  select i.stripe_account_id, i.identity_state
    into v_identity
    from public.account_stripe_connect_identities i
   where i.account_id = v_member.account_id;

  if not found
     or coalesce(v_identity.identity_state, '') <> 'linked'
     or v_identity.stripe_account_id is distinct from v_member.stripe_account_id then
    return query select
      'review_required'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      v_member.release_claim_amount_cents, v_member.currency,
      v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  select exists (
    select 1
      from public.transaction_risk_decisions d
     where d.account_id = v_member.account_id
       and d.action = 'settlement_release'
       and d.participant = 'settlement_recipient'
       and d.subject_type = 'split_batch'
       and d.subject_id = v_member.batch_id::text
       and d.decision = 'allow'
       and d.risk_assessed_at >= now() - interval '5 minutes'
  ) into v_risk_allowed;

  if not v_risk_allowed then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      0::bigint, v_member.currency, v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  v_release_amount := v_member.provider_amount_cents - v_member.provider_refund_cents;

  if v_release_amount <= 0 then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
      0::bigint, v_member.currency, v_charge.stripe_charge_id, v_charge.transfer_group;
    return;
  end if;

  select coalesce(sum(m.provider_amount_cents - m.provider_refund_cents), 0)
    into v_provider_budget
    from public.platform_held_group_member_settlements m
   where m.batch_id = v_member.batch_id;

  select coalesce(sum(
    greatest(m.released_amount_cents - m.reversed_amount_cents, 0)
    + m.release_claim_amount_cents
  ), 0)
    into v_reserved_or_net_released
    from public.platform_held_group_member_settlements m
   where m.batch_id = v_member.batch_id
     and m.id <> v_member.id;

  if v_reserved_or_net_released + v_release_amount > v_provider_budget
     or v_reserved_or_net_released + v_release_amount > v_charge.provider_amount_cents then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_OVER_TRANSFER_GUARD';
  end if;

  update public.platform_held_group_member_settlements
     set state = 'release_claimed',
         release_attempt_number = release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         release_claim_amount_cents = v_release_amount,
         release_observation_key = nullif(trim(coalesce(p_stripe_absence_observation_key, '')), ''),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = v_member.id
   returning * into v_member;

  return query select
    'create'::text, v_member.release_attempt_number, v_member.batch_id,
    v_member.provider_profile_id, v_member.account_id, v_member.stripe_account_id,
    v_member.release_claim_amount_cents, v_member.currency,
    v_charge.stripe_charge_id, v_charge.transfer_group;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_member_release(
  p_member_settlement_id uuid,
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
  v_charge public.platform_held_group_charges%rowtype;
  v_unsettled integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_TRANSFER_INVALID';
  end if;

  select m.* into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_settlement_id;

  if not found then return false; end if;

  select c.* into v_charge
    from public.platform_held_group_charges c
   where c.batch_id = v_member.batch_id
   for update;

  select m.* into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_settlement_id
   for update;

  if v_member.state = 'released'
     and v_member.stripe_transfer_id = p_stripe_transfer_id then
    return true;
  end if;

  if v_member.state <> 'release_claimed'
     or v_member.release_claim_token is distinct from p_claim_token
     or v_member.release_claim_amount_cents <= 0 then
    return false;
  end if;

  update public.platform_held_group_member_settlements
     set state = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         released_amount_cents = release_claim_amount_cents,
         provider_refund_cents_at_release = provider_refund_cents,
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = 0,
         released_at = coalesce(released_at, now()),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_settlement_id;

  select count(*) into v_unsettled
    from public.platform_held_group_member_settlements m
   where m.batch_id = v_member.batch_id
     and m.provider_amount_cents - m.provider_refund_cents > 0
     and m.stripe_transfer_id is null;

  update public.platform_held_group_charges
     set state = case
           when refunded_amount_cents > 0 then 'partially_refunded'
           when v_unsettled = 0 then 'released'
           else 'partially_released'
         end,
         updated_at = now()
   where batch_id = v_member.batch_id;

  return true;
end;
$$;

create or replace function public.klyx_fail_platform_held_group_member_release(
  p_member_settlement_id uuid,
  p_claim_token uuid,
  p_error_code text,
  p_error_message text,
  p_uncertain_stripe_result boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.platform_held_group_member_settlements
     set state = case
           when p_uncertain_stripe_result then 'review_required'
           else 'release_failed'
         end,
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = case
           when p_uncertain_stripe_result then release_claim_amount_cents
           else 0
         end,
         last_error_code = left(coalesce(p_error_code, 'group_member_release_failed'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member release failed.'), 1000),
         updated_at = now()
   where id = p_member_settlement_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_reconcile_platform_held_group_member_transfer(
  p_member_settlement_id uuid,
  p_stripe_transfer_id text,
  p_transfer_amount_cents bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_member_settlements%rowtype;
  v_unsettled integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_TRANSFER_INVALID';
  end if;

  select m.* into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_settlement_id
   for update;

  if not found then return false; end if;

  perform 1
    from public.platform_held_group_charges c
   where c.batch_id = v_member.batch_id
   for update;

  if v_member.stripe_transfer_id is not null then
    return v_member.stripe_transfer_id = p_stripe_transfer_id
       and v_member.released_amount_cents = p_transfer_amount_cents;
  end if;

  if v_member.state not in ('release_claimed', 'review_required')
     or v_member.release_claim_amount_cents <> p_transfer_amount_cents
     or p_transfer_amount_cents <= 0 then
    return false;
  end if;

  update public.platform_held_group_member_settlements
     set state = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         released_amount_cents = p_transfer_amount_cents,
         provider_refund_cents_at_release = provider_refund_cents,
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = 0,
         released_at = coalesce(released_at, now()),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_settlement_id;

  select count(*) into v_unsettled
    from public.platform_held_group_member_settlements m
   where m.batch_id = v_member.batch_id
     and m.provider_amount_cents - m.provider_refund_cents > 0
     and m.stripe_transfer_id is null;

  update public.platform_held_group_charges
     set state = case
           when refunded_amount_cents > 0 then 'partially_refunded'
           when v_unsettled = 0 then 'released'
           else 'partially_released'
         end,
         updated_at = now()
   where batch_id = v_member.batch_id;

  return true;
end;
$$;

create or replace function public.klyx_mark_platform_held_group_member_review(
  p_member_settlement_id uuid,
  p_reason_code text,
  p_reason_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $
declare
  v_updated integer;
begin
  update public.platform_held_group_member_settlements
     set state = 'review_required',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_reason_code, 'group_member_review_required'), 120),
         last_error_message = left(coalesce(p_reason_message, 'Group member settlement requires review.'), 1000),
         updated_at = now()
   where id = p_member_settlement_id
     and state <> 'refunded';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$;

create or replace function public.klyx_claim_platform_held_group_refund(
  p_request_id uuid,
  p_batch_id uuid,
  p_allocations jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge public.platform_held_group_charges%rowtype;
  v_request_amount bigint;
  v_allocation_count integer;
  v_record record;
  v_member public.platform_held_group_member_settlements%rowtype;
  v_new_refund_gross bigint;
  v_target_provider_refund bigint;
  v_reversal_due bigint;
begin
  if jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_REFUND_ALLOCATIONS_REQUIRED';
  end if;

  select c.* into v_charge
    from public.platform_held_group_charges c
   where c.batch_id = p_batch_id
   for update;

  if not found
     or v_charge.state not in ('held', 'partially_released', 'released', 'partially_refunded') then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_REFUND_NOT_READY';
  end if;

  if exists (
    select 1
      from public.platform_held_group_member_settlements m
     where m.batch_id = p_batch_id
       and m.release_claim_amount_cents > 0
  ) then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_REFUND_RELEASE_IN_FLIGHT';
  end if;

  if exists (
    select 1
      from public.platform_held_group_refund_requests r
     where r.batch_id = p_batch_id
       and r.state in ('claimed', 'refund_pending', 'review_required')
  ) then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_REFUND_ALREADY_ACTIVE';
  end if;

  select
    count(*),
    coalesce(sum(a.refund_gross_cents), 0)
  into v_allocation_count, v_request_amount
  from jsonb_to_recordset(p_allocations) as a(
    member_settlement_id uuid,
    refund_gross_cents bigint
  );

  if v_allocation_count <> jsonb_array_length(p_allocations)
     or v_request_amount <= 0
     or v_request_amount > v_charge.gross_amount_cents - v_charge.refunded_amount_cents then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_REFUND_AMOUNT_INVALID';
  end if;

  if (
    select count(distinct a.member_settlement_id)
      from jsonb_to_recordset(p_allocations) as a(
        member_settlement_id uuid,
        refund_gross_cents bigint
      )
  ) <> v_allocation_count then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_REFUND_MEMBER_DUPLICATE';
  end if;

  insert into public.platform_held_group_refund_requests (
    id,
    batch_id,
    requested_amount_cents,
    currency,
    state
  ) values (
    p_request_id,
    p_batch_id,
    v_request_amount,
    v_charge.currency,
    'claimed'
  );

  for v_record in
    select *
      from jsonb_to_recordset(p_allocations) as a(
        member_settlement_id uuid,
        refund_gross_cents bigint
      )
  loop
    select m.* into v_member
      from public.platform_held_group_member_settlements m
     where m.id = v_record.member_settlement_id
       and m.batch_id = p_batch_id
     for update;

    if not found
       or v_record.refund_gross_cents <= 0
       or v_record.refund_gross_cents >
          v_member.gross_amount_cents - v_member.refund_allocated_gross_cents then
      raise exception 'KLYX_PLATFORM_HELD_GROUP_REFUND_MEMBER_AMOUNT_INVALID';
    end if;

    v_new_refund_gross :=
      v_member.refund_allocated_gross_cents + v_record.refund_gross_cents;

    v_target_provider_refund := case
      when v_new_refund_gross = v_member.gross_amount_cents
        then v_member.provider_amount_cents
      else floor(
        (v_member.provider_amount_cents::numeric * v_new_refund_gross::numeric)
        / v_member.gross_amount_cents::numeric
      )::bigint
    end;

    v_reversal_due := case
      when v_member.stripe_transfer_id is null then 0
      else greatest(
        v_target_provider_refund
        - v_member.provider_refund_cents_at_release
        - v_member.reversed_amount_cents,
        0
      )
    end;

    if v_reversal_due > greatest(
      v_member.released_amount_cents - v_member.reversed_amount_cents,
      0
    ) then
      raise exception 'KLYX_PLATFORM_HELD_GROUP_REFUND_REVERSAL_EXCEEDS_RELEASED';
    end if;

    insert into public.platform_held_group_refund_allocations (
      request_id,
      member_settlement_id,
      refund_gross_cents,
      target_refunded_gross_cents,
      target_provider_refund_cents,
      provider_reversal_due_cents,
      state
    ) values (
      p_request_id,
      v_member.id,
      v_record.refund_gross_cents,
      v_new_refund_gross,
      v_target_provider_refund,
      v_reversal_due,
      case when v_reversal_due = 0
        then 'no_reversal_required'
        else 'pending_reversal'
      end
    );

    update public.platform_held_group_member_settlements
       set state = 'refund_pending',
           updated_at = now()
     where id = v_member.id;
  end loop;

  update public.platform_held_group_charges
     set state = 'refund_pending',
         updated_at = now()
   where batch_id = p_batch_id;

  return true;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_refund_reversal(
  p_request_id uuid,
  p_member_settlement_id uuid,
  p_stripe_transfer_reversal_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allocation public.platform_held_group_refund_allocations%rowtype;
  v_member public.platform_held_group_member_settlements%rowtype;
begin
  if coalesce(trim(p_stripe_transfer_reversal_id), '') !~ '^trr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_REVERSAL_INVALID';
  end if;

  select a.* into v_allocation
    from public.platform_held_group_refund_allocations a
   where a.request_id = p_request_id
     and a.member_settlement_id = p_member_settlement_id
   for update;

  if not found then return false; end if;

  if v_allocation.state = 'reversed'
     and v_allocation.stripe_transfer_reversal_id = p_stripe_transfer_reversal_id then
    return true;
  end if;

  if v_allocation.state <> 'pending_reversal'
     or v_allocation.provider_reversal_due_cents <= 0 then
    return false;
  end if;

  select m.* into v_member
    from public.platform_held_group_member_settlements m
   where m.id = p_member_settlement_id
   for update;

  if not found
     or v_member.stripe_transfer_id is null
     or v_member.reversed_amount_cents + v_allocation.provider_reversal_due_cents >
        v_member.released_amount_cents then
    return false;
  end if;

  update public.platform_held_group_refund_allocations
     set state = 'reversed',
         stripe_transfer_reversal_id = p_stripe_transfer_reversal_id,
         updated_at = now()
   where request_id = p_request_id
     and member_settlement_id = p_member_settlement_id;

  update public.platform_held_group_member_settlements
     set reversed_amount_cents =
           reversed_amount_cents + v_allocation.provider_reversal_due_cents,
         updated_at = now()
   where id = p_member_settlement_id;

  return true;
end;
$$;

create or replace function public.klyx_mark_platform_held_group_refund_ready(
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.platform_held_group_refund_requests%rowtype;
begin
  select r.* into v_request
    from public.platform_held_group_refund_requests r
   where r.id = p_request_id
   for update;

  if not found then return false; end if;

  perform 1
    from public.platform_held_group_charges c
   where c.batch_id = v_request.batch_id
   for update;

  if exists (
    select 1
      from public.platform_held_group_refund_allocations a
     where a.request_id = p_request_id
       and a.state not in ('no_reversal_required', 'reversed')
  ) then
    return false;
  end if;

  update public.platform_held_group_refund_requests
     set state = 'refund_pending',
         updated_at = now()
   where id = p_request_id
     and state = 'claimed';

  return found;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_refund(
  p_request_id uuid,
  p_stripe_refund_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.platform_held_group_refund_requests%rowtype;
  v_charge public.platform_held_group_charges%rowtype;
  v_record record;
  v_new_total bigint;
begin
  if coalesce(trim(p_stripe_refund_id), '') !~ '^re_[A-Za-z0-9]+$' then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_REFUND_ID_INVALID';
  end if;

  select r.* into v_request
    from public.platform_held_group_refund_requests r
   where r.id = p_request_id
   for update;

  if not found then return false; end if;

  select c.* into v_charge
    from public.platform_held_group_charges c
   where c.batch_id = v_request.batch_id
   for update;

  if v_request.state = 'succeeded'
     and v_request.stripe_refund_id = p_stripe_refund_id then
    return true;
  end if;

  if v_request.state <> 'refund_pending'
     or exists (
       select 1
         from public.platform_held_group_refund_allocations a
        where a.request_id = p_request_id
          and a.state not in ('no_reversal_required', 'reversed')
     ) then
    return false;
  end if;

  v_new_total := v_charge.refunded_amount_cents + v_request.requested_amount_cents;

  if v_new_total > v_charge.gross_amount_cents then
    raise exception 'KLYX_PLATFORM_HELD_GROUP_REFUND_EXCEEDS_GROSS';
  end if;

  for v_record in
    select a.*
      from public.platform_held_group_refund_allocations a
     where a.request_id = p_request_id
  loop
    update public.platform_held_group_member_settlements m
       set refund_allocated_gross_cents = v_record.target_refunded_gross_cents,
           provider_refund_cents = v_record.target_provider_refund_cents,
           state = case
             when v_record.target_refunded_gross_cents = m.gross_amount_cents
               then 'refunded'
             when m.stripe_transfer_id is not null
               then 'released'
             else 'held'
           end,
           refunded_at = case
             when v_record.target_refunded_gross_cents = m.gross_amount_cents
               then coalesce(m.refunded_at, now())
             else m.refunded_at
           end,
           updated_at = now()
     where m.id = v_record.member_settlement_id;
  end loop;

  update public.platform_held_group_refund_requests
     set state = 'succeeded',
         stripe_refund_id = p_stripe_refund_id,
         finalized_at = now(),
         updated_at = now()
   where id = p_request_id;

  update public.platform_held_group_charges
     set refunded_amount_cents = v_new_total,
         state = case
           when v_new_total = gross_amount_cents then 'refunded'
           else 'partially_refunded'
         end,
         refunded_at = case
           when v_new_total = gross_amount_cents then coalesce(refunded_at, now())
           else refunded_at
         end,
         updated_at = now()
   where batch_id = v_request.batch_id;

  return true;
end;
$$;

create or replace function public.klyx_mark_platform_held_group_refund_review(
  p_request_id uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.platform_held_group_refund_requests%rowtype;
begin
  select r.* into v_request
    from public.platform_held_group_refund_requests r
   where r.id = p_request_id
   for update;

  if not found then return false; end if;

  perform 1
    from public.platform_held_group_charges c
   where c.batch_id = v_request.batch_id
   for update;

  update public.platform_held_group_refund_requests
     set state = 'review_required',
         last_error_code = left(coalesce(p_error_code, 'group_refund_review_required'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group refund requires review.'), 1000),
         updated_at = now()
   where id = p_request_id;

  update public.platform_held_group_refund_allocations
     set state = case
           when state in ('reversed', 'no_reversal_required') then state
           else 'review_required'
         end,
         updated_at = now()
   where request_id = p_request_id;

  update public.platform_held_group_member_settlements m
     set state = 'review_required',
         last_error_code = 'group_refund_review_required',
         last_error_message = left(coalesce(p_error_message, 'Group refund requires review.'), 1000),
         updated_at = now()
   where exists (
     select 1
       from public.platform_held_group_refund_allocations a
      where a.request_id = p_request_id
        and a.member_settlement_id = m.id
   );

  update public.platform_held_group_charges
     set state = 'review_required',
         updated_at = now()
   where batch_id = v_request.batch_id;

  return true;
end;
$$;

revoke all on function public.klyx_block_platform_held_group_reconfirmation()
  from public, anon, authenticated;
revoke all on function public.klyx_init_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_claim_platform_held_group_checkout(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_attach_platform_held_group_checkout(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_release_platform_held_group_checkout(uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_attach_platform_held_group_payment_truth(
  uuid, text, text, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.klyx_claim_platform_held_group_member_release(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_release(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_platform_held_group_member_release(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.klyx_reconcile_platform_held_group_member_transfer(uuid, text, bigint)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_member_review(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_claim_platform_held_group_refund(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_refund_reversal(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_refund_ready(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_refund(uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_refund_review(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.klyx_init_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) to service_role;
grant execute on function public.klyx_claim_platform_held_group_checkout(uuid, uuid)
  to service_role;
grant execute on function public.klyx_attach_platform_held_group_checkout(uuid, uuid, text)
  to service_role;
grant execute on function public.klyx_release_platform_held_group_checkout(uuid, text)
  to service_role;
grant execute on function public.klyx_attach_platform_held_group_payment_truth(
  uuid, text, text, text, bigint, text
) to service_role;
grant execute on function public.klyx_claim_platform_held_group_member_release(uuid, uuid, text)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_release(uuid, uuid, text)
  to service_role;
grant execute on function public.klyx_fail_platform_held_group_member_release(uuid, uuid, text, text, boolean)
  to service_role;
grant execute on function public.klyx_reconcile_platform_held_group_member_transfer(uuid, text, bigint)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_member_review(uuid, text, text)
  to service_role;
grant execute on function public.klyx_claim_platform_held_group_refund(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_group_refund_reversal(uuid, uuid, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_refund_ready(uuid)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_group_refund(uuid, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_refund_review(uuid, text, text)
  to service_role;

comment on table public.platform_held_group_charges is
  'TEST-only one-charge Platform-Held control plane for a multi-executor split batch.';
comment on table public.platform_held_group_member_settlements is
  'Per-canonical-executor immutable settlement ledger funded by one group charge.';
comment on table public.platform_held_group_refund_requests is
  'Server-only total/partial group refund claims; provider reversals must complete before Stripe refund.';
comment on table public.platform_held_group_refund_allocations is
  'Per-member gross refund allocation and exact provider reversal due for a group refund request.';

commit;

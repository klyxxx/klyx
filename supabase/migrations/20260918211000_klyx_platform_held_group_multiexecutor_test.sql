-- KLYX PLATFORM-HELD MULTI-EXECUTOR GROUP SETTLEMENT — STRIPE TEST ONLY
--
-- One platform charge finances an immutable set of per-executor settlements.
-- This is deliberately separate from:
--   * certified single-booking booking_settlements;
--   * legacy multi-provider destination-charge split payment units;
--   * historical mono-provider booking_groups.
--
-- No Stripe side effect is performed by SQL.

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

create table if not exists public.platform_held_group_settlements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique
    references public.split_booking_batches(id) on delete restrict,
  client_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  payment_confirmation_id uuid not null
    references public.split_booking_payment_confirmations(id) on delete restrict,
  payment_plan_hash text not null,
  payment_mode text not null default 'platform_held_group'
    check (payment_mode = 'platform_held_group'),
  currency text not null check (char_length(currency) = 3),
  gross_amount_cents bigint not null check (gross_amount_cents > 0),
  platform_fee_cents bigint not null check (platform_fee_cents >= 0),
  provider_amount_cents bigint not null check (provider_amount_cents >= 0),
  transfer_group text not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  checkout_attempt_number integer not null default 0
    check (checkout_attempt_number >= 0),
  checkout_claim_token uuid,
  checkout_claimed_at timestamptz,
  state text not null default 'pending_payment'
    check (state in (
      'pending_payment',
      'held',
      'release_partial',
      'released',
      'refund_pending',
      'partially_refunded',
      'refunded',
      'review_required'
    )),
  refunded_amount_cents bigint not null default 0
    check (refunded_amount_cents >= 0),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klyx_platform_held_group_parent_economics
    check (
      platform_fee_cents + provider_amount_cents = gross_amount_cents
      and refunded_amount_cents <= gross_amount_cents
    ),
  constraint klyx_platform_held_group_plan_hash
    check (char_length(payment_plan_hash) = 64)
);

create unique index if not exists platform_held_group_checkout_uidx
  on public.platform_held_group_settlements(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists platform_held_group_payment_intent_uidx
  on public.platform_held_group_settlements(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists platform_held_group_charge_uidx
  on public.platform_held_group_settlements(stripe_charge_id)
  where stripe_charge_id is not null;

create unique index if not exists platform_held_group_transfer_group_uidx
  on public.platform_held_group_settlements(transfer_group);

create table if not exists public.platform_held_group_settlement_members (
  id uuid primary key default gen_random_uuid(),
  group_settlement_id uuid not null
    references public.platform_held_group_settlements(id) on delete restrict,
  batch_id uuid not null
    references public.split_booking_batches(id) on delete restrict,
  provider_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  provider_account_id uuid not null
    references public.accounts(id) on delete restrict,
  stripe_account_id text not null
    check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  booking_ids jsonb not null
    check (jsonb_typeof(booking_ids) = 'array'),
  currency text not null check (char_length(currency) = 3),
  gross_amount_cents bigint not null check (gross_amount_cents > 0),
  platform_fee_cents bigint not null check (platform_fee_cents >= 0),
  provider_amount_cents bigint not null check (provider_amount_cents >= 0),
  state text not null default 'held'
    check (state in (
      'held',
      'release_claimed',
      'released',
      'release_failed',
      'refund_pending',
      'partially_reversed',
      'reversed',
      'review_required'
    )),
  release_attempt_number integer not null default 0
    check (release_attempt_number >= 0),
  release_claim_token uuid,
  release_claimed_at timestamptz,
  stripe_transfer_id text,
  released_at timestamptz,
  reversed_amount_cents bigint not null default 0
    check (reversed_amount_cents >= 0),
  refunded_gross_amount_cents bigint not null default 0
    check (refunded_gross_amount_cents >= 0),
  refunded_platform_fee_cents bigint not null default 0
    check (refunded_platform_fee_cents >= 0),
  refunded_provider_amount_cents bigint not null default 0
    check (refunded_provider_amount_cents >= 0),
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klyx_platform_held_group_member_unique
    unique (group_settlement_id, provider_profile_id),
  constraint klyx_platform_held_group_member_economics
    check (
      platform_fee_cents + provider_amount_cents = gross_amount_cents
      and reversed_amount_cents <= provider_amount_cents
      and refunded_gross_amount_cents <= gross_amount_cents
      and refunded_platform_fee_cents <= platform_fee_cents
      and refunded_provider_amount_cents <= provider_amount_cents
      and refunded_platform_fee_cents + refunded_provider_amount_cents
        = refunded_gross_amount_cents
    )
);

create unique index if not exists platform_held_group_member_transfer_uidx
  on public.platform_held_group_settlement_members(stripe_transfer_id)
  where stripe_transfer_id is not null;

create index if not exists platform_held_group_members_batch_idx
  on public.platform_held_group_settlement_members(batch_id, state);

create table if not exists public.platform_held_group_refunds (
  id uuid primary key default gen_random_uuid(),
  group_settlement_id uuid not null
    references public.platform_held_group_settlements(id) on delete restrict,
  batch_id uuid not null
    references public.split_booking_batches(id) on delete restrict,
  request_key text not null,
  currency text not null check (char_length(currency) = 3),
  amount_cents bigint not null check (amount_cents > 0),
  state text not null default 'reversing'
    check (state in (
      'reversing',
      'ready',
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
  constraint klyx_platform_held_group_refund_key
    unique (group_settlement_id, request_key)
);

create unique index if not exists platform_held_group_refund_stripe_uidx
  on public.platform_held_group_refunds(stripe_refund_id)
  where stripe_refund_id is not null;

create table if not exists public.platform_held_group_refund_allocations (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null
    references public.platform_held_group_refunds(id) on delete restrict,
  member_id uuid not null
    references public.platform_held_group_settlement_members(id) on delete restrict,
  gross_refund_cents bigint not null check (gross_refund_cents > 0),
  platform_fee_refund_cents bigint not null check (platform_fee_refund_cents >= 0),
  provider_refund_cents bigint not null check (provider_refund_cents >= 0),
  state text not null default 'ready'
    check (state in (
      'ready',
      'reversal_required',
      'reversed',
      'failed',
      'review_required',
      'refunded'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klyx_platform_held_group_refund_allocation_unique
    unique (refund_id, member_id),
  constraint klyx_platform_held_group_refund_allocation_economics
    check (
      platform_fee_refund_cents + provider_refund_cents = gross_refund_cents
    )
);

create table if not exists public.platform_held_group_member_reversals (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null unique
    references public.platform_held_group_refund_allocations(id) on delete restrict,
  member_id uuid not null
    references public.platform_held_group_settlement_members(id) on delete restrict,
  stripe_transfer_id text not null,
  stripe_transfer_reversal_id text not null unique,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

alter table public.platform_held_group_settlements enable row level security;
alter table public.platform_held_group_settlement_members enable row level security;
alter table public.platform_held_group_refunds enable row level security;
alter table public.platform_held_group_refund_allocations enable row level security;
alter table public.platform_held_group_member_reversals enable row level security;

revoke all privileges on table public.platform_held_group_settlements
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_group_settlement_members
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_group_refunds
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_group_refund_allocations
  from public, anon, authenticated;
revoke all privileges on table public.platform_held_group_member_reversals
  from public, anon, authenticated;

grant select, insert, update, delete on table public.platform_held_group_settlements
  to service_role;
grant select, insert, update, delete on table public.platform_held_group_settlement_members
  to service_role;
grant select, insert, update, delete on table public.platform_held_group_refunds
  to service_role;
grant select, insert, update, delete on table public.platform_held_group_refund_allocations
  to service_role;
grant select, insert, update, delete on table public.platform_held_group_member_reversals
  to service_role;

create or replace function public.klyx_prepare_platform_held_group_settlement(
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
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_existing public.platform_held_group_settlements%rowtype;
  v_group_id uuid;
  v_member jsonb;
  v_member_count integer;
  v_provider_count integer;
  v_booking_count integer;
  v_actual_booking_count integer;
  v_gross_sum bigint;
  v_fee_sum bigint;
  v_provider_sum bigint;
  v_provider_profile_id uuid;
  v_provider_account_id uuid;
  v_stripe_account_id text;
  v_booking_ids jsonb;
begin
  if char_length(coalesce(p_payment_plan_hash, '')) <> 64
     or char_length(upper(coalesce(p_currency, ''))) <> 3
     or coalesce(trim(p_transfer_group), '') = ''
     or p_gross_amount_cents <= 0
     or p_platform_fee_cents < 0
     or p_provider_amount_cents < 0
     or p_platform_fee_cents + p_provider_amount_cents <> p_gross_amount_cents
     or p_members is null
     or jsonb_typeof(p_members) <> 'array'
     or jsonb_array_length(p_members) < 2 then
    raise exception 'KLYX_GROUP_HELD_PLAN_INVALID';
  end if;

  select id, client_profile_id, provider_count, expected_booking_count, status
    into v_batch
    from public.split_booking_batches
   where id = p_batch_id
   for update;

  if not found
     or v_batch.client_profile_id <> p_client_profile_id
     or v_batch.provider_count < 2
     or v_batch.status <> 'created' then
    raise exception 'KLYX_GROUP_HELD_BATCH_INVALID';
  end if;

  if exists (
    select 1
      from public.split_booking_payment_runs r
     where r.batch_id = p_batch_id
  ) then
    raise exception 'KLYX_GROUP_HELD_LEGACY_SPLIT_PAYMENT_CONFLICT';
  end if;

  if not exists (
    select 1
      from public.split_booking_payment_confirmations c
     where c.id = p_payment_confirmation_id
       and c.batch_id = p_batch_id
       and c.client_profile_id = p_client_profile_id
       and c.payment_plan_hash = p_payment_plan_hash
       and c.invalidated_at is null
  ) then
    raise exception 'KLYX_GROUP_HELD_CONFIRMATION_INVALID';
  end if;

  select *
    into v_existing
    from public.platform_held_group_settlements
   where batch_id = p_batch_id;

  if found then
    if v_existing.payment_confirmation_id = p_payment_confirmation_id
       and v_existing.payment_plan_hash = p_payment_plan_hash
       and v_existing.currency = upper(p_currency)
       and v_existing.gross_amount_cents = p_gross_amount_cents
       and v_existing.platform_fee_cents = p_platform_fee_cents
       and v_existing.provider_amount_cents = p_provider_amount_cents
       and v_existing.transfer_group = p_transfer_group then
      return v_existing.id;
    end if;

    raise exception 'KLYX_GROUP_HELD_PLAN_ALREADY_FROZEN';
  end if;

  select
    count(*),
    count(distinct m ->> 'provider_profile_id'),
    coalesce(sum((m ->> 'gross_amount_cents')::bigint), 0),
    coalesce(sum((m ->> 'platform_fee_cents')::bigint), 0),
    coalesce(sum((m ->> 'provider_amount_cents')::bigint), 0)
    into v_member_count, v_provider_count, v_gross_sum, v_fee_sum, v_provider_sum
    from jsonb_array_elements(p_members) m;

  if v_member_count <> v_batch.provider_count
     or v_provider_count <> v_member_count
     or v_gross_sum <> p_gross_amount_cents
     or v_fee_sum <> p_platform_fee_cents
     or v_provider_sum <> p_provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_ACCOUNTING_TOTAL_MISMATCH';
  end if;

  select count(distinct booking_id)
    into v_actual_booking_count
    from public.split_booking_batch_items
   where batch_id = p_batch_id;

  select count(distinct (booking_id)::uuid)
    into v_booking_count
    from jsonb_array_elements(p_members) m
    cross join lateral jsonb_array_elements_text(m -> 'booking_ids') booking_id;

  if v_actual_booking_count <> v_batch.expected_booking_count
     or v_booking_count <> v_actual_booking_count then
    raise exception 'KLYX_GROUP_HELD_BOOKING_COVERAGE_MISMATCH';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_members) m
      cross join lateral jsonb_array_elements_text(m -> 'booking_ids') booking_id
      left join public.split_booking_batch_items i
        on i.batch_id = p_batch_id
       and i.booking_id = booking_id::uuid
       and i.provider_profile_id = (m ->> 'provider_profile_id')::uuid
     where i.id is null
  ) then
    raise exception 'KLYX_GROUP_HELD_MEMBER_BOOKING_MISMATCH';
  end if;

  if exists (
    select 1
      from public.split_booking_batch_items i
     where i.batch_id = p_batch_id
       and not exists (
         select 1
           from jsonb_array_elements(p_members) m
           cross join lateral jsonb_array_elements_text(m -> 'booking_ids') booking_id
          where booking_id::uuid = i.booking_id
            and (m ->> 'provider_profile_id')::uuid = i.provider_profile_id
       )
  ) then
    raise exception 'KLYX_GROUP_HELD_MEMBER_BOOKING_MISSING';
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
    transfer_group
  ) values (
    p_batch_id,
    p_client_profile_id,
    p_payment_confirmation_id,
    p_payment_plan_hash,
    upper(p_currency),
    p_gross_amount_cents,
    p_platform_fee_cents,
    p_provider_amount_cents,
    p_transfer_group
  )
  returning id into v_group_id;

  for v_member in
    select value from jsonb_array_elements(p_members)
  loop
    v_provider_profile_id := (v_member ->> 'provider_profile_id')::uuid;
    v_provider_account_id := (v_member ->> 'provider_account_id')::uuid;
    v_stripe_account_id := trim(v_member ->> 'stripe_account_id');
    v_booking_ids := v_member -> 'booking_ids';

    if v_booking_ids is null
       or jsonb_typeof(v_booking_ids) <> 'array'
       or jsonb_array_length(v_booking_ids) = 0
       or v_stripe_account_id !~ '^acct_[A-Za-z0-9]+$'
       or (v_member ->> 'gross_amount_cents')::bigint <= 0
       or (v_member ->> 'platform_fee_cents')::bigint < 0
       or (v_member ->> 'provider_amount_cents')::bigint < 0
       or (v_member ->> 'platform_fee_cents')::bigint
          + (v_member ->> 'provider_amount_cents')::bigint
          <> (v_member ->> 'gross_amount_cents')::bigint then
      raise exception 'KLYX_GROUP_HELD_MEMBER_INVALID';
    end if;

    if not exists (
      select 1
        from public.profiles p
       where p.id = v_provider_profile_id
         and p.account_id = v_provider_account_id
    ) then
      raise exception 'KLYX_GROUP_HELD_MEMBER_ACCOUNT_MISMATCH';
    end if;

    if not exists (
      select 1
        from public.account_stripe_connect_identities i
       where i.account_id = v_provider_account_id
         and i.identity_state = 'linked'
         and i.stripe_account_id = v_stripe_account_id
    ) then
      raise exception 'KLYX_GROUP_HELD_MEMBER_STRIPE_IDENTITY_MISMATCH';
    end if;

    insert into public.platform_held_group_settlement_members (
      group_settlement_id,
      batch_id,
      provider_profile_id,
      provider_account_id,
      stripe_account_id,
      booking_ids,
      currency,
      gross_amount_cents,
      platform_fee_cents,
      provider_amount_cents,
      state
    ) values (
      v_group_id,
      p_batch_id,
      v_provider_profile_id,
      v_provider_account_id,
      v_stripe_account_id,
      v_booking_ids,
      upper(p_currency),
      (v_member ->> 'gross_amount_cents')::bigint,
      (v_member ->> 'platform_fee_cents')::bigint,
      (v_member ->> 'provider_amount_cents')::bigint,
      'held'
    );
  end loop;

  return v_group_id;
end;
$$;

create or replace function public.klyx_claim_platform_held_group_checkout(
  p_group_settlement_id uuid,
  p_claim_token uuid
)
returns table (
  action text,
  attempt_number integer,
  checkout_session_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.platform_held_group_settlements%rowtype;
begin
  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = p_group_settlement_id
   for update;

  if not found then
    raise exception 'KLYX_GROUP_HELD_SETTLEMENT_NOT_FOUND';
  end if;

  if v_parent.state <> 'pending_payment' then
    return query select
      'paid'::text,
      v_parent.checkout_attempt_number,
      v_parent.stripe_checkout_session_id;
    return;
  end if;

  if v_parent.stripe_checkout_session_id is not null then
    return query select
      'reuse'::text,
      v_parent.checkout_attempt_number,
      v_parent.stripe_checkout_session_id;
    return;
  end if;

  if v_parent.checkout_claim_token is not null
     and v_parent.checkout_claimed_at is not null
     and v_parent.checkout_claimed_at > now() - interval '2 minutes' then
    return query select
      'busy'::text,
      v_parent.checkout_attempt_number,
      null::text;
    return;
  end if;

  if v_parent.checkout_claim_token is not null
     and v_parent.checkout_claimed_at is not null then
    -- Unknown prior Stripe result: transfer ownership of the stale claim but
    -- KEEP the same attempt number so the caller must reuse the same Stripe
    -- idempotency key. Never mint a fresh checkout key after an unknown write.
    update public.platform_held_group_settlements
       set checkout_claim_token = p_claim_token,
           checkout_claimed_at = now(),
           updated_at = now()
     where id = p_group_settlement_id
     returning * into v_parent;
  else
    update public.platform_held_group_settlements
       set checkout_attempt_number = checkout_attempt_number + 1,
           checkout_claim_token = p_claim_token,
           checkout_claimed_at = now(),
           updated_at = now()
     where id = p_group_settlement_id
     returning * into v_parent;
  end if;

  return query select
    'create'::text,
    v_parent.checkout_attempt_number,
    null::text;
end;
$;

create or replace function public.klyx_attach_platform_held_group_checkout(
  p_group_settlement_id uuid,
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
  if coalesce(trim(p_checkout_session_id), '') !~ '^cs_[A-Za-z0-9_]+
create or replace function public.klyx_mark_platform_held_group_paid(
  p_group_settlement_id uuid,
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
  v_parent public.platform_held_group_settlements%rowtype;
begin
  if coalesce(trim(p_checkout_session_id), '') !~ '^cs_[A-Za-z0-9_]+$'
     or coalesce(trim(p_payment_intent_id), '') !~ '^pi_[A-Za-z0-9_]+$'
     or coalesce(trim(p_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_GROUP_HELD_STRIPE_TRUTH_INVALID';
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = p_group_settlement_id
   for update;

  if not found then return false; end if;

  if v_parent.stripe_checkout_session_id is distinct from p_checkout_session_id
     or v_parent.gross_amount_cents <> p_amount_cents
     or v_parent.currency <> upper(p_currency)
     or (v_parent.stripe_payment_intent_id is not null
         and v_parent.stripe_payment_intent_id <> p_payment_intent_id)
     or (v_parent.stripe_charge_id is not null
         and v_parent.stripe_charge_id <> p_charge_id) then
    raise exception 'KLYX_GROUP_HELD_STRIPE_TRUTH_MISMATCH';
  end if;

  update public.platform_held_group_settlements
     set state = case when state = 'pending_payment' then 'held' else state end,
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
         stripe_charge_id = coalesce(stripe_charge_id, p_charge_id),
         paid_at = coalesce(paid_at, now()),
         updated_at = now()
   where id = p_group_settlement_id
     and state in ('pending_payment', 'held');

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
  provider_account_id uuid,
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
  v_member public.platform_held_group_settlement_members%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_total_member_provider bigint;
  v_committed_provider bigint;
  v_incomplete integer;
begin
  select m.*
    into v_member
    from public.platform_held_group_settlement_members m
   where m.id = p_member_id;

  if not found then
    raise exception 'KLYX_GROUP_HELD_MEMBER_NOT_FOUND';
  end if;

  select p.*
    into v_parent
    from public.platform_held_group_settlements p
   where p.id = v_member.group_settlement_id
   for update;

  select m.*
    into v_member
    from public.platform_held_group_settlement_members m
   where m.id = p_member_id
   for update;

  if v_member.state = 'released' and v_member.stripe_transfer_id is not null then
    return query select
      'released'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_parent.state in ('refund_pending', 'refunded', 'review_required')
     or coalesce(trim(v_parent.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$'
     or v_member.state in ('refund_pending', 'partially_reversed', 'reversed', 'review_required') then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_member.state = 'release_claimed' then
    return query select
      'busy'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select count(*)
    into v_incomplete
    from jsonb_array_elements_text(v_member.booking_ids) booking_id
    join public.bookings b on b.id = booking_id::uuid
   where coalesce(b.status, '') <> 'completed';

  if v_incomplete > 0 then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if not exists (
    select 1
      from public.account_stripe_connect_identities i
     where i.account_id = v_member.provider_account_id
       and i.identity_state = 'linked'
       and i.stripe_account_id = v_member.stripe_account_id
  ) then
    return query select
      'review_required'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if not exists (
    select 1
      from public.transaction_risk_decisions d
     where d.account_id = v_member.provider_account_id
       and d.action = 'settlement_release'
       and d.participant = 'settlement_recipient'
       and d.subject_type = 'split_batch'
       and d.subject_id = v_member.batch_id::text
       and d.decision = 'allow'
       and d.risk_assessed_at >= now() - interval '5 minutes'
  ) then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select coalesce(sum(provider_amount_cents), 0)
    into v_total_member_provider
    from public.platform_held_group_settlement_members
   where group_settlement_id = v_parent.id;

  if v_total_member_provider <> v_parent.provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_MEMBER_PROVIDER_TOTAL_MISMATCH';
  end if;

  select coalesce(sum(provider_amount_cents), 0)
    into v_committed_provider
    from public.platform_held_group_settlement_members
   where group_settlement_id = v_parent.id
     and id <> v_member.id
     and (
       stripe_transfer_id is not null
       or state = 'release_claimed'
     );

  if v_committed_provider + v_member.provider_amount_cents
       > v_parent.provider_amount_cents
     or v_committed_provider + v_member.provider_amount_cents
       > v_parent.gross_amount_cents - v_parent.platform_fee_cents then
    raise exception 'KLYX_GROUP_HELD_AGGREGATE_OVERTRANSFER_GUARD';
  end if;

  update public.platform_held_group_settlement_members
     set state = 'release_claimed',
         release_attempt_number = release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = v_member.id
   returning * into v_member;

  return query select
    'create'::text, v_member.release_attempt_number, v_member.batch_id,
    v_member.provider_profile_id, v_member.provider_account_id,
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
  v_member public.platform_held_group_settlement_members%rowtype;
  v_remaining integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_GROUP_HELD_TRANSFER_ID_INVALID';
  end if;

  update public.platform_held_group_settlement_members
     set state = 'released',
         stripe_transfer_id = coalesce(stripe_transfer_id, p_stripe_transfer_id),
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token
     and (stripe_transfer_id is null or stripe_transfer_id = p_stripe_transfer_id)
   returning * into v_member;

  if not found then return false; end if;

  select count(*)
    into v_remaining
    from public.platform_held_group_settlement_members
   where group_settlement_id = v_member.group_settlement_id
     and state not in ('released', 'partially_reversed', 'reversed');

  update public.platform_held_group_settlements
     set state = case when v_remaining = 0 then 'released' else 'release_partial' end,
         updated_at = now()
   where id = v_member.group_settlement_id
     and state in ('held', 'release_partial', 'released');

  return true;
end;
$$;

create or replace function public.klyx_reconcile_platform_held_group_member_release(
  p_member_id uuid,
  p_stripe_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.platform_held_group_settlement_members%rowtype;
  v_remaining integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+  p_member_id uuid,
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
  update public.platform_held_group_settlement_members
     set state = 'release_failed',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_error_code, 'group_member_release_failed'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member release failed.'), 1000),
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_platform_held_group_review(
  p_group_settlement_id uuid,
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
  update public.platform_held_group_settlements
     set state = 'review_required',
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where id = p_group_settlement_id
     and state <> 'refunded';

  get diagnostics v_updated = row_count;

  if v_updated = 1 then
    update public.platform_held_group_settlement_members
       set state = case
             when state in ('reversed') then state
             else 'review_required'
           end,
           release_claim_token = null,
           release_claimed_at = null,
           last_error_code = left(coalesce(p_error_code, 'group_review_required'), 120),
           last_error_message = left(coalesce(p_error_message, 'Group settlement requires review.'), 1000),
           updated_at = now()
     where group_settlement_id = p_group_settlement_id;
  end if;

  return v_updated = 1;
end;
$;

create or replace function public.klyx_mark_platform_held_group_member_review(
  p_member_id uuid,
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
  update public.platform_held_group_settlement_members
     set state = 'review_required',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_error_code, 'group_member_review_required'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member requires review.'), 1000),
         updated_at = now()
   where id = p_member_id
     and state not in ('reversed');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_create_platform_held_group_refund_plan(
  p_batch_id uuid,
  p_request_key text,
  p_amount_cents bigint,
  p_currency text,
  p_allocations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.platform_held_group_settlements%rowtype;
  v_existing public.platform_held_group_refunds%rowtype;
  v_refund_id uuid;
  v_allocation jsonb;
  v_member public.platform_held_group_settlement_members%rowtype;
  v_amount_sum bigint;
  v_fee_sum bigint;
  v_provider_sum bigint;
  v_prior_gross bigint;
  v_prior_fee bigint;
  v_prior_provider bigint;
  v_prior_total bigint;
  v_requires_reversal boolean := false;
begin
  if coalesce(trim(p_request_key), '') = ''
     or p_amount_cents <= 0
     or char_length(upper(coalesce(p_currency, ''))) <> 3
     or p_allocations is null
     or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'KLYX_GROUP_HELD_REFUND_PLAN_INVALID';
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where batch_id = p_batch_id
   for update;

  if not found
     or v_parent.state in ('pending_payment', 'refunded', 'review_required')
     or v_parent.currency <> upper(p_currency)
     or coalesce(trim(v_parent.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_GROUP_HELD_REFUND_NOT_READY';
  end if;

  if exists (
    select 1
      from public.platform_held_group_settlement_members m
     where m.group_settlement_id = v_parent.id
       and m.state = 'release_claimed'
  ) then
    raise exception 'KLYX_GROUP_HELD_REFUND_RELEASE_CONFLICT';
  end if;

  select *
    into v_existing
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and request_key = p_request_key;

  if found then
    if v_existing.amount_cents = p_amount_cents
       and v_existing.currency = upper(p_currency) then
      return v_existing.id;
    end if;
    raise exception 'KLYX_GROUP_HELD_REFUND_KEY_CONFLICT';
  end if;

  select
    coalesce(sum((a ->> 'gross_refund_cents')::bigint), 0),
    coalesce(sum((a ->> 'platform_fee_refund_cents')::bigint), 0),
    coalesce(sum((a ->> 'provider_refund_cents')::bigint), 0)
    into v_amount_sum, v_fee_sum, v_provider_sum
    from jsonb_array_elements(p_allocations) a;

  if v_amount_sum <> p_amount_cents
     or v_fee_sum + v_provider_sum <> p_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_ALLOCATION_TOTAL_MISMATCH';
  end if;

  select coalesce(sum(amount_cents), 0)
    into v_prior_total
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and state <> 'failed';

  if v_prior_total + p_amount_cents > v_parent.gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_EXCEEDS_GROSS';
  end if;

  insert into public.platform_held_group_refunds (
    group_settlement_id,
    batch_id,
    request_key,
    currency,
    amount_cents,
    state
  ) values (
    v_parent.id,
    p_batch_id,
    p_request_key,
    upper(p_currency),
    p_amount_cents,
    'reversing'
  )
  returning id into v_refund_id;

  for v_allocation in
    select value from jsonb_array_elements(p_allocations)
  loop
    select *
      into v_member
      from public.platform_held_group_settlement_members
     where id = (v_allocation ->> 'member_id')::uuid
       and group_settlement_id = v_parent.id
     for update;

    if not found then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_INVALID';
    end if;

    if (v_allocation ->> 'gross_refund_cents')::bigint <= 0
       or (v_allocation ->> 'platform_fee_refund_cents')::bigint < 0
       or (v_allocation ->> 'provider_refund_cents')::bigint < 0
       or (v_allocation ->> 'platform_fee_refund_cents')::bigint
          + (v_allocation ->> 'provider_refund_cents')::bigint
          <> (v_allocation ->> 'gross_refund_cents')::bigint then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_ECONOMICS_INVALID';
    end if;

    select
      coalesce(sum(a.gross_refund_cents), 0),
      coalesce(sum(a.platform_fee_refund_cents), 0),
      coalesce(sum(a.provider_refund_cents), 0)
      into v_prior_gross, v_prior_fee, v_prior_provider
      from public.platform_held_group_refund_allocations a
      join public.platform_held_group_refunds r on r.id = a.refund_id
     where a.member_id = v_member.id
       and r.state <> 'failed';

    if v_prior_gross + (v_allocation ->> 'gross_refund_cents')::bigint
         > v_member.gross_amount_cents
       or v_prior_fee + (v_allocation ->> 'platform_fee_refund_cents')::bigint
         > v_member.platform_fee_cents
       or v_prior_provider + (v_allocation ->> 'provider_refund_cents')::bigint
         > v_member.provider_amount_cents then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_EXCEEDS_FROZEN_ECONOMICS';
    end if;

    if v_member.stripe_transfer_id is not null
       and (v_allocation ->> 'provider_refund_cents')::bigint > 0 then
      v_requires_reversal := true;
    end if;

    insert into public.platform_held_group_refund_allocations (
      refund_id,
      member_id,
      gross_refund_cents,
      platform_fee_refund_cents,
      provider_refund_cents,
      state
    ) values (
      v_refund_id,
      v_member.id,
      (v_allocation ->> 'gross_refund_cents')::bigint,
      (v_allocation ->> 'platform_fee_refund_cents')::bigint,
      (v_allocation ->> 'provider_refund_cents')::bigint,
      case
        when v_member.stripe_transfer_id is not null
         and (v_allocation ->> 'provider_refund_cents')::bigint > 0
          then 'reversal_required'
        else 'ready'
      end
    );
  end loop;

  update public.platform_held_group_refunds
     set state = case when v_requires_reversal then 'reversing' else 'ready' end,
         updated_at = now()
   where id = v_refund_id;

  update public.platform_held_group_settlements
     set state = 'refund_pending',
         updated_at = now()
   where id = v_parent.id;

  return v_refund_id;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_member_reversal(
  p_allocation_id uuid,
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
  v_allocation public.platform_held_group_refund_allocations%rowtype;
  v_member public.platform_held_group_settlement_members%rowtype;
  v_pending integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$'
     or coalesce(trim(p_stripe_transfer_reversal_id), '') !~ '^trr_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_GROUP_HELD_REVERSAL_TRUTH_INVALID';
  end if;

  select *
    into v_allocation
    from public.platform_held_group_refund_allocations
   where id = p_allocation_id
   for update;

  if not found
     or v_allocation.state not in ('reversal_required', 'reversed')
     or v_allocation.provider_refund_cents <> p_amount_cents then
    return false;
  end if;

  select *
    into v_member
    from public.platform_held_group_settlement_members
   where id = v_allocation.member_id
   for update;

  if not found
     or v_member.stripe_transfer_id is distinct from p_stripe_transfer_id
     or v_member.reversed_amount_cents + p_amount_cents > v_member.provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REVERSAL_MEMBER_MISMATCH';
  end if;

  if exists (
    select 1
      from public.platform_held_group_member_reversals r
     where r.allocation_id = p_allocation_id
  ) then
    return true;
  end if;

  insert into public.platform_held_group_member_reversals (
    allocation_id,
    member_id,
    stripe_transfer_id,
    stripe_transfer_reversal_id,
    amount_cents
  ) values (
    p_allocation_id,
    v_member.id,
    p_stripe_transfer_id,
    p_stripe_transfer_reversal_id,
    p_amount_cents
  );

  update public.platform_held_group_refund_allocations
     set state = 'reversed',
         updated_at = now()
   where id = p_allocation_id;

  update public.platform_held_group_settlement_members
     set reversed_amount_cents = reversed_amount_cents + p_amount_cents,
         state = case
           when reversed_amount_cents + p_amount_cents = provider_amount_cents
             then 'reversed'
           else 'partially_reversed'
         end,
         updated_at = now()
   where id = v_member.id;

  select count(*)
    into v_pending
    from public.platform_held_group_refund_allocations
   where refund_id = v_allocation.refund_id
     and state = 'reversal_required';

  if v_pending = 0 then
    update public.platform_held_group_refunds
       set state = 'ready',
           updated_at = now()
     where id = v_allocation.refund_id
       and state = 'reversing';
  end if;

  return true;
end;
$$;

create or replace function public.klyx_mark_platform_held_group_refund_allocation_review(
  p_allocation_id uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allocation public.platform_held_group_refund_allocations%rowtype;
begin
  update public.platform_held_group_refund_allocations
     set state = 'review_required',
         updated_at = now()
   where id = p_allocation_id
   returning * into v_allocation;

  if not found then return false; end if;

  update public.platform_held_group_refunds
     set state = 'review_required',
         failure_code = left(coalesce(p_error_code, 'group_refund_allocation_review'), 120),
         failure_message = left(coalesce(p_error_message, 'Refund allocation requires review.'), 1000),
         updated_at = now()
   where id = v_allocation.refund_id;

  return true;
end;
$;

create or replace function public.klyx_mark_platform_held_group_refund_inflight(
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
  update public.platform_held_group_refunds
     set state = 'refunding',
         updated_at = now()
   where id = p_refund_id
     and state = 'ready'
     and not exists (
       select 1
         from public.platform_held_group_refund_allocations a
        where a.refund_id = p_refund_id
          and a.state not in ('ready', 'reversed')
     );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$;

create or replace function public.klyx_fail_platform_held_group_refund(
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
  v_refund public.platform_held_group_refunds%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_total_refunded bigint;
begin
  update public.platform_held_group_refunds
     set state = 'failed',
         failure_code = left(coalesce(p_error_code, 'group_refund_failed'), 120),
         failure_message = left(coalesce(p_error_message, 'Group refund failed.'), 1000),
         updated_at = now()
   where id = p_refund_id
     and state in ('ready', 'refunding')
   returning * into v_refund;

  if not found then return false; end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = v_refund.group_settlement_id
   for update;

  select coalesce(sum(amount_cents), 0)
    into v_total_refunded
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and state = 'succeeded';

  update public.platform_held_group_settlements
     set refunded_amount_cents = v_total_refunded,
         state = case
           when v_total_refunded > 0 then 'partially_refunded'
           when exists (
             select 1
               from public.platform_held_group_settlement_members m
              where m.group_settlement_id = v_parent.id
                and m.stripe_transfer_id is not null
           ) then 'release_partial'
           else 'held'
         end,
         updated_at = now()
   where id = v_parent.id;

  return true;
end;
$;

create or replace function public.klyx_finalize_platform_held_group_refund(
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
  v_refund public.platform_held_group_refunds%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_allocation record;
  v_total_refunded bigint;
begin
  if coalesce(trim(p_stripe_refund_id), '') !~ '^re_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_GROUP_HELD_REFUND_TRUTH_INVALID';
  end if;

  select *
    into v_refund
    from public.platform_held_group_refunds
   where id = p_refund_id
   for update;

  if not found then return false; end if;

  if v_refund.state = 'succeeded' then
    return v_refund.stripe_refund_id = p_stripe_refund_id
       and v_refund.amount_cents = p_amount_cents
       and v_refund.currency = upper(p_currency);
  end if;

  if v_refund.state not in ('ready', 'refunding')
     or v_refund.amount_cents <> p_amount_cents
     or v_refund.currency <> upper(p_currency)
     or exists (
       select 1
         from public.platform_held_group_refund_allocations a
        where a.refund_id = v_refund.id
          and a.state not in ('ready', 'reversed')
     ) then
    return false;
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = v_refund.group_settlement_id
   for update;

  for v_allocation in
    select * from public.platform_held_group_refund_allocations
     where refund_id = v_refund.id
     for update
  loop
    update public.platform_held_group_settlement_members
       set refunded_gross_amount_cents =
             refunded_gross_amount_cents + v_allocation.gross_refund_cents,
           refunded_platform_fee_cents =
             refunded_platform_fee_cents + v_allocation.platform_fee_refund_cents,
           refunded_provider_amount_cents =
             refunded_provider_amount_cents + v_allocation.provider_refund_cents,
           updated_at = now()
     where id = v_allocation.member_id;

    update public.platform_held_group_refund_allocations
       set state = 'refunded',
           updated_at = now()
     where id = v_allocation.id;
  end loop;

  update public.platform_held_group_refunds
     set state = 'succeeded',
         stripe_refund_id = p_stripe_refund_id,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = v_refund.id;

  select coalesce(sum(amount_cents), 0)
    into v_total_refunded
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and state = 'succeeded';

  if v_total_refunded > v_parent.gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_TOTAL_EXCEEDS_GROSS';
  end if;

  update public.platform_held_group_settlements as parent
     set refunded_amount_cents = v_total_refunded,
         state = case
           when v_total_refunded = parent.gross_amount_cents then 'refunded'
           when exists (
             select 1 from public.platform_held_group_settlement_members m
              where m.group_settlement_id = parent.id
                and m.stripe_transfer_id is not null
           ) then 'release_partial'
           else 'partially_refunded'
         end,
         refunded_at = case
           when v_total_refunded = gross_amount_cents then coalesce(refunded_at, now())
           else refunded_at
         end,
         updated_at = now()
   where id = v_parent.id;

  return true;
end;
$$;

revoke all on function public.klyx_prepare_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_claim_platform_held_group_checkout(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_attach_platform_held_group_checkout(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_release_expired_platform_held_group_checkout(uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_paid(
  uuid, text, text, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.klyx_claim_platform_held_group_member_release(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_release(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_reconcile_platform_held_group_member_release(uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_reopen_platform_held_group_member_release_after_no_transfer(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_platform_held_group_member_release(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_review(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_member_review(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_create_platform_held_group_refund_plan(
  uuid, text, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_reversal(
  uuid, text, text, bigint
) from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_refund_allocation_review(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_refund_inflight(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_platform_held_group_refund(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_refund(
  uuid, text, bigint, text
) from public, anon, authenticated;

grant execute on function public.klyx_prepare_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) to service_role;
grant execute on function public.klyx_claim_platform_held_group_checkout(uuid, uuid)
  to service_role;
grant execute on function public.klyx_attach_platform_held_group_checkout(uuid, uuid, text)
  to service_role;
grant execute on function public.klyx_release_expired_platform_held_group_checkout(uuid, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_paid(
  uuid, text, text, text, bigint, text
) to service_role;
grant execute on function public.klyx_claim_platform_held_group_member_release(uuid, uuid)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_release(uuid, uuid, text)
  to service_role;
grant execute on function public.klyx_reconcile_platform_held_group_member_release(uuid, text)
  to service_role;
grant execute on function public.klyx_reopen_platform_held_group_member_release_after_no_transfer(uuid)
  to service_role;
grant execute on function public.klyx_fail_platform_held_group_member_release(uuid, uuid, text, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_review(uuid, text, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_member_review(uuid, text, text)
  to service_role;
grant execute on function public.klyx_create_platform_held_group_refund_plan(
  uuid, text, bigint, text, jsonb
) to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_reversal(
  uuid, text, text, bigint
) to service_role;
grant execute on function public.klyx_mark_platform_held_group_refund_allocation_review(uuid, text, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_refund_inflight(uuid)
  to service_role;
grant execute on function public.klyx_fail_platform_held_group_refund(uuid, text, text)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_group_refund(
  uuid, text, bigint, text
) to service_role;

comment on table public.platform_held_group_settlements is
  'TEST-only parent accounting envelope for one KLYX platform charge financing a multi-executor split batch.';

comment on table public.platform_held_group_settlement_members is
  'Immutable per-executor economics and independent release state for TEST-only multi-executor Platform-Held settlement.';

comment on table public.platform_held_group_refund_allocations is
  'Explicit refund allocation ledger. Partial refunds never invent a proportional allocation: gross, KLYX fee and provider portion are supplied and constrained exactly.';

commit;
 then
    raise exception 'KLYX_GROUP_HELD_CHECKOUT_ID_INVALID';
  end if;

  update public.platform_held_group_settlements
     set stripe_checkout_session_id = p_checkout_session_id,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where id = p_group_settlement_id
     and state = 'pending_payment'
     and checkout_claim_token = p_claim_token
     and stripe_checkout_session_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$;

create or replace function public.klyx_release_expired_platform_held_group_checkout(
  p_group_settlement_id uuid,
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
     set stripe_checkout_session_id = null,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where id = p_group_settlement_id
     and state = 'pending_payment'
     and stripe_checkout_session_id = p_checkout_session_id;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$;

create or replace function public.klyx_mark_platform_held_group_paid(
  p_group_settlement_id uuid,
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
  v_parent public.platform_held_group_settlements%rowtype;
begin
  if coalesce(trim(p_checkout_session_id), '') !~ '^cs_[A-Za-z0-9_]+$'
     or coalesce(trim(p_payment_intent_id), '') !~ '^pi_[A-Za-z0-9_]+$'
     or coalesce(trim(p_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_GROUP_HELD_STRIPE_TRUTH_INVALID';
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = p_group_settlement_id
   for update;

  if not found then return false; end if;

  if v_parent.stripe_checkout_session_id is distinct from p_checkout_session_id
     or v_parent.gross_amount_cents <> p_amount_cents
     or v_parent.currency <> upper(p_currency)
     or (v_parent.stripe_payment_intent_id is not null
         and v_parent.stripe_payment_intent_id <> p_payment_intent_id)
     or (v_parent.stripe_charge_id is not null
         and v_parent.stripe_charge_id <> p_charge_id) then
    raise exception 'KLYX_GROUP_HELD_STRIPE_TRUTH_MISMATCH';
  end if;

  update public.platform_held_group_settlements
     set state = case when state = 'pending_payment' then 'held' else state end,
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
         stripe_charge_id = coalesce(stripe_charge_id, p_charge_id),
         paid_at = coalesce(paid_at, now()),
         updated_at = now()
   where id = p_group_settlement_id
     and state in ('pending_payment', 'held');

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
  provider_account_id uuid,
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
  v_member public.platform_held_group_settlement_members%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_total_member_provider bigint;
  v_committed_provider bigint;
  v_incomplete integer;
begin
  select m.*
    into v_member
    from public.platform_held_group_settlement_members m
   where m.id = p_member_id;

  if not found then
    raise exception 'KLYX_GROUP_HELD_MEMBER_NOT_FOUND';
  end if;

  select p.*
    into v_parent
    from public.platform_held_group_settlements p
   where p.id = v_member.group_settlement_id
   for update;

  select m.*
    into v_member
    from public.platform_held_group_settlement_members m
   where m.id = p_member_id
   for update;

  if v_member.state = 'released' and v_member.stripe_transfer_id is not null then
    return query select
      'released'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_parent.state in ('refund_pending', 'refunded', 'review_required')
     or coalesce(trim(v_parent.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$'
     or v_member.state in ('refund_pending', 'partially_reversed', 'reversed', 'review_required') then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_member.state = 'release_claimed' then
    return query select
      'busy'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select count(*)
    into v_incomplete
    from jsonb_array_elements_text(v_member.booking_ids) booking_id
    join public.bookings b on b.id = booking_id::uuid
   where coalesce(b.status, '') <> 'completed';

  if v_incomplete > 0 then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if not exists (
    select 1
      from public.account_stripe_connect_identities i
     where i.account_id = v_member.provider_account_id
       and i.identity_state = 'linked'
       and i.stripe_account_id = v_member.stripe_account_id
  ) then
    return query select
      'review_required'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if not exists (
    select 1
      from public.transaction_risk_decisions d
     where d.account_id = v_member.provider_account_id
       and d.action = 'settlement_release'
       and d.participant = 'settlement_recipient'
       and d.subject_type = 'split_batch'
       and d.subject_id = v_member.batch_id::text
       and d.decision = 'allow'
       and d.risk_assessed_at >= now() - interval '5 minutes'
  ) then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select coalesce(sum(provider_amount_cents), 0)
    into v_total_member_provider
    from public.platform_held_group_settlement_members
   where group_settlement_id = v_parent.id;

  if v_total_member_provider <> v_parent.provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_MEMBER_PROVIDER_TOTAL_MISMATCH';
  end if;

  select coalesce(sum(provider_amount_cents), 0)
    into v_committed_provider
    from public.platform_held_group_settlement_members
   where group_settlement_id = v_parent.id
     and id <> v_member.id
     and (
       stripe_transfer_id is not null
       or state = 'release_claimed'
     );

  if v_committed_provider + v_member.provider_amount_cents
       > v_parent.provider_amount_cents
     or v_committed_provider + v_member.provider_amount_cents
       > v_parent.gross_amount_cents - v_parent.platform_fee_cents then
    raise exception 'KLYX_GROUP_HELD_AGGREGATE_OVERTRANSFER_GUARD';
  end if;

  update public.platform_held_group_settlement_members
     set state = 'release_claimed',
         release_attempt_number = release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = v_member.id
   returning * into v_member;

  return query select
    'create'::text, v_member.release_attempt_number, v_member.batch_id,
    v_member.provider_profile_id, v_member.provider_account_id,
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
  v_member public.platform_held_group_settlement_members%rowtype;
  v_remaining integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_GROUP_HELD_TRANSFER_ID_INVALID';
  end if;

  update public.platform_held_group_settlement_members
     set state = 'released',
         stripe_transfer_id = coalesce(stripe_transfer_id, p_stripe_transfer_id),
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token
     and (stripe_transfer_id is null or stripe_transfer_id = p_stripe_transfer_id)
   returning * into v_member;

  if not found then return false; end if;

  select count(*)
    into v_remaining
    from public.platform_held_group_settlement_members
   where group_settlement_id = v_member.group_settlement_id
     and state not in ('released', 'partially_reversed', 'reversed');

  update public.platform_held_group_settlements
     set state = case when v_remaining = 0 then 'released' else 'release_partial' end,
         updated_at = now()
   where id = v_member.group_settlement_id
     and state in ('held', 'release_partial', 'released');

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
  v_updated integer;
begin
  update public.platform_held_group_settlement_members
     set state = 'release_failed',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_error_code, 'group_member_release_failed'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member release failed.'), 1000),
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_platform_held_group_member_review(
  p_member_id uuid,
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
  update public.platform_held_group_settlement_members
     set state = 'review_required',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_error_code, 'group_member_review_required'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member requires review.'), 1000),
         updated_at = now()
   where id = p_member_id
     and state not in ('reversed');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_create_platform_held_group_refund_plan(
  p_batch_id uuid,
  p_request_key text,
  p_amount_cents bigint,
  p_currency text,
  p_allocations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.platform_held_group_settlements%rowtype;
  v_existing public.platform_held_group_refunds%rowtype;
  v_refund_id uuid;
  v_allocation jsonb;
  v_member public.platform_held_group_settlement_members%rowtype;
  v_amount_sum bigint;
  v_fee_sum bigint;
  v_provider_sum bigint;
  v_prior_gross bigint;
  v_prior_fee bigint;
  v_prior_provider bigint;
  v_prior_total bigint;
  v_requires_reversal boolean := false;
begin
  if coalesce(trim(p_request_key), '') = ''
     or p_amount_cents <= 0
     or char_length(upper(coalesce(p_currency, ''))) <> 3
     or p_allocations is null
     or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'KLYX_GROUP_HELD_REFUND_PLAN_INVALID';
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where batch_id = p_batch_id
   for update;

  if not found
     or v_parent.state in ('pending_payment', 'refunded', 'review_required')
     or v_parent.currency <> upper(p_currency)
     or coalesce(trim(v_parent.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_GROUP_HELD_REFUND_NOT_READY';
  end if;

  if exists (
    select 1
      from public.platform_held_group_settlement_members m
     where m.group_settlement_id = v_parent.id
       and m.state = 'release_claimed'
  ) then
    raise exception 'KLYX_GROUP_HELD_REFUND_RELEASE_CONFLICT';
  end if;

  select *
    into v_existing
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and request_key = p_request_key;

  if found then
    if v_existing.amount_cents = p_amount_cents
       and v_existing.currency = upper(p_currency) then
      return v_existing.id;
    end if;
    raise exception 'KLYX_GROUP_HELD_REFUND_KEY_CONFLICT';
  end if;

  select
    coalesce(sum((a ->> 'gross_refund_cents')::bigint), 0),
    coalesce(sum((a ->> 'platform_fee_refund_cents')::bigint), 0),
    coalesce(sum((a ->> 'provider_refund_cents')::bigint), 0)
    into v_amount_sum, v_fee_sum, v_provider_sum
    from jsonb_array_elements(p_allocations) a;

  if v_amount_sum <> p_amount_cents
     or v_fee_sum + v_provider_sum <> p_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_ALLOCATION_TOTAL_MISMATCH';
  end if;

  select coalesce(sum(amount_cents), 0)
    into v_prior_total
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and state <> 'failed';

  if v_prior_total + p_amount_cents > v_parent.gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_EXCEEDS_GROSS';
  end if;

  insert into public.platform_held_group_refunds (
    group_settlement_id,
    batch_id,
    request_key,
    currency,
    amount_cents,
    state
  ) values (
    v_parent.id,
    p_batch_id,
    p_request_key,
    upper(p_currency),
    p_amount_cents,
    'reversing'
  )
  returning id into v_refund_id;

  for v_allocation in
    select value from jsonb_array_elements(p_allocations)
  loop
    select *
      into v_member
      from public.platform_held_group_settlement_members
     where id = (v_allocation ->> 'member_id')::uuid
       and group_settlement_id = v_parent.id
     for update;

    if not found then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_INVALID';
    end if;

    if (v_allocation ->> 'gross_refund_cents')::bigint <= 0
       or (v_allocation ->> 'platform_fee_refund_cents')::bigint < 0
       or (v_allocation ->> 'provider_refund_cents')::bigint < 0
       or (v_allocation ->> 'platform_fee_refund_cents')::bigint
          + (v_allocation ->> 'provider_refund_cents')::bigint
          <> (v_allocation ->> 'gross_refund_cents')::bigint then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_ECONOMICS_INVALID';
    end if;

    select
      coalesce(sum(a.gross_refund_cents), 0),
      coalesce(sum(a.platform_fee_refund_cents), 0),
      coalesce(sum(a.provider_refund_cents), 0)
      into v_prior_gross, v_prior_fee, v_prior_provider
      from public.platform_held_group_refund_allocations a
      join public.platform_held_group_refunds r on r.id = a.refund_id
     where a.member_id = v_member.id
       and r.state <> 'failed';

    if v_prior_gross + (v_allocation ->> 'gross_refund_cents')::bigint
         > v_member.gross_amount_cents
       or v_prior_fee + (v_allocation ->> 'platform_fee_refund_cents')::bigint
         > v_member.platform_fee_cents
       or v_prior_provider + (v_allocation ->> 'provider_refund_cents')::bigint
         > v_member.provider_amount_cents then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_EXCEEDS_FROZEN_ECONOMICS';
    end if;

    if v_member.stripe_transfer_id is not null
       and (v_allocation ->> 'provider_refund_cents')::bigint > 0 then
      v_requires_reversal := true;
    end if;

    insert into public.platform_held_group_refund_allocations (
      refund_id,
      member_id,
      gross_refund_cents,
      platform_fee_refund_cents,
      provider_refund_cents,
      state
    ) values (
      v_refund_id,
      v_member.id,
      (v_allocation ->> 'gross_refund_cents')::bigint,
      (v_allocation ->> 'platform_fee_refund_cents')::bigint,
      (v_allocation ->> 'provider_refund_cents')::bigint,
      case
        when v_member.stripe_transfer_id is not null
         and (v_allocation ->> 'provider_refund_cents')::bigint > 0
          then 'reversal_required'
        else 'ready'
      end
    );
  end loop;

  update public.platform_held_group_refunds
     set state = case when v_requires_reversal then 'reversing' else 'ready' end,
         updated_at = now()
   where id = v_refund_id;

  update public.platform_held_group_settlements
     set state = 'refund_pending',
         updated_at = now()
   where id = v_parent.id;

  return v_refund_id;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_member_reversal(
  p_allocation_id uuid,
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
  v_allocation public.platform_held_group_refund_allocations%rowtype;
  v_member public.platform_held_group_settlement_members%rowtype;
  v_pending integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$'
     or coalesce(trim(p_stripe_transfer_reversal_id), '') !~ '^trr_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_GROUP_HELD_REVERSAL_TRUTH_INVALID';
  end if;

  select *
    into v_allocation
    from public.platform_held_group_refund_allocations
   where id = p_allocation_id
   for update;

  if not found
     or v_allocation.state not in ('reversal_required', 'reversed')
     or v_allocation.provider_refund_cents <> p_amount_cents then
    return false;
  end if;

  select *
    into v_member
    from public.platform_held_group_settlement_members
   where id = v_allocation.member_id
   for update;

  if not found
     or v_member.stripe_transfer_id is distinct from p_stripe_transfer_id
     or v_member.reversed_amount_cents + p_amount_cents > v_member.provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REVERSAL_MEMBER_MISMATCH';
  end if;

  if exists (
    select 1
      from public.platform_held_group_member_reversals r
     where r.allocation_id = p_allocation_id
  ) then
    return true;
  end if;

  insert into public.platform_held_group_member_reversals (
    allocation_id,
    member_id,
    stripe_transfer_id,
    stripe_transfer_reversal_id,
    amount_cents
  ) values (
    p_allocation_id,
    v_member.id,
    p_stripe_transfer_id,
    p_stripe_transfer_reversal_id,
    p_amount_cents
  );

  update public.platform_held_group_refund_allocations
     set state = 'reversed',
         updated_at = now()
   where id = p_allocation_id;

  update public.platform_held_group_settlement_members
     set reversed_amount_cents = reversed_amount_cents + p_amount_cents,
         state = case
           when reversed_amount_cents + p_amount_cents = provider_amount_cents
             then 'reversed'
           else 'partially_reversed'
         end,
         updated_at = now()
   where id = v_member.id;

  select count(*)
    into v_pending
    from public.platform_held_group_refund_allocations
   where refund_id = v_allocation.refund_id
     and state = 'reversal_required';

  if v_pending = 0 then
    update public.platform_held_group_refunds
       set state = 'ready',
           updated_at = now()
     where id = v_allocation.refund_id
       and state = 'reversing';
  end if;

  return true;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_refund(
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
  v_refund public.platform_held_group_refunds%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_allocation record;
  v_total_refunded bigint;
begin
  if coalesce(trim(p_stripe_refund_id), '') !~ '^re_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_GROUP_HELD_REFUND_TRUTH_INVALID';
  end if;

  select *
    into v_refund
    from public.platform_held_group_refunds
   where id = p_refund_id
   for update;

  if not found then return false; end if;

  if v_refund.state = 'succeeded' then
    return v_refund.stripe_refund_id = p_stripe_refund_id
       and v_refund.amount_cents = p_amount_cents
       and v_refund.currency = upper(p_currency);
  end if;

  if v_refund.state <> 'ready'
     or v_refund.amount_cents <> p_amount_cents
     or v_refund.currency <> upper(p_currency)
     or exists (
       select 1
         from public.platform_held_group_refund_allocations a
        where a.refund_id = v_refund.id
          and a.state not in ('ready', 'reversed')
     ) then
    return false;
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = v_refund.group_settlement_id
   for update;

  for v_allocation in
    select * from public.platform_held_group_refund_allocations
     where refund_id = v_refund.id
     for update
  loop
    update public.platform_held_group_settlement_members
       set refunded_gross_amount_cents =
             refunded_gross_amount_cents + v_allocation.gross_refund_cents,
           refunded_platform_fee_cents =
             refunded_platform_fee_cents + v_allocation.platform_fee_refund_cents,
           refunded_provider_amount_cents =
             refunded_provider_amount_cents + v_allocation.provider_refund_cents,
           updated_at = now()
     where id = v_allocation.member_id;

    update public.platform_held_group_refund_allocations
       set state = 'refunded',
           updated_at = now()
     where id = v_allocation.id;
  end loop;

  update public.platform_held_group_refunds
     set state = 'succeeded',
         stripe_refund_id = p_stripe_refund_id,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = v_refund.id;

  select coalesce(sum(amount_cents), 0)
    into v_total_refunded
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and state = 'succeeded';

  if v_total_refunded > v_parent.gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_TOTAL_EXCEEDS_GROSS';
  end if;

  update public.platform_held_group_settlements
     set refunded_amount_cents = v_total_refunded,
         state = case
           when v_total_refunded = gross_amount_cents then 'refunded'
           when exists (
             select 1 from public.platform_held_group_settlement_members m
              where m.group_settlement_id = id
                and m.stripe_transfer_id is not null
           ) then 'release_partial'
           else 'partially_refunded'
         end,
         refunded_at = case
           when v_total_refunded = gross_amount_cents then coalesce(refunded_at, now())
           else refunded_at
         end,
         updated_at = now()
   where id = v_parent.id;

  return true;
end;
$$;

revoke all on function public.klyx_prepare_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_attach_platform_held_group_checkout(uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_paid(
  uuid, text, text, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.klyx_claim_platform_held_group_member_release(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_release(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_platform_held_group_member_release(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_member_review(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_create_platform_held_group_refund_plan(
  uuid, text, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_reversal(
  uuid, text, text, bigint
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_refund(
  uuid, text, bigint, text
) from public, anon, authenticated;

grant execute on function public.klyx_prepare_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) to service_role;
grant execute on function public.klyx_attach_platform_held_group_checkout(uuid, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_paid(
  uuid, text, text, text, bigint, text
) to service_role;
grant execute on function public.klyx_claim_platform_held_group_member_release(uuid, uuid)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_release(uuid, uuid, text)
  to service_role;
grant execute on function public.klyx_fail_platform_held_group_member_release(uuid, uuid, text, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_member_review(uuid, text, text)
  to service_role;
grant execute on function public.klyx_create_platform_held_group_refund_plan(
  uuid, text, bigint, text, jsonb
) to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_reversal(
  uuid, text, text, bigint
) to service_role;
grant execute on function public.klyx_finalize_platform_held_group_refund(
  uuid, text, bigint, text
) to service_role;

comment on table public.platform_held_group_settlements is
  'TEST-only parent accounting envelope for one KLYX platform charge financing a multi-executor split batch.';

comment on table public.platform_held_group_settlement_members is
  'Immutable per-executor economics and independent release state for TEST-only multi-executor Platform-Held settlement.';

comment on table public.platform_held_group_refund_allocations is
  'Explicit refund allocation ledger. Partial refunds never invent a proportional allocation: gross, KLYX fee and provider portion are supplied and constrained exactly.';

commit;
 then
    raise exception 'KLYX_GROUP_HELD_TRANSFER_ID_INVALID';
  end if;

  select *
    into v_member
    from public.platform_held_group_settlement_members
   where id = p_member_id
   for update;

  if not found then return false; end if;

  if v_member.stripe_transfer_id is not null
     and v_member.stripe_transfer_id <> p_stripe_transfer_id then
    raise exception 'KLYX_GROUP_HELD_TRANSFER_RECONCILIATION_CONFLICT';
  end if;

  if v_member.state in ('refund_pending', 'partially_reversed', 'reversed', 'review_required') then
    return false;
  end if;

  update public.platform_held_group_settlement_members
     set state = 'released',
         stripe_transfer_id = coalesce(stripe_transfer_id, p_stripe_transfer_id),
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_id;

  select count(*)
    into v_remaining
    from public.platform_held_group_settlement_members
   where group_settlement_id = v_member.group_settlement_id
     and state not in ('released', 'partially_reversed', 'reversed');

  update public.platform_held_group_settlements
     set state = case when v_remaining = 0 then 'released' else 'release_partial' end,
         updated_at = now()
   where id = v_member.group_settlement_id
     and state in ('held', 'release_partial', 'released');

  return true;
end;
$;

create or replace function public.klyx_reopen_platform_held_group_member_release_after_no_transfer(
  p_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.platform_held_group_settlement_members
     set state = 'release_failed',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = 'group_member_recovery_no_transfer',
         last_error_message =
           'Expired release claim reopened only after Stripe truth showed no member Transfer.',
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claimed_at is not null
     and release_claimed_at <= now() - interval '10 minutes'
     and stripe_transfer_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$;

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
  v_updated integer;
begin
  update public.platform_held_group_settlement_members
     set state = 'release_failed',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_error_code, 'group_member_release_failed'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member release failed.'), 1000),
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_platform_held_group_member_review(
  p_member_id uuid,
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
  update public.platform_held_group_settlement_members
     set state = 'review_required',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_error_code, 'group_member_review_required'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member requires review.'), 1000),
         updated_at = now()
   where id = p_member_id
     and state not in ('reversed');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_create_platform_held_group_refund_plan(
  p_batch_id uuid,
  p_request_key text,
  p_amount_cents bigint,
  p_currency text,
  p_allocations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.platform_held_group_settlements%rowtype;
  v_existing public.platform_held_group_refunds%rowtype;
  v_refund_id uuid;
  v_allocation jsonb;
  v_member public.platform_held_group_settlement_members%rowtype;
  v_amount_sum bigint;
  v_fee_sum bigint;
  v_provider_sum bigint;
  v_prior_gross bigint;
  v_prior_fee bigint;
  v_prior_provider bigint;
  v_prior_total bigint;
  v_requires_reversal boolean := false;
begin
  if coalesce(trim(p_request_key), '') = ''
     or p_amount_cents <= 0
     or char_length(upper(coalesce(p_currency, ''))) <> 3
     or p_allocations is null
     or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'KLYX_GROUP_HELD_REFUND_PLAN_INVALID';
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where batch_id = p_batch_id
   for update;

  if not found
     or v_parent.state in ('pending_payment', 'refunded', 'review_required')
     or v_parent.currency <> upper(p_currency)
     or coalesce(trim(v_parent.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_GROUP_HELD_REFUND_NOT_READY';
  end if;

  if exists (
    select 1
      from public.platform_held_group_settlement_members m
     where m.group_settlement_id = v_parent.id
       and m.state = 'release_claimed'
  ) then
    raise exception 'KLYX_GROUP_HELD_REFUND_RELEASE_CONFLICT';
  end if;

  select *
    into v_existing
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and request_key = p_request_key;

  if found then
    if v_existing.amount_cents = p_amount_cents
       and v_existing.currency = upper(p_currency) then
      return v_existing.id;
    end if;
    raise exception 'KLYX_GROUP_HELD_REFUND_KEY_CONFLICT';
  end if;

  select
    coalesce(sum((a ->> 'gross_refund_cents')::bigint), 0),
    coalesce(sum((a ->> 'platform_fee_refund_cents')::bigint), 0),
    coalesce(sum((a ->> 'provider_refund_cents')::bigint), 0)
    into v_amount_sum, v_fee_sum, v_provider_sum
    from jsonb_array_elements(p_allocations) a;

  if v_amount_sum <> p_amount_cents
     or v_fee_sum + v_provider_sum <> p_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_ALLOCATION_TOTAL_MISMATCH';
  end if;

  select coalesce(sum(amount_cents), 0)
    into v_prior_total
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and state <> 'failed';

  if v_prior_total + p_amount_cents > v_parent.gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_EXCEEDS_GROSS';
  end if;

  insert into public.platform_held_group_refunds (
    group_settlement_id,
    batch_id,
    request_key,
    currency,
    amount_cents,
    state
  ) values (
    v_parent.id,
    p_batch_id,
    p_request_key,
    upper(p_currency),
    p_amount_cents,
    'reversing'
  )
  returning id into v_refund_id;

  for v_allocation in
    select value from jsonb_array_elements(p_allocations)
  loop
    select *
      into v_member
      from public.platform_held_group_settlement_members
     where id = (v_allocation ->> 'member_id')::uuid
       and group_settlement_id = v_parent.id
     for update;

    if not found then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_INVALID';
    end if;

    if (v_allocation ->> 'gross_refund_cents')::bigint <= 0
       or (v_allocation ->> 'platform_fee_refund_cents')::bigint < 0
       or (v_allocation ->> 'provider_refund_cents')::bigint < 0
       or (v_allocation ->> 'platform_fee_refund_cents')::bigint
          + (v_allocation ->> 'provider_refund_cents')::bigint
          <> (v_allocation ->> 'gross_refund_cents')::bigint then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_ECONOMICS_INVALID';
    end if;

    select
      coalesce(sum(a.gross_refund_cents), 0),
      coalesce(sum(a.platform_fee_refund_cents), 0),
      coalesce(sum(a.provider_refund_cents), 0)
      into v_prior_gross, v_prior_fee, v_prior_provider
      from public.platform_held_group_refund_allocations a
      join public.platform_held_group_refunds r on r.id = a.refund_id
     where a.member_id = v_member.id
       and r.state <> 'failed';

    if v_prior_gross + (v_allocation ->> 'gross_refund_cents')::bigint
         > v_member.gross_amount_cents
       or v_prior_fee + (v_allocation ->> 'platform_fee_refund_cents')::bigint
         > v_member.platform_fee_cents
       or v_prior_provider + (v_allocation ->> 'provider_refund_cents')::bigint
         > v_member.provider_amount_cents then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_EXCEEDS_FROZEN_ECONOMICS';
    end if;

    if v_member.stripe_transfer_id is not null
       and (v_allocation ->> 'provider_refund_cents')::bigint > 0 then
      v_requires_reversal := true;
    end if;

    insert into public.platform_held_group_refund_allocations (
      refund_id,
      member_id,
      gross_refund_cents,
      platform_fee_refund_cents,
      provider_refund_cents,
      state
    ) values (
      v_refund_id,
      v_member.id,
      (v_allocation ->> 'gross_refund_cents')::bigint,
      (v_allocation ->> 'platform_fee_refund_cents')::bigint,
      (v_allocation ->> 'provider_refund_cents')::bigint,
      case
        when v_member.stripe_transfer_id is not null
         and (v_allocation ->> 'provider_refund_cents')::bigint > 0
          then 'reversal_required'
        else 'ready'
      end
    );
  end loop;

  update public.platform_held_group_refunds
     set state = case when v_requires_reversal then 'reversing' else 'ready' end,
         updated_at = now()
   where id = v_refund_id;

  update public.platform_held_group_settlements
     set state = 'refund_pending',
         updated_at = now()
   where id = v_parent.id;

  return v_refund_id;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_member_reversal(
  p_allocation_id uuid,
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
  v_allocation public.platform_held_group_refund_allocations%rowtype;
  v_member public.platform_held_group_settlement_members%rowtype;
  v_pending integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$'
     or coalesce(trim(p_stripe_transfer_reversal_id), '') !~ '^trr_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_GROUP_HELD_REVERSAL_TRUTH_INVALID';
  end if;

  select *
    into v_allocation
    from public.platform_held_group_refund_allocations
   where id = p_allocation_id
   for update;

  if not found
     or v_allocation.state not in ('reversal_required', 'reversed')
     or v_allocation.provider_refund_cents <> p_amount_cents then
    return false;
  end if;

  select *
    into v_member
    from public.platform_held_group_settlement_members
   where id = v_allocation.member_id
   for update;

  if not found
     or v_member.stripe_transfer_id is distinct from p_stripe_transfer_id
     or v_member.reversed_amount_cents + p_amount_cents > v_member.provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REVERSAL_MEMBER_MISMATCH';
  end if;

  if exists (
    select 1
      from public.platform_held_group_member_reversals r
     where r.allocation_id = p_allocation_id
  ) then
    return true;
  end if;

  insert into public.platform_held_group_member_reversals (
    allocation_id,
    member_id,
    stripe_transfer_id,
    stripe_transfer_reversal_id,
    amount_cents
  ) values (
    p_allocation_id,
    v_member.id,
    p_stripe_transfer_id,
    p_stripe_transfer_reversal_id,
    p_amount_cents
  );

  update public.platform_held_group_refund_allocations
     set state = 'reversed',
         updated_at = now()
   where id = p_allocation_id;

  update public.platform_held_group_settlement_members
     set reversed_amount_cents = reversed_amount_cents + p_amount_cents,
         state = case
           when reversed_amount_cents + p_amount_cents = provider_amount_cents
             then 'reversed'
           else 'partially_reversed'
         end,
         updated_at = now()
   where id = v_member.id;

  select count(*)
    into v_pending
    from public.platform_held_group_refund_allocations
   where refund_id = v_allocation.refund_id
     and state = 'reversal_required';

  if v_pending = 0 then
    update public.platform_held_group_refunds
       set state = 'ready',
           updated_at = now()
     where id = v_allocation.refund_id
       and state = 'reversing';
  end if;

  return true;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_refund(
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
  v_refund public.platform_held_group_refunds%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_allocation record;
  v_total_refunded bigint;
begin
  if coalesce(trim(p_stripe_refund_id), '') !~ '^re_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_GROUP_HELD_REFUND_TRUTH_INVALID';
  end if;

  select *
    into v_refund
    from public.platform_held_group_refunds
   where id = p_refund_id
   for update;

  if not found then return false; end if;

  if v_refund.state = 'succeeded' then
    return v_refund.stripe_refund_id = p_stripe_refund_id
       and v_refund.amount_cents = p_amount_cents
       and v_refund.currency = upper(p_currency);
  end if;

  if v_refund.state <> 'ready'
     or v_refund.amount_cents <> p_amount_cents
     or v_refund.currency <> upper(p_currency)
     or exists (
       select 1
         from public.platform_held_group_refund_allocations a
        where a.refund_id = v_refund.id
          and a.state not in ('ready', 'reversed')
     ) then
    return false;
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = v_refund.group_settlement_id
   for update;

  for v_allocation in
    select * from public.platform_held_group_refund_allocations
     where refund_id = v_refund.id
     for update
  loop
    update public.platform_held_group_settlement_members
       set refunded_gross_amount_cents =
             refunded_gross_amount_cents + v_allocation.gross_refund_cents,
           refunded_platform_fee_cents =
             refunded_platform_fee_cents + v_allocation.platform_fee_refund_cents,
           refunded_provider_amount_cents =
             refunded_provider_amount_cents + v_allocation.provider_refund_cents,
           updated_at = now()
     where id = v_allocation.member_id;

    update public.platform_held_group_refund_allocations
       set state = 'refunded',
           updated_at = now()
     where id = v_allocation.id;
  end loop;

  update public.platform_held_group_refunds
     set state = 'succeeded',
         stripe_refund_id = p_stripe_refund_id,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = v_refund.id;

  select coalesce(sum(amount_cents), 0)
    into v_total_refunded
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and state = 'succeeded';

  if v_total_refunded > v_parent.gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_TOTAL_EXCEEDS_GROSS';
  end if;

  update public.platform_held_group_settlements
     set refunded_amount_cents = v_total_refunded,
         state = case
           when v_total_refunded = gross_amount_cents then 'refunded'
           when exists (
             select 1 from public.platform_held_group_settlement_members m
              where m.group_settlement_id = id
                and m.stripe_transfer_id is not null
           ) then 'release_partial'
           else 'partially_refunded'
         end,
         refunded_at = case
           when v_total_refunded = gross_amount_cents then coalesce(refunded_at, now())
           else refunded_at
         end,
         updated_at = now()
   where id = v_parent.id;

  return true;
end;
$$;

revoke all on function public.klyx_prepare_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_attach_platform_held_group_checkout(uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_paid(
  uuid, text, text, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.klyx_claim_platform_held_group_member_release(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_release(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_platform_held_group_member_release(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_member_review(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_create_platform_held_group_refund_plan(
  uuid, text, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_reversal(
  uuid, text, text, bigint
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_refund(
  uuid, text, bigint, text
) from public, anon, authenticated;

grant execute on function public.klyx_prepare_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) to service_role;
grant execute on function public.klyx_attach_platform_held_group_checkout(uuid, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_paid(
  uuid, text, text, text, bigint, text
) to service_role;
grant execute on function public.klyx_claim_platform_held_group_member_release(uuid, uuid)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_release(uuid, uuid, text)
  to service_role;
grant execute on function public.klyx_fail_platform_held_group_member_release(uuid, uuid, text, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_member_review(uuid, text, text)
  to service_role;
grant execute on function public.klyx_create_platform_held_group_refund_plan(
  uuid, text, bigint, text, jsonb
) to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_reversal(
  uuid, text, text, bigint
) to service_role;
grant execute on function public.klyx_finalize_platform_held_group_refund(
  uuid, text, bigint, text
) to service_role;

comment on table public.platform_held_group_settlements is
  'TEST-only parent accounting envelope for one KLYX platform charge financing a multi-executor split batch.';

comment on table public.platform_held_group_settlement_members is
  'Immutable per-executor economics and independent release state for TEST-only multi-executor Platform-Held settlement.';

comment on table public.platform_held_group_refund_allocations is
  'Explicit refund allocation ledger. Partial refunds never invent a proportional allocation: gross, KLYX fee and provider portion are supplied and constrained exactly.';

commit;
 then
    raise exception 'KLYX_GROUP_HELD_CHECKOUT_ID_INVALID';
  end if;

  update public.platform_held_group_settlements
     set stripe_checkout_session_id = p_checkout_session_id,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where id = p_group_settlement_id
     and state = 'pending_payment'
     and checkout_claim_token = p_claim_token
     and stripe_checkout_session_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$;

create or replace function public.klyx_release_expired_platform_held_group_checkout(
  p_group_settlement_id uuid,
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
     set stripe_checkout_session_id = null,
         checkout_claim_token = null,
         checkout_claimed_at = null,
         updated_at = now()
   where id = p_group_settlement_id
     and state = 'pending_payment'
     and stripe_checkout_session_id = p_checkout_session_id;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$;

create or replace function public.klyx_mark_platform_held_group_paid(
  p_group_settlement_id uuid,
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
  v_parent public.platform_held_group_settlements%rowtype;
begin
  if coalesce(trim(p_checkout_session_id), '') !~ '^cs_[A-Za-z0-9_]+$'
     or coalesce(trim(p_payment_intent_id), '') !~ '^pi_[A-Za-z0-9_]+$'
     or coalesce(trim(p_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_GROUP_HELD_STRIPE_TRUTH_INVALID';
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = p_group_settlement_id
   for update;

  if not found then return false; end if;

  if v_parent.stripe_checkout_session_id is distinct from p_checkout_session_id
     or v_parent.gross_amount_cents <> p_amount_cents
     or v_parent.currency <> upper(p_currency)
     or (v_parent.stripe_payment_intent_id is not null
         and v_parent.stripe_payment_intent_id <> p_payment_intent_id)
     or (v_parent.stripe_charge_id is not null
         and v_parent.stripe_charge_id <> p_charge_id) then
    raise exception 'KLYX_GROUP_HELD_STRIPE_TRUTH_MISMATCH';
  end if;

  update public.platform_held_group_settlements
     set state = case when state = 'pending_payment' then 'held' else state end,
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
         stripe_charge_id = coalesce(stripe_charge_id, p_charge_id),
         paid_at = coalesce(paid_at, now()),
         updated_at = now()
   where id = p_group_settlement_id
     and state in ('pending_payment', 'held');

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
  provider_account_id uuid,
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
  v_member public.platform_held_group_settlement_members%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_total_member_provider bigint;
  v_committed_provider bigint;
  v_incomplete integer;
begin
  select m.*
    into v_member
    from public.platform_held_group_settlement_members m
   where m.id = p_member_id;

  if not found then
    raise exception 'KLYX_GROUP_HELD_MEMBER_NOT_FOUND';
  end if;

  select p.*
    into v_parent
    from public.platform_held_group_settlements p
   where p.id = v_member.group_settlement_id
   for update;

  select m.*
    into v_member
    from public.platform_held_group_settlement_members m
   where m.id = p_member_id
   for update;

  if v_member.state = 'released' and v_member.stripe_transfer_id is not null then
    return query select
      'released'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_parent.state in ('refund_pending', 'refunded', 'review_required')
     or coalesce(trim(v_parent.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$'
     or v_member.state in ('refund_pending', 'partially_reversed', 'reversed', 'review_required') then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if v_member.state = 'release_claimed' then
    return query select
      'busy'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select count(*)
    into v_incomplete
    from jsonb_array_elements_text(v_member.booking_ids) booking_id
    join public.bookings b on b.id = booking_id::uuid
   where coalesce(b.status, '') <> 'completed';

  if v_incomplete > 0 then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if not exists (
    select 1
      from public.account_stripe_connect_identities i
     where i.account_id = v_member.provider_account_id
       and i.identity_state = 'linked'
       and i.stripe_account_id = v_member.stripe_account_id
  ) then
    return query select
      'review_required'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  if not exists (
    select 1
      from public.transaction_risk_decisions d
     where d.account_id = v_member.provider_account_id
       and d.action = 'settlement_release'
       and d.participant = 'settlement_recipient'
       and d.subject_type = 'split_batch'
       and d.subject_id = v_member.batch_id::text
       and d.decision = 'allow'
       and d.risk_assessed_at >= now() - interval '5 minutes'
  ) then
    return query select
      'not_ready'::text, v_member.release_attempt_number, v_member.batch_id,
      v_member.provider_profile_id, v_member.provider_account_id,
      v_member.stripe_account_id, v_member.provider_amount_cents,
      v_member.currency, v_parent.stripe_charge_id, v_parent.transfer_group;
    return;
  end if;

  select coalesce(sum(provider_amount_cents), 0)
    into v_total_member_provider
    from public.platform_held_group_settlement_members
   where group_settlement_id = v_parent.id;

  if v_total_member_provider <> v_parent.provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_MEMBER_PROVIDER_TOTAL_MISMATCH';
  end if;

  select coalesce(sum(provider_amount_cents), 0)
    into v_committed_provider
    from public.platform_held_group_settlement_members
   where group_settlement_id = v_parent.id
     and id <> v_member.id
     and (
       stripe_transfer_id is not null
       or state = 'release_claimed'
     );

  if v_committed_provider + v_member.provider_amount_cents
       > v_parent.provider_amount_cents
     or v_committed_provider + v_member.provider_amount_cents
       > v_parent.gross_amount_cents - v_parent.platform_fee_cents then
    raise exception 'KLYX_GROUP_HELD_AGGREGATE_OVERTRANSFER_GUARD';
  end if;

  update public.platform_held_group_settlement_members
     set state = 'release_claimed',
         release_attempt_number = release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = v_member.id
   returning * into v_member;

  return query select
    'create'::text, v_member.release_attempt_number, v_member.batch_id,
    v_member.provider_profile_id, v_member.provider_account_id,
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
  v_member public.platform_held_group_settlement_members%rowtype;
  v_remaining integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_GROUP_HELD_TRANSFER_ID_INVALID';
  end if;

  update public.platform_held_group_settlement_members
     set state = 'released',
         stripe_transfer_id = coalesce(stripe_transfer_id, p_stripe_transfer_id),
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token
     and (stripe_transfer_id is null or stripe_transfer_id = p_stripe_transfer_id)
   returning * into v_member;

  if not found then return false; end if;

  select count(*)
    into v_remaining
    from public.platform_held_group_settlement_members
   where group_settlement_id = v_member.group_settlement_id
     and state not in ('released', 'partially_reversed', 'reversed');

  update public.platform_held_group_settlements
     set state = case when v_remaining = 0 then 'released' else 'release_partial' end,
         updated_at = now()
   where id = v_member.group_settlement_id
     and state in ('held', 'release_partial', 'released');

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
  v_updated integer;
begin
  update public.platform_held_group_settlement_members
     set state = 'release_failed',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_error_code, 'group_member_release_failed'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member release failed.'), 1000),
         updated_at = now()
   where id = p_member_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_mark_platform_held_group_member_review(
  p_member_id uuid,
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
  update public.platform_held_group_settlement_members
     set state = 'review_required',
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = left(coalesce(p_error_code, 'group_member_review_required'), 120),
         last_error_message = left(coalesce(p_error_message, 'Group member requires review.'), 1000),
         updated_at = now()
   where id = p_member_id
     and state not in ('reversed');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_create_platform_held_group_refund_plan(
  p_batch_id uuid,
  p_request_key text,
  p_amount_cents bigint,
  p_currency text,
  p_allocations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.platform_held_group_settlements%rowtype;
  v_existing public.platform_held_group_refunds%rowtype;
  v_refund_id uuid;
  v_allocation jsonb;
  v_member public.platform_held_group_settlement_members%rowtype;
  v_amount_sum bigint;
  v_fee_sum bigint;
  v_provider_sum bigint;
  v_prior_gross bigint;
  v_prior_fee bigint;
  v_prior_provider bigint;
  v_prior_total bigint;
  v_requires_reversal boolean := false;
begin
  if coalesce(trim(p_request_key), '') = ''
     or p_amount_cents <= 0
     or char_length(upper(coalesce(p_currency, ''))) <> 3
     or p_allocations is null
     or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'KLYX_GROUP_HELD_REFUND_PLAN_INVALID';
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where batch_id = p_batch_id
   for update;

  if not found
     or v_parent.state in ('pending_payment', 'refunded', 'review_required')
     or v_parent.currency <> upper(p_currency)
     or coalesce(trim(v_parent.stripe_charge_id), '') !~ '^ch_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_GROUP_HELD_REFUND_NOT_READY';
  end if;

  if exists (
    select 1
      from public.platform_held_group_settlement_members m
     where m.group_settlement_id = v_parent.id
       and m.state = 'release_claimed'
  ) then
    raise exception 'KLYX_GROUP_HELD_REFUND_RELEASE_CONFLICT';
  end if;

  select *
    into v_existing
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and request_key = p_request_key;

  if found then
    if v_existing.amount_cents = p_amount_cents
       and v_existing.currency = upper(p_currency) then
      return v_existing.id;
    end if;
    raise exception 'KLYX_GROUP_HELD_REFUND_KEY_CONFLICT';
  end if;

  select
    coalesce(sum((a ->> 'gross_refund_cents')::bigint), 0),
    coalesce(sum((a ->> 'platform_fee_refund_cents')::bigint), 0),
    coalesce(sum((a ->> 'provider_refund_cents')::bigint), 0)
    into v_amount_sum, v_fee_sum, v_provider_sum
    from jsonb_array_elements(p_allocations) a;

  if v_amount_sum <> p_amount_cents
     or v_fee_sum + v_provider_sum <> p_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_ALLOCATION_TOTAL_MISMATCH';
  end if;

  select coalesce(sum(amount_cents), 0)
    into v_prior_total
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and state <> 'failed';

  if v_prior_total + p_amount_cents > v_parent.gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_EXCEEDS_GROSS';
  end if;

  insert into public.platform_held_group_refunds (
    group_settlement_id,
    batch_id,
    request_key,
    currency,
    amount_cents,
    state
  ) values (
    v_parent.id,
    p_batch_id,
    p_request_key,
    upper(p_currency),
    p_amount_cents,
    'reversing'
  )
  returning id into v_refund_id;

  for v_allocation in
    select value from jsonb_array_elements(p_allocations)
  loop
    select *
      into v_member
      from public.platform_held_group_settlement_members
     where id = (v_allocation ->> 'member_id')::uuid
       and group_settlement_id = v_parent.id
     for update;

    if not found then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_INVALID';
    end if;

    if (v_allocation ->> 'gross_refund_cents')::bigint <= 0
       or (v_allocation ->> 'platform_fee_refund_cents')::bigint < 0
       or (v_allocation ->> 'provider_refund_cents')::bigint < 0
       or (v_allocation ->> 'platform_fee_refund_cents')::bigint
          + (v_allocation ->> 'provider_refund_cents')::bigint
          <> (v_allocation ->> 'gross_refund_cents')::bigint then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_ECONOMICS_INVALID';
    end if;

    select
      coalesce(sum(a.gross_refund_cents), 0),
      coalesce(sum(a.platform_fee_refund_cents), 0),
      coalesce(sum(a.provider_refund_cents), 0)
      into v_prior_gross, v_prior_fee, v_prior_provider
      from public.platform_held_group_refund_allocations a
      join public.platform_held_group_refunds r on r.id = a.refund_id
     where a.member_id = v_member.id
       and r.state <> 'failed';

    if v_prior_gross + (v_allocation ->> 'gross_refund_cents')::bigint
         > v_member.gross_amount_cents
       or v_prior_fee + (v_allocation ->> 'platform_fee_refund_cents')::bigint
         > v_member.platform_fee_cents
       or v_prior_provider + (v_allocation ->> 'provider_refund_cents')::bigint
         > v_member.provider_amount_cents then
      raise exception 'KLYX_GROUP_HELD_REFUND_MEMBER_EXCEEDS_FROZEN_ECONOMICS';
    end if;

    if v_member.stripe_transfer_id is not null
       and (v_allocation ->> 'provider_refund_cents')::bigint > 0 then
      v_requires_reversal := true;
    end if;

    insert into public.platform_held_group_refund_allocations (
      refund_id,
      member_id,
      gross_refund_cents,
      platform_fee_refund_cents,
      provider_refund_cents,
      state
    ) values (
      v_refund_id,
      v_member.id,
      (v_allocation ->> 'gross_refund_cents')::bigint,
      (v_allocation ->> 'platform_fee_refund_cents')::bigint,
      (v_allocation ->> 'provider_refund_cents')::bigint,
      case
        when v_member.stripe_transfer_id is not null
         and (v_allocation ->> 'provider_refund_cents')::bigint > 0
          then 'reversal_required'
        else 'ready'
      end
    );
  end loop;

  update public.platform_held_group_refunds
     set state = case when v_requires_reversal then 'reversing' else 'ready' end,
         updated_at = now()
   where id = v_refund_id;

  update public.platform_held_group_settlements
     set state = 'refund_pending',
         updated_at = now()
   where id = v_parent.id;

  return v_refund_id;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_member_reversal(
  p_allocation_id uuid,
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
  v_allocation public.platform_held_group_refund_allocations%rowtype;
  v_member public.platform_held_group_settlement_members%rowtype;
  v_pending integer;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$'
     or coalesce(trim(p_stripe_transfer_reversal_id), '') !~ '^trr_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_GROUP_HELD_REVERSAL_TRUTH_INVALID';
  end if;

  select *
    into v_allocation
    from public.platform_held_group_refund_allocations
   where id = p_allocation_id
   for update;

  if not found
     or v_allocation.state not in ('reversal_required', 'reversed')
     or v_allocation.provider_refund_cents <> p_amount_cents then
    return false;
  end if;

  select *
    into v_member
    from public.platform_held_group_settlement_members
   where id = v_allocation.member_id
   for update;

  if not found
     or v_member.stripe_transfer_id is distinct from p_stripe_transfer_id
     or v_member.reversed_amount_cents + p_amount_cents > v_member.provider_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REVERSAL_MEMBER_MISMATCH';
  end if;

  if exists (
    select 1
      from public.platform_held_group_member_reversals r
     where r.allocation_id = p_allocation_id
  ) then
    return true;
  end if;

  insert into public.platform_held_group_member_reversals (
    allocation_id,
    member_id,
    stripe_transfer_id,
    stripe_transfer_reversal_id,
    amount_cents
  ) values (
    p_allocation_id,
    v_member.id,
    p_stripe_transfer_id,
    p_stripe_transfer_reversal_id,
    p_amount_cents
  );

  update public.platform_held_group_refund_allocations
     set state = 'reversed',
         updated_at = now()
   where id = p_allocation_id;

  update public.platform_held_group_settlement_members
     set reversed_amount_cents = reversed_amount_cents + p_amount_cents,
         state = case
           when reversed_amount_cents + p_amount_cents = provider_amount_cents
             then 'reversed'
           else 'partially_reversed'
         end,
         updated_at = now()
   where id = v_member.id;

  select count(*)
    into v_pending
    from public.platform_held_group_refund_allocations
   where refund_id = v_allocation.refund_id
     and state = 'reversal_required';

  if v_pending = 0 then
    update public.platform_held_group_refunds
       set state = 'ready',
           updated_at = now()
     where id = v_allocation.refund_id
       and state = 'reversing';
  end if;

  return true;
end;
$$;

create or replace function public.klyx_finalize_platform_held_group_refund(
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
  v_refund public.platform_held_group_refunds%rowtype;
  v_parent public.platform_held_group_settlements%rowtype;
  v_allocation record;
  v_total_refunded bigint;
begin
  if coalesce(trim(p_stripe_refund_id), '') !~ '^re_[A-Za-z0-9]+$'
     or p_amount_cents <= 0 then
    raise exception 'KLYX_GROUP_HELD_REFUND_TRUTH_INVALID';
  end if;

  select *
    into v_refund
    from public.platform_held_group_refunds
   where id = p_refund_id
   for update;

  if not found then return false; end if;

  if v_refund.state = 'succeeded' then
    return v_refund.stripe_refund_id = p_stripe_refund_id
       and v_refund.amount_cents = p_amount_cents
       and v_refund.currency = upper(p_currency);
  end if;

  if v_refund.state <> 'ready'
     or v_refund.amount_cents <> p_amount_cents
     or v_refund.currency <> upper(p_currency)
     or exists (
       select 1
         from public.platform_held_group_refund_allocations a
        where a.refund_id = v_refund.id
          and a.state not in ('ready', 'reversed')
     ) then
    return false;
  end if;

  select *
    into v_parent
    from public.platform_held_group_settlements
   where id = v_refund.group_settlement_id
   for update;

  for v_allocation in
    select * from public.platform_held_group_refund_allocations
     where refund_id = v_refund.id
     for update
  loop
    update public.platform_held_group_settlement_members
       set refunded_gross_amount_cents =
             refunded_gross_amount_cents + v_allocation.gross_refund_cents,
           refunded_platform_fee_cents =
             refunded_platform_fee_cents + v_allocation.platform_fee_refund_cents,
           refunded_provider_amount_cents =
             refunded_provider_amount_cents + v_allocation.provider_refund_cents,
           updated_at = now()
     where id = v_allocation.member_id;

    update public.platform_held_group_refund_allocations
       set state = 'refunded',
           updated_at = now()
     where id = v_allocation.id;
  end loop;

  update public.platform_held_group_refunds
     set state = 'succeeded',
         stripe_refund_id = p_stripe_refund_id,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = v_refund.id;

  select coalesce(sum(amount_cents), 0)
    into v_total_refunded
    from public.platform_held_group_refunds
   where group_settlement_id = v_parent.id
     and state = 'succeeded';

  if v_total_refunded > v_parent.gross_amount_cents then
    raise exception 'KLYX_GROUP_HELD_REFUND_TOTAL_EXCEEDS_GROSS';
  end if;

  update public.platform_held_group_settlements
     set refunded_amount_cents = v_total_refunded,
         state = case
           when v_total_refunded = gross_amount_cents then 'refunded'
           when exists (
             select 1 from public.platform_held_group_settlement_members m
              where m.group_settlement_id = id
                and m.stripe_transfer_id is not null
           ) then 'release_partial'
           else 'partially_refunded'
         end,
         refunded_at = case
           when v_total_refunded = gross_amount_cents then coalesce(refunded_at, now())
           else refunded_at
         end,
         updated_at = now()
   where id = v_parent.id;

  return true;
end;
$$;

revoke all on function public.klyx_prepare_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_attach_platform_held_group_checkout(uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_paid(
  uuid, text, text, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.klyx_claim_platform_held_group_member_release(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_release(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_platform_held_group_member_release(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_mark_platform_held_group_member_review(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_create_platform_held_group_refund_plan(
  uuid, text, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_reversal(
  uuid, text, text, bigint
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_refund(
  uuid, text, bigint, text
) from public, anon, authenticated;

grant execute on function public.klyx_prepare_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) to service_role;
grant execute on function public.klyx_attach_platform_held_group_checkout(uuid, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_paid(
  uuid, text, text, text, bigint, text
) to service_role;
grant execute on function public.klyx_claim_platform_held_group_member_release(uuid, uuid)
  to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_release(uuid, uuid, text)
  to service_role;
grant execute on function public.klyx_fail_platform_held_group_member_release(uuid, uuid, text, text)
  to service_role;
grant execute on function public.klyx_mark_platform_held_group_member_review(uuid, text, text)
  to service_role;
grant execute on function public.klyx_create_platform_held_group_refund_plan(
  uuid, text, bigint, text, jsonb
) to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_reversal(
  uuid, text, text, bigint
) to service_role;
grant execute on function public.klyx_finalize_platform_held_group_refund(
  uuid, text, bigint, text
) to service_role;

comment on table public.platform_held_group_settlements is
  'TEST-only parent accounting envelope for one KLYX platform charge financing a multi-executor split batch.';

comment on table public.platform_held_group_settlement_members is
  'Immutable per-executor economics and independent release state for TEST-only multi-executor Platform-Held settlement.';

comment on table public.platform_held_group_refund_allocations is
  'Explicit refund allocation ledger. Partial refunds never invent a proportional allocation: gross, KLYX fee and provider portion are supplied and constrained exactly.';

commit;

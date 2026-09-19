-- KLYX Platform-Held multi-executor group settlement — Stripe TEST only
--
-- Financial model:
--   one split_booking_batch -> one platform charge -> N executor settlements.
--   The existing legacy split destination-charge flow is not modified here.
--   The certified single-booking booking_settlements table is not modified.
--
-- Accounting invariants:
--   parent gross = parent KLYX fee + parent provider funds
--   sum(member gross) = parent gross
--   sum(member KLYX fee) = parent KLYX fee
--   sum(member provider amount) = parent provider funds
--   member gross = member KLYX fee + member provider amount
--   aggregate net released/claimed provider funds may never exceed provider
--   funds remaining after reserved/succeeded refunds.
--
-- All tables/functions are service_role only.

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
    check (char_length(currency) = 3 and currency = upper(currency)),

  gross_amount_cents bigint not null
    check (gross_amount_cents > 0),

  platform_fee_cents bigint not null
    check (platform_fee_cents >= 0),

  provider_amount_cents bigint not null
    check (provider_amount_cents >= 0),

  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,

  transfer_group text not null unique,

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

  refunded_gross_cents bigint not null default 0
    check (refunded_gross_cents >= 0),

  refunded_platform_fee_cents bigint not null default 0
    check (refunded_platform_fee_cents >= 0),

  refunded_provider_cents bigint not null default 0
    check (refunded_provider_cents >= 0),

  held_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint platform_held_group_parent_economics_check
    check (
      platform_fee_cents + provider_amount_cents = gross_amount_cents
    ),

  constraint platform_held_group_parent_refund_check
    check (
      refunded_gross_cents <= gross_amount_cents
      and refunded_platform_fee_cents <= platform_fee_cents
      and refunded_provider_cents <= provider_amount_cents
      and refunded_platform_fee_cents + refunded_provider_cents =
        refunded_gross_cents
    )
);

create table if not exists public.platform_held_group_settlement_members (
  id uuid primary key default gen_random_uuid(),

  batch_id uuid not null
    references public.platform_held_group_settlements(batch_id)
    on delete restrict,

  provider_profile_id uuid not null
    references public.profiles(id) on delete restrict,

  provider_account_id uuid not null
    references public.accounts(id) on delete restrict,

  stripe_account_id text not null
    check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),

  currency text not null
    check (char_length(currency) = 3 and currency = upper(currency)),

  gross_amount_cents bigint not null
    check (gross_amount_cents > 0),

  platform_fee_cents bigint not null
    check (platform_fee_cents >= 0),

  provider_amount_cents bigint not null
    check (provider_amount_cents >= 0),

  booking_ids jsonb not null
    check (jsonb_typeof(booking_ids) = 'array'),

  state text not null default 'held'
    check (state in (
      'held',
      'release_claimed',
      'released',
      'release_failed',
      'refund_pending',
      'partially_refunded',
      'reversed',
      'refunded',
      'review_required'
    )),

  release_attempt_number integer not null default 0
    check (release_attempt_number >= 0),

  release_claim_token uuid,
  release_claimed_at timestamptz,
  release_claim_amount_cents bigint
    check (
      release_claim_amount_cents is null
      or release_claim_amount_cents >= 0
    ),

  stripe_transfer_id text,
  stripe_transfer_amount_cents bigint
    check (
      stripe_transfer_amount_cents is null
      or stripe_transfer_amount_cents >= 0
    ),

  refunded_gross_cents bigint not null default 0
    check (refunded_gross_cents >= 0),

  refunded_platform_fee_cents bigint not null default 0
    check (refunded_platform_fee_cents >= 0),

  refunded_provider_cents bigint not null default 0
    check (refunded_provider_cents >= 0),

  reversed_provider_cents bigint not null default 0
    check (reversed_provider_cents >= 0),

  released_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint platform_held_group_member_unique_provider
    unique (batch_id, provider_profile_id),

  constraint platform_held_group_member_economics_check
    check (
      platform_fee_cents + provider_amount_cents = gross_amount_cents
    ),

  constraint platform_held_group_member_refund_check
    check (
      refunded_gross_cents <= gross_amount_cents
      and refunded_platform_fee_cents <= platform_fee_cents
      and refunded_provider_cents <= provider_amount_cents
      and refunded_platform_fee_cents + refunded_provider_cents =
        refunded_gross_cents
    ),

  constraint platform_held_group_member_reversal_check
    check (
      reversed_provider_cents <= refunded_provider_cents
      and (
        stripe_transfer_amount_cents is null
        or reversed_provider_cents <= stripe_transfer_amount_cents
      )
    )
);

create unique index if not exists
  platform_held_group_member_transfer_uidx
on public.platform_held_group_settlement_members(stripe_transfer_id)
where stripe_transfer_id is not null;

create index if not exists
  platform_held_group_members_batch_state_idx
on public.platform_held_group_settlement_members(batch_id, state);

create table if not exists public.platform_held_group_refunds (
  id uuid primary key default gen_random_uuid(),

  batch_id uuid not null
    references public.platform_held_group_settlements(batch_id)
    on delete restrict,

  kind text not null
    check (kind in ('partial', 'total')),

  currency text not null
    check (char_length(currency) = 3 and currency = upper(currency)),

  amount_cents bigint not null
    check (amount_cents > 0),

  platform_fee_refund_cents bigint not null
    check (platform_fee_refund_cents >= 0),

  provider_refund_cents bigint not null
    check (provider_refund_cents >= 0),

  state text not null default 'preparing'
    check (state in (
      'preparing',
      'reversing',
      'refund_ready',
      'refund_created',
      'succeeded',
      'failed',
      'review_required'
    )),

  stripe_refund_id text,
  idempotency_key text not null unique,

  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz,

  constraint platform_held_group_refund_economics_check
    check (
      platform_fee_refund_cents + provider_refund_cents = amount_cents
    )
);

create unique index if not exists
  platform_held_group_refund_stripe_uidx
on public.platform_held_group_refunds(stripe_refund_id)
where stripe_refund_id is not null;

create table if not exists public.platform_held_group_refund_allocations (
  refund_id uuid not null
    references public.platform_held_group_refunds(id) on delete restrict,

  member_id uuid not null
    references public.platform_held_group_settlement_members(id)
    on delete restrict,

  gross_refund_cents bigint not null
    check (gross_refund_cents > 0),

  platform_fee_refund_cents bigint not null
    check (platform_fee_refund_cents >= 0),

  provider_refund_cents bigint not null
    check (provider_refund_cents >= 0),

  stripe_transfer_reversal_id text,
  reversed_provider_cents bigint not null default 0
    check (reversed_provider_cents >= 0),

  state text not null default 'pending'
    check (state in (
      'pending',
      'reversal_claimed',
      'reversed',
      'refund_ready',
      'succeeded',
      'failed',
      'review_required'
    )),

  reversal_claim_token uuid,
  reversal_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (refund_id, member_id),

  constraint platform_held_group_refund_allocation_economics_check
    check (
      platform_fee_refund_cents + provider_refund_cents =
        gross_refund_cents
      and reversed_provider_cents <= provider_refund_cents
    )
);

create unique index if not exists
  platform_held_group_allocation_reversal_uidx
on public.platform_held_group_refund_allocations(stripe_transfer_reversal_id)
where stripe_transfer_reversal_id is not null;

alter table public.platform_held_group_settlements enable row level security;
alter table public.platform_held_group_settlement_members enable row level security;
alter table public.platform_held_group_refunds enable row level security;
alter table public.platform_held_group_refund_allocations enable row level security;

revoke all privileges on table
  public.platform_held_group_settlements,
  public.platform_held_group_settlement_members,
  public.platform_held_group_refunds,
  public.platform_held_group_refund_allocations
from public, anon, authenticated;

grant select, insert, update on table
  public.platform_held_group_settlements,
  public.platform_held_group_settlement_members,
  public.platform_held_group_refunds,
  public.platform_held_group_refund_allocations
to service_role;

create or replace function
public.klyx_persist_platform_held_group_settlement(
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
  v_confirmation record;
  v_batch record;
  v_member jsonb;
  v_provider_profile_id uuid;
  v_provider_account_id uuid;
  v_stripe_account_id text;
  v_member_currency text;
  v_member_gross bigint;
  v_member_fee bigint;
  v_member_provider bigint;
  v_booking_ids jsonb;
  v_member_count integer := 0;
  v_gross_total bigint := 0;
  v_fee_total bigint := 0;
  v_provider_total bigint := 0;
  v_distinct_provider_count integer := 0;
begin
  if p_currency <> upper(p_currency)
     or char_length(p_currency) <> 3
     or p_gross_amount_cents <= 0
     or p_platform_fee_cents < 0
     or p_provider_amount_cents < 0
     or p_platform_fee_cents + p_provider_amount_cents <>
        p_gross_amount_cents
     or coalesce(trim(p_transfer_group), '') = ''
     or p_members is null
     or jsonb_typeof(p_members) <> 'array'
     or jsonb_array_length(p_members) < 2 then
    raise exception 'KLYX_GROUP_SETTLEMENT_PLAN_INVALID';
  end if;

  select b.id, b.client_profile_id, b.provider_count, b.status
    into v_batch
    from public.split_booking_batches b
   where b.id = p_batch_id
   for update;

  if not found
     or v_batch.client_profile_id <> p_client_profile_id
     or v_batch.provider_count < 2
     or v_batch.status <> 'created' then
    raise exception 'KLYX_GROUP_SETTLEMENT_BATCH_INVALID';
  end if;

  select c.id, c.client_profile_id, c.payment_plan_hash,
         c.total_amount_cents, c.currency, c.provider_count,
         c.payment_unit_count, c.invalidated_at
    into v_confirmation
    from public.split_booking_payment_confirmations c
   where c.id = p_payment_confirmation_id
     and c.batch_id = p_batch_id
   for update;

  if not found
     or v_confirmation.client_profile_id <> p_client_profile_id
     or v_confirmation.invalidated_at is not null
     or v_confirmation.payment_plan_hash <> p_payment_plan_hash
     or v_confirmation.total_amount_cents <> p_gross_amount_cents
     or upper(v_confirmation.currency) <> p_currency
     or v_confirmation.provider_count <> jsonb_array_length(p_members)
     or v_confirmation.payment_unit_count <> jsonb_array_length(p_members) then
    raise exception 'KLYX_GROUP_SETTLEMENT_CONFIRMATION_MISMATCH';
  end if;

  if exists (
    select 1
      from public.platform_held_group_settlements s
     where s.batch_id = p_batch_id
       and (
         s.client_profile_id <> p_client_profile_id
         or s.payment_confirmation_id <> p_payment_confirmation_id
         or s.payment_plan_hash <> p_payment_plan_hash
         or s.currency <> p_currency
         or s.gross_amount_cents <> p_gross_amount_cents
         or s.platform_fee_cents <> p_platform_fee_cents
         or s.provider_amount_cents <> p_provider_amount_cents
         or s.transfer_group <> p_transfer_group
       )
  ) then
    raise exception 'KLYX_GROUP_SETTLEMENT_IMMUTABLE_CONFLICT';
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
    p_currency,
    p_gross_amount_cents,
    p_platform_fee_cents,
    p_provider_amount_cents,
    p_transfer_group
  )
  on conflict (batch_id) do nothing;

  for v_member in
    select value from jsonb_array_elements(p_members)
  loop
    begin
      v_provider_profile_id :=
        (v_member ->> 'provider_profile_id')::uuid;
      v_provider_account_id :=
        (v_member ->> 'provider_account_id')::uuid;
      v_stripe_account_id :=
        trim(v_member ->> 'stripe_account_id');
      v_member_currency :=
        upper(trim(v_member ->> 'currency'));
      v_member_gross :=
        (v_member ->> 'gross_amount_cents')::bigint;
      v_member_fee :=
        (v_member ->> 'platform_fee_cents')::bigint;
      v_member_provider :=
        (v_member ->> 'provider_amount_cents')::bigint;
      v_booking_ids := v_member -> 'booking_ids';
    exception when others then
      raise exception 'KLYX_GROUP_SETTLEMENT_MEMBER_INVALID';
    end;

    if v_provider_profile_id is null
       or v_provider_account_id is null
       or v_stripe_account_id !~ '^acct_[A-Za-z0-9]+$'
       or v_member_currency <> p_currency
       or v_member_gross <= 0
       or v_member_fee < 0
       or v_member_provider < 0
       or v_member_fee + v_member_provider <> v_member_gross
       or v_booking_ids is null
       or jsonb_typeof(v_booking_ids) <> 'array'
       or jsonb_array_length(v_booking_ids) = 0 then
      raise exception 'KLYX_GROUP_SETTLEMENT_MEMBER_INVALID';
    end if;

    if not exists (
      select 1
        from public.profiles p
       where p.id = v_provider_profile_id
         and p.account_id = v_provider_account_id
    ) then
      raise exception 'KLYX_GROUP_SETTLEMENT_ACCOUNT_AUTHORITY_MISMATCH';
    end if;

    if not exists (
      select 1
        from public.account_stripe_connect_identities i
       where i.account_id = v_provider_account_id
         and i.identity_state = 'linked'
         and i.stripe_account_id = v_stripe_account_id
    ) then
      raise exception 'KLYX_GROUP_SETTLEMENT_STRIPE_AUTHORITY_MISMATCH';
    end if;

    if exists (
      select 1
        from jsonb_array_elements_text(v_booking_ids) x(booking_id)
       where not exists (
         select 1
           from public.split_booking_batch_items bi
          where bi.batch_id = p_batch_id
            and bi.provider_profile_id = v_provider_profile_id
            and bi.booking_id = x.booking_id::uuid
       )
    ) then
      raise exception 'KLYX_GROUP_SETTLEMENT_BOOKING_MEMBERSHIP_MISMATCH';
    end if;

    insert into public.platform_held_group_settlement_members (
      batch_id,
      provider_profile_id,
      provider_account_id,
      stripe_account_id,
      currency,
      gross_amount_cents,
      platform_fee_cents,
      provider_amount_cents,
      booking_ids
    ) values (
      p_batch_id,
      v_provider_profile_id,
      v_provider_account_id,
      v_stripe_account_id,
      v_member_currency,
      v_member_gross,
      v_member_fee,
      v_member_provider,
      v_booking_ids
    )
    on conflict (batch_id, provider_profile_id) do nothing;

    if exists (
      select 1
        from public.platform_held_group_settlement_members m
       where m.batch_id = p_batch_id
         and m.provider_profile_id = v_provider_profile_id
         and (
           m.provider_account_id <> v_provider_account_id
           or m.stripe_account_id <> v_stripe_account_id
           or m.currency <> v_member_currency
           or m.gross_amount_cents <> v_member_gross
           or m.platform_fee_cents <> v_member_fee
           or m.provider_amount_cents <> v_member_provider
           or m.booking_ids <> v_booking_ids
         )
    ) then
      raise exception 'KLYX_GROUP_SETTLEMENT_MEMBER_IMMUTABLE_CONFLICT';
    end if;

    v_member_count := v_member_count + 1;
    v_gross_total := v_gross_total + v_member_gross;
    v_fee_total := v_fee_total + v_member_fee;
    v_provider_total := v_provider_total + v_member_provider;
  end loop;

  select count(distinct m.provider_profile_id)
    into v_distinct_provider_count
    from public.platform_held_group_settlement_members m
   where m.batch_id = p_batch_id;

  if v_member_count <> jsonb_array_length(p_members)
     or v_distinct_provider_count <> v_member_count
     or v_gross_total <> p_gross_amount_cents
     or v_fee_total <> p_platform_fee_cents
     or v_provider_total <> p_provider_amount_cents then
    raise exception 'KLYX_GROUP_SETTLEMENT_ACCOUNTING_INVARIANT_FAILED';
  end if;

  return true;
end;
$$;

create or replace function
public.klyx_attach_platform_held_group_stripe_truth(
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
  v_updated integer;
begin
  if coalesce(trim(p_checkout_session_id), '') !~ '^cs_'
     or coalesce(trim(p_payment_intent_id), '') !~ '^pi_'
     or coalesce(trim(p_charge_id), '') !~ '^ch_' then
    raise exception 'KLYX_GROUP_SETTLEMENT_STRIPE_TRUTH_INVALID';
  end if;

  update public.platform_held_group_settlements
     set stripe_checkout_session_id =
           coalesce(stripe_checkout_session_id, p_checkout_session_id),
         stripe_payment_intent_id =
           coalesce(stripe_payment_intent_id, p_payment_intent_id),
         stripe_charge_id =
           coalesce(stripe_charge_id, p_charge_id),
         state = case
           when state = 'pending_payment' then 'held'
           else state
         end,
         held_at = coalesce(held_at, now()),
         updated_at = now()
   where batch_id = p_batch_id
     and (stripe_checkout_session_id is null
          or stripe_checkout_session_id = p_checkout_session_id)
     and (stripe_payment_intent_id is null
          or stripe_payment_intent_id = p_payment_intent_id)
     and (stripe_charge_id is null
          or stripe_charge_id = p_charge_id);

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function
public.klyx_claim_platform_held_group_member_release(
  p_batch_id uuid,
  p_member_id uuid,
  p_claim_token uuid
)
returns table (
  action text,
  attempt_number integer,
  stripe_account_id text,
  amount_cents bigint,
  currency text,
  stripe_charge_id text,
  transfer_group text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.platform_held_group_settlements%rowtype;
  v_member public.platform_held_group_settlement_members%rowtype;
  v_reserved_provider bigint;
  v_available_provider bigint;
  v_release_amount bigint;
begin
  -- Parent lock serializes all member release/refund reservations for this
  -- captured charge. This is the aggregate over-transfer guard.
  select *
    into v_parent
    from public.platform_held_group_settlements
   where batch_id = p_batch_id
   for update;

  if not found then
    return query
      select 'not_applicable'::text, 0, null::text, 0::bigint,
             null::text, null::text, null::text;
    return;
  end if;

  select *
    into v_member
    from public.platform_held_group_settlement_members
   where id = p_member_id
     and batch_id = p_batch_id
   for update;

  if not found then
    raise exception 'KLYX_GROUP_SETTLEMENT_MEMBER_NOT_FOUND';
  end if;

  if v_member.state = 'released' and v_member.stripe_transfer_id is not null then
    return query
      select 'released'::text, v_member.release_attempt_number,
             v_member.stripe_account_id,
             coalesce(v_member.stripe_transfer_amount_cents, 0),
             v_member.currency, v_parent.stripe_charge_id,
             v_parent.transfer_group;
    return;
  end if;

  if v_member.state in (
    'refund_pending', 'partially_refunded', 'reversed',
    'refunded', 'review_required'
  ) then
    return query
      select 'not_ready'::text, v_member.release_attempt_number,
             v_member.stripe_account_id, 0::bigint,
             v_member.currency, v_parent.stripe_charge_id,
             v_parent.transfer_group;
    return;
  end if;

  if v_member.state = 'release_claimed'
     and v_member.release_claimed_at >
       now() - interval '10 minutes' then
    return query
      select 'busy'::text, v_member.release_attempt_number,
             v_member.stripe_account_id,
             coalesce(v_member.release_claim_amount_cents, 0),
             v_member.currency, v_parent.stripe_charge_id,
             v_parent.transfer_group;
    return;
  end if;

  if v_parent.state in ('pending_payment', 'refund_pending', 'refunded', 'review_required')
     or v_parent.stripe_charge_id is null then
    return query
      select 'not_ready'::text, v_member.release_attempt_number,
             v_member.stripe_account_id, 0::bigint,
             v_member.currency, v_parent.stripe_charge_id,
             v_parent.transfer_group;
    return;
  end if;

  v_release_amount :=
    v_member.provider_amount_cents - v_member.refunded_provider_cents;

  if v_release_amount <= 0 then
    return query
      select 'not_ready'::text, v_member.release_attempt_number,
             v_member.stripe_account_id, 0::bigint,
             v_member.currency, v_parent.stripe_charge_id,
             v_parent.transfer_group;
    return;
  end if;

  select coalesce(sum(
    case
      when m.state = 'release_claimed'
        then coalesce(m.release_claim_amount_cents, 0)
      when m.stripe_transfer_id is not null
        then greatest(
          coalesce(m.stripe_transfer_amount_cents, 0)
          - m.reversed_provider_cents,
          0
        )
      else 0
    end
  ), 0)
    into v_reserved_provider
    from public.platform_held_group_settlement_members m
   where m.batch_id = p_batch_id
     and m.id <> p_member_id;

  v_available_provider :=
    v_parent.provider_amount_cents - v_parent.refunded_provider_cents;

  if v_reserved_provider + v_release_amount > v_available_provider then
    raise exception 'KLYX_GROUP_SETTLEMENT_AGGREGATE_OVERTRANSFER_BLOCKED';
  end if;

  update public.platform_held_group_settlement_members
     set state = 'release_claimed',
         release_attempt_number = release_attempt_number + 1,
         release_claim_token = p_claim_token,
         release_claimed_at = now(),
         release_claim_amount_cents = v_release_amount,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_id
   returning * into v_member;

  return query
    select 'create'::text, v_member.release_attempt_number,
           v_member.stripe_account_id,
           v_member.release_claim_amount_cents,
           v_member.currency, v_parent.stripe_charge_id,
           v_parent.transfer_group;
end;
$$;

create or replace function
public.klyx_finalize_platform_held_group_member_release(
  p_batch_id uuid,
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
  v_updated integer;
  v_released bigint;
  v_total bigint;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_GROUP_SETTLEMENT_TRANSFER_ID_INVALID';
  end if;

  update public.platform_held_group_settlement_members
     set state = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         stripe_transfer_amount_cents = release_claim_amount_cents,
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         release_claim_amount_cents = null,
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where id = p_member_id
     and batch_id = p_batch_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token
     and (stripe_transfer_id is null
          or stripe_transfer_id = p_stripe_transfer_id);

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return false;
  end if;

  select
    count(*) filter (
      where state = 'released'
        and stripe_transfer_id is not null
    ),
    count(*)
    into v_released, v_total
    from public.platform_held_group_settlement_members
   where batch_id = p_batch_id;

  update public.platform_held_group_settlements
     set state = case
           when v_released = v_total then 'released'
           when v_released > 0 then 'partially_released'
           else state
         end,
         updated_at = now()
   where batch_id = p_batch_id;

  return true;
end;
$$;

create or replace function
public.klyx_fail_platform_held_group_member_release(
  p_batch_id uuid,
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
         release_claim_amount_cents = null,
         last_error_code = left(
           coalesce(p_error_code, 'group_member_release_failed'), 120
         ),
         last_error_message = left(
           coalesce(p_error_message, 'Group member release failed.'), 1000
         ),
         updated_at = now()
   where id = p_member_id
     and batch_id = p_batch_id
     and state = 'release_claimed'
     and release_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function
public.klyx_platform_held_group_accounting_snapshot(
  p_batch_id uuid
)
returns table (
  gross_amount_cents bigint,
  platform_fee_cents bigint,
  provider_amount_cents bigint,
  member_gross_cents bigint,
  member_platform_fee_cents bigint,
  member_provider_cents bigint,
  claimed_provider_cents bigint,
  transferred_provider_cents bigint,
  reversed_provider_cents bigint,
  refunded_gross_cents bigint,
  refundable_gross_cents bigint,
  provider_funds_remaining_cents bigint,
  accounting_valid boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.gross_amount_cents,
    p.platform_fee_cents,
    p.provider_amount_cents,
    coalesce(sum(m.gross_amount_cents), 0)::bigint,
    coalesce(sum(m.platform_fee_cents), 0)::bigint,
    coalesce(sum(m.provider_amount_cents), 0)::bigint,
    coalesce(sum(
      case when m.state = 'release_claimed'
        then coalesce(m.release_claim_amount_cents, 0)
        else 0 end
    ), 0)::bigint,
    coalesce(sum(coalesce(m.stripe_transfer_amount_cents, 0)), 0)::bigint,
    coalesce(sum(m.reversed_provider_cents), 0)::bigint,
    p.refunded_gross_cents,
    (p.gross_amount_cents - p.refunded_gross_cents)::bigint,
    (p.provider_amount_cents - p.refunded_provider_cents)::bigint,
    (
      coalesce(sum(m.gross_amount_cents), 0) = p.gross_amount_cents
      and coalesce(sum(m.platform_fee_cents), 0) = p.platform_fee_cents
      and coalesce(sum(m.provider_amount_cents), 0) = p.provider_amount_cents
      and p.platform_fee_cents + p.provider_amount_cents =
        p.gross_amount_cents
      and p.refunded_platform_fee_cents + p.refunded_provider_cents =
        p.refunded_gross_cents
      and coalesce(sum(
        greatest(
          coalesce(m.stripe_transfer_amount_cents, 0)
          - m.reversed_provider_cents,
          0
        )
        + case when m.state = 'release_claimed'
            then coalesce(m.release_claim_amount_cents, 0)
            else 0 end
      ), 0) <= p.provider_amount_cents - p.refunded_provider_cents
    ) as accounting_valid
  from public.platform_held_group_settlements p
  left join public.platform_held_group_settlement_members m
    on m.batch_id = p.batch_id
  where p.batch_id = p_batch_id
  group by p.batch_id;
$$;

revoke all on function public.klyx_persist_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.klyx_attach_platform_held_group_stripe_truth(
  uuid, text, text, text
) from public, anon, authenticated;
revoke all on function public.klyx_claim_platform_held_group_member_release(
  uuid, uuid, uuid
) from public, anon, authenticated;
revoke all on function public.klyx_finalize_platform_held_group_member_release(
  uuid, uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.klyx_fail_platform_held_group_member_release(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.klyx_platform_held_group_accounting_snapshot(uuid)
  from public, anon, authenticated;

grant execute on function public.klyx_persist_platform_held_group_settlement(
  uuid, uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) to service_role;
grant execute on function public.klyx_attach_platform_held_group_stripe_truth(
  uuid, text, text, text
) to service_role;
grant execute on function public.klyx_claim_platform_held_group_member_release(
  uuid, uuid, uuid
) to service_role;
grant execute on function public.klyx_finalize_platform_held_group_member_release(
  uuid, uuid, uuid, text
) to service_role;
grant execute on function public.klyx_fail_platform_held_group_member_release(
  uuid, uuid, uuid, text, text
) to service_role;
grant execute on function public.klyx_platform_held_group_accounting_snapshot(uuid)
  to service_role;

comment on table public.platform_held_group_settlements is
  'One Stripe platform-held charge financing one multi-executor KLYX batch. Server-only.';
comment on table public.platform_held_group_settlement_members is
  'Immutable per-executor economics and independent release state for a platform-held group charge. Server-only.';
comment on table public.platform_held_group_refunds is
  'Total/partial refund operation against one platform-held multi-executor group charge. Server-only.';
comment on table public.platform_held_group_refund_allocations is
  'Exact per-executor refund allocation and individual Transfer reversal truth. Server-only.';

commit;

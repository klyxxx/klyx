-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260813165000_klyx_split_payment_confirmation_13_26.sql
-- SHA256: 6261281e01f29b7d1d449680ea35e0a5080138bbddf0185587abab7be7514ab6
-- PHASE: 06_split_missions
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX_SPLIT_PAYMENT_CONFIRMATION_13_26

create table if not exists
public.split_booking_payment_confirmations (
  id uuid primary key
    default gen_random_uuid(),

  batch_id uuid not null
    references public.split_booking_batches(id)
    on delete cascade,

  client_profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  price_confirmation_id uuid not null
    references public.split_booking_price_confirmations(id)
    on delete restrict,

  payment_plan_hash text not null,

  payment_plan_snapshot jsonb not null,

  provider_count integer not null,

  payment_unit_count integer not null,

  total_amount_cents bigint not null,

  currency text not null,

  confirmed_at timestamptz not null
    default now(),

  invalidated_at timestamptz,

  invalidation_reason text,

  consumed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint klyx_split_payment_confirmation_hash_13_26
    check (
      char_length(payment_plan_hash) = 64
    ),

  constraint klyx_split_payment_confirmation_provider_count_13_26
    check (
      provider_count >= 2
    ),

  constraint klyx_split_payment_confirmation_unit_count_13_26
    check (
      payment_unit_count >= 2
    ),

  constraint klyx_split_payment_confirmation_total_13_26
    check (
      total_amount_cents >= 0
    ),

  constraint klyx_split_payment_confirmation_currency_13_26
    check (
      char_length(currency) = 3
    )
);

create index if not exists
  klyx_split_payment_confirmation_batch_13_26
on public.split_booking_payment_confirmations (
  batch_id,
  confirmed_at desc
);

create unique index if not exists
  klyx_split_payment_confirmation_active_13_26
on public.split_booking_payment_confirmations (
  batch_id
)
where
  invalidated_at is null
  and consumed_at is null;

alter table
  public.split_booking_payment_confirmations
enable row level security;


create or replace function
public.klyx_confirm_split_payment_plan_13_26(
  p_batch_id uuid,
  p_client_profile_id uuid,
  p_price_confirmation_id uuid,
  p_payment_plan_hash text,
  p_payment_plan_snapshot jsonb,
  p_provider_count integer,
  p_payment_unit_count integer,
  p_total_amount_cents bigint,
  p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_batch_status text;
  v_price_batch uuid;
  v_price_invalidated timestamptz;
  v_confirmation_id uuid;
begin
  select
    client_profile_id,
    status
  into
    v_owner,
    v_batch_status
  from public.split_booking_batches
  where id = p_batch_id;

  if v_owner is null then
    raise exception
      'KLYX_SPLIT_PAYMENT_BATCH_NOT_FOUND';
  end if;

  if v_owner <> p_client_profile_id then
    raise exception
      'KLYX_SPLIT_PAYMENT_OWNER_REQUIRED';
  end if;

  if v_batch_status <> 'created' then
    raise exception
      'KLYX_SPLIT_PAYMENT_BATCH_NOT_READY';
  end if;

  select
    batch_id,
    invalidated_at
  into
    v_price_batch,
    v_price_invalidated
  from public.split_booking_price_confirmations
  where id = p_price_confirmation_id;

  if v_price_batch is null then
    raise exception
      'KLYX_SPLIT_PAYMENT_PRICE_PROOF_NOT_FOUND';
  end if;

  if v_price_batch <> p_batch_id then
    raise exception
      'KLYX_SPLIT_PAYMENT_PRICE_PROOF_MISMATCH';
  end if;

  if v_price_invalidated is not null then
    raise exception
      'KLYX_SPLIT_PAYMENT_PRICE_PROOF_INVALIDATED';
  end if;

  if
    p_payment_plan_hash is null
    or char_length(
      p_payment_plan_hash
    ) <> 64
  then
    raise exception
      'KLYX_SPLIT_PAYMENT_INVALID_HASH';
  end if;

  if p_provider_count < 2 then
    raise exception
      'KLYX_SPLIT_PAYMENT_PROVIDER_COUNT_INVALID';
  end if;

  if p_payment_unit_count < 2 then
    raise exception
      'KLYX_SPLIT_PAYMENT_UNIT_COUNT_INVALID';
  end if;

  if p_total_amount_cents < 0 then
    raise exception
      'KLYX_SPLIT_PAYMENT_TOTAL_INVALID';
  end if;

  if
    p_currency is null
    or char_length(
      p_currency
    ) <> 3
  then
    raise exception
      'KLYX_SPLIT_PAYMENT_CURRENCY_INVALID';
  end if;

  update
    public.split_booking_payment_confirmations
  set
    invalidated_at = now(),
    invalidation_reason =
      'replaced_by_new_payment_confirmation',
    updated_at = now()
  where
    batch_id = p_batch_id
    and invalidated_at is null
    and consumed_at is null;

  insert into
    public.split_booking_payment_confirmations (
      batch_id,
      client_profile_id,
      price_confirmation_id,
      payment_plan_hash,
      payment_plan_snapshot,
      provider_count,
      payment_unit_count,
      total_amount_cents,
      currency
    )
  values (
    p_batch_id,
    p_client_profile_id,
    p_price_confirmation_id,
    p_payment_plan_hash,
    p_payment_plan_snapshot,
    p_provider_count,
    p_payment_unit_count,
    p_total_amount_cents,
    upper(
      p_currency
    )
  )
  returning id
  into v_confirmation_id;

  return v_confirmation_id;
end;
$$;

revoke all
on function
public.klyx_confirm_split_payment_plan_13_26(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  integer,
  integer,
  bigint,
  text
)
from public;

revoke all
on function
public.klyx_confirm_split_payment_plan_13_26(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  integer,
  integer,
  bigint,
  text
)
from authenticated;

grant execute
on function
public.klyx_confirm_split_payment_plan_13_26(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  integer,
  integer,
  bigint,
  text
)
to service_role;
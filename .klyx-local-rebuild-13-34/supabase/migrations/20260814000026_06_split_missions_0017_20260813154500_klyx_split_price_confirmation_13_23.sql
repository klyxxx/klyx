-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260813154500_klyx_split_price_confirmation_13_23.sql
-- SHA256: be594d3c9957e67f5ccc34e0ee97848f0eb4d61f01bac6f9f3fd2f6bfc9907f6
-- PHASE: 06_split_missions
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX_SPLIT_PRICE_CONFIRMATION_13_23

create table if not exists
public.split_booking_price_confirmations (
  id uuid primary key
    default gen_random_uuid(),

  batch_id uuid not null
    references public.split_booking_batches(id)
    on delete cascade,

  client_profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  price_hash text not null,

  price_snapshot jsonb not null,

  item_count integer not null,

  total_amount_cents bigint not null,

  currency text not null,

  confirmed_at timestamptz not null
    default now(),

  invalidated_at timestamptz,

  invalidation_reason text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint klyx_split_price_hash_13_23
    check (
      char_length(price_hash) = 64
    ),

  constraint klyx_split_price_count_13_23
    check (
      item_count >= 2
    ),

  constraint klyx_split_price_total_13_23
    check (
      total_amount_cents >= 0
    ),

  constraint klyx_split_price_currency_13_23
    check (
      char_length(currency) = 3
    )
);

create index if not exists
  klyx_split_price_batch_history_13_23
on public.split_booking_price_confirmations (
  batch_id,
  confirmed_at desc
);

create unique index if not exists
  klyx_split_price_one_active_13_23
on public.split_booking_price_confirmations (
  batch_id
)
where invalidated_at is null;

alter table
  public.split_booking_price_confirmations
enable row level security;


create or replace function
public.klyx_confirm_split_booking_prices_13_23(
  p_batch_id uuid,
  p_client_profile_id uuid,
  p_price_hash text,
  p_price_snapshot jsonb,
  p_item_count integer,
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
  v_status text;
  v_confirmation_id uuid;
begin
  select
    client_profile_id,
    status
  into
    v_owner,
    v_status
  from public.split_booking_batches
  where id = p_batch_id;

  if v_owner is null then
    raise exception
      'KLYX_SPLIT_PRICE_BATCH_NOT_FOUND';
  end if;

  if v_owner <> p_client_profile_id then
    raise exception
      'KLYX_SPLIT_PRICE_OWNER_REQUIRED';
  end if;

  if v_status <> 'created' then
    raise exception
      'KLYX_SPLIT_PRICE_BATCH_NOT_READY';
  end if;

  if
    p_price_hash is null
    or char_length(
      p_price_hash
    ) <> 64
  then
    raise exception
      'KLYX_SPLIT_PRICE_INVALID_HASH';
  end if;

  if p_item_count < 2 then
    raise exception
      'KLYX_SPLIT_PRICE_INVALID_COUNT';
  end if;

  if p_total_amount_cents < 0 then
    raise exception
      'KLYX_SPLIT_PRICE_INVALID_TOTAL';
  end if;

  if
    p_currency is null
    or char_length(
      p_currency
    ) <> 3
  then
    raise exception
      'KLYX_SPLIT_PRICE_INVALID_CURRENCY';
  end if;

  update
    public.split_booking_price_confirmations
  set
    invalidated_at = now(),
    invalidation_reason =
      'replaced_by_new_price_confirmation',
    updated_at = now()
  where
    batch_id = p_batch_id
    and invalidated_at is null;

  insert into
    public.split_booking_price_confirmations (
      batch_id,
      client_profile_id,
      price_hash,
      price_snapshot,
      item_count,
      total_amount_cents,
      currency
    )
  values (
    p_batch_id,
    p_client_profile_id,
    p_price_hash,
    p_price_snapshot,
    p_item_count,
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
public.klyx_confirm_split_booking_prices_13_23(
  uuid,
  uuid,
  text,
  jsonb,
  integer,
  bigint,
  text
)
from public;

revoke all
on function
public.klyx_confirm_split_booking_prices_13_23(
  uuid,
  uuid,
  text,
  jsonb,
  integer,
  bigint,
  text
)
from authenticated;

grant execute
on function
public.klyx_confirm_split_booking_prices_13_23(
  uuid,
  uuid,
  text,
  jsonb,
  integer,
  bigint,
  text
)
to service_role;
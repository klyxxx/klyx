-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260813143000_klyx_split_booking_recovery_13_20.sql
-- SHA256: a4459e393954ac051c7a99f92d3bf71484ef4cb468f56938b32f36af2cf4506c
-- PHASE: 06_split_missions
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX_SPLIT_BOOKING_RECOVERY_13_20

create table if not exists
public.split_booking_proof_consumptions (
  id uuid primary key
    default gen_random_uuid(),

  confirmation_id uuid not null
    references public.market_split_plan_confirmations(id)
    on delete restrict,

  batch_id uuid not null
    references public.split_booking_batches(id)
    on delete cascade,

  market_request_id uuid not null
    references public.market_service_requests(id)
    on delete cascade,

  client_profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  plan_hash text not null,

  consumed_at timestamptz not null
    default now(),

  created_at timestamptz not null
    default now(),

  constraint klyx_split_consumption_hash_13_20
    check (
      char_length(plan_hash) = 64
    )
);

create unique index if not exists
  klyx_split_consumption_confirmation_13_20
on public.split_booking_proof_consumptions (
  confirmation_id
);

create unique index if not exists
  klyx_split_consumption_batch_13_20
on public.split_booking_proof_consumptions (
  batch_id
);

alter table
  public.split_booking_proof_consumptions
enable row level security;


create or replace function
public.klyx_split_batch_integrity_13_20()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual_count integer;
begin
  select count(*)::integer
  into v_actual_count
  from public.split_booking_batch_items
  where batch_id = new.id;

  new.created_booking_count :=
    coalesce(
      v_actual_count,
      0
    );

  if
    new.status = 'created'
    and new.created_booking_count <>
      new.expected_booking_count
  then
    raise exception
      'KLYX_SPLIT_BATCH_INCOMPLETE:%/%',
      new.created_booking_count,
      new.expected_booking_count;
  end if;

  return new;
end;
$$;


drop trigger if exists
  klyx_split_batch_integrity_13_20
on public.split_booking_batches;

create trigger
  klyx_split_batch_integrity_13_20
before update
on public.split_booking_batches
for each row
execute function
  public.klyx_split_batch_integrity_13_20();


create or replace function
public.klyx_split_batch_item_count_13_20()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
begin
  v_batch_id :=
    coalesce(
      new.batch_id,
      old.batch_id
    );

  update public.split_booking_batches
  set
    created_booking_count = (
      select count(*)::integer
      from public.split_booking_batch_items
      where batch_id = v_batch_id
    ),
    updated_at = now()
  where id = v_batch_id;

  return coalesce(
    new,
    old
  );
end;
$$;


drop trigger if exists
  klyx_split_batch_item_count_insert_13_20
on public.split_booking_batch_items;

create trigger
  klyx_split_batch_item_count_insert_13_20
after insert
on public.split_booking_batch_items
for each row
execute function
  public.klyx_split_batch_item_count_13_20();


drop trigger if exists
  klyx_split_batch_item_count_delete_13_20
on public.split_booking_batch_items;

create trigger
  klyx_split_batch_item_count_delete_13_20
after delete
on public.split_booking_batch_items
for each row
execute function
  public.klyx_split_batch_item_count_13_20();


create or replace function
public.klyx_consume_split_booking_proof_13_20()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confirmation
    public.market_split_plan_confirmations%rowtype;

  v_existing_batch uuid;
begin
  if
    new.status <> 'created'
  then
    return new;
  end if;

  if
    old.status is not distinct from 'created'
  then
    return new;
  end if;

  select *
  into v_confirmation
  from public.market_split_plan_confirmations
  where id = new.confirmation_id;

  if not found then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_NOT_FOUND';
  end if;

  if
    v_confirmation.invalidated_at
    is not null
  then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_INVALIDATED';
  end if;

  if
    v_confirmation.market_request_id <>
      new.market_request_id
  then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_REQUEST_MISMATCH';
  end if;

  if
    v_confirmation.client_profile_id <>
      new.client_profile_id
  then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_CLIENT_MISMATCH';
  end if;

  if
    v_confirmation.plan_hash <>
      new.plan_hash
  then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_HASH_MISMATCH';
  end if;

  insert into
    public.split_booking_proof_consumptions (
      confirmation_id,
      batch_id,
      market_request_id,
      client_profile_id,
      plan_hash
    )
  values (
    new.confirmation_id,
    new.id,
    new.market_request_id,
    new.client_profile_id,
    new.plan_hash
  )
  on conflict (
    confirmation_id
  )
  do nothing;

  select batch_id
  into v_existing_batch
  from public.split_booking_proof_consumptions
  where confirmation_id =
    new.confirmation_id;

  if
    v_existing_batch is distinct from
      new.id
  then
    raise exception
      'KLYX_SPLIT_CONFIRMATION_ALREADY_CONSUMED';
  end if;

  return new;
end;
$$;


drop trigger if exists
  klyx_consume_split_booking_proof_13_20
on public.split_booking_batches;

create trigger
  klyx_consume_split_booking_proof_13_20
after update of status
on public.split_booking_batches
for each row
execute function
  public.klyx_consume_split_booking_proof_13_20();
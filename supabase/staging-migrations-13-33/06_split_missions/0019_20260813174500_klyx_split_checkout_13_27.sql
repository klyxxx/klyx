-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260813174500_klyx_split_checkout_13_27.sql
-- SHA256: 37aab80cc11b185e78cf5d3961bb22db772dde6137404bf84c3912427479ac53
-- PHASE: 06_split_missions
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX_SPLIT_CHECKOUT_DB_13_27

create table if not exists
public.split_booking_payment_runs (
  id uuid primary key
    default gen_random_uuid(),

  batch_id uuid not null unique
    references public.split_booking_batches(id)
    on delete restrict,

  client_profile_id uuid not null
    references public.profiles(id)
    on delete restrict,

  payment_confirmation_id uuid not null unique
    references public.split_booking_payment_confirmations(id)
    on delete restrict,

  payment_plan_hash text not null,

  total_amount_cents bigint not null,

  currency text not null,

  provider_count integer not null,

  payment_unit_count integer not null,

  status text not null
    default 'preparing',

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  ready_at timestamptz,

  paid_at timestamptz,

  constraint klyx_split_run_hash_13_27
    check (
      char_length(payment_plan_hash) = 64
    ),

  constraint klyx_split_run_total_13_27
    check (
      total_amount_cents >= 0
    ),

  constraint klyx_split_run_currency_13_27
    check (
      char_length(currency) = 3
    ),

  constraint klyx_split_run_provider_count_13_27
    check (
      provider_count >= 2
    ),

  constraint klyx_split_run_unit_count_13_27
    check (
      payment_unit_count >= 2
    ),

  constraint klyx_split_run_status_13_27
    check (
      status in (
        'preparing',
        'ready',
        'partially_paid',
        'paid'
      )
    )
);


create table if not exists
public.split_booking_payment_units (
  id uuid primary key
    default gen_random_uuid(),

  run_id uuid not null
    references public.split_booking_payment_runs(id)
    on delete cascade,

  batch_id uuid not null
    references public.split_booking_batches(id)
    on delete restrict,

  payment_confirmation_id uuid not null
    references public.split_booking_payment_confirmations(id)
    on delete restrict,

  client_profile_id uuid not null
    references public.profiles(id)
    on delete restrict,

  provider_profile_id uuid not null
    references public.profiles(id)
    on delete restrict,

  stripe_account_id text not null,

  amount_cents bigint not null,

  currency text not null,

  booking_ids jsonb not null,

  slot_ids jsonb not null,

  application_fee_amount bigint not null,

  provider_amount_cents bigint not null,

  status text not null
    default 'pending',

  attempt_number integer not null
    default 0,

  attempt_token text,

  stripe_checkout_session_id text,

  checkout_url text,

  stripe_payment_intent_id text,

  last_error text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  checkout_created_at timestamptz,

  paid_at timestamptz,

  constraint klyx_split_unit_amount_13_27
    check (
      amount_cents >= 50
    ),

  constraint klyx_split_unit_currency_13_27
    check (
      char_length(currency) = 3
    ),

  constraint klyx_split_unit_fee_13_27
    check (
      application_fee_amount >= 0
      and
      provider_amount_cents >= 0
      and
      application_fee_amount
        + provider_amount_cents
        = amount_cents
    ),

  constraint klyx_split_unit_booking_json_13_27
    check (
      jsonb_typeof(booking_ids)
        = 'array'
    ),

  constraint klyx_split_unit_slot_json_13_27
    check (
      jsonb_typeof(slot_ids)
        = 'array'
    ),

  constraint klyx_split_unit_status_13_27
    check (
      status in (
        'pending',
        'creating',
        'checkout_open',
        'paid',
        'failed',
        'expired'
      )
    ),

  constraint klyx_split_unit_provider_unique_13_27
    unique (
      run_id,
      provider_profile_id
    )
);


create unique index if not exists
  klyx_split_unit_session_unique_13_27
on public.split_booking_payment_units (
  stripe_checkout_session_id
)
where
  stripe_checkout_session_id is not null;


create index if not exists
  klyx_split_unit_batch_13_27
on public.split_booking_payment_units (
  batch_id,
  status
);


alter table
  public.split_booking_payment_runs
enable row level security;

alter table
  public.split_booking_payment_units
enable row level security;


create or replace function
public.klyx_claim_split_payment_unit_13_27(
  p_unit_id uuid,
  p_client_profile_id uuid,
  p_attempt_token text
)
returns table (
  action text,
  unit_id uuid,
  checkout_session_id text,
  attempt_number integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit public.split_booking_payment_units%rowtype;
begin
  select *
  into v_unit
  from public.split_booking_payment_units
  where
    id = p_unit_id
    and client_profile_id = p_client_profile_id
  for update;

  if not found then
    raise exception
      'KLYX_SPLIT_PAYMENT_UNIT_NOT_FOUND';
  end if;

  if v_unit.status = 'paid' then
    return query
    select
      'paid'::text,
      v_unit.id,
      v_unit.stripe_checkout_session_id,
      v_unit.attempt_number;

    return;
  end if;

  if
    v_unit.status = 'checkout_open'
    and
    v_unit.stripe_checkout_session_id is not null
  then
    return query
    select
      'reuse'::text,
      v_unit.id,
      v_unit.stripe_checkout_session_id,
      v_unit.attempt_number;

    return;
  end if;

  if
    v_unit.status = 'creating'
    and
    v_unit.updated_at >
      now() - interval '2 minutes'
  then
    return query
    select
      'busy'::text,
      v_unit.id,
      v_unit.stripe_checkout_session_id,
      v_unit.attempt_number;

    return;
  end if;

  update
    public.split_booking_payment_units
  set
    status = 'creating',
    attempt_number =
      attempt_number + 1,
    attempt_token =
      p_attempt_token,
    last_error = null,
    updated_at = now()
  where
    id = v_unit.id
  returning *
  into v_unit;

  return query
  select
    'create'::text,
    v_unit.id,
    null::text,
    v_unit.attempt_number;
end;
$$;


create or replace function
public.klyx_attach_split_checkout_13_27(
  p_unit_id uuid,
  p_attempt_token text,
  p_checkout_session_id text,
  p_checkout_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update
    public.split_booking_payment_units
  set
    status = 'checkout_open',
    stripe_checkout_session_id =
      p_checkout_session_id,
    checkout_url =
      p_checkout_url,
    attempt_token = null,
    checkout_created_at = now(),
    updated_at = now()
  where
    id = p_unit_id
    and status = 'creating'
    and attempt_token =
      p_attempt_token;

  return found;
end;
$$;


create or replace function
public.klyx_release_split_checkout_13_27(
  p_unit_id uuid,
  p_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update
    public.split_booking_payment_units
  set
    status = 'expired',
    stripe_checkout_session_id = null,
    checkout_url = null,
    stripe_payment_intent_id = null,
    attempt_token = null,
    last_error =
      'checkout_expired',
    updated_at = now()
  where
    id = p_unit_id
    and stripe_checkout_session_id =
      p_checkout_session_id
    and status <> 'paid';

  return found;
end;
$$;


create or replace function
public.klyx_finalize_split_payment_run_13_27(
  p_run_id uuid,
  p_client_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.split_booking_payment_runs%rowtype;
  v_ready_count integer;
  v_paid_count integer;
begin
  select *
  into v_run
  from public.split_booking_payment_runs
  where
    id = p_run_id
    and client_profile_id =
      p_client_profile_id
  for update;

  if not found then
    raise exception
      'KLYX_SPLIT_PAYMENT_RUN_NOT_FOUND';
  end if;

  select
    count(*) filter (
      where status in (
        'checkout_open',
        'paid'
      )
    ),
    count(*) filter (
      where status = 'paid'
    )
  into
    v_ready_count,
    v_paid_count
  from public.split_booking_payment_units
  where run_id = v_run.id;

  if
    v_ready_count <>
      v_run.payment_unit_count
  then
    return false;
  end if;

  update
    public.split_booking_payment_confirmations
  set
    consumed_at =
      coalesce(
        consumed_at,
        now()
      ),
    updated_at = now()
  where
    id =
      v_run.payment_confirmation_id
    and invalidated_at is null;

  update
    public.split_booking_payment_runs
  set
    status =
      case
        when
          v_paid_count =
            payment_unit_count
        then 'paid'
        when
          v_paid_count > 0
        then 'partially_paid'
        else 'ready'
      end,
    ready_at =
      coalesce(
        ready_at,
        now()
      ),
    paid_at =
      case
        when
          v_paid_count =
            payment_unit_count
        then
          coalesce(
            paid_at,
            now()
          )
        else paid_at
      end,
    updated_at = now()
  where id = v_run.id;

  return true;
end;
$$;


create or replace function
public.klyx_block_split_payment_reconfirmation_13_27()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.split_booking_payment_runs
    where batch_id = new.batch_id
  ) then
    raise exception
      'KLYX_SPLIT_PAYMENT_ALREADY_STARTED';
  end if;

  return new;
end;
$$;


drop trigger if exists
  klyx_block_split_payment_reconfirmation_13_27
on public.split_booking_payment_confirmations;

create trigger
  klyx_block_split_payment_reconfirmation_13_27
before insert
on public.split_booking_payment_confirmations
for each row
execute function
public.klyx_block_split_payment_reconfirmation_13_27();


revoke all
on function
public.klyx_claim_split_payment_unit_13_27(
  uuid,
  uuid,
  text
)
from public, authenticated;

revoke all
on function
public.klyx_attach_split_checkout_13_27(
  uuid,
  text,
  text,
  text
)
from public, authenticated;

revoke all
on function
public.klyx_release_split_checkout_13_27(
  uuid,
  text
)
from public, authenticated;

revoke all
on function
public.klyx_finalize_split_payment_run_13_27(
  uuid,
  uuid
)
from public, authenticated;

grant execute
on function
public.klyx_claim_split_payment_unit_13_27(
  uuid,
  uuid,
  text
)
to service_role;

grant execute
on function
public.klyx_attach_split_checkout_13_27(
  uuid,
  text,
  text,
  text
)
to service_role;

grant execute
on function
public.klyx_release_split_checkout_13_27(
  uuid,
  text
)
to service_role;

grant execute
on function
public.klyx_finalize_split_payment_run_13_27(
  uuid,
  uuid
)
to service_role;
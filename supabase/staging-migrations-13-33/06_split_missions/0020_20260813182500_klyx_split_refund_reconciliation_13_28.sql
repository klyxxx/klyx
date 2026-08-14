-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260813182500_klyx_split_refund_reconciliation_13_28.sql
-- SHA256: 8fc74ad1cf9c04bad88adc443cbc62da5cdfaaf65a05b1599f46917b4046b68a
-- PHASE: 06_split_missions
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX_SPLIT_REFUND_DB_13_28

alter table
  public.split_booking_payment_units
add column if not exists
  refund_status text not null
  default 'none';

alter table
  public.split_booking_payment_units
add column if not exists
  refunded_amount_cents bigint not null
  default 0;

alter table
  public.split_booking_payment_units
add column if not exists
  stripe_refund_id text;

alter table
  public.split_booking_payment_units
add column if not exists
  refund_failure_reason text;

alter table
  public.split_booking_payment_units
add column if not exists
  refund_updated_at timestamptz;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname =
        'klyx_split_unit_refund_status_13_28'
  ) then
    alter table
      public.split_booking_payment_units
    add constraint
      klyx_split_unit_refund_status_13_28
    check (
      refund_status in (
        'none',
        'processing',
        'partially_refunded',
        'refunded',
        'failed'
      )
    );
  end if;
end;
$$;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname =
        'klyx_split_unit_refunded_amount_13_28'
  ) then
    alter table
      public.split_booking_payment_units
    add constraint
      klyx_split_unit_refunded_amount_13_28
    check (
      refunded_amount_cents >= 0
      and
      refunded_amount_cents <= amount_cents
    );
  end if;
end;
$$;


create table if not exists
public.split_booking_payment_refunds (
  id uuid primary key
    default gen_random_uuid(),

  unit_id uuid not null
    references public.split_booking_payment_units(id)
    on delete restrict,

  run_id uuid not null
    references public.split_booking_payment_runs(id)
    on delete restrict,

  batch_id uuid not null
    references public.split_booking_batches(id)
    on delete restrict,

  stripe_refund_id text not null unique,

  stripe_payment_intent_id text,

  amount_cents bigint not null,

  currency text not null,

  status text not null,

  raw_status text,

  failure_reason text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint klyx_split_refund_amount_13_28
    check (
      amount_cents > 0
    ),

  constraint klyx_split_refund_currency_13_28
    check (
      char_length(currency) = 3
    ),

  constraint klyx_split_refund_status_13_28
    check (
      status in (
        'processing',
        'succeeded',
        'failed'
      )
    )
);


create index if not exists
  klyx_split_refund_unit_13_28
on public.split_booking_payment_refunds (
  unit_id,
  created_at
);


create index if not exists
  klyx_split_refund_run_13_28
on public.split_booking_payment_refunds (
  run_id,
  status
);


alter table
  public.split_booking_payment_refunds
enable row level security;


alter table
  public.split_booking_payment_runs
drop constraint if exists
  klyx_split_run_status_13_27;


alter table
  public.split_booking_payment_runs
add constraint
  klyx_split_run_status_13_28
check (
  status in (
    'preparing',
    'ready',
    'partially_paid',
    'paid',
    'partially_refunded',
    'refunded'
  )
);


create or replace function
public.klyx_recompute_split_refund_run_13_28(
  p_run_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_paid integer;
  v_refunded integer;
  v_refund_activity integer;
  v_status text;
begin
  select
    count(*),
    count(*) filter (
      where status = 'paid'
    ),
    count(*) filter (
      where refund_status = 'refunded'
    ),
    count(*) filter (
      where refund_status <> 'none'
    )
  into
    v_total,
    v_paid,
    v_refunded,
    v_refund_activity
  from public.split_booking_payment_units
  where run_id = p_run_id;

  if
    v_total > 0
    and
    v_refunded = v_total
  then
    v_status =
      'refunded';

  elsif
    v_refund_activity > 0
  then
    v_status =
      'partially_refunded';

  elsif
    v_total > 0
    and
    v_paid = v_total
  then
    v_status =
      'paid';

  elsif
    v_paid > 0
  then
    v_status =
      'partially_paid';

  else
    v_status =
      'ready';
  end if;

  update
    public.split_booking_payment_runs
  set
    status =
      v_status,
    updated_at =
      now()
  where id =
    p_run_id;

  return v_status;
end;
$$;


revoke all
on function
public.klyx_recompute_split_refund_run_13_28(
  uuid
)
from public, authenticated;

grant execute
on function
public.klyx_recompute_split_refund_run_13_28(
  uuid
)
to service_role;
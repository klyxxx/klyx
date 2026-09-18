-- KLYX PLATFORM-HELD SETTLEMENT — OPERATIONAL RECOVERY / RECONCILIATION
--
-- Server-only, fail-closed recovery primitives for partial Stripe/DB failures.
-- No Stripe side effect is executed by SQL. Application code remains TEST-only
-- for platform-held Transfer / reversal creation.
--
-- Canonical authorities preserved:
--   user authority: accounts.id
--   Stripe Connect authority: account_stripe_connect_identities
--   profiles.stripe_account_id: compatibility/history only
--
-- Group/split platform-held settlement remains unsupported.

begin;

alter table public.booking_settlements
  drop constraint if exists booking_settlements_state_check;

alter table public.booking_settlements
  add constraint booking_settlements_state_check
  check (
    state in (
      'pending_payment',
      'held',
      'review_required',
      'human_review',
      'release_claimed',
      'released',
      'release_failed',
      'refund_pending',
      'refunded'
    )
  );

alter table public.booking_settlements
  add column if not exists held_at timestamptz,
  add column if not exists human_review_at timestamptz,
  add column if not exists last_reconciled_at timestamptz;

update public.booking_settlements
   set held_at = coalesce(held_at, created_at)
 where held_at is null
   and state in (
     'held',
     'review_required',
     'human_review',
     'release_claimed',
     'released',
     'release_failed',
     'refund_pending',
     'refunded'
   );

create or replace function public.klyx_set_booking_settlement_recovery_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.state = 'held' then
      new.held_at := coalesce(new.held_at, now());
    end if;

    if new.state = 'human_review' then
      new.human_review_at := coalesce(new.human_review_at, now());
    end if;

    return new;
  end if;

  if new.state = 'held' and old.state is distinct from 'held' then
    new.held_at := coalesce(new.held_at, now());
  end if;

  if new.state = 'human_review'
     and old.state is distinct from 'human_review' then
    new.human_review_at := coalesce(new.human_review_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists booking_settlements_recovery_timestamps
  on public.booking_settlements;

create trigger booking_settlements_recovery_timestamps
before insert or update on public.booking_settlements
for each row
execute function public.klyx_set_booking_settlement_recovery_timestamps();

create table if not exists public.booking_settlement_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.booking_settlements(booking_id) on delete restrict,
  run_id uuid not null,
  source text not null
    check (source in ('release', 'refund', 'webhook', 'scheduled', 'manual')),
  action text not null,
  outcome text not null
    check (
      outcome in (
        'observed',
        'recovered',
        'released',
        'reversed',
        'human_review',
        'no_action',
        'failed'
      )
    ),
  reason_code text,
  before_state text,
  after_state text,
  stripe_transfer_id text,
  stripe_transfer_reversal_id text,
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  deduplication_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists booking_settlement_reconciliation_events_booking_idx
  on public.booking_settlement_reconciliation_events(booking_id, created_at desc);

create index if not exists booking_settlement_reconciliation_events_outcome_idx
  on public.booking_settlement_reconciliation_events(outcome, created_at desc);

alter table public.booking_settlement_reconciliation_events enable row level security;

revoke all privileges on table public.booking_settlement_reconciliation_events
  from public, anon, authenticated, service_role;
grant select, insert on table public.booking_settlement_reconciliation_events
  to service_role;

comment on table public.booking_settlement_reconciliation_events is
  'Append-only server-side audit trail for platform-held settlement reconciliation.';

create or replace function public.klyx_mark_booking_settlement_human_review(
  p_booking_id uuid,
  p_reason_codes jsonb,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_reason_codes is null or jsonb_typeof(p_reason_codes) <> 'array' then
    raise exception 'KLYX_SETTLEMENT_HUMAN_REVIEW_REASONS_INVALID';
  end if;

  update public.booking_settlements
     set state = 'human_review',
         release_reason_codes = p_reason_codes,
         release_claim_token = null,
         release_claimed_at = null,
         human_review_at = coalesce(human_review_at, now()),
         last_error_code = left(coalesce(p_error_code, 'settlement_human_review'), 120),
         last_error_message = left(coalesce(p_error_message, 'Settlement requires human review.'), 1000),
         last_reconciled_at = now(),
         updated_at = now()
   where booking_id = p_booking_id;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_record_booking_settlement_transfer_truth(
  p_booking_id uuid,
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
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_SETTLEMENT_TRANSFER_ID_INVALID';
  end if;

  update public.booking_settlements
     set stripe_transfer_id = p_stripe_transfer_id,
         last_reconciled_at = now(),
         updated_at = now()
   where booking_id = p_booking_id
     and (
       stripe_transfer_id is null
       or stripe_transfer_id = p_stripe_transfer_id
     );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.klyx_reconcile_booking_settlement_released(
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
  v_booking record;
begin
  if coalesce(trim(p_stripe_transfer_id), '') !~ '^tr_[A-Za-z0-9]+$' then
    raise exception 'KLYX_SETTLEMENT_TRANSFER_ID_INVALID';
  end if;

  select s.*
    into v_settlement
    from public.booking_settlements as s
   where s.booking_id = p_booking_id
   for update;

  if not found then
    return false;
  end if;

  select
    b.status,
    b.payment_status,
    b.refund_status,
    b.payment_mode,
    b.booking_group_id
    into v_booking
    from public.bookings as b
   where b.id = p_booking_id;

  if not found then
    return false;
  end if;

  if v_settlement.stripe_transfer_id is distinct from p_stripe_transfer_id then
    return false;
  end if;

  if v_settlement.state in ('human_review', 'refund_pending', 'refunded')
     or coalesce(v_booking.refund_status, '') in ('processing', 'succeeded')
     or coalesce(v_booking.payment_status, '') = 'refunded' then
    return false;
  end if;

  if coalesce(v_booking.status, '') <> 'completed'
     or coalesce(v_booking.payment_status, '') <> 'paid'
     or coalesce(v_booking.payment_mode, '') <> 'platform_held'
     or v_booking.booking_group_id is not null
     or v_settlement.state not in ('held', 'release_claimed', 'release_failed', 'released') then
    return false;
  end if;

  update public.booking_settlements
     set state = 'released',
         released_at = coalesce(released_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
         last_error_code = null,
         last_error_message = null,
         last_reconciled_at = now(),
         updated_at = now()
   where booking_id = p_booking_id;

  return true;
end;
$$;

create or replace function public.klyx_force_booking_settlement_refund_pending(
  p_booking_id uuid
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
     set state = case when state = 'refunded' then 'refunded' else 'refund_pending' end,
         release_claim_token = null,
         release_claimed_at = null,
         last_reconciled_at = now(),
         updated_at = now()
   where booking_id = p_booking_id
     and state <> 'human_review';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
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
  v_settlement public.booking_settlements%rowtype;
  v_booking record;
begin
  select s.*
    into v_settlement
    from public.booking_settlements as s
   where s.booking_id = p_booking_id
   for update;

  if not found or v_settlement.state = 'human_review' then
    return false;
  end if;

  select b.payment_status, b.refund_status, b.payment_mode
    into v_booking
    from public.bookings as b
   where b.id = p_booking_id;

  if not found
     or coalesce(v_booking.payment_mode, '') <> 'platform_held'
     or (
       coalesce(v_booking.payment_status, '') <> 'refunded'
       and coalesce(v_booking.refund_status, '') <> 'succeeded'
     ) then
    return false;
  end if;

  if v_settlement.stripe_transfer_id is not null
     and v_settlement.stripe_transfer_reversal_id is null then
    return false;
  end if;

  update public.booking_settlements
     set state = 'refunded',
         refunded_at = coalesce(refunded_at, now()),
         release_claim_token = null,
         release_claimed_at = null,
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
  select s.*
    into v_settlement
    from public.booking_settlements as s
   where s.booking_id = p_booking_id
   for update;

  if not found or v_settlement.state = 'human_review' then
    return false;
  end if;

  if v_settlement.stripe_transfer_id is not null
     and v_settlement.stripe_transfer_reversal_id is null then
    return false;
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

create or replace function public.klyx_booking_settlement_metrics()
returns table (
  held bigint,
  pending_release bigint,
  failed bigint,
  review bigint,
  released bigint,
  reversed bigint,
  settlement_avg_seconds double precision,
  settlement_p50_seconds double precision,
  settlement_p95_seconds double precision
)
language sql
security definer
set search_path = public
as $$
  select
    count(*) filter (where s.state = 'held')::bigint,
    count(*) filter (where s.state = 'release_claimed')::bigint,
    count(*) filter (where s.state = 'release_failed')::bigint,
    count(*) filter (where s.state in ('review_required', 'human_review'))::bigint,
    count(*) filter (where s.state = 'released')::bigint,
    count(*) filter (where s.stripe_transfer_reversal_id is not null)::bigint,
    (
      avg(
        extract(epoch from (s.released_at - coalesce(s.held_at, s.created_at)))
      ) filter (where s.released_at is not null)
    )::double precision,
    (
      percentile_cont(0.50) within group (
        order by extract(epoch from (s.released_at - coalesce(s.held_at, s.created_at)))
      ) filter (where s.released_at is not null)
    )::double precision,
    (
      percentile_cont(0.95) within group (
        order by extract(epoch from (s.released_at - coalesce(s.held_at, s.created_at)))
      ) filter (where s.released_at is not null)
    )::double precision
  from public.booking_settlements as s
  where s.payment_mode = 'platform_held';
$$;

revoke all on function public.klyx_set_booking_settlement_recovery_timestamps()
  from public, anon, authenticated;
revoke all on function public.klyx_mark_booking_settlement_human_review(uuid, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.klyx_record_booking_settlement_transfer_truth(uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_reconcile_booking_settlement_released(uuid, text)
  from public, anon, authenticated;
revoke all on function public.klyx_force_booking_settlement_refund_pending(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_reconcile_booking_settlement_refund_terminal(uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_booking_settlement_metrics()
  from public, anon, authenticated;

grant execute on function public.klyx_mark_booking_settlement_human_review(uuid, jsonb, text, text)
  to service_role;
grant execute on function public.klyx_record_booking_settlement_transfer_truth(uuid, text)
  to service_role;
grant execute on function public.klyx_reconcile_booking_settlement_released(uuid, text)
  to service_role;
grant execute on function public.klyx_force_booking_settlement_refund_pending(uuid)
  to service_role;
grant execute on function public.klyx_reconcile_booking_settlement_refund_terminal(uuid)
  to service_role;
grant execute on function public.klyx_booking_settlement_metrics()
  to service_role;

comment on function public.klyx_mark_booking_settlement_human_review(uuid, jsonb, text, text) is
  'Fail-closed terminal recovery state for ambiguous or irreconcilable settlement truth.';

comment on function public.klyx_record_booking_settlement_transfer_truth(uuid, text) is
  'Records a Stripe Transfer id only when absent or identical; never overwrites conflicting financial truth.';

comment on function public.klyx_reconcile_booking_settlement_released(uuid, text) is
  'Finalizes DB release from verified Stripe truth only when no refund fence or human-review state is active.';

comment on function public.klyx_booking_settlement_metrics() is
  'Server-only operational metrics for held, pending release, failed, review, released, reversed and settlement latency.';

commit;

-- KLYX_REFUND_RECONCILIATION_MONOTONICITY_16_11
--
-- Refund webhooks can be delivered more than once and out of order. Keep
-- succeeded financial/refund facts terminal at the database boundary and give
-- grouped Stripe refund audit rows a deterministic identity.

begin;

-- ---------------------------------------------------------------------------
-- 1. Group refund audit identity
-- ---------------------------------------------------------------------------

alter table public.booking_group_cancellation_events
  add column if not exists stripe_refund_id text;

comment on column public.booking_group_cancellation_events.stripe_refund_id is
  'Stripe refund identity for server-generated refund audit events. NULL for non-Stripe cancellation history.';

create unique index if not exists booking_group_cancellation_events_refund_identity_uidx
  on public.booking_group_cancellation_events (
    booking_group_id,
    action,
    stripe_refund_id
  );

-- A late failure snapshot must not create a contradictory audit fact after the
-- group has already reached its terminal refunded state. Returning NULL skips
-- the stale INSERT while preserving historical failure -> success sequences.
create or replace function public.klyx_guard_group_refund_audit_16_11()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if
    new.stripe_refund_id is not null
    and new.action = 'refund_failed'
    and exists (
      select 1
      from public.booking_groups
      where id = new.booking_group_id
        and refund_status = 'refunded'
    )
  then
    return null;
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_guard_group_refund_audit_16_11()
  from public, anon, authenticated;
grant execute on function public.klyx_guard_group_refund_audit_16_11()
  to service_role;

drop trigger if exists klyx_guard_group_refund_audit_16_11
  on public.booking_group_cancellation_events;

create trigger klyx_guard_group_refund_audit_16_11
before insert on public.booking_group_cancellation_events
for each row
execute function public.klyx_guard_group_refund_audit_16_11();

-- ---------------------------------------------------------------------------
-- 2. Financial ledger terminal success
-- ---------------------------------------------------------------------------

create or replace function public.klyx_preserve_succeeded_financial_ledger_16_11()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if
    old.status = 'succeeded'
    and new.status is distinct from 'succeeded'
  then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_preserve_succeeded_financial_ledger_16_11()
  from public, anon, authenticated;
grant execute on function public.klyx_preserve_succeeded_financial_ledger_16_11()
  to service_role;

drop trigger if exists klyx_preserve_succeeded_financial_ledger_16_11
  on public.booking_financial_ledger;

create trigger klyx_preserve_succeeded_financial_ledger_16_11
before update on public.booking_financial_ledger
for each row
execute function public.klyx_preserve_succeeded_financial_ledger_16_11();

-- ---------------------------------------------------------------------------
-- 3. Split refund terminal success
-- ---------------------------------------------------------------------------

create or replace function public.klyx_preserve_succeeded_split_refund_16_11()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if
    old.status = 'succeeded'
    and new.status is distinct from 'succeeded'
  then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_preserve_succeeded_split_refund_16_11()
  from public, anon, authenticated;
grant execute on function public.klyx_preserve_succeeded_split_refund_16_11()
  to service_role;

drop trigger if exists klyx_preserve_succeeded_split_refund_16_11
  on public.split_booking_payment_refunds;

create trigger klyx_preserve_succeeded_split_refund_16_11
before update on public.split_booking_payment_refunds
for each row
execute function public.klyx_preserve_succeeded_split_refund_16_11();

-- Preserve the existing server-only privilege model explicitly. The migration
-- adds no browser-facing capability.
revoke all privileges on table public.booking_group_cancellation_events
  from public, anon, authenticated;
revoke all privileges on table public.booking_financial_ledger
  from public, anon, authenticated;
revoke all privileges on table public.split_booking_payment_refunds
  from public, anon, authenticated;

grant all privileges on table public.booking_group_cancellation_events
  to service_role;
grant all privileges on table public.booking_financial_ledger
  to service_role;
grant all privileges on table public.split_booking_payment_refunds
  to service_role;

commit;

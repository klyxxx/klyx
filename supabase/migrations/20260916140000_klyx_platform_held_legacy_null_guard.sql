-- KLYX PLATFORM-HELD SETTLEMENT — LEGACY NULL PAYMENT-MODE GUARD
--
-- Legacy bookings created before an explicit checkout mode can keep
-- bookings.payment_mode NULL. PostgreSQL three-valued logic makes
-- `NULL <> 'platform_held'` evaluate to NULL, so the original Phase 2 trigger
-- guards could fall through when a legacy webhook changed payment_status to
-- `paid`. Keep every non-platform-held booking, including NULL legacy rows,
-- outside platform-held settlement reconciliation.

begin;

create or replace function public.klyx_guard_platform_held_booking_economics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.booking_settlements%rowtype;
begin
  if coalesce(new.payment_mode, '') <> 'platform_held'
     or coalesce(new.payment_status, '') <> 'paid' then
    return new;
  end if;

  select *
    into v_settlement
    from public.booking_settlements
   where booking_id = new.id;

  if not found then
    raise exception 'KLYX_PLATFORM_HELD_SETTLEMENT_MISSING';
  end if;

  if coalesce(trim(new.stripe_payment_intent_id), '') !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception 'KLYX_PLATFORM_HELD_PAYMENT_INTENT_REQUIRED';
  end if;

  new.amount_total := v_settlement.gross_amount_cents;
  new.currency := v_settlement.currency;
  new.application_fee_amount := v_settlement.platform_fee_cents;
  new.platform_fee_amount := v_settlement.platform_fee_cents;
  new.provider_amount := v_settlement.provider_amount_cents;

  return new;
end;
$$;

create or replace function public.klyx_mark_platform_held_booking_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if coalesce(new.payment_mode, '') <> 'platform_held'
     or coalesce(new.payment_status, '') <> 'paid'
     or coalesce(old.payment_status, '') = 'paid' then
    return new;
  end if;

  update public.booking_settlements
     set state = case
           when state = 'pending_payment' then 'held'
           else state
         end,
         stripe_checkout_session_id = coalesce(stripe_checkout_session_id, new.stripe_checkout_session_id),
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id, new.stripe_payment_intent_id),
         updated_at = now()
   where booking_id = new.id
     and state in ('pending_payment', 'held');

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'KLYX_PLATFORM_HELD_PAID_SETTLEMENT_NOT_WRITABLE';
  end if;

  return new;
end;
$$;

comment on function public.klyx_guard_platform_held_booking_economics() is
  'NULL-safe platform-held economics guard. Legacy bookings whose payment_mode is NULL or non-platform-held bypass settlement enforcement.';

comment on function public.klyx_mark_platform_held_booking_paid() is
  'NULL-safe platform-held paid reconciliation. Legacy bookings whose payment_mode is NULL or non-platform-held never require a booking_settlements row.';

commit;

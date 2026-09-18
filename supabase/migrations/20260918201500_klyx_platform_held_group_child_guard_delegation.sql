-- KLYX PLATFORM-HELD BOOKING GUARDS — NULL-SAFE GROUP CHILD DELEGATION
--
-- Preserve the post-#803 NULL-safe behavior for legacy/non-platform-held
-- standalone bookings while delegating grouped children to the parent
-- booking_group_settlements control plane.

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
     or coalesce(new.payment_status, '') <> 'paid'
     or new.booking_group_id is not null then
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
     or coalesce(old.payment_status, '') = 'paid'
     or new.booking_group_id is not null then
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
  'NULL-safe standalone platform-held economics guard; grouped children delegate frozen economics to booking_group_settlements.';

comment on function public.klyx_mark_platform_held_booking_paid() is
  'NULL-safe standalone platform-held paid reconciliation; grouped children are reconciled by the parent group settlement.';

commit;

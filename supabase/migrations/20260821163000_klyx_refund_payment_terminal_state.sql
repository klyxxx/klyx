-- KLYX_REFUND_PAYMENT_TERMINAL_STATE_2026
-- A full successful refund is a terminal payment state.
-- This invariant lives in PostgreSQL so every Stripe/API path shares it.

create or replace function public.klyx_enforce_booking_refund_payment_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Never let a late payment-success/failure webhook move a refunded booking
  -- back to paid/failed. Returning NULL skips only that conflicting UPDATE.
  if old.payment_status = 'refunded'
     and new.payment_status is distinct from 'refunded' then
    return null;
  end if;

  -- Stripe can report a successful partial refund. Only a refund covering the
  -- complete canonical booking amount makes payment_status terminal/refunded.
  if new.refund_status = 'succeeded'
     and coalesce(new.amount_total, 0) > 0
     and coalesce(new.refunded_amount_cents, 0) >= new.amount_total then
    new.payment_status := 'refunded';
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_enforce_booking_refund_payment_state()
from public, anon, authenticated;

drop trigger if exists klyx_booking_refund_payment_terminal_state
on public.bookings;

create trigger klyx_booking_refund_payment_terminal_state
before update on public.bookings
for each row
execute function public.klyx_enforce_booking_refund_payment_state();

-- Repair historical rows that were fully refunded before the invariant was
-- introduced. Partial refunds deliberately remain in their prior payment state.
update public.bookings
set payment_status = 'refunded',
    updated_at = now()
where refund_status = 'succeeded'
  and coalesce(amount_total, 0) > 0
  and coalesce(refunded_amount_cents, 0) >= amount_total
  and payment_status is distinct from 'refunded';

-- KLYX_REFUND_PAYMENT_TERMINAL_STATE_2026
-- A full successful refund is a terminal payment state.
--
-- The canonical baseline already protects paid bookings with
-- public.klyx_protect_paid_booking(). Keep that single guard as the source of
-- truth instead of adding a second BEFORE UPDATE trigger whose execution order
-- could conflict with the existing immutability rule.

create or replace function public.klyx_protect_paid_booking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  full_refund_proven boolean;
begin
  full_refund_proven :=
    new.refund_status = 'succeeded'
    and coalesce(old.amount_total, 0) > 0
    and coalesce(new.refunded_amount_cents, 0) >= old.amount_total;

  -- A refunded payment is financially terminal. Other booking fields may still
  -- receive harmless lifecycle/audit updates, but payment_status can never move
  -- back to paid, failed, checkout_created, or any other state.
  if old.payment_status = 'refunded'
     and new.payment_status is distinct from 'refunded' then
    raise exception 'KLYX_BOOKING_ALREADY_REFUNDED';
  end if;

  if old.payment_status = 'paid' then
    -- Preserve the original paid-booking immutability contract. Refund metadata
    -- may change, but the canonical amount/currency and Stripe payment identity
    -- remain frozen forever once payment succeeded.
    if new.amount_total is distinct from old.amount_total
      or new.currency is distinct from old.currency
      or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
      or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
    then
      raise exception 'KLYX_PAID_BOOKING_IMMUTABLE';
    end if;

    if new.payment_status is distinct from 'paid' then
      if not (
        new.payment_status = 'refunded'
        and full_refund_proven
      ) then
        raise exception 'KLYX_BOOKING_ALREADY_PAID';
      end if;
    elsif full_refund_proven then
      -- Existing refund writers update refund_status/refunded_amount_cents while
      -- leaving payment_status=paid. Promote that same atomic UPDATE here so all
      -- single-booking and grouped-child refund paths converge on one invariant.
      new.payment_status := 'refunded';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_protect_paid_booking()
from public, anon, authenticated;
grant execute on function public.klyx_protect_paid_booking()
to service_role;

-- Remove the earlier PR-local experimental trigger if this migration is replayed
-- while iterating locally. Production never received it before merge.
drop trigger if exists klyx_booking_refund_payment_terminal_state
on public.bookings;

-- Repair historical rows that were fully refunded before this invariant was
-- introduced. The replaced canonical guard now explicitly permits exactly this
-- paid -> refunded transition when the stored refund proof is complete.
update public.bookings
set payment_status = 'refunded',
    updated_at = now()
where refund_status = 'succeeded'
  and coalesce(amount_total, 0) > 0
  and coalesce(refunded_amount_cents, 0) >= amount_total
  and payment_status is distinct from 'refunded';

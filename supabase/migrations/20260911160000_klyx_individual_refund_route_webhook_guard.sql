-- KLYX_INDIVIDUAL_REFUND_ROUTE_WEBHOOK_GUARD_2026
-- Prevent a stale HTTP response from stripe.refunds.create() from downgrading
-- terminal refund proof already committed by the signed Stripe webhook.

begin;

-- payment_status=refunded is only reached after the canonical full-refund proof
-- succeeds. Repair any snapshot left inconsistent by the historical route ↔
-- webhook race before installing the stronger guard.
update public.bookings
set refund_status = 'succeeded',
    refunded_amount_cents = greatest(
      coalesce(refunded_amount_cents, 0),
      coalesce(amount_total, 0)
    ),
    refunded_at = coalesce(refunded_at, updated_at, paid_at, now()),
    updated_at = now()
where payment_status = 'refunded'
  and refund_status is distinct from 'succeeded';

-- Extend the existing canonical paid-booking guard rather than adding a second
-- BEFORE UPDATE trigger. Once the webhook has committed payment_status=refunded,
-- preserve the exact terminal refund metadata against any stale route writer.
create or replace function public.klyx_protect_paid_booking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  full_refund_proven boolean;
begin
  if old.payment_status = 'refunded' then
    if new.payment_status is distinct from 'refunded' then
      raise exception 'KLYX_BOOKING_ALREADY_REFUNDED';
    end if;

    new.refund_status := old.refund_status;
    new.stripe_refund_id := old.stripe_refund_id;
    new.refunded_amount_cents := old.refunded_amount_cents;
    new.refunded_at := old.refunded_at;
  end if;

  full_refund_proven :=
    new.refund_status = 'succeeded'
    and coalesce(old.amount_total, 0) > 0
    and coalesce(new.refunded_amount_cents, 0) >= old.amount_total;

  if old.payment_status = 'paid' then
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

comment on function public.klyx_protect_paid_booking() is
  'Preserves paid/refunded booking immutability and prevents stale individual refund route writes from downgrading signed Stripe webhook terminal proof.';

commit;

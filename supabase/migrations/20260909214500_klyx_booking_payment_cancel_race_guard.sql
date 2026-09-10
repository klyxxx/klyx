begin;

-- KLYX_BOOKING_PAYMENT_CANCEL_RACE_GUARD_17_01
--
-- Payment claim and booking lifecycle mutations serialize on the same bookings
-- row. A fresh creating_checkout claim represents an in-flight Stripe side
-- effect and an attached checkout_created session is already payable. Neither
-- state may coexist with a lifecycle exit from accepted.
--
-- A creating_checkout claim older than the claim lease is different: Stripe or
-- the network may have failed before KLYX persisted a session. In that case we
-- allow the lifecycle change, but atomically invalidate the attempt token. Any
-- delayed checkout creator still holding that token can no longer attach its
-- Stripe session and the existing route expires the unpersisted session.

create or replace function public.klyx_guard_individual_booking_payment_cancel_race_17_01()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.booking_group_id is not null
     or old.status is distinct from 'accepted'
     or new.status is not distinct from old.status then
    return new;
  end if;

  if old.payment_status = 'checkout_created' then
    return null;
  end if;

  if old.payment_status = 'creating_checkout' then
    if old.payment_checkout_started_at is not null
       and old.payment_checkout_started_at > now() - interval '2 minutes' then
      return null;
    end if;

    new.payment_status := 'failed';
    new.payment_attempt_token := null;
    new.payment_checkout_started_at := null;
    new.payment_failure_code := 'checkout_claim_stale';
    new.payment_failure_message :=
      'La tentative de paiement a expire avant la creation de la session Stripe.';
    new.payment_failed_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_guard_individual_booking_payment_cancel_race_17_01()
  from public, anon, authenticated;
grant execute on function public.klyx_guard_individual_booking_payment_cancel_race_17_01()
  to service_role;

drop trigger if exists klyx_booking_payment_cancel_race_guard_17_01
  on public.bookings;

create trigger klyx_booking_payment_cancel_race_guard_17_01
before update of status
on public.bookings
for each row
execute function public.klyx_guard_individual_booking_payment_cancel_race_17_01();

comment on function public.klyx_guard_individual_booking_payment_cancel_race_17_01() is
  'KLYX 17.01: prevents accepted lifecycle exit while an individual Stripe checkout is active and invalidates stale creating-checkout claims before allowing lifecycle changes.';

commit;

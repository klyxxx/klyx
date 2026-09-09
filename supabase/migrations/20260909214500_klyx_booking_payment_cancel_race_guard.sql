begin;

-- KLYX_BOOKING_PAYMENT_CANCEL_RACE_GUARD_17_01
--
-- Individual booking payment claims and booking cancellation both mutate the
-- same bookings row. The payment claim already locks that row and transitions
-- payment_status to creating_checkout before Stripe session creation. Once a
-- checkout is being created or has been handed to the client, leaving the
-- accepted lifecycle would make that Stripe session payable for a booking that
-- KLYX considers cancelled/completed.
--
-- Returning NULL from this BEFORE UPDATE trigger skips the competing lifecycle
-- mutation. PostgREST therefore returns no updated row and the existing booking
-- status API answers 409 instead of committing an impossible transition.

create or replace function public.klyx_guard_individual_booking_payment_cancel_race_17_01()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.booking_group_id is null
     and old.status = 'accepted'
     and new.status is distinct from old.status
     and coalesce(old.payment_status, '') in ('creating_checkout', 'checkout_created') then
    return null;
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
  'KLYX 17.01: serializes individual booking lifecycle changes against creating/open Stripe checkout state so a payable session cannot outlive accepted booking status.';

commit;

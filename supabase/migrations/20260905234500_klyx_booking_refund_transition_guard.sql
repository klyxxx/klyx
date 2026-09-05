-- KLYX_BOOKING_REFUND_TRANSITION_GUARD_16_21
-- Keep booking lifecycle and refund lifecycle monotone under concurrent
-- service-role writes. A refund may only be claimed while the booking is
-- still accepted. Once a refund is processing/succeeded, mission progress
-- cannot advance; only the cancellation transition may change lifecycle state.

create or replace function public.klyx_guard_booking_refund_transition_16_21()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.refund_status = 'processing'
     and old.refund_status is distinct from 'processing'
     and old.status is distinct from 'accepted' then
    raise exception 'KLYX_BOOKING_REFUND_STALE_STATUS'
      using errcode = 'P0001';
  end if;

  if coalesce(old.refund_status, '') in ('processing', 'succeeded')
     or coalesce(new.refund_status, '') in ('processing', 'succeeded') then
    if new.status is distinct from old.status
       and new.status is distinct from 'cancelled' then
      raise exception 'KLYX_BOOKING_REFUND_STATUS_CONFLICT'
        using errcode = 'P0001';
    end if;

    if new.service_status is distinct from old.service_status
       and new.status is distinct from 'cancelled' then
      raise exception 'KLYX_BOOKING_REFUND_TRACKING_CONFLICT'
        using errcode = 'P0001';
    end if;

    if new.provider_finished_at is distinct from old.provider_finished_at
       and new.status is distinct from 'cancelled' then
      raise exception 'KLYX_BOOKING_REFUND_TRACKING_CONFLICT'
        using errcode = 'P0001';
    end if;

    if new.client_confirmed_at is distinct from old.client_confirmed_at
       and new.status is distinct from 'cancelled' then
      raise exception 'KLYX_BOOKING_REFUND_TRACKING_CONFLICT'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_guard_booking_refund_transition_16_21()
  from public, anon, authenticated;
grant execute on function public.klyx_guard_booking_refund_transition_16_21()
  to service_role;

drop trigger if exists klyx_booking_refund_transition_guard_16_21
  on public.bookings;

create trigger klyx_booking_refund_transition_guard_16_21
before update of status, service_status, refund_status,
  provider_finished_at, client_confirmed_at
on public.bookings
for each row
execute function public.klyx_guard_booking_refund_transition_16_21();

comment on function public.klyx_guard_booking_refund_transition_16_21() is
  'KLYX 16.21: blocks stale refund claims and lifecycle/tracking progress while a booking refund is processing or succeeded.';

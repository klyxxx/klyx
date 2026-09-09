-- KLYX_BOOKING_STATUS_HISTORY_ATOMICITY_17_01
--
-- A booking lifecycle transition and its immutable status event must commit or
-- roll back together. Single-booking routes historically updated `bookings`
-- first and inserted `booking_status_events` afterwards, so a transient event
-- write failure could leave a real lifecycle state without its audit fact.
--
-- Grouped bookings keep their dedicated transactional lifecycle functions and
-- are deliberately excluded from this trigger.

begin;

create or replace function public.klyx_dedupe_booking_status_event_17_01()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.booking_status_events existing
    where existing.booking_id = new.booking_id
      and existing.previous_status is not distinct from new.previous_status
      and existing.new_status = new.new_status
  ) then
    return null;
  end if;

  return new;
end;
$$;

revoke all on function public.klyx_dedupe_booking_status_event_17_01()
  from public, anon, authenticated;
grant execute on function public.klyx_dedupe_booking_status_event_17_01()
  to service_role;

drop trigger if exists klyx_dedupe_booking_status_event_17_01
  on public.booking_status_events;

create trigger klyx_dedupe_booking_status_event_17_01
before insert on public.booking_status_events
for each row
execute function public.klyx_dedupe_booking_status_event_17_01();

create or replace function public.klyx_record_single_booking_status_event_17_01()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid;
  v_previous_status text;
  v_note text;
begin
  -- Booking groups own their status history through dedicated group lifecycle
  -- functions. Do not duplicate or reinterpret those events here.
  if new.booking_group_id is not null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_actor_id := new.parent_id;
    v_previous_status := null;
    v_note := 'Réservation créée.';
  else
    if new.status is not distinct from old.status then
      return new;
    end if;

    v_previous_status := old.status;

    case new.status
      when 'accepted' then
        v_actor_id := coalesce(new.provider_id, new.babysitter_id);
        v_note := new.provider_response;
      when 'rejected' then
        v_actor_id := coalesce(new.provider_id, new.babysitter_id);
        v_note := new.provider_response;
      when 'cancelled' then
        v_actor_id := new.cancelled_by;
        v_note := new.cancellation_reason;
        if coalesce(new.refund_status, '') in ('processing', 'succeeded') then
          v_note := concat_ws(
            ' ',
            nullif(trim(coalesce(v_note, '')), ''),
            'Remboursement Stripe demandé automatiquement.'
          );
        end if;
      when 'completed' then
        v_actor_id := new.parent_id;
        v_note := 'Mission terminée et confirmée par le client.';
      else
        -- The table constraint remains the final authority for the status
        -- vocabulary. Keep an audit fact even if another server-owned path
        -- introduces a supported status transition later.
        v_actor_id := null;
        v_note := null;
    end case;
  end if;

  insert into public.booking_status_events (
    booking_id,
    actor_id,
    previous_status,
    new_status,
    note
  ) values (
    new.id,
    v_actor_id,
    v_previous_status,
    new.status,
    v_note
  );

  return new;
end;
$$;

revoke all on function public.klyx_record_single_booking_status_event_17_01()
  from public, anon, authenticated;
grant execute on function public.klyx_record_single_booking_status_event_17_01()
  to service_role;

drop trigger if exists klyx_single_booking_status_event_on_insert_17_01
  on public.bookings;
create trigger klyx_single_booking_status_event_on_insert_17_01
after insert on public.bookings
for each row
when (new.booking_group_id is null)
execute function public.klyx_record_single_booking_status_event_17_01();

drop trigger if exists klyx_single_booking_status_event_on_update_17_01
  on public.bookings;
create trigger klyx_single_booking_status_event_on_update_17_01
after update of status on public.bookings
for each row
when (
  new.booking_group_id is null
  and old.status is distinct from new.status
)
execute function public.klyx_record_single_booking_status_event_17_01();

comment on function public.klyx_record_single_booking_status_event_17_01() is
  'KLYX 17.01: records non-group booking lifecycle history in the same DB transaction as booking creation/status mutation.';

commit;

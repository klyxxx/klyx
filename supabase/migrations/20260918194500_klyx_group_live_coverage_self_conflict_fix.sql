-- KLYX GROUP LIVE COVERAGE — SELF-CONFLICT FIX
--
-- klyx_provider_group_decision marks the current group's children accepted
-- before the booking_groups row transitions to accepted. The live-coverage
-- trigger must therefore exclude only those same-group children while still
-- rejecting every overlapping accepted/completed booking from another group
-- or a standalone booking.

begin;

create or replace function public.klyx_group_live_coverage_check(
  p_request_id uuid,
  p_provider_profile_id uuid,
  p_user_service_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_service record;
  v_slot record;

  v_actual_slot_count integer := 0;
  v_covered_count integer := 0;

  v_available boolean := false;

  v_current_group_id uuid := null;
  v_conflict_booking_id uuid := null;
begin
  select
    r.id,
    r.service_id,
    r.request_mode,
    r.slot_count,
    r.status
  into v_request
  from public.market_service_requests r
  where r.id = p_request_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_REQUEST_NOT_FOUND',
      'coverageCount', 0,
      'slotCount', 0
    );
  end if;

  if v_request.request_mode <> 'multi_slot' then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_NOT_MULTI_SLOT',
      'coverageCount', 0,
      'slotCount', coalesce(v_request.slot_count, 0)
    );
  end if;

  if coalesce(v_request.slot_count, 0) < 2 then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_INVALID_SLOT_COUNT',
      'coverageCount', 0,
      'slotCount', coalesce(v_request.slot_count, 0)
    );
  end if;

  select
    us.id,
    us.user_id,
    us.service_id,
    us.active,
    us.provider_enabled
  into v_service
  from public.user_services us
  where us.id = p_user_service_id
    and us.user_id = p_provider_profile_id
    and us.service_id = v_request.service_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_SERVICE_NOT_FOUND',
      'coverageCount', 0,
      'slotCount', v_request.slot_count
    );
  end if;

  if coalesce(v_service.active, false) = false
     or coalesce(v_service.provider_enabled, false) = false then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_SERVICE_INACTIVE',
      'coverageCount', 0,
      'slotCount', v_request.slot_count
    );
  end if;

  select count(*)
  into v_actual_slot_count
  from public.market_service_request_slots s
  where s.market_request_id = p_request_id;

  if v_actual_slot_count <> v_request.slot_count then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_SLOT_COUNT_CHANGED',
      'coverageCount', 0,
      'slotCount', v_actual_slot_count,
      'expectedSlotCount', v_request.slot_count
    );
  end if;

  -- The booking group already exists while the BEFORE UPDATE acceptance guard
  -- runs. Resolve it from the same canonical request/provider/service tuple.
  select g.id
  into v_current_group_id
  from public.booking_groups g
  where g.market_request_id = p_request_id
    and g.provider_profile_id = p_provider_profile_id
    and g.user_service_id = p_user_service_id
    and g.status in ('pending_provider', 'accepted')
  order by g.created_at desc
  limit 1;

  for v_slot in
    select
      s.id,
      s.position,
      s.requested_date,
      s.start_time,
      s.end_time
    from public.market_service_request_slots s
    where s.market_request_id = p_request_id
    order by s.position asc
  loop
    if v_slot.requested_date is null
       or v_slot.start_time is null
       or v_slot.end_time is null
       or v_slot.end_time <= v_slot.start_time then
      return jsonb_build_object(
        'ok', false,
        'code', 'GROUP_LIVE_SLOT_TIME_INVALID',
        'coverageCount', v_covered_count,
        'slotCount', v_request.slot_count,
        'failedPosition', v_slot.position
      );
    end if;

    select exists (
      select 1
      from public.availability_slots a
      where a.user_service_id = p_user_service_id
        and a.is_active = true
        and a.day_of_week = extract(dow from v_slot.requested_date)::integer
        and a.start_time <= v_slot.start_time
        and a.end_time >= v_slot.end_time
    )
    into v_available;

    if coalesce(v_available, false) = false then
      return jsonb_build_object(
        'ok', false,
        'code', 'GROUP_LIVE_OUTSIDE_AVAILABILITY',
        'coverageCount', v_covered_count,
        'slotCount', v_request.slot_count,
        'failedPosition', v_slot.position,
        'date', v_slot.requested_date
      );
    end if;

    select b.id
    into v_conflict_booking_id
    from public.bookings b
    where (
      b.provider_id = p_provider_profile_id
      or b.babysitter_id = p_provider_profile_id
    )
      and b.booking_group_id is distinct from v_current_group_id
      and b.booking_date = v_slot.requested_date
      and b.status in ('accepted', 'completed')
      and b.start_time < v_slot.end_time
      and b.end_time > v_slot.start_time
    order by b.booking_date asc, b.start_time asc
    limit 1;

    if v_conflict_booking_id is not null then
      return jsonb_build_object(
        'ok', false,
        'code', 'GROUP_LIVE_BOOKING_CONFLICT',
        'coverageCount', v_covered_count,
        'slotCount', v_request.slot_count,
        'failedPosition', v_slot.position,
        'conflictBookingId', v_conflict_booking_id
      );
    end if;

    v_covered_count := v_covered_count + 1;
    v_conflict_booking_id := null;
  end loop;

  if v_covered_count <> v_request.slot_count then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_INCOMPLETE',
      'coverageCount', v_covered_count,
      'slotCount', v_request.slot_count
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'coverageCount', v_covered_count,
    'slotCount', v_request.slot_count,
    'fullCoverage', true,
    'checkedAt', now()
  );
end;
$$;

revoke all
on function public.klyx_group_live_coverage_check(uuid, uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.klyx_group_live_coverage_check(uuid, uuid, uuid)
to service_role;

comment on function public.klyx_group_live_coverage_check(uuid, uuid, uuid) is
  'Validates current multi-slot availability and external booking conflicts while excluding only the current group children during atomic provider acceptance.';

commit;

-- KLYX_GROUP_ATOMIC_LIVE_COVERAGE_12_96
--
-- Objectif :
-- une offre peut avoir ete validee N/N,
-- mais le planning du prestataire peut changer
-- avant la selection finale du client.
--
-- La base refait donc la verification exactement
-- au moment de INSERT booking_groups.
--
-- Aucun booking enfant, paiement ou action automatique
-- n est cree si la couverture n est plus complete.

create or replace function
public.klyx_group_live_coverage_check(
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

  v_conflict_booking_id uuid := null;
begin
  -- =========================================================
  -- 1. Demande multi-slot
  -- =========================================================

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

  if
    v_request.request_mode <> 'multi_slot'
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_NOT_MULTI_SLOT',
      'coverageCount', 0,
      'slotCount', coalesce(v_request.slot_count, 0)
    );
  end if;

  if
    coalesce(v_request.slot_count, 0) < 2
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_INVALID_SLOT_COUNT',
      'coverageCount', 0,
      'slotCount', coalesce(v_request.slot_count, 0)
    );
  end if;

  -- =========================================================
  -- 2. Le service prestataire doit encore etre actif
  -- =========================================================

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

  if
    coalesce(v_service.active, false) = false
    or
    coalesce(v_service.provider_enabled, false) = false
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_SERVICE_INACTIVE',
      'coverageCount', 0,
      'slotCount', v_request.slot_count
    );
  end if;

  -- =========================================================
  -- 3. Le snapshot des slots doit toujours etre canonique
  -- =========================================================

  select count(*)
  into v_actual_slot_count
  from public.market_service_request_slots s
  where s.market_request_id = p_request_id;

  if
    v_actual_slot_count <> v_request.slot_count
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_LIVE_SLOT_COUNT_CHANGED',
      'coverageCount', 0,
      'slotCount', v_actual_slot_count,
      'expectedSlotCount', v_request.slot_count
    );
  end if;

  -- =========================================================
  -- 4. Verification slot par slot
  --
  -- 12.85 interdit deja les groupes overnight :
  -- end_time doit donc rester strictement > start_time ici.
  -- =========================================================

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
    if
      v_slot.requested_date is null
      or
      v_slot.start_time is null
      or
      v_slot.end_time is null
      or
      v_slot.end_time <= v_slot.start_time
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'GROUP_LIVE_SLOT_TIME_INVALID',
        'coverageCount', v_covered_count,
        'slotCount', v_request.slot_count,
        'failedPosition', v_slot.position
      );
    end if;

    -- =======================================================
    -- Disponibilite recurrante LIVE
    --
    -- Postgres extract(dow):
    -- dimanche = 0 ... samedi = 6
    -- Meme convention que le planning KLYX.
    -- =======================================================

    select exists (
      select 1
      from public.availability_slots a
      where a.user_service_id = p_user_service_id
        and a.is_active = true
        and a.day_of_week =
          extract(
            dow
            from v_slot.requested_date
          )::integer
        and a.start_time <= v_slot.start_time
        and a.end_time >= v_slot.end_time
    )
    into v_available;

    if
      coalesce(v_available, false) = false
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'GROUP_LIVE_OUTSIDE_AVAILABILITY',
        'coverageCount', v_covered_count,
        'slotCount', v_request.slot_count,
        'failedPosition', v_slot.position,
        'date', v_slot.requested_date
      );
    end if;

    -- =======================================================
    -- Conflits reels LIVE
    --
    -- pending n est volontairement pas un hard conflict :
    -- le prestataire doit encore accepter une mission pending.
    -- accepted/completed restent les hard conflicts KLYX.
    -- =======================================================

    select b.id
    into v_conflict_booking_id
    from public.bookings b
    where (
      b.provider_id = p_provider_profile_id
      or
      b.babysitter_id = p_provider_profile_id
    )
      and b.booking_date = v_slot.requested_date
      and b.status in (
        'accepted',
        'completed'
      )
      and b.start_time < v_slot.end_time
      and b.end_time > v_slot.start_time
    order by b.booking_date asc, b.start_time asc
    limit 1;

    if
      v_conflict_booking_id is not null
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'GROUP_LIVE_BOOKING_CONFLICT',
        'coverageCount', v_covered_count,
        'slotCount', v_request.slot_count,
        'failedPosition', v_slot.position,
        'conflictBookingId', v_conflict_booking_id
      );
    end if;

    v_covered_count :=
      v_covered_count + 1;

    v_conflict_booking_id :=
      null;
  end loop;

  -- =========================================================
  -- 5. Couverture finale N/N
  -- =========================================================

  if
    v_covered_count <> v_request.slot_count
  then
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
on function
public.klyx_group_live_coverage_check(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated;

grant execute
on function
public.klyx_group_live_coverage_check(
  uuid,
  uuid,
  uuid
)
to service_role;

-- ===========================================================
-- TRIGGER
-- ===========================================================

create or replace function
public.klyx_enforce_group_live_coverage_12_96()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_code text;
begin
  v_result :=
    public.klyx_group_live_coverage_check(
      new.market_request_id,
      new.provider_profile_id,
      new.user_service_id
    );

  if
    coalesce(
      (v_result ->> 'ok')::boolean,
      false
    ) = false
  then
    v_code :=
      coalesce(
        v_result ->> 'code',
        'GROUP_LIVE_COVERAGE_REQUIRED'
      );

    raise exception
      'KLYX_GROUP_LIVE_COVERAGE_REQUIRED:%',
      v_code
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all
on function
public.klyx_enforce_group_live_coverage_12_96()
from public, anon, authenticated;

drop trigger if exists
  klyx_booking_group_live_coverage_12_96
on public.booking_groups;

create trigger
  klyx_booking_group_live_coverage_12_96
before insert
on public.booking_groups
for each row
execute function
  public.klyx_enforce_group_live_coverage_12_96();

comment on function
public.klyx_group_live_coverage_check(
  uuid,
  uuid,
  uuid
)
is
'KLYX 12.96 - revalidation atomique des disponibilites et conflits avant creation booking group.';

comment on trigger
klyx_booking_group_live_coverage_12_96
on public.booking_groups
is
'KLYX 12.96 - empeche la creation d un groupe si le prestataire ne couvre plus tous les creneaux.';
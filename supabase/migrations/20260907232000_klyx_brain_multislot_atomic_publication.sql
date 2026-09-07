-- KLYX BRAIN MULTI-SLOT ATOMIC PUBLICATION
--
-- A Brain confirmation must never expose a market parent without its frozen
-- provider candidate snapshot and complete slot set. This server-only RPC
-- commits parent + candidates + slots in one PostgreSQL transaction.

begin;

create or replace function public.klyx_create_brain_multi_slot_market_request(
  p_client_profile_id uuid,
  p_service_id uuid,
  p_title text,
  p_description text,
  p_city text,
  p_requested_date date,
  p_requested_time time without time zone,
  p_budget_total numeric,
  p_slot_count integer,
  p_confirmation_id uuid,
  p_slots jsonb,
  p_candidates jsonb
)
returns table (
  request_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_valid_slot_positions integer;
  v_distinct_slot_positions integer;
begin
  if p_client_profile_id is null
    or p_service_id is null
    or p_confirmation_id is null
    or p_requested_date is null
    or p_requested_time is null
    or p_slot_count is null
    or p_slot_count < 1
    or p_slot_count > 20
  then
    raise exception 'KLYX_MULTI_SLOT_ATOMIC_INVALID_PARENT'
      using errcode = '22023';
  end if;

  if coalesce(jsonb_typeof(p_slots), '') <> 'array' then
    raise exception 'KLYX_MULTI_SLOT_ATOMIC_INVALID_SLOTS'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_slots) <> p_slot_count then
    raise exception 'KLYX_MULTI_SLOT_ATOMIC_INVALID_SLOTS'
      using errcode = '22023';
  end if;

  if coalesce(jsonb_typeof(p_candidates), '') <> 'array' then
    raise exception 'KLYX_MULTI_SLOT_ATOMIC_INVALID_CANDIDATES'
      using errcode = '22023';
  end if;

  select
    count(*) filter (
      where slot.position between 1 and p_slot_count
    ),
    count(distinct slot.position)
  into
    v_valid_slot_positions,
    v_distinct_slot_positions
  from jsonb_to_recordset(p_slots) as slot(
    position integer
  );

  if v_valid_slot_positions <> p_slot_count
    or v_distinct_slot_positions <> p_slot_count
  then
    raise exception 'KLYX_MULTI_SLOT_ATOMIC_SLOT_POSITIONS_INVALID'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_candidates) as candidate(
      coverage_count integer,
      slot_count integer,
      full_coverage boolean
    )
    where candidate.slot_count is distinct from p_slot_count
      or candidate.coverage_count is null
      or candidate.coverage_count < 0
      or candidate.coverage_count > p_slot_count
      or candidate.full_coverage is null
      or candidate.full_coverage is distinct from (
        candidate.coverage_count = p_slot_count
      )
  ) then
    raise exception 'KLYX_MULTI_SLOT_ATOMIC_CANDIDATE_INVALID'
      using errcode = '22023';
  end if;

  begin
    insert into public.market_service_requests (
      client_profile_id,
      service_id,
      title,
      description,
      city,
      requested_date,
      requested_time,
      budget_max,
      budget_total,
      request_mode,
      slot_count,
      prefer_single_provider,
      status,
      brain_confirmation_message_id
    )
    values (
      p_client_profile_id,
      p_service_id,
      p_title,
      p_description,
      p_city,
      p_requested_date,
      p_requested_time,
      p_budget_total,
      p_budget_total,
      'multi_slot',
      p_slot_count,
      true,
      'open',
      p_confirmation_id
    )
    returning id into v_request_id;
  exception
    when unique_violation then
      select request.id
      into v_request_id
      from public.market_service_requests as request
      where request.brain_confirmation_message_id = p_confirmation_id
        and request.client_profile_id = p_client_profile_id
        and request.service_id = p_service_id
        and request.request_mode = 'multi_slot'
        and request.slot_count = p_slot_count
      limit 1;

      if v_request_id is null then
        raise;
      end if;

      return query
      select v_request_id, false;
      return;
  end;

  insert into public.market_request_provider_candidates (
    market_request_id,
    provider_profile_id,
    coverage_count,
    slot_count,
    full_coverage
  )
  select
    v_request_id,
    candidate.provider_profile_id,
    candidate.coverage_count,
    candidate.slot_count,
    candidate.full_coverage
  from jsonb_to_recordset(p_candidates) as candidate(
    provider_profile_id uuid,
    coverage_count integer,
    slot_count integer,
    full_coverage boolean
  );

  insert into public.market_service_request_slots (
    market_request_id,
    position,
    requested_date,
    start_time,
    end_time,
    budget_max,
    duration_minutes
  )
  select
    v_request_id,
    slot.position,
    slot.requested_date,
    slot.start_time,
    slot.end_time,
    slot.budget_max,
    slot.duration_minutes
  from jsonb_to_recordset(p_slots) as slot(
    position integer,
    requested_date date,
    start_time time without time zone,
    end_time time without time zone,
    budget_max numeric,
    duration_minutes integer
  );

  return query
  select v_request_id, true;
end;
$$;

revoke all
on function public.klyx_create_brain_multi_slot_market_request(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  time without time zone,
  numeric,
  integer,
  uuid,
  jsonb,
  jsonb
)
from public;

revoke execute
on function public.klyx_create_brain_multi_slot_market_request(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  time without time zone,
  numeric,
  integer,
  uuid,
  jsonb,
  jsonb
)
from anon, authenticated;

grant execute
on function public.klyx_create_brain_multi_slot_market_request(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  time without time zone,
  numeric,
  integer,
  uuid,
  jsonb,
  jsonb
)
to service_role;

comment on function public.klyx_create_brain_multi_slot_market_request(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  time without time zone,
  numeric,
  integer,
  uuid,
  jsonb,
  jsonb
) is
  'Server-only atomic Brain multi-slot market publication. Commits parent, frozen candidates, and slots together; confirmation replays return the already committed request.';

do $$
declare
  function_signature text :=
    'public.klyx_create_brain_multi_slot_market_request(uuid,uuid,text,text,text,date,time without time zone,numeric,integer,uuid,jsonb,jsonb)';
  function_oid regprocedure;
  role_name text;
begin
  function_oid := to_regprocedure(function_signature);

  if function_oid is null then
    raise exception
      'KLYX_MULTI_SLOT_ATOMIC_FUNCTION_MISSING:%',
      function_signature
      using errcode = 'P0001';
  end if;

  foreach role_name in array array['anon', 'authenticated']
  loop
    if has_function_privilege(
      role_name,
      function_oid,
      'EXECUTE'
    ) then
      raise exception
        'KLYX_MULTI_SLOT_ATOMIC_EXECUTE_LEAK:role=% function=%',
        role_name,
        function_signature
        using errcode = 'P0001';
    end if;
  end loop;

  if not has_function_privilege(
    'service_role',
    function_oid,
    'EXECUTE'
  ) then
    raise exception
      'KLYX_MULTI_SLOT_ATOMIC_SERVICE_ROLE_EXECUTE_MISSING:function=%',
      function_signature
      using errcode = 'P0001';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;

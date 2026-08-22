-- KLYX explicit client-agent booking confirmation.
--
-- Search/provider choice may be automatic, but a booking is created only after
-- an authenticated client explicitly confirms the persisted agent plan.
-- The booking is linked back to the plan so retries and crash recovery cannot
-- duplicate an agent-originated reservation. Payment remains a separate,
-- explicit user action.

begin;

alter table public.client_agent_plans
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

alter table public.bookings
  add column if not exists agent_plan_id uuid references public.client_agent_plans(id) on delete set null;

create unique index if not exists bookings_agent_plan_unique_idx
  on public.bookings(agent_plan_id)
  where agent_plan_id is not null;

create index if not exists client_agent_plans_booking_idx
  on public.client_agent_plans(booking_id)
  where booking_id is not null;

alter table public.client_agent_plan_events
  drop constraint if exists client_agent_plan_events_type_check;
alter table public.client_agent_plan_events
  add constraint client_agent_plan_events_type_check check (
    event_type in (
      'search_started',
      'search_succeeded',
      'provider_selected',
      'confirmation_required',
      'booking_confirmation_granted',
      'booking_created',
      'execution_failed'
    )
  );

create or replace function public.klyx_claim_client_agent_booking_confirmation(
  p_plan_id uuid,
  p_profile_id uuid
)
returns table(action text, revision integer, booking_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.client_agent_plans%rowtype;
  v_existing_booking_id uuid;
  v_revision integer;
begin
  select *
    into v_plan
  from public.client_agent_plans
  where id = p_plan_id
    and profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'KLYX_AGENT_PLAN_NOT_FOUND';
  end if;

  if v_plan.plan_status in ('cancelled', 'completed') then
    return query select 'closed'::text, v_plan.execution_revision, v_plan.booking_id;
    return;
  end if;

  if v_plan.booking_id is not null then
    return query select 'reuse'::text, v_plan.execution_revision, v_plan.booking_id;
    return;
  end if;

  select b.id
    into v_existing_booking_id
  from public.bookings b
  where b.agent_plan_id = p_plan_id
    and b.parent_id = p_profile_id
  limit 1;

  if v_existing_booking_id is not null then
    update public.client_agent_plans
    set
      booking_id = v_existing_booking_id,
      execution_status = 'waiting_confirmation',
      next_action = 'pay',
      next_action_href = '/bookings/' || v_existing_booking_id::text,
      last_execution_code = 'KLYX_AGENT_BOOKING_RECOVERED',
      last_execution_at = now(),
      updated_at = now()
    where id = p_plan_id
      and profile_id = p_profile_id;

    return query select 'reuse'::text, v_plan.execution_revision, v_existing_booking_id;
    return;
  end if;

  if
    v_plan.selected_provider_id is null
    or v_plan.selected_user_service_id is null
    or v_plan.service_slug is null
    or v_plan.requested_day is null
    or v_plan.requested_time is null
    or v_plan.next_action is distinct from 'book'
  then
    return query select 'invalid'::text, v_plan.execution_revision, null::uuid;
    return;
  end if;

  if
    v_plan.execution_status = 'running'
    and v_plan.last_execution_at is not null
    and v_plan.last_execution_at > now() - interval '2 minutes'
  then
    return query select 'busy'::text, v_plan.execution_revision, null::uuid;
    return;
  end if;

  v_revision := v_plan.execution_revision + 1;

  update public.client_agent_plans
  set
    execution_status = 'running',
    execution_revision = v_revision,
    last_execution_code = null,
    last_execution_at = now(),
    updated_at = now()
  where id = p_plan_id
    and profile_id = p_profile_id;

  return query select 'create'::text, v_revision, null::uuid;
end;
$$;

alter function public.klyx_claim_client_agent_booking_confirmation(uuid, uuid)
  owner to postgres;
revoke all on function public.klyx_claim_client_agent_booking_confirmation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.klyx_claim_client_agent_booking_confirmation(uuid, uuid)
  to service_role;

commit;

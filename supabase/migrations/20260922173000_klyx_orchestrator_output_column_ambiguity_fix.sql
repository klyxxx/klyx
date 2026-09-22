begin;

-- Mission 19 runtime hardening.
--
-- PL/pgSQL RETURNS TABLE output columns are variables in the function scope.
-- The orchestrator functions return workflow_id/version, so unqualified table
-- references with those names can be ambiguous at runtime. Keep the public RPC
-- contract unchanged and qualify every conflicting table reference explicitly.

create or replace function public.klyx_transition_workflow(
  p_workflow_id uuid,
  p_account_id uuid,
  p_expected_version bigint,
  p_to_step text,
  p_event_type text,
  p_actor_type text,
  p_payload jsonb default '{}'::jsonb
)
returns table (
  workflow_id uuid,
  mode text,
  current_step text,
  status text,
  version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow public.klyx_workflows%rowtype;
  v_allowed boolean := false;
  v_next_ordinal bigint;
begin
  if p_actor_type not in ('assistant', 'user', 'server', 'system', 'operator') then
    raise exception 'KLYX_WORKFLOW_ACTOR_INVALID';
  end if;

  select w.*
    into v_workflow
    from public.klyx_workflows as w
   where w.id = p_workflow_id
     and w.account_id = p_account_id
   for update;

  if not found then
    raise exception 'KLYX_WORKFLOW_NOT_FOUND';
  end if;

  if v_workflow.version <> p_expected_version then
    raise exception 'KLYX_WORKFLOW_VERSION_CONFLICT';
  end if;

  if v_workflow.status in ('completed', 'cancelled') then
    raise exception 'KLYX_WORKFLOW_TERMINAL';
  end if;

  if v_workflow.mode = 'request' then
    v_allowed := case v_workflow.current_step
      when 'intention' then p_to_step = 'comprehension'
      when 'comprehension' then p_to_step in ('plan', 'intention')
      when 'plan' then p_to_step in ('search', 'comprehension')
      when 'search' then p_to_step in ('matching', 'plan')
      when 'matching' then p_to_step in ('quote', 'search')
      when 'quote' then p_to_step in ('negotiation_confirmation', 'matching')
      when 'negotiation_confirmation' then p_to_step in ('booking', 'quote', 'matching')
      when 'booking' then p_to_step in ('payment', 'negotiation_confirmation')
      when 'payment' then p_to_step in ('execution', 'incident')
      when 'execution' then p_to_step in ('tracking', 'incident')
      when 'tracking' then p_to_step in ('incident', 'closure')
      when 'incident' then p_to_step in ('refund_replacement', 'tracking')
      when 'refund_replacement' then p_to_step in ('tracking', 'closure')
      else false
    end;
  else
    v_allowed := case v_workflow.current_step
      when 'skill' then p_to_step = 'opportunities'
      when 'opportunities' then p_to_step in ('eligibility', 'skill')
      when 'eligibility' then p_to_step in ('proposal', 'opportunities')
      when 'proposal' then p_to_step in ('acceptance', 'opportunities')
      when 'acceptance' then p_to_step in ('mission', 'proposal')
      when 'mission' then p_to_step = 'settlement'
      else false
    end;
  end if;

  if not v_allowed then
    raise exception 'KLYX_WORKFLOW_TRANSITION_INVALID:%->%',
      v_workflow.current_step, p_to_step;
  end if;

  select coalesce(max(s.ordinal), 0) + 1
    into v_next_ordinal
    from public.klyx_workflow_steps as s
   where s.workflow_id = v_workflow.id;

  update public.klyx_workflow_steps as s
     set exited_at = coalesce(s.exited_at, now())
   where s.workflow_id = v_workflow.id
     and s.exited_at is null;

  update public.klyx_workflows as w
     set current_step = p_to_step,
         status = case
           when v_workflow.mode = 'request' and p_to_step = 'closure'
             then 'completed'
           else 'active'
         end,
         version = w.version + 1,
         completed_at = case
           when v_workflow.mode = 'request' and p_to_step = 'closure'
             then coalesce(w.completed_at, now())
           else w.completed_at
         end,
         updated_at = now()
   where w.id = v_workflow.id
   returning w.* into v_workflow;

  insert into public.klyx_workflow_steps (
    workflow_id,
    step,
    ordinal,
    metadata
  )
  values (
    v_workflow.id,
    p_to_step,
    v_next_ordinal,
    coalesce(p_payload, '{}'::jsonb)
  );

  insert into public.klyx_workflow_events (
    workflow_id,
    account_id,
    event_type,
    actor_type,
    step,
    workflow_version,
    payload
  )
  values (
    v_workflow.id,
    v_workflow.account_id,
    left(coalesce(nullif(trim(p_event_type), ''), 'workflow_transition'), 120),
    p_actor_type,
    p_to_step,
    v_workflow.version,
    coalesce(p_payload, '{}'::jsonb)
  );

  return query
  select
    v_workflow.id,
    v_workflow.mode,
    v_workflow.current_step,
    v_workflow.status,
    v_workflow.version;
end;
$$;

alter function public.klyx_transition_workflow(
  uuid, uuid, bigint, text, text, text, jsonb
) owner to postgres;

create or replace function public.klyx_complete_settlement_workflow(
  p_workflow_id uuid,
  p_account_id uuid,
  p_expected_version bigint,
  p_event_type text default 'settlement_completed',
  p_actor_type text default 'server',
  p_payload jsonb default '{}'::jsonb
)
returns table (
  workflow_id uuid,
  mode text,
  current_step text,
  status text,
  version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow public.klyx_workflows%rowtype;
  v_booking_id uuid;
  v_booking record;
  v_settlement public.booking_settlements%rowtype;
begin
  if p_actor_type not in ('server', 'system', 'operator') then
    raise exception 'KLYX_WORKFLOW_COMPLETION_ACTOR_INVALID';
  end if;

  select w.*
    into v_workflow
    from public.klyx_workflows as w
   where w.id = p_workflow_id
     and w.account_id = p_account_id
   for update;

  if not found then
    raise exception 'KLYX_WORKFLOW_NOT_FOUND';
  end if;

  if v_workflow.version <> p_expected_version then
    raise exception 'KLYX_WORKFLOW_VERSION_CONFLICT';
  end if;

  if v_workflow.mode <> 'earn' or v_workflow.current_step <> 'settlement' then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_COMPLETION_INVALID';
  end if;

  if v_workflow.status not in ('active', 'waiting') then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_NOT_COMPLETABLE';
  end if;

  begin
    v_booking_id := nullif(
      trim(coalesce(p_payload ->> 'booking_id', '')),
      ''
    )::uuid;
  exception
    when invalid_text_representation then
      raise exception 'KLYX_WORKFLOW_SETTLEMENT_BOOKING_INVALID';
  end;

  if v_booking_id is null then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_BOOKING_REQUIRED';
  end if;

  select
    b.id,
    b.status,
    b.payment_status,
    b.provider_id,
    b.babysitter_id
    into v_booking
    from public.bookings as b
   where b.id = v_booking_id
   for share;

  if not found
     or coalesce(v_booking.provider_id, v_booking.babysitter_id)
          is distinct from v_workflow.profile_id
     or coalesce(v_booking.status, '') <> 'completed'
     or coalesce(v_booking.payment_status, '') <> 'paid' then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_BOOKING_NOT_COMPLETABLE';
  end if;

  select s.*
    into v_settlement
    from public.booking_settlements as s
   where s.booking_id = v_booking_id
     and s.provider_profile_id = v_workflow.profile_id
   for share;

  if not found
     or v_settlement.state <> 'released'
     or coalesce(v_settlement.stripe_transfer_id, '') !~ '^tr_[A-Za-z0-9_]+$'
     or v_settlement.released_at is null then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_PROOF_REQUIRED';
  end if;

  update public.klyx_workflow_steps as s
     set exited_at = coalesce(s.exited_at, now())
   where s.workflow_id = v_workflow.id
     and s.exited_at is null
     and s.step = 'settlement';

  update public.klyx_workflows as w
     set status = 'completed',
         version = w.version + 1,
         completed_at = coalesce(w.completed_at, now()),
         updated_at = now()
   where w.id = v_workflow.id
   returning w.* into v_workflow;

  insert into public.klyx_workflow_events (
    workflow_id,
    account_id,
    event_type,
    actor_type,
    step,
    workflow_version,
    payload
  )
  values (
    v_workflow.id,
    v_workflow.account_id,
    left(coalesce(nullif(trim(p_event_type), ''), 'settlement_completed'), 120),
    p_actor_type,
    'settlement',
    v_workflow.version,
    coalesce(p_payload, '{}'::jsonb)
      || jsonb_build_object(
           'booking_id', v_booking_id,
           'stripe_transfer_id', v_settlement.stripe_transfer_id,
           'settlement_state', v_settlement.state,
           'settlement_authority', 'booking_settlements'
         )
  );

  return query
  select
    v_workflow.id,
    v_workflow.mode,
    v_workflow.current_step,
    v_workflow.status,
    v_workflow.version;
end;
$$;

alter function public.klyx_complete_settlement_workflow(
  uuid, uuid, bigint, text, text, jsonb
) owner to postgres;

revoke all on function public.klyx_transition_workflow(
  uuid, uuid, bigint, text, text, text, jsonb
) from public, anon, authenticated;

revoke all on function public.klyx_complete_settlement_workflow(
  uuid, uuid, bigint, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.klyx_transition_workflow(
  uuid, uuid, bigint, text, text, text, jsonb
) to service_role;

grant execute on function public.klyx_complete_settlement_workflow(
  uuid, uuid, bigint, text, text, jsonb
) to service_role;

comment on function public.klyx_transition_workflow(
  uuid, uuid, bigint, text, text, text, jsonb
) is
  'Mission 19: deterministic workflow transition with output-column-safe SQL qualification.';

comment on function public.klyx_complete_settlement_workflow(
  uuid, uuid, bigint, text, text, jsonb
) is
  'Mission 19: settlement completion remains bound to canonical released settlement truth and uses output-column-safe SQL qualification.';

commit;

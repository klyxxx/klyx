-- KLYX Mission 19B — GAGNER completion boundary
--
-- The canonical earn lifecycle is:
-- skill -> opportunities -> eligibility -> proposal -> acceptance
-- -> mission -> completion -> settlement.
--
-- This migration closes the previous mission -> settlement shortcut without
-- changing settlement completion semantics.

begin;

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
    from public.klyx_workflows w
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
      when 'mission' then p_to_step = 'completion'
      when 'completion' then p_to_step = 'settlement'
      else false
    end;
  end if;

  if not v_allowed then
    raise exception 'KLYX_WORKFLOW_TRANSITION_INVALID:%->%',
      v_workflow.current_step, p_to_step;
  end if;

  select coalesce(max(s.ordinal), 0) + 1
    into v_next_ordinal
    from public.klyx_workflow_steps s
   where s.workflow_id = v_workflow.id;

  update public.klyx_workflow_steps
     set exited_at = coalesce(exited_at, now())
   where workflow_id = v_workflow.id
     and exited_at is null;

  update public.klyx_workflows
     set current_step = p_to_step,
         status = case
           when v_workflow.mode = 'request' and p_to_step = 'closure'
             then 'completed'
           else 'active'
         end,
         version = version + 1,
         completed_at = case
           when v_workflow.mode = 'request' and p_to_step = 'closure'
             then coalesce(completed_at, now())
           else completed_at
         end,
         updated_at = now()
   where id = v_workflow.id
   returning * into v_workflow;

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
  select v_workflow.id, v_workflow.mode, v_workflow.current_step,
         v_workflow.status, v_workflow.version;
end;
$$;

revoke all on function public.klyx_transition_workflow(uuid, uuid, bigint, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.klyx_transition_workflow(uuid, uuid, bigint, text, text, text, jsonb)
  to service_role;

comment on function public.klyx_transition_workflow(uuid, uuid, bigint, text, text, text, jsonb) is
  'Canonical KLYX workflow transition gate. Earn workflows require mission -> completion -> settlement.';

commit;

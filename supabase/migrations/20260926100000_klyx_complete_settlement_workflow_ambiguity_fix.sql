-- Fix a runtime PL/pgSQL ambiguity in the existing terminal GAGNER RPC.
-- No workflow transition, authorization, or financial behavior changes.

begin;

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

revoke all on function public.klyx_complete_settlement_workflow(uuid, uuid, bigint, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.klyx_complete_settlement_workflow(uuid, uuid, bigint, text, text, jsonb)
  to service_role;

comment on function public.klyx_complete_settlement_workflow(uuid, uuid, bigint, text, text, jsonb) is
  'Server-controlled terminal completion for earn workflows; table references are qualified to avoid PL/pgSQL output-column ambiguity.';

commit;

-- KLYX MISSION 19 — END-TO-END AUTONOMOUS CONTINUITY
--
-- A workflow is canonical server state. A conversation is only one UI surface.
-- Deleting a conversation may orphan a workflow (ON DELETE SET NULL), but must
-- never destroy or reset the workflow.
--
-- This RPC atomically re-attaches the latest orphaned workflow for the same
-- account/profile (and optionally mode) to a new conversation.

begin;

create or replace function public.klyx_resume_orphaned_workflow(
  p_account_id uuid,
  p_profile_id uuid,
  p_conversation_id uuid,
  p_mode text default null
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
  if p_conversation_id is null then
    raise exception 'KLYX_WORKFLOW_REBIND_CONVERSATION_REQUIRED';
  end if;

  if p_mode is not null and p_mode not in ('request', 'earn') then
    raise exception 'KLYX_WORKFLOW_MODE_INVALID';
  end if;

  if not exists (
    select 1
      from public.profiles p
      join public.accounts a on a.id = p_account_id
     where p.id = p_profile_id
       and p.owner_user_id = a.auth_user_id
       and (p.account_id is null or p.account_id = p_account_id)
  ) then
    raise exception 'KLYX_WORKFLOW_PROFILE_ACCOUNT_MISMATCH';
  end if;

  if not exists (
    select 1
      from public.brain_conversations c
     where c.id = p_conversation_id
       and c.user_id = p_profile_id
  ) then
    raise exception 'KLYX_WORKFLOW_CONVERSATION_PROFILE_MISMATCH';
  end if;

  select w.*
    into v_workflow
    from public.klyx_workflows w
   where w.account_id = p_account_id
     and w.profile_id = p_profile_id
     and w.conversation_id is null
     and w.status in ('active', 'waiting', 'blocked')
     and (p_mode is null or w.mode = p_mode)
   order by w.updated_at desc, w.id desc
   limit 1
   for update;

  if not found then
    return;
  end if;

  if exists (
    select 1
      from public.klyx_workflows other
     where other.id <> v_workflow.id
       and other.account_id = p_account_id
       and other.conversation_id = p_conversation_id
       and other.mode = v_workflow.mode
       and other.status in ('active', 'waiting', 'blocked')
  ) then
    raise exception 'KLYX_WORKFLOW_REBIND_TARGET_CONFLICT';
  end if;

  update public.klyx_workflows as workflow
     set conversation_id = p_conversation_id,
         version = workflow.version + 1,
         updated_at = now()
   where workflow.id = v_workflow.id
   returning workflow.* into v_workflow;

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
    'workflow_conversation_rebound',
    'server',
    v_workflow.current_step,
    v_workflow.version,
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'reason', 'conversation_continuity_recovery'
    )
  );

  return query
  select v_workflow.id, v_workflow.mode, v_workflow.current_step,
         v_workflow.status, v_workflow.version;
end;
$$;

revoke all on function public.klyx_resume_orphaned_workflow(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.klyx_resume_orphaned_workflow(uuid, uuid, uuid, text)
  to service_role;

comment on function public.klyx_resume_orphaned_workflow(uuid, uuid, uuid, text) is
  'Mission 19: atomically rebinds persistent KLYX workflow state after conversation deletion without trusting browser or LLM state.';

commit;

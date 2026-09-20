-- KLYX Orchestrator foundation
--
-- Persistent workflow state for the unified assistant.
-- The assistant may understand, plan and propose actions, but sensitive
-- mutations remain authorized and executed by deterministic server code.

begin;

create table if not exists public.klyx_workflows (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  conversation_id uuid references public.brain_conversations(id) on delete set null,
  mode text not null check (mode in ('request', 'earn')),
  current_step text not null,
  status text not null default 'active'
    check (status in ('active', 'waiting', 'blocked', 'completed', 'cancelled')),
  version bigint not null default 1 check (version >= 1),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists klyx_workflows_active_conversation_mode_unique
  on public.klyx_workflows(account_id, conversation_id, mode)
  where conversation_id is not null
    and status in ('active', 'waiting', 'blocked');

create index if not exists klyx_workflows_account_updated_idx
  on public.klyx_workflows(account_id, updated_at desc);

create table if not exists public.klyx_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.klyx_workflows(id) on delete cascade,
  step text not null,
  ordinal bigint not null,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (workflow_id, ordinal)
);

create index if not exists klyx_workflow_steps_workflow_idx
  on public.klyx_workflow_steps(workflow_id, ordinal desc);

create table if not exists public.klyx_workflow_actions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.klyx_workflows(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  action_type text not null,
  mutation_class text not null
    check (mutation_class in ('read', 'reversible', 'sensitive')),
  requires_confirmation boolean not null default false,
  proposed_by text not null
    check (proposed_by in ('assistant', 'user', 'server', 'system')),
  executor text not null default 'server'
    check (executor in ('server', 'none')),
  status text not null default 'proposed'
    check (
      status in (
        'proposed',
        'awaiting_confirmation',
        'authorized',
        'executing',
        'executed',
        'blocked',
        'failed',
        'cancelled'
      )
    ),
  idempotency_key text not null,
  input jsonb not null default '{}'::jsonb,
  authorization_context jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  authorized_at timestamptz,
  executed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (workflow_id, idempotency_key)
);

create index if not exists klyx_workflow_actions_workflow_idx
  on public.klyx_workflow_actions(workflow_id, created_at desc);

create table if not exists public.klyx_workflow_confirmations (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.klyx_workflows(id) on delete cascade,
  action_id uuid not null references public.klyx_workflow_actions(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  confirmation_type text not null
    check (confirmation_type in ('user', 'provider', 'operator')),
  decision text
    check (decision is null or decision in ('approved', 'rejected')),
  decided_by_profile_id uuid references public.profiles(id) on delete restrict,
  decision_context jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (action_id, confirmation_type)
);

create table if not exists public.klyx_workflow_events (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.klyx_workflows(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  event_type text not null,
  actor_type text not null
    check (actor_type in ('assistant', 'user', 'server', 'system', 'operator')),
  step text,
  workflow_version bigint not null check (workflow_version >= 1),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists klyx_workflow_events_workflow_idx
  on public.klyx_workflow_events(workflow_id, created_at asc, id asc);

create or replace function public.klyx_reject_workflow_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'KLYX_WORKFLOW_EVENT_IMMUTABLE';
end;
$$;

drop trigger if exists klyx_workflow_events_immutable_update
  on public.klyx_workflow_events;
create trigger klyx_workflow_events_immutable_update
before update on public.klyx_workflow_events
for each row execute function public.klyx_reject_workflow_event_mutation();

create or replace function public.klyx_create_or_resume_workflow(
  p_account_id uuid,
  p_profile_id uuid,
  p_conversation_id uuid,
  p_mode text,
  p_context jsonb default '{}'::jsonb
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
  v_initial_step text;
begin
  if p_mode not in ('request', 'earn') then
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

  if p_conversation_id is not null
     and not exists (
       select 1
         from public.brain_conversations c
        where c.id = p_conversation_id
          and c.user_id = p_profile_id
     ) then
    raise exception 'KLYX_WORKFLOW_CONVERSATION_PROFILE_MISMATCH';
  end if;

  if p_conversation_id is not null then
    select w.*
      into v_workflow
      from public.klyx_workflows w
     where w.account_id = p_account_id
       and w.conversation_id = p_conversation_id
       and w.mode = p_mode
       and w.status in ('active', 'waiting', 'blocked')
     order by w.updated_at desc
     limit 1
     for update;

    if found then
      if coalesce(p_context, '{}'::jsonb) <> '{}'::jsonb then
        update public.klyx_workflows
           set context = context || p_context,
               updated_at = now()
         where id = v_workflow.id
         returning * into v_workflow;
      end if;

      return query
      select v_workflow.id, v_workflow.mode, v_workflow.current_step,
             v_workflow.status, v_workflow.version;
      return;
    end if;
  end if;

  v_initial_step := case when p_mode = 'request' then 'intention' else 'skill' end;

  begin
    insert into public.klyx_workflows (
      account_id,
      profile_id,
      conversation_id,
      mode,
      current_step,
      context
    )
    values (
      p_account_id,
      p_profile_id,
      p_conversation_id,
      p_mode,
      v_initial_step,
      coalesce(p_context, '{}'::jsonb)
    )
    returning * into v_workflow;
  exception when unique_violation then
    select w.*
      into v_workflow
      from public.klyx_workflows w
     where w.account_id = p_account_id
       and w.conversation_id = p_conversation_id
       and w.mode = p_mode
       and w.status in ('active', 'waiting', 'blocked')
     order by w.updated_at desc
     limit 1;
  end;

  if v_workflow.id is null then
    raise exception 'KLYX_WORKFLOW_CREATE_FAILED';
  end if;

  if not exists (
    select 1
      from public.klyx_workflow_steps s
     where s.workflow_id = v_workflow.id
  ) then
    insert into public.klyx_workflow_steps (
      workflow_id,
      step,
      ordinal,
      metadata
    )
    values (
      v_workflow.id,
      v_workflow.current_step,
      1,
      jsonb_build_object('source', 'workflow_created')
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
      p_account_id,
      'workflow_created',
      'server',
      v_workflow.current_step,
      v_workflow.version,
      jsonb_build_object('mode', p_mode)
    );
  end if;

  return query
  select v_workflow.id, v_workflow.mode, v_workflow.current_step,
         v_workflow.status, v_workflow.version;
end;
$$;

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

  if v_workflow.mode <> 'earn' or v_workflow.current_step <> 'settlement' then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_COMPLETION_INVALID';
  end if;

  if v_workflow.status not in ('active', 'waiting') then
    raise exception 'KLYX_WORKFLOW_SETTLEMENT_NOT_COMPLETABLE';
  end if;

  update public.klyx_workflow_steps
     set exited_at = coalesce(exited_at, now())
   where workflow_id = v_workflow.id
     and exited_at is null
     and step = 'settlement';

  update public.klyx_workflows
     set status = 'completed',
         version = version + 1,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = v_workflow.id
   returning * into v_workflow;

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
  select v_workflow.id, v_workflow.mode, v_workflow.current_step,
         v_workflow.status, v_workflow.version;
end;
$$;

alter table public.klyx_workflows enable row level security;
alter table public.klyx_workflow_steps enable row level security;
alter table public.klyx_workflow_actions enable row level security;
alter table public.klyx_workflow_confirmations enable row level security;
alter table public.klyx_workflow_events enable row level security;

revoke all on table public.klyx_workflows from anon, authenticated;
revoke all on table public.klyx_workflow_steps from anon, authenticated;
revoke all on table public.klyx_workflow_actions from anon, authenticated;
revoke all on table public.klyx_workflow_confirmations from anon, authenticated;
revoke all on table public.klyx_workflow_events from anon, authenticated;

revoke all on function public.klyx_create_or_resume_workflow(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.klyx_transition_workflow(uuid, uuid, bigint, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.klyx_complete_settlement_workflow(uuid, uuid, bigint, text, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.klyx_create_or_resume_workflow(uuid, uuid, uuid, text, jsonb)
  to service_role;
grant execute on function public.klyx_transition_workflow(uuid, uuid, bigint, text, text, text, jsonb)
  to service_role;
grant execute on function public.klyx_complete_settlement_workflow(uuid, uuid, bigint, text, text, jsonb)
  to service_role;

comment on table public.klyx_workflows is
  'Canonical persistent state machine for the unified KLYX assistant.';
comment on table public.klyx_workflow_actions is
  'Assistant/server action proposals. Sensitive mutations are never executed by the LLM.';
comment on table public.klyx_workflow_events is
  'Append-only audit stream for workflow state and orchestration decisions.';

commit;

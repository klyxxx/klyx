-- KLYX durable client-agent execution state.
--
-- The agent may automatically perform reversible discovery actions (search and
-- provider recommendation), but booking/payment remain explicit user actions.
-- Execution claims are atomic so retries cannot create duplicate agent work.

begin;

alter table public.client_agent_plans
  add column if not exists selected_provider_id uuid references public.profiles(id) on delete set null,
  add column if not exists selected_user_service_id uuid references public.user_services(id) on delete set null,
  add column if not exists search_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists execution_status text not null default 'idle',
  add column if not exists execution_revision integer not null default 0,
  add column if not exists next_action text,
  add column if not exists next_action_href text,
  add column if not exists last_execution_code text,
  add column if not exists last_execution_at timestamptz;

alter table public.client_agent_plans
  drop constraint if exists client_agent_plans_execution_status_check;
alter table public.client_agent_plans
  add constraint client_agent_plans_execution_status_check
  check (execution_status in ('idle', 'running', 'waiting_confirmation', 'failed'));

alter table public.client_agent_plans
  drop constraint if exists client_agent_plans_execution_revision_check;
alter table public.client_agent_plans
  add constraint client_agent_plans_execution_revision_check
  check (execution_revision >= 0);

alter table public.client_agent_plans
  drop constraint if exists client_agent_plans_next_action_check;
alter table public.client_agent_plans
  add constraint client_agent_plans_next_action_check
  check (next_action is null or next_action in ('complete', 'search', 'choose', 'book', 'pay'));

create index if not exists client_agent_plans_selected_provider_idx
  on public.client_agent_plans(selected_provider_id)
  where selected_provider_id is not null;

create table if not exists public.client_agent_plan_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.client_agent_plans(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  execution_revision integer not null,
  event_type text not null,
  step_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint client_agent_plan_events_revision_check check (execution_revision >= 1),
  constraint client_agent_plan_events_type_check check (
    event_type in (
      'search_started',
      'search_succeeded',
      'provider_selected',
      'confirmation_required',
      'execution_failed'
    )
  ),
  constraint client_agent_plan_events_step_check check (
    step_id is null or step_id in ('search', 'choose', 'book', 'pay')
  ),
  constraint client_agent_plan_events_unique unique (plan_id, execution_revision, event_type)
);

create index if not exists client_agent_plan_events_plan_idx
  on public.client_agent_plan_events(plan_id, created_at asc);

alter table public.client_agent_plan_events enable row level security;

-- Agent execution is a server API boundary. Browser clients do not need direct
-- access to either durable plan internals or the execution journal.
revoke all privileges on table public.client_agent_plans
  from public, anon, authenticated;
grant all privileges on table public.client_agent_plans
  to service_role;

revoke all privileges on table public.client_agent_plan_events
  from public, anon, authenticated;
grant all privileges on table public.client_agent_plan_events
  to service_role;

create or replace function public.klyx_claim_client_agent_execution(
  p_plan_id uuid,
  p_profile_id uuid
)
returns table(action text, revision integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.client_agent_plans%rowtype;
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
    return query select 'closed'::text, v_plan.execution_revision;
    return;
  end if;

  if
    v_plan.selected_provider_id is not null
    and v_plan.selected_user_service_id is not null
    and v_plan.execution_status = 'waiting_confirmation'
    and v_plan.next_action = 'book'
  then
    return query select 'reuse'::text, v_plan.execution_revision;
    return;
  end if;

  if
    v_plan.execution_status = 'running'
    and v_plan.last_execution_at is not null
    and v_plan.last_execution_at > now() - interval '2 minutes'
  then
    return query select 'busy'::text, v_plan.execution_revision;
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

  return query select 'execute'::text, v_revision;
end;
$$;

alter function public.klyx_claim_client_agent_execution(uuid, uuid)
  owner to postgres;
revoke all on function public.klyx_claim_client_agent_execution(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.klyx_claim_client_agent_execution(uuid, uuid)
  to service_role;

commit;

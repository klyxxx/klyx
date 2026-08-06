begin;

create table if not exists public.client_agent_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  raw_request text not null,
  service_slug text null,
  city text null,
  requested_day date null,
  requested_time time without time zone null,
  duration_hours numeric(5,2) null,
  budget_max numeric(12,2) null,
  plan_status text not null default 'draft',
  steps jsonb not null default '[]'::jsonb,
  memory_used boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone null,
  constraint client_agent_plans_status_check check (
    plan_status = any (
      array[
        'draft'::text,
        'ready'::text,
        'in_progress'::text,
        'completed'::text,
        'cancelled'::text
      ]
    )
  ),
  constraint client_agent_plans_duration_check check (
    duration_hours is null
    or (
      duration_hours > 0
      and duration_hours <= 24
    )
  ),
  constraint client_agent_plans_budget_check check (
    budget_max is null or budget_max >= 0
  )
);

create index if not exists client_agent_plans_profile_idx
  on public.client_agent_plans(profile_id, created_at desc);

alter table public.client_agent_plans enable row level security;

drop policy if exists "Clients read own agent plans"
  on public.client_agent_plans;

create policy "Clients read own agent plans"
on public.client_agent_plans
for select
to authenticated
using (
  profile_id in (
    select id
    from public.profiles
    where owner_user_id = auth.uid()
      and account_type = 'client'
  )
);

commit;

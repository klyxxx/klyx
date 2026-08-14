-- KLYX_MULTI_SLOT_MARKET_12_83

alter table public.market_service_requests
  add column if not exists request_mode text not null default 'single';

alter table public.market_service_requests
  add column if not exists slot_count integer not null default 1;

alter table public.market_service_requests
  add column if not exists budget_total numeric(12,2);

alter table public.market_service_requests
  add column if not exists prefer_single_provider boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'market_service_requests_request_mode_check'
  ) then
    alter table public.market_service_requests
      add constraint market_service_requests_request_mode_check
      check (
        request_mode in (
          'single',
          'multi_slot'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'market_service_requests_slot_count_check'
  ) then
    alter table public.market_service_requests
      add constraint market_service_requests_slot_count_check
      check (
        slot_count >= 1
        and slot_count <= 20
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'market_service_requests_budget_total_check'
  ) then
    alter table public.market_service_requests
      add constraint market_service_requests_budget_total_check
      check (
        budget_total is null
        or budget_total >= 0
      );
  end if;
end
$$;

create table if not exists public.market_service_request_slots (
  id uuid primary key default gen_random_uuid(),

  market_request_id uuid not null
    references public.market_service_requests(id)
    on delete cascade,

  position integer not null,

  requested_date date not null,

  start_time time not null,

  end_time time not null,

  budget_max numeric(12,2),

  duration_minutes integer not null,

  created_at timestamptz not null default now(),

  constraint market_service_request_slots_position_check
    check (
      position >= 1
      and position <= 20
    ),

  constraint market_service_request_slots_budget_check
    check (
      budget_max is null
      or budget_max >= 0
    ),

  constraint market_service_request_slots_duration_check
    check (
      duration_minutes > 0
      and duration_minutes <= 1440
    ),

  constraint market_service_request_slots_time_check
    check (
      start_time <> end_time
    )
);

create unique index if not exists
  market_service_request_slots_request_position_uidx
on public.market_service_request_slots (
  market_request_id,
  position
);

create index if not exists
  market_service_request_slots_date_idx
on public.market_service_request_slots (
  requested_date
);

create table if not exists public.market_request_provider_candidates (
  id uuid primary key default gen_random_uuid(),

  market_request_id uuid not null
    references public.market_service_requests(id)
    on delete cascade,

  provider_profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  coverage_count integer not null,

  slot_count integer not null,

  full_coverage boolean not null default false,

  created_at timestamptz not null default now(),

  constraint market_request_provider_candidates_coverage_check
    check (
      coverage_count >= 0
      and coverage_count <= slot_count
      and slot_count >= 1
    )
);

create unique index if not exists
  market_request_provider_candidates_uidx
on public.market_request_provider_candidates (
  market_request_id,
  provider_profile_id
);

create index if not exists
  market_request_provider_candidates_rank_idx
on public.market_request_provider_candidates (
  market_request_id,
  full_coverage desc,
  coverage_count desc
);

alter table public.market_service_request_slots
  enable row level security;

alter table public.market_request_provider_candidates
  enable row level security;

revoke all
on table public.market_service_request_slots
from anon, authenticated;

revoke all
on table public.market_request_provider_candidates
from anon, authenticated;

grant all
on table public.market_service_request_slots
to service_role;

grant all
on table public.market_request_provider_candidates
to service_role;
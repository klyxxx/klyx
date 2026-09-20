begin;

-- KLYX MISSION 15 — HUMAN OPERATIONS / CASE MANAGEMENT
--
-- Human Operations is a work-queue and coordination layer.
-- It never becomes Booking, Trust & Safety, Financial Ledger, Settlement,
-- Eligibility, Risk or Durable Job truth.
--
-- Existing authorities remain canonical:
-- - trust_cases / trust_decision_reviews: Trust & Safety review truth;
-- - financial_reconciliation_cases/events: financial divergence truth;
-- - ops_durable_jobs: durable execution truth;
-- - ops_events: append-only Operations audit.
--
-- Mission 15 coordinates human ownership, queueing, assignment, SLA and
-- explicit manual actions by referencing those authorities.

create table if not exists public.ops_human_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique,

  operation_id uuid not null
    references public.ops_operations(id) on delete restrict,
  correlation_id uuid not null,

  case_type text not null,
  queue_key text not null,
  source_type text not null,
  source_ref text not null,

  account_id uuid references public.accounts(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,

  failure_domain_type text not null default 'global',
  failure_domain_key text not null default 'global',
  market_id text,
  region_id text,
  country_code text,
  currency text,
  payment_provider text,
  capability text,
  dependency text,

  priority text not null default 'normal',
  status text not null default 'open',
  reason_code text not null,
  title text not null,
  summary text not null,

  assigned_to_auth_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  claimed_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,

  version bigint not null default 1,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ops_human_cases_case_key_check
    check (length(case_key) between 3 and 256),
  constraint ops_human_cases_case_type_check
    check (
      length(case_type) between 3 and 96
      and case_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_human_cases_queue_key_check
    check (
      length(queue_key) between 2 and 96
      and queue_key ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_human_cases_source_type_check
    check (
      length(source_type) between 2 and 96
      and source_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_human_cases_source_ref_check
    check (length(source_ref) between 1 and 512),
  constraint ops_human_cases_failure_domain_type_check
    check (
      length(failure_domain_type) between 2 and 64
      and failure_domain_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_human_cases_failure_domain_key_check
    check (length(failure_domain_key) between 1 and 256),
  constraint ops_human_cases_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint ops_human_cases_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint ops_human_cases_payment_provider_check
    check (
      payment_provider is null
      or (
        length(payment_provider) between 2 and 64
        and payment_provider ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_human_cases_capability_check
    check (
      capability is null
      or (
        length(capability) between 2 and 128
        and capability ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_human_cases_dependency_check
    check (
      dependency is null
      or (
        length(dependency) between 2 and 128
        and dependency ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_human_cases_priority_check
    check (priority in ('low', 'normal', 'high', 'critical')),
  constraint ops_human_cases_status_check
    check (
      status in (
        'open',
        'triage',
        'in_review',
        'waiting_external',
        'resolved',
        'closed'
      )
    ),
  constraint ops_human_cases_reason_code_check
    check (
      length(reason_code) between 2 and 128
      and reason_code ~ '^[A-Z][A-Z0-9_.:-]*$'
    ),
  constraint ops_human_cases_title_check
    check (length(title) between 1 and 240),
  constraint ops_human_cases_summary_check
    check (length(summary) between 1 and 4000),
  constraint ops_human_cases_version_check
    check (version >= 1),
  constraint ops_human_cases_closed_requires_resolved_check
    check (closed_at is null or resolved_at is not null)
);

comment on table public.ops_human_cases is
  'Human Operations work queue. It coordinates ownership and review but never replaces canonical domain truth.';
comment on column public.ops_human_cases.source_ref is
  'Reference to the canonical source resource. Mission 15 stores references, not copied domain payloads.';
comment on column public.ops_human_cases.version is
  'Optimistic-concurrency fence for human assignment and state transitions.';

create index if not exists ops_human_cases_queue_idx
  on public.ops_human_cases (status, priority, due_at, opened_at)
  where status in ('open', 'triage', 'in_review', 'waiting_external');

create index if not exists ops_human_cases_assignee_idx
  on public.ops_human_cases (assigned_to_auth_user_id, status, updated_at desc)
  where assigned_to_auth_user_id is not null;

create index if not exists ops_human_cases_source_idx
  on public.ops_human_cases (source_type, source_ref, opened_at desc);

create index if not exists ops_human_cases_failure_domain_idx
  on public.ops_human_cases (
    failure_domain_type,
    failure_domain_key,
    country_code,
    currency,
    payment_provider,
    capability,
    updated_at desc
  );

alter table public.ops_human_cases enable row level security;
revoke all privileges on table public.ops_human_cases
  from public, anon, authenticated, service_role;
grant select on table public.ops_human_cases to service_role;

create table if not exists public.ops_human_case_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null
    references public.ops_human_cases(id) on delete restrict,
  resource_type text not null,
  resource_ref text not null,
  relation_type text not null default 'related',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint ops_human_case_links_resource_type_check
    check (
      length(resource_type) between 2 and 96
      and resource_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_human_case_links_resource_ref_check
    check (length(resource_ref) between 1 and 512),
  constraint ops_human_case_links_relation_type_check
    check (
      length(relation_type) between 2 and 96
      and relation_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_human_case_links_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint ops_human_case_links_unique
    unique (case_id, resource_type, resource_ref, relation_type)
);

comment on table public.ops_human_case_links is
  'Reference links from Human Operations cases to canonical resources. No linked resource is re-modeled here.';

create index if not exists ops_human_case_links_resource_idx
  on public.ops_human_case_links (resource_type, resource_ref, created_at desc);

alter table public.ops_human_case_links enable row level security;
revoke all privileges on table public.ops_human_case_links
  from public, anon, authenticated, service_role;
grant select on table public.ops_human_case_links to service_role;

create table if not exists public.ops_durable_job_redrives (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null
    references public.ops_human_cases(id) on delete restrict,
  original_job_id uuid not null
    references public.ops_durable_jobs(id) on delete restrict,
  new_job_id uuid not null
    references public.ops_durable_jobs(id) on delete restrict,
  redrive_key text not null,
  operator_auth_user_id uuid not null
    references auth.users(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now(),

  constraint ops_durable_job_redrives_key_check
    check (
      length(redrive_key) between 3 and 120
      and redrive_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'
    ),
  constraint ops_durable_job_redrives_reason_code_check
    check (
      length(reason_code) between 2 and 128
      and reason_code ~ '^[A-Z][A-Z0-9_.:-]*$'
    ),
  constraint ops_durable_job_redrives_distinct_jobs_check
    check (original_job_id <> new_job_id),
  constraint ops_durable_job_redrives_request_unique
    unique (case_id, redrive_key),
  constraint ops_durable_job_redrives_new_job_unique
    unique (new_job_id)
);

comment on table public.ops_durable_job_redrives is
  'Explicit human-approved DLQ redrive lineage. The original dead-lettered job remains terminal; each redrive creates a new durable job.';

create index if not exists ops_durable_job_redrives_original_idx
  on public.ops_durable_job_redrives (original_job_id, created_at desc);

alter table public.ops_durable_job_redrives enable row level security;
revoke all privileges on table public.ops_durable_job_redrives
  from public, anon, authenticated, service_role;
grant select on table public.ops_durable_job_redrives to service_role;

create or replace function public.klyx_human_ops_immutable_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'KLYX_HUMAN_OPS_AUDIT_IMMUTABLE';
end;
$$;

alter function public.klyx_human_ops_immutable_guard() owner to postgres;
revoke all on function public.klyx_human_ops_immutable_guard()
  from public, anon, authenticated, service_role;

drop trigger if exists klyx_ops_human_case_links_immutable
  on public.ops_human_case_links;
create trigger klyx_ops_human_case_links_immutable
before update or delete on public.ops_human_case_links
for each row execute function public.klyx_human_ops_immutable_guard();

drop trigger if exists klyx_ops_durable_job_redrives_immutable
  on public.ops_durable_job_redrives;
create trigger klyx_ops_durable_job_redrives_immutable
before update or delete on public.ops_durable_job_redrives
for each row execute function public.klyx_human_ops_immutable_guard();

create or replace function public.klyx_open_human_ops_case(
  p_case_key text,
  p_case_type text,
  p_queue_key text,
  p_source_type text,
  p_source_ref text,
  p_reason_code text,
  p_title text,
  p_summary text,
  p_priority text default 'normal',
  p_account_id uuid default null,
  p_booking_id uuid default null,
  p_failure_domain_type text default 'global',
  p_failure_domain_key text default 'global',
  p_market_id text default null,
  p_region_id text default null,
  p_country_code text default null,
  p_currency text default null,
  p_payment_provider text default null,
  p_capability text default null,
  p_dependency text default null,
  p_due_at timestamptz default null
)
returns table(
  case_id uuid,
  case_status text,
  case_version bigint,
  created boolean,
  operation_id uuid,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case_key text := trim(coalesce(p_case_key, ''));
  v_case_type text := lower(trim(coalesce(p_case_type, '')));
  v_queue_key text := lower(trim(coalesce(p_queue_key, '')));
  v_source_type text := lower(trim(coalesce(p_source_type, '')));
  v_source_ref text := trim(coalesce(p_source_ref, ''));
  v_reason_code text := upper(trim(coalesce(p_reason_code, '')));
  v_title text := trim(coalesce(p_title, ''));
  v_summary text := trim(coalesce(p_summary, ''));
  v_priority text := lower(trim(coalesce(p_priority, 'normal')));
  v_failure_domain_type text := lower(trim(coalesce(p_failure_domain_type, 'global')));
  v_failure_domain_key text := trim(coalesce(p_failure_domain_key, 'global'));
  v_market_id text := nullif(trim(p_market_id), '');
  v_region_id text := nullif(trim(p_region_id), '');
  v_country_code text := upper(nullif(trim(p_country_code), ''));
  v_currency text := upper(nullif(trim(p_currency), ''));
  v_payment_provider text := lower(nullif(trim(p_payment_provider), ''));
  v_capability text := lower(nullif(trim(p_capability), ''));
  v_dependency text := lower(nullif(trim(p_dependency), ''));
  v_existing public.ops_human_cases%rowtype;
  v_case public.ops_human_cases%rowtype;
  v_operation_id uuid;
  v_correlation_id uuid := gen_random_uuid();
begin
  if v_case_key = '' or length(v_case_key) > 256 then
    raise exception 'KLYX_HUMAN_OPS_CASE_KEY_INVALID';
  end if;

  if v_case_type = '' or v_queue_key = '' then
    raise exception 'KLYX_HUMAN_OPS_CASE_CLASSIFICATION_REQUIRED';
  end if;

  if v_source_type = '' or v_source_ref = '' then
    raise exception 'KLYX_HUMAN_OPS_SOURCE_REQUIRED';
  end if;

  if v_reason_code = '' then
    raise exception 'KLYX_HUMAN_OPS_REASON_REQUIRED';
  end if;

  if v_title = '' or v_summary = '' then
    raise exception 'KLYX_HUMAN_OPS_DESCRIPTION_REQUIRED';
  end if;

  if v_priority not in ('low', 'normal', 'high', 'critical') then
    raise exception 'KLYX_HUMAN_OPS_PRIORITY_INVALID';
  end if;

  if v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'KLYX_HUMAN_OPS_COUNTRY_CODE_INVALID';
  end if;

  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_HUMAN_OPS_CURRENCY_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_case_key, 0));

  select *
    into v_existing
    from public.ops_human_cases
   where case_key = v_case_key
   for update;

  if found then
    if
      v_existing.case_type is distinct from v_case_type
      or v_existing.queue_key is distinct from v_queue_key
      or v_existing.source_type is distinct from v_source_type
      or v_existing.source_ref is distinct from v_source_ref
      or v_existing.reason_code is distinct from v_reason_code
      or v_existing.account_id is distinct from p_account_id
      or v_existing.booking_id is distinct from p_booking_id
      or v_existing.failure_domain_type is distinct from v_failure_domain_type
      or v_existing.failure_domain_key is distinct from v_failure_domain_key
      or v_existing.market_id is distinct from v_market_id
      or v_existing.region_id is distinct from v_region_id
      or v_existing.country_code is distinct from v_country_code
      or v_existing.currency is distinct from v_currency
      or v_existing.payment_provider is distinct from v_payment_provider
      or v_existing.capability is distinct from v_capability
      or v_existing.dependency is distinct from v_dependency
    then
      raise exception 'KLYX_HUMAN_OPS_CASE_KEY_CONFLICT';
    end if;

    return query
    select
      v_existing.id,
      v_existing.status,
      v_existing.version,
      false,
      v_existing.operation_id,
      v_existing.correlation_id;
    return;
  end if;

  insert into public.ops_operations (
    correlation_id,
    account_id,
    domain_type,
    domain_resource_type,
    domain_resource_id,
    failure_domain_type,
    failure_domain_key,
    market_id,
    region_id,
    country_code,
    currency,
    payment_provider,
    capability,
    dependency,
    operation_type,
    risk_level,
    status
  ) values (
    v_correlation_id,
    p_account_id,
    'operations',
    'human_case',
    v_case_key,
    v_failure_domain_type,
    v_failure_domain_key,
    v_market_id,
    v_region_id,
    v_country_code,
    v_currency,
    v_payment_provider,
    v_capability,
    v_dependency,
    'human_case.manage',
    case
      when v_priority = 'critical' then 'critical'
      when v_priority = 'high' then 'high'
      else 'normal'
    end,
    'started'
  )
  returning id into v_operation_id;

  insert into public.ops_human_cases (
    case_key,
    operation_id,
    correlation_id,
    case_type,
    queue_key,
    source_type,
    source_ref,
    account_id,
    booking_id,
    failure_domain_type,
    failure_domain_key,
    market_id,
    region_id,
    country_code,
    currency,
    payment_provider,
    capability,
    dependency,
    priority,
    status,
    reason_code,
    title,
    summary,
    due_at
  ) values (
    v_case_key,
    v_operation_id,
    v_correlation_id,
    v_case_type,
    v_queue_key,
    v_source_type,
    v_source_ref,
    p_account_id,
    p_booking_id,
    v_failure_domain_type,
    v_failure_domain_key,
    v_market_id,
    v_region_id,
    v_country_code,
    v_currency,
    v_payment_provider,
    v_capability,
    v_dependency,
    v_priority,
    'open',
    v_reason_code,
    v_title,
    v_summary,
    p_due_at
  )
  returning * into v_case;

  insert into public.ops_human_case_links (
    case_id,
    resource_type,
    resource_ref,
    relation_type
  ) values (
    v_case.id,
    v_source_type,
    v_source_ref,
    'primary'
  );

  insert into public.ops_events (
    operation_id,
    correlation_id,
    event_type,
    severity,
    domain_type,
    domain_resource_type,
    domain_resource_id,
    domain_event_id,
    failure_domain_type,
    failure_domain_key,
    market_id,
    region_id,
    country_code,
    currency,
    payment_provider,
    capability,
    dependency,
    metadata
  ) values (
    v_case.operation_id,
    v_case.correlation_id,
    'human_case.opened',
    case when v_priority in ('high', 'critical') then 'warning' else 'info' end,
    'operations',
    'human_case',
    v_case.id::text,
    null,
    v_case.failure_domain_type,
    v_case.failure_domain_key,
    v_case.market_id,
    v_case.region_id,
    v_case.country_code,
    v_case.currency,
    v_case.payment_provider,
    v_case.capability,
    v_case.dependency,
    jsonb_build_object(
      'case_type', v_case.case_type,
      'queue_key', v_case.queue_key,
      'source_type', v_case.source_type,
      'source_ref', v_case.source_ref,
      'priority', v_case.priority,
      'reason_code', v_case.reason_code,
      'due_at', v_case.due_at
    )
  );

  return query
  select
    v_case.id,
    v_case.status,
    v_case.version,
    true,
    v_case.operation_id,
    v_case.correlation_id;
end;
$$;

alter function public.klyx_open_human_ops_case(
  text, text, text, text, text, text, text, text, text,
  uuid, uuid, text, text, text, text, text, text, text, text, timestamptz
) owner to postgres;
revoke all on function public.klyx_open_human_ops_case(
  text, text, text, text, text, text, text, text, text,
  uuid, uuid, text, text, text, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.klyx_open_human_ops_case(
  text, text, text, text, text, text, text, text, text,
  uuid, uuid, text, text, text, text, text, text, text, text, timestamptz
) to service_role;

create or replace function public.klyx_link_human_ops_case(
  p_case_id uuid,
  p_resource_type text,
  p_resource_ref text,
  p_relation_type text,
  p_operator_auth_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case public.ops_human_cases%rowtype;
  v_resource_type text := lower(trim(coalesce(p_resource_type, '')));
  v_resource_ref text := trim(coalesce(p_resource_ref, ''));
  v_relation_type text := lower(trim(coalesce(p_relation_type, 'related')));
  v_link_id uuid;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_HUMAN_OPS_OPERATOR_REQUIRED';
  end if;

  if v_resource_type = '' or v_resource_ref = '' or v_relation_type = '' then
    raise exception 'KLYX_HUMAN_OPS_LINK_INVALID';
  end if;

  select *
    into v_case
    from public.ops_human_cases
   where id = p_case_id
   for update;

  if not found then
    raise exception 'KLYX_HUMAN_OPS_CASE_NOT_FOUND';
  end if;

  if v_case.status = 'closed' then
    raise exception 'KLYX_HUMAN_OPS_CASE_CLOSED';
  end if;

  insert into public.ops_human_case_links (
    case_id,
    resource_type,
    resource_ref,
    relation_type
  ) values (
    v_case.id,
    v_resource_type,
    v_resource_ref,
    v_relation_type
  )
  on conflict (case_id, resource_type, resource_ref, relation_type) do nothing
  returning id into v_link_id;

  if v_link_id is null then
    select id
      into v_link_id
      from public.ops_human_case_links
     where case_id = v_case.id
       and resource_type = v_resource_type
       and resource_ref = v_resource_ref
       and relation_type = v_relation_type;
  else
    insert into public.ops_events (
      operation_id,
      correlation_id,
      event_type,
      severity,
      domain_type,
      domain_resource_type,
      domain_resource_id,
      failure_domain_type,
      failure_domain_key,
      market_id,
      region_id,
      country_code,
      currency,
      payment_provider,
      capability,
      dependency,
      metadata
    ) values (
      v_case.operation_id,
      v_case.correlation_id,
      'human_case.linked',
      'info',
      'operations',
      'human_case',
      v_case.id::text,
      v_case.failure_domain_type,
      v_case.failure_domain_key,
      v_case.market_id,
      v_case.region_id,
      v_case.country_code,
      v_case.currency,
      v_case.payment_provider,
      v_case.capability,
      v_case.dependency,
      jsonb_build_object(
        'resource_type', v_resource_type,
        'resource_ref', v_resource_ref,
        'relation_type', v_relation_type,
        'operator_auth_user_id', p_operator_auth_user_id
      )
    );
  end if;

  return v_link_id;
end;
$$;

alter function public.klyx_link_human_ops_case(uuid, text, text, text, uuid)
  owner to postgres;
revoke all on function public.klyx_link_human_ops_case(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.klyx_link_human_ops_case(uuid, text, text, text, uuid)
  to service_role;

create or replace function public.klyx_assign_human_ops_case(
  p_case_id uuid,
  p_actor_auth_user_id uuid,
  p_assignee_auth_user_id uuid,
  p_expected_version bigint,
  p_reason_code text
)
returns table(case_status text, case_version bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case public.ops_human_cases%rowtype;
  v_reason_code text := upper(trim(coalesce(p_reason_code, '')));
  v_previous_assignee uuid;
begin
  if p_actor_auth_user_id is null or p_assignee_auth_user_id is null then
    raise exception 'KLYX_HUMAN_OPS_OPERATOR_REQUIRED';
  end if;

  if v_reason_code = '' then
    raise exception 'KLYX_HUMAN_OPS_REASON_REQUIRED';
  end if;

  select *
    into v_case
    from public.ops_human_cases
   where id = p_case_id
   for update;

  if not found then
    raise exception 'KLYX_HUMAN_OPS_CASE_NOT_FOUND';
  end if;

  if v_case.status in ('resolved', 'closed') then
    raise exception 'KLYX_HUMAN_OPS_CASE_NOT_ASSIGNABLE';
  end if;

  if v_case.version <> p_expected_version then
    raise exception 'KLYX_HUMAN_OPS_CASE_VERSION_CONFLICT';
  end if;

  v_previous_assignee := v_case.assigned_to_auth_user_id;

  update public.ops_human_cases
     set assigned_to_auth_user_id = p_assignee_auth_user_id,
         claimed_at = coalesce(claimed_at, now()),
         status = case when status = 'open' then 'triage' else status end,
         version = version + 1,
         updated_at = now()
   where id = v_case.id
   returning * into v_case;

  insert into public.ops_events (
    operation_id,
    correlation_id,
    event_type,
    severity,
    domain_type,
    domain_resource_type,
    domain_resource_id,
    failure_domain_type,
    failure_domain_key,
    market_id,
    region_id,
    country_code,
    currency,
    payment_provider,
    capability,
    dependency,
    metadata
  ) values (
    v_case.operation_id,
    v_case.correlation_id,
    'human_case.assigned',
    'info',
    'operations',
    'human_case',
    v_case.id::text,
    v_case.failure_domain_type,
    v_case.failure_domain_key,
    v_case.market_id,
    v_case.region_id,
    v_case.country_code,
    v_case.currency,
    v_case.payment_provider,
    v_case.capability,
    v_case.dependency,
    jsonb_build_object(
      'actor_auth_user_id', p_actor_auth_user_id,
      'previous_assignee_auth_user_id', v_previous_assignee,
      'assignee_auth_user_id', p_assignee_auth_user_id,
      'reason_code', v_reason_code,
      'version', v_case.version
    )
  );

  return query select v_case.status, v_case.version;
end;
$$;

alter function public.klyx_assign_human_ops_case(uuid, uuid, uuid, bigint, text)
  owner to postgres;
revoke all on function public.klyx_assign_human_ops_case(uuid, uuid, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.klyx_assign_human_ops_case(uuid, uuid, uuid, bigint, text)
  to service_role;

create or replace function public.klyx_transition_human_ops_case(
  p_case_id uuid,
  p_operator_auth_user_id uuid,
  p_expected_version bigint,
  p_to_status text,
  p_reason_code text,
  p_note text default null
)
returns table(case_status text, case_version bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case public.ops_human_cases%rowtype;
  v_from_status text;
  v_to_status text := lower(trim(coalesce(p_to_status, '')));
  v_reason_code text := upper(trim(coalesce(p_reason_code, '')));
  v_note text := nullif(trim(p_note), '');
  v_allowed boolean := false;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_HUMAN_OPS_OPERATOR_REQUIRED';
  end if;

  if v_reason_code = '' then
    raise exception 'KLYX_HUMAN_OPS_REASON_REQUIRED';
  end if;

  if v_to_status not in (
    'triage',
    'in_review',
    'waiting_external',
    'resolved',
    'closed'
  ) then
    raise exception 'KLYX_HUMAN_OPS_STATUS_INVALID';
  end if;

  if v_note is not null and length(v_note) > 4000 then
    raise exception 'KLYX_HUMAN_OPS_NOTE_TOO_LONG';
  end if;

  select *
    into v_case
    from public.ops_human_cases
   where id = p_case_id
   for update;

  if not found then
    raise exception 'KLYX_HUMAN_OPS_CASE_NOT_FOUND';
  end if;

  if v_case.version <> p_expected_version then
    raise exception 'KLYX_HUMAN_OPS_CASE_VERSION_CONFLICT';
  end if;

  if v_case.assigned_to_auth_user_id is distinct from p_operator_auth_user_id then
    raise exception 'KLYX_HUMAN_OPS_CASE_NOT_OWNED';
  end if;

  v_from_status := v_case.status;

  v_allowed := case
    when v_from_status = 'open'
      then v_to_status in ('triage', 'in_review', 'resolved')
    when v_from_status = 'triage'
      then v_to_status in ('in_review', 'waiting_external', 'resolved')
    when v_from_status = 'in_review'
      then v_to_status in ('waiting_external', 'resolved')
    when v_from_status = 'waiting_external'
      then v_to_status in ('in_review', 'resolved')
    when v_from_status = 'resolved'
      then v_to_status in ('in_review', 'closed')
    else false
  end;

  if not v_allowed or v_from_status = v_to_status then
    raise exception 'KLYX_HUMAN_OPS_TRANSITION_INVALID';
  end if;

  update public.ops_human_cases
     set status = v_to_status,
         resolved_at = case
           when v_to_status = 'resolved' then now()
           when v_from_status = 'resolved' and v_to_status = 'in_review' then null
           else resolved_at
         end,
         closed_at = case
           when v_to_status = 'closed' then now()
           else closed_at
         end,
         version = version + 1,
         updated_at = now()
   where id = v_case.id
   returning * into v_case;

  if v_to_status = 'closed' then
    update public.ops_operations
       set status = 'succeeded',
           completed_at = coalesce(completed_at, now()),
           updated_at = now()
     where id = v_case.operation_id;
  end if;

  insert into public.ops_events (
    operation_id,
    correlation_id,
    event_type,
    severity,
    domain_type,
    domain_resource_type,
    domain_resource_id,
    failure_domain_type,
    failure_domain_key,
    market_id,
    region_id,
    country_code,
    currency,
    payment_provider,
    capability,
    dependency,
    metadata
  ) values (
    v_case.operation_id,
    v_case.correlation_id,
    'human_case.status_changed',
    case when v_to_status = 'resolved' then 'info' else 'warning' end,
    'operations',
    'human_case',
    v_case.id::text,
    v_case.failure_domain_type,
    v_case.failure_domain_key,
    v_case.market_id,
    v_case.region_id,
    v_case.country_code,
    v_case.currency,
    v_case.payment_provider,
    v_case.capability,
    v_case.dependency,
    jsonb_strip_nulls(
      jsonb_build_object(
        'operator_auth_user_id', p_operator_auth_user_id,
        'from_status', v_from_status,
        'to_status', v_to_status,
        'reason_code', v_reason_code,
        'note', v_note,
        'version', v_case.version
      )
    )
  );

  return query select v_case.status, v_case.version;
end;
$$;

alter function public.klyx_transition_human_ops_case(
  uuid, uuid, bigint, text, text, text
) owner to postgres;
revoke all on function public.klyx_transition_human_ops_case(
  uuid, uuid, bigint, text, text, text
) from public, anon, authenticated;
grant execute on function public.klyx_transition_human_ops_case(
  uuid, uuid, bigint, text, text, text
) to service_role;

create or replace function public.klyx_open_dlq_human_ops_case(
  p_job_id uuid,
  p_case_key text,
  p_queue_key text default 'operations',
  p_priority text default 'high',
  p_due_at timestamptz default null
)
returns table(
  case_id uuid,
  case_status text,
  case_version bigint,
  created boolean,
  operation_id uuid,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.ops_durable_jobs%rowtype;
  v_booking_id uuid;
begin
  select *
    into v_job
    from public.ops_durable_jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'KLYX_HUMAN_OPS_DURABLE_JOB_NOT_FOUND';
  end if;

  if v_job.status <> 'dead_lettered' then
    raise exception 'KLYX_HUMAN_OPS_DURABLE_JOB_NOT_DEAD_LETTERED';
  end if;

  if v_job.domain_resource_type = 'booking'
     and nullif(trim(v_job.domain_resource_id), '') is not null then
    select booking.id
      into v_booking_id
      from public.bookings as booking
     where booking.id::text = trim(v_job.domain_resource_id)
     limit 1;
  end if;

  return query
  select *
    from public.klyx_open_human_ops_case(
      p_case_key => p_case_key,
      p_case_type => 'durable_job_failure',
      p_queue_key => p_queue_key,
      p_source_type => 'durable_job',
      p_source_ref => v_job.id::text,
      p_reason_code => coalesce(v_job.last_error_code, 'DURABLE_JOB_DEAD_LETTERED'),
      p_title => concat('Durable job ', v_job.job_type, ' requires human review'),
      p_summary => concat(
        'Dead-lettered durable job ',
        v_job.id::text,
        ' exhausted automated execution and requires explicit human handling.'
      ),
      p_priority => p_priority,
      p_account_id => v_job.account_id,
      p_booking_id => v_booking_id,
      p_failure_domain_type => v_job.failure_domain_type,
      p_failure_domain_key => v_job.failure_domain_key,
      p_market_id => v_job.market_id,
      p_region_id => v_job.region_id,
      p_country_code => v_job.country_code,
      p_currency => v_job.currency,
      p_payment_provider => v_job.payment_provider,
      p_capability => v_job.capability,
      p_dependency => v_job.dependency,
      p_due_at => p_due_at
    );
end;
$$;

alter function public.klyx_open_dlq_human_ops_case(
  uuid, text, text, text, timestamptz
) owner to postgres;
revoke all on function public.klyx_open_dlq_human_ops_case(
  uuid, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.klyx_open_dlq_human_ops_case(
  uuid, text, text, text, timestamptz
) to service_role;

create or replace function public.klyx_redrive_dead_lettered_job(
  p_case_id uuid,
  p_original_job_id uuid,
  p_operator_auth_user_id uuid,
  p_redrive_key text,
  p_reason_code text,
  p_available_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case public.ops_human_cases%rowtype;
  v_job public.ops_durable_jobs%rowtype;
  v_existing public.ops_durable_job_redrives%rowtype;
  v_redrive_key text := trim(coalesce(p_redrive_key, ''));
  v_reason_code text := upper(trim(coalesce(p_reason_code, '')));
  v_idempotency_key text;
  v_new_job_id uuid;
  v_new_operation_id uuid;
  v_new_correlation_id uuid;
  v_active_descendant uuid;
  v_link_exists boolean;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_HUMAN_OPS_OPERATOR_REQUIRED';
  end if;

  if
    v_redrive_key = ''
    or length(v_redrive_key) > 120
    or v_redrive_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'
  then
    raise exception 'KLYX_HUMAN_OPS_REDRIVE_KEY_INVALID';
  end if;

  if v_reason_code = '' then
    raise exception 'KLYX_HUMAN_OPS_REASON_REQUIRED';
  end if;

  select *
    into v_case
    from public.ops_human_cases
   where id = p_case_id
   for update;

  if not found then
    raise exception 'KLYX_HUMAN_OPS_CASE_NOT_FOUND';
  end if;

  if v_case.status <> 'in_review' then
    raise exception 'KLYX_HUMAN_OPS_REDRIVE_REQUIRES_IN_REVIEW';
  end if;

  if v_case.assigned_to_auth_user_id is distinct from p_operator_auth_user_id then
    raise exception 'KLYX_HUMAN_OPS_CASE_NOT_OWNED';
  end if;

  select *
    into v_job
    from public.ops_durable_jobs
   where id = p_original_job_id
   for update;

  if not found then
    raise exception 'KLYX_HUMAN_OPS_DURABLE_JOB_NOT_FOUND';
  end if;

  if v_job.status <> 'dead_lettered' then
    raise exception 'KLYX_HUMAN_OPS_DURABLE_JOB_NOT_DEAD_LETTERED';
  end if;

  select exists(
    select 1
      from public.ops_human_case_links
     where case_id = v_case.id
       and resource_type = 'durable_job'
       and resource_ref = v_job.id::text
  ) into v_link_exists;

  if not v_link_exists then
    raise exception 'KLYX_HUMAN_OPS_REDRIVE_JOB_NOT_LINKED';
  end if;

  select *
    into v_existing
    from public.ops_durable_job_redrives
   where case_id = v_case.id
     and redrive_key = v_redrive_key;

  if found then
    if
      v_existing.original_job_id is distinct from v_job.id
      or v_existing.operator_auth_user_id is distinct from p_operator_auth_user_id
      or v_existing.reason_code is distinct from v_reason_code
    then
      raise exception 'KLYX_HUMAN_OPS_REDRIVE_KEY_CONFLICT';
    end if;

    return v_existing.new_job_id;
  end if;

  select r.new_job_id
    into v_active_descendant
    from public.ops_durable_job_redrives as r
    join public.ops_durable_jobs as child
      on child.id = r.new_job_id
   where r.original_job_id = v_job.id
     and child.status in ('queued', 'running', 'retry_wait', 'succeeded')
   order by r.created_at desc
   limit 1;

  if v_active_descendant is not null then
    raise exception 'KLYX_HUMAN_OPS_REDRIVE_ACTIVE_DESCENDANT';
  end if;

  v_idempotency_key := concat(
    'redrive:',
    v_job.id::text,
    ':',
    v_redrive_key
  );

  select
    e.job_id,
    e.operation_id,
    e.correlation_id
  into
    v_new_job_id,
    v_new_operation_id,
    v_new_correlation_id
  from public.klyx_enqueue_durable_job(
    p_job_type => v_job.job_type,
    p_idempotency_key => v_idempotency_key,
    p_payload => v_job.payload,
    p_account_id => v_job.account_id,
    p_domain_type => v_job.domain_type,
    p_domain_resource_type => v_job.domain_resource_type,
    p_domain_resource_id => v_job.domain_resource_id,
    p_failure_domain_type => v_job.failure_domain_type,
    p_failure_domain_key => v_job.failure_domain_key,
    p_market_id => v_job.market_id,
    p_region_id => v_job.region_id,
    p_country_code => v_job.country_code,
    p_currency => v_job.currency,
    p_payment_provider => v_job.payment_provider,
    p_capability => v_job.capability,
    p_dependency => v_job.dependency,
    p_priority => v_job.priority,
    p_available_at => coalesce(p_available_at, now()),
    p_max_attempts => v_job.max_attempts,
    p_backoff_base_seconds => v_job.backoff_base_seconds,
    p_backoff_max_seconds => v_job.backoff_max_seconds
  ) as e;

  if v_new_job_id is null then
    raise exception 'KLYX_HUMAN_OPS_REDRIVE_ENQUEUE_FAILED';
  end if;

  insert into public.ops_durable_job_redrives (
    case_id,
    original_job_id,
    new_job_id,
    redrive_key,
    operator_auth_user_id,
    reason_code
  ) values (
    v_case.id,
    v_job.id,
    v_new_job_id,
    v_redrive_key,
    p_operator_auth_user_id,
    v_reason_code
  );

  insert into public.ops_human_case_links (
    case_id,
    resource_type,
    resource_ref,
    relation_type,
    metadata
  ) values (
    v_case.id,
    'durable_job',
    v_new_job_id::text,
    'redrive_child',
    jsonb_build_object(
      'original_job_id', v_job.id,
      'redrive_key', v_redrive_key
    )
  );

  insert into public.ops_events (
    operation_id,
    correlation_id,
    event_type,
    severity,
    domain_type,
    domain_resource_type,
    domain_resource_id,
    domain_event_id,
    failure_domain_type,
    failure_domain_key,
    market_id,
    region_id,
    country_code,
    currency,
    payment_provider,
    capability,
    dependency,
    metadata
  ) values (
    v_case.operation_id,
    v_case.correlation_id,
    'human_case.dlq_redrive_requested',
    'warning',
    'operations',
    'human_case',
    v_case.id::text,
    null,
    v_case.failure_domain_type,
    v_case.failure_domain_key,
    v_case.market_id,
    v_case.region_id,
    v_case.country_code,
    v_case.currency,
    v_case.payment_provider,
    v_case.capability,
    v_case.dependency,
    jsonb_build_object(
      'operator_auth_user_id', p_operator_auth_user_id,
      'original_job_id', v_job.id,
      'new_job_id', v_new_job_id,
      'new_operation_id', v_new_operation_id,
      'new_correlation_id', v_new_correlation_id,
      'redrive_key', v_redrive_key,
      'reason_code', v_reason_code
    )
  );

  return v_new_job_id;
end;
$$;

alter function public.klyx_redrive_dead_lettered_job(
  uuid, uuid, uuid, text, text, timestamptz
) owner to postgres;
revoke all on function public.klyx_redrive_dead_lettered_job(
  uuid, uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.klyx_redrive_dead_lettered_job(
  uuid, uuid, uuid, text, text, timestamptz
) to service_role;

comment on function public.klyx_redrive_dead_lettered_job(
  uuid, uuid, uuid, text, text, timestamptz
) is
  'Explicit human-owned DLQ redrive. The original dead-lettered durable job remains terminal; a new idempotent durable job is created and linked to the Human Operations case.';

commit;

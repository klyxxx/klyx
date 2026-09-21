begin;

-- KLYX MISSION 17 — CIRCUIT BREAKERS + INCIDENT ENGINE
--
-- Incident state is operational coordination state only.
-- Canonical Booking, Ledger, Settlement, Risk, Eligibility, Durable Jobs,
-- Human Operations and Financial Reconciliation remain authoritative.
--
-- Circuit breakers reuse Mission 13 ops_capability_controls. Mission 17 does
-- not create a second blocking authority.

create table if not exists public.ops_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null unique,

  operation_id uuid not null
    references public.ops_operations(id) on delete restrict,
  correlation_id uuid not null,

  source_type text not null,
  source_ref text not null,

  severity text not null,
  status text not null default 'open',
  reason_code text not null,
  title text not null,
  summary text not null,

  market_id text,
  region_id text,
  country_code text,
  currency text,
  payment_provider text,
  capability text,
  dependency text,

  opened_by_auth_user_id uuid not null
    references auth.users(id) on delete restrict,

  version bigint not null default 1,
  opened_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  mitigating_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint ops_incidents_key_check
    check (length(incident_key) between 3 and 256),
  constraint ops_incidents_source_type_check
    check (
      length(source_type) between 2 and 96
      and source_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_incidents_source_ref_check
    check (length(source_ref) between 1 and 512),
  constraint ops_incidents_severity_check
    check (severity in ('warning', 'error', 'critical')),
  constraint ops_incidents_status_check
    check (
      status in (
        'open',
        'acknowledged',
        'mitigating',
        'resolved',
        'closed'
      )
    ),
  constraint ops_incidents_reason_code_check
    check (
      length(reason_code) between 3 and 128
      and reason_code ~ '^[A-Z][A-Z0-9_:-]*$'
    ),
  constraint ops_incidents_title_check
    check (length(title) between 1 and 240),
  constraint ops_incidents_summary_check
    check (length(summary) between 1 and 4000),
  constraint ops_incidents_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint ops_incidents_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint ops_incidents_payment_provider_check
    check (
      payment_provider is null
      or (
        length(payment_provider) between 2 and 64
        and payment_provider ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_incidents_capability_check
    check (
      capability is null
      or (
        length(capability) between 2 and 128
        and capability ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_incidents_dependency_check
    check (
      dependency is null
      or (
        length(dependency) between 2 and 128
        and dependency ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_incidents_version_check
    check (version >= 1),
  constraint ops_incidents_closed_requires_resolved_check
    check (closed_at is null or resolved_at is not null)
);

comment on table public.ops_incidents is
  'Operational incident coordination state. Incidents never replace canonical business, financial, risk or execution truth.';

create index if not exists ops_incidents_status_idx
  on public.ops_incidents(status, severity, updated_at desc);
create index if not exists ops_incidents_scope_idx
  on public.ops_incidents(
    market_id,
    region_id,
    country_code,
    currency,
    payment_provider,
    capability,
    dependency,
    updated_at desc
  );

alter table public.ops_incidents enable row level security;
revoke all privileges on table public.ops_incidents
  from public, anon, authenticated, service_role;
grant select on table public.ops_incidents to service_role;

create table if not exists public.ops_incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null
    references public.ops_incidents(id) on delete restrict,
  event_key text not null unique,
  event_type text not null,
  actor_auth_user_id uuid not null
    references auth.users(id) on delete restrict,
  reason_code text not null,
  note text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint ops_incident_events_key_check
    check (length(event_key) between 3 and 320),
  constraint ops_incident_events_type_check
    check (
      length(event_type) between 3 and 96
      and event_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_incident_events_reason_check
    check (
      length(reason_code) between 3 and 128
      and reason_code ~ '^[A-Z][A-Z0-9_:-]*$'
    ),
  constraint ops_incident_events_note_check
    check (note is null or length(note) <= 4000),
  constraint ops_incident_events_details_check
    check (jsonb_typeof(details) = 'object')
);

comment on table public.ops_incident_events is
  'Append-only incident audit events. Current incident state remains a derived operational coordination state, not business truth.';

create index if not exists ops_incident_events_incident_idx
  on public.ops_incident_events(incident_id, created_at asc);

alter table public.ops_incident_events enable row level security;
revoke all privileges on table public.ops_incident_events
  from public, anon, authenticated, service_role;
grant select on table public.ops_incident_events to service_role;

create or replace function public.klyx_ops_incident_events_append_only_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'KLYX_OPS_INCIDENT_EVENTS_APPEND_ONLY';
end;
$$;

alter function public.klyx_ops_incident_events_append_only_guard()
  owner to postgres;
revoke all on function public.klyx_ops_incident_events_append_only_guard()
  from public, anon, authenticated;
grant execute on function public.klyx_ops_incident_events_append_only_guard()
  to service_role;

drop trigger if exists klyx_ops_incident_events_append_only
  on public.ops_incident_events;
create trigger klyx_ops_incident_events_append_only
before update or delete on public.ops_incident_events
for each row execute function public.klyx_ops_incident_events_append_only_guard();

create table if not exists public.ops_incident_controls (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null
    references public.ops_incidents(id) on delete restrict,
  control_id uuid not null
    references public.ops_capability_controls(id) on delete restrict,
  opened_by_auth_user_id uuid not null
    references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_by_auth_user_id uuid
    references auth.users(id) on delete restrict,
  closed_at timestamptz,

  constraint ops_incident_controls_close_actor_check
    check (
      (closed_at is null and closed_by_auth_user_id is null)
      or
      (closed_at is not null and closed_by_auth_user_id is not null)
    )
);

comment on table public.ops_incident_controls is
  'Incident-to-control activation history. Enforcement authority remains ops_capability_controls.';

create unique index if not exists ops_incident_controls_one_active_per_incident
  on public.ops_incident_controls(incident_id)
  where closed_at is null;
create index if not exists ops_incident_controls_control_idx
  on public.ops_incident_controls(control_id, opened_at desc);

alter table public.ops_incident_controls enable row level security;
revoke all privileges on table public.ops_incident_controls
  from public, anon, authenticated, service_role;
grant select on table public.ops_incident_controls to service_role;

create or replace function public.klyx_open_ops_incident(
  p_incident_key text,
  p_source_type text,
  p_source_ref text,
  p_severity text,
  p_reason_code text,
  p_title text,
  p_summary text,
  p_operator_auth_user_id uuid,
  p_market_id text default null,
  p_region_id text default null,
  p_country_code text default null,
  p_currency text default null,
  p_payment_provider text default null,
  p_capability text default null,
  p_dependency text default null
)
returns table(incident_id uuid, version bigint, operation_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_incident_key text := trim(coalesce(p_incident_key, ''));
  v_source_type text := lower(trim(coalesce(p_source_type, '')));
  v_source_ref text := trim(coalesce(p_source_ref, ''));
  v_severity text := lower(trim(coalesce(p_severity, '')));
  v_reason_code text := upper(trim(coalesce(p_reason_code, '')));
  v_title text := trim(coalesce(p_title, ''));
  v_summary text := trim(coalesce(p_summary, ''));
  v_market_id text := nullif(trim(p_market_id), '');
  v_region_id text := nullif(trim(p_region_id), '');
  v_country_code text := upper(nullif(trim(p_country_code), ''));
  v_currency text := upper(nullif(trim(p_currency), ''));
  v_payment_provider text := lower(nullif(trim(p_payment_provider), ''));
  v_capability text := lower(nullif(trim(p_capability), ''));
  v_dependency text := lower(nullif(trim(p_dependency), ''));
  v_existing public.ops_incidents%rowtype;
  v_incident_id uuid;
  v_version bigint;
  v_operation_id uuid;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_OPS_INCIDENT_OPERATOR_REQUIRED';
  end if;

  if v_incident_key = '' or length(v_incident_key) > 256 then
    raise exception 'KLYX_OPS_INCIDENT_KEY_INVALID';
  end if;

  if
    v_source_type = ''
    or v_source_type !~ '^[a-z][a-z0-9_.:-]*$'
    or v_source_ref = ''
  then
    raise exception 'KLYX_OPS_INCIDENT_SOURCE_INVALID';
  end if;

  if v_severity not in ('warning', 'error', 'critical') then
    raise exception 'KLYX_OPS_INCIDENT_SEVERITY_INVALID';
  end if;

  if v_reason_code = '' or v_title = '' or v_summary = '' then
    raise exception 'KLYX_OPS_INCIDENT_DETAILS_REQUIRED';
  end if;

  if v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'KLYX_OPS_INCIDENT_COUNTRY_INVALID';
  end if;

  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_OPS_INCIDENT_CURRENCY_INVALID';
  end if;

  select *
    into v_existing
    from public.ops_incidents
   where incident_key = v_incident_key;

  if found then
    if
      v_existing.source_type is distinct from v_source_type
      or v_existing.source_ref is distinct from v_source_ref
      or v_existing.severity is distinct from v_severity
      or v_existing.reason_code is distinct from v_reason_code
    then
      raise exception 'KLYX_OPS_INCIDENT_KEY_CONFLICT';
    end if;

    return query
    select v_existing.id, v_existing.version, v_existing.operation_id;
    return;
  end if;

  insert into public.ops_operations (
    correlation_id,
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
    status,
    started_at,
    completed_at
  ) values (
    v_correlation_id,
    'operations',
    'ops_incident',
    v_incident_key,
    'incident',
    v_incident_key,
    v_market_id,
    v_region_id,
    v_country_code,
    v_currency,
    v_payment_provider,
    v_capability,
    v_dependency,
    'ops.incident.open',
    case
      when v_severity = 'critical' then 'critical'
      when v_severity = 'error' then 'high'
      else 'normal'
    end,
    'succeeded',
    now(),
    now()
  )
  returning id into v_operation_id;

  insert into public.ops_incidents (
    incident_key,
    operation_id,
    correlation_id,
    source_type,
    source_ref,
    severity,
    status,
    reason_code,
    title,
    summary,
    market_id,
    region_id,
    country_code,
    currency,
    payment_provider,
    capability,
    dependency,
    opened_by_auth_user_id
  ) values (
    v_incident_key,
    v_operation_id,
    v_correlation_id,
    v_source_type,
    v_source_ref,
    v_severity,
    'open',
    v_reason_code,
    v_title,
    v_summary,
    v_market_id,
    v_region_id,
    v_country_code,
    v_currency,
    v_payment_provider,
    v_capability,
    v_dependency,
    p_operator_auth_user_id
  )
  returning id, public.ops_incidents.version
  into v_incident_id, v_version;

  insert into public.ops_incident_events (
    incident_id,
    event_key,
    event_type,
    actor_auth_user_id,
    reason_code,
    details
  ) values (
    v_incident_id,
    concat('incident:', v_incident_id::text, ':opened'),
    'opened',
    p_operator_auth_user_id,
    v_reason_code,
    jsonb_build_object(
      'source_type', v_source_type,
      'source_ref', v_source_ref,
      'severity', v_severity
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
    v_operation_id,
    v_correlation_id,
    'incident.opened',
    v_severity,
    'operations',
    'ops_incident',
    v_incident_id::text,
    'incident',
    v_incident_key,
    v_market_id,
    v_region_id,
    v_country_code,
    v_currency,
    v_payment_provider,
    v_capability,
    v_dependency,
    jsonb_build_object(
      'incident_id', v_incident_id,
      'reason_code', v_reason_code,
      'source_type', v_source_type,
      'source_ref', v_source_ref
    )
  );

  return query select v_incident_id, v_version, v_operation_id;
end;
$$;

alter function public.klyx_open_ops_incident(
  text, text, text, text, text, text, text, uuid,
  text, text, text, text, text, text, text
) owner to postgres;
revoke all on function public.klyx_open_ops_incident(
  text, text, text, text, text, text, text, uuid,
  text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.klyx_open_ops_incident(
  text, text, text, text, text, text, text, uuid,
  text, text, text, text, text, text, text
) to service_role;

create or replace function public.klyx_transition_ops_incident(
  p_incident_id uuid,
  p_operator_auth_user_id uuid,
  p_expected_version bigint,
  p_to_status text,
  p_reason_code text,
  p_note text default null
)
returns table(incident_id uuid, status text, version bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_incident public.ops_incidents%rowtype;
  v_to_status text := lower(trim(coalesce(p_to_status, '')));
  v_reason_code text := upper(trim(coalesce(p_reason_code, '')));
  v_note text := nullif(trim(p_note), '');
  v_event_type text;
  v_active_breaker boolean;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_OPS_INCIDENT_OPERATOR_REQUIRED';
  end if;

  if v_reason_code = '' then
    raise exception 'KLYX_OPS_INCIDENT_REASON_REQUIRED';
  end if;

  select *
    into v_incident
    from public.ops_incidents
   where id = p_incident_id
   for update;

  if not found then
    raise exception 'KLYX_OPS_INCIDENT_NOT_FOUND';
  end if;

  if v_incident.version <> p_expected_version then
    raise exception 'KLYX_OPS_INCIDENT_VERSION_CONFLICT';
  end if;

  if v_incident.status = v_to_status then
    return query
    select v_incident.id, v_incident.status, v_incident.version;
    return;
  end if;

  if not (
    (v_incident.status = 'open' and v_to_status = 'acknowledged')
    or
    (v_incident.status = 'acknowledged' and v_to_status in ('mitigating', 'resolved'))
    or
    (v_incident.status = 'mitigating' and v_to_status = 'resolved')
    or
    (v_incident.status = 'resolved' and v_to_status = 'closed')
  ) then
    raise exception 'KLYX_OPS_INCIDENT_TRANSITION_INVALID';
  end if;

  if v_to_status in ('resolved', 'closed') then
    select exists(
      select 1
        from public.ops_incident_controls
       where incident_id = v_incident.id
         and closed_at is null
    ) into v_active_breaker;

    if v_active_breaker then
      raise exception 'KLYX_OPS_INCIDENT_ACTIVE_BREAKER';
    end if;
  end if;

  v_event_type := case v_to_status
    when 'acknowledged' then 'acknowledged'
    when 'mitigating' then 'mitigation_started'
    when 'resolved' then 'resolved'
    when 'closed' then 'closed'
  end;

  update public.ops_incidents
     set status = v_to_status,
         acknowledged_at = case
           when v_to_status = 'acknowledged'
           then coalesce(acknowledged_at, now())
           else acknowledged_at
         end,
         mitigating_at = case
           when v_to_status = 'mitigating'
           then coalesce(mitigating_at, now())
           else mitigating_at
         end,
         resolved_at = case
           when v_to_status = 'resolved'
           then coalesce(resolved_at, now())
           else resolved_at
         end,
         closed_at = case
           when v_to_status = 'closed'
           then coalesce(closed_at, now())
           else closed_at
         end,
         version = version + 1,
         updated_at = now()
   where id = v_incident.id
   returning * into v_incident;

  insert into public.ops_incident_events (
    incident_id,
    event_key,
    event_type,
    actor_auth_user_id,
    reason_code,
    note,
    details
  ) values (
    v_incident.id,
    concat(
      'incident:',
      v_incident.id::text,
      ':',
      v_incident.version::text,
      ':',
      v_event_type
    ),
    v_event_type,
    p_operator_auth_user_id,
    v_reason_code,
    v_note,
    jsonb_build_object('status', v_incident.status)
  );

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
    v_incident.operation_id,
    v_incident.correlation_id,
    concat('incident.', v_event_type),
    case
      when v_incident.severity = 'critical' and v_to_status not in ('resolved', 'closed')
        then 'critical'
      when v_to_status in ('resolved', 'closed') then 'info'
      else 'warning'
    end,
    'operations',
    'ops_incident',
    v_incident.id::text,
    'incident',
    v_incident.incident_key,
    v_incident.market_id,
    v_incident.region_id,
    v_incident.country_code,
    v_incident.currency,
    v_incident.payment_provider,
    v_incident.capability,
    v_incident.dependency,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'status', v_incident.status,
      'reason_code', v_reason_code,
      'version', v_incident.version
    )
  );

  return query
  select v_incident.id, v_incident.status, v_incident.version;
end;
$$;

alter function public.klyx_transition_ops_incident(
  uuid, uuid, bigint, text, text, text
) owner to postgres;
revoke all on function public.klyx_transition_ops_incident(
  uuid, uuid, bigint, text, text, text
) from public, anon, authenticated;
grant execute on function public.klyx_transition_ops_incident(
  uuid, uuid, bigint, text, text, text
) to service_role;

create or replace function public.klyx_open_incident_circuit_breaker(
  p_incident_id uuid,
  p_operator_auth_user_id uuid,
  p_expected_version bigint,
  p_reason_code text,
  p_expires_at timestamptz default null
)
returns table(
  incident_id uuid,
  control_id uuid,
  control_version bigint,
  incident_version bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_incident public.ops_incidents%rowtype;
  v_reason_code text := upper(trim(coalesce(p_reason_code, '')));
  v_control_id uuid;
  v_control_version bigint;
  v_control_operation_id uuid;
  v_active public.ops_incident_controls%rowtype;
  v_active_control_state text;
  v_active_control_expires_at timestamptz;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_OPS_INCIDENT_OPERATOR_REQUIRED';
  end if;

  if v_reason_code = '' then
    raise exception 'KLYX_OPS_INCIDENT_REASON_REQUIRED';
  end if;

  select *
    into v_incident
    from public.ops_incidents
   where id = p_incident_id
   for update;

  if not found then
    raise exception 'KLYX_OPS_INCIDENT_NOT_FOUND';
  end if;

  if v_incident.version <> p_expected_version then
    raise exception 'KLYX_OPS_INCIDENT_VERSION_CONFLICT';
  end if;

  if v_incident.status not in ('acknowledged', 'mitigating') then
    raise exception 'KLYX_OPS_INCIDENT_BREAKER_STATUS_INVALID';
  end if;

  if
    v_incident.market_id is null
    and v_incident.region_id is null
    and v_incident.country_code is null
    and v_incident.currency is null
    and v_incident.payment_provider is null
    and v_incident.capability is null
    and v_incident.dependency is null
  then
    raise exception 'KLYX_OPS_INCIDENT_BREAKER_SCOPE_REQUIRED';
  end if;

  select *
    into v_active
    from public.ops_incident_controls
   where incident_id = v_incident.id
     and closed_at is null
   order by opened_at desc
   limit 1;

  if found then
    select c.version, c.state, c.expires_at
      into
        v_control_version,
        v_active_control_state,
        v_active_control_expires_at
      from public.ops_capability_controls as c
     where c.id = v_active.control_id;

    if
      v_active_control_state is distinct from 'DISABLED'
      or (
        v_active_control_expires_at is not null
        and v_active_control_expires_at <= now()
      )
    then
      raise exception 'KLYX_OPS_INCIDENT_BREAKER_STALE_LINK';
    end if;

    return query
    select
      v_incident.id,
      v_active.control_id,
      v_control_version,
      v_incident.version;
    return;
  end if;

  select
    c.control_id,
    c.version,
    c.operation_id
  into
    v_control_id,
    v_control_version,
    v_control_operation_id
  from public.klyx_ops_set_manual_control(
    p_scope_type => 'incident',
    p_scope_key => v_incident.id::text,
    p_state => 'DISABLED',
    p_reason_code => v_reason_code,
    p_operator_user_id => p_operator_auth_user_id,
    p_market_id => v_incident.market_id,
    p_region_id => v_incident.region_id,
    p_country_code => v_incident.country_code,
    p_currency => v_incident.currency,
    p_payment_provider => v_incident.payment_provider,
    p_capability => v_incident.capability,
    p_dependency => v_incident.dependency,
    p_expires_at => p_expires_at
  ) as c;

  if v_control_id is null then
    raise exception 'KLYX_OPS_INCIDENT_BREAKER_CONTROL_FAILED';
  end if;

  insert into public.ops_incident_controls (
    incident_id,
    control_id,
    opened_by_auth_user_id
  ) values (
    v_incident.id,
    v_control_id,
    p_operator_auth_user_id
  );

  update public.ops_incidents
     set version = version + 1,
         updated_at = now()
   where id = v_incident.id
   returning * into v_incident;

  insert into public.ops_incident_events (
    incident_id,
    event_key,
    event_type,
    actor_auth_user_id,
    reason_code,
    details
  ) values (
    v_incident.id,
    concat(
      'incident:',
      v_incident.id::text,
      ':',
      v_incident.version::text,
      ':circuit_opened'
    ),
    'circuit_opened',
    p_operator_auth_user_id,
    v_reason_code,
    jsonb_build_object(
      'control_id', v_control_id,
      'control_version', v_control_version,
      'control_operation_id', v_control_operation_id,
      'expires_at', p_expires_at
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
    v_incident.operation_id,
    v_incident.correlation_id,
    'incident.circuit_opened',
    'critical',
    'operations',
    'ops_incident',
    v_incident.id::text,
    'incident',
    v_incident.incident_key,
    v_incident.market_id,
    v_incident.region_id,
    v_incident.country_code,
    v_incident.currency,
    v_incident.payment_provider,
    v_incident.capability,
    v_incident.dependency,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'control_id', v_control_id,
      'reason_code', v_reason_code
    )
  );

  return query
  select
    v_incident.id,
    v_control_id,
    v_control_version,
    v_incident.version;
end;
$$;

alter function public.klyx_open_incident_circuit_breaker(
  uuid, uuid, bigint, text, timestamptz
) owner to postgres;
revoke all on function public.klyx_open_incident_circuit_breaker(
  uuid, uuid, bigint, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.klyx_open_incident_circuit_breaker(
  uuid, uuid, bigint, text, timestamptz
) to service_role;

create or replace function public.klyx_close_incident_circuit_breaker(
  p_incident_id uuid,
  p_operator_auth_user_id uuid,
  p_expected_version bigint,
  p_reason_code text
)
returns table(
  incident_id uuid,
  control_id uuid,
  control_version bigint,
  incident_version bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_incident public.ops_incidents%rowtype;
  v_reason_code text := upper(trim(coalesce(p_reason_code, '')));
  v_active public.ops_incident_controls%rowtype;
  v_control_id uuid;
  v_control_version bigint;
  v_control_operation_id uuid;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_OPS_INCIDENT_OPERATOR_REQUIRED';
  end if;

  if v_reason_code = '' then
    raise exception 'KLYX_OPS_INCIDENT_REASON_REQUIRED';
  end if;

  select *
    into v_incident
    from public.ops_incidents
   where id = p_incident_id
   for update;

  if not found then
    raise exception 'KLYX_OPS_INCIDENT_NOT_FOUND';
  end if;

  if v_incident.version <> p_expected_version then
    raise exception 'KLYX_OPS_INCIDENT_VERSION_CONFLICT';
  end if;

  select *
    into v_active
    from public.ops_incident_controls
   where incident_id = v_incident.id
     and closed_at is null
   order by opened_at desc
   limit 1
   for update;

  if not found then
    raise exception 'KLYX_OPS_INCIDENT_BREAKER_NOT_ACTIVE';
  end if;

  select
    c.control_id,
    c.version,
    c.operation_id
  into
    v_control_id,
    v_control_version,
    v_control_operation_id
  from public.klyx_ops_set_manual_control(
    p_scope_type => 'incident',
    p_scope_key => v_incident.id::text,
    p_state => 'ENABLED',
    p_reason_code => v_reason_code,
    p_operator_user_id => p_operator_auth_user_id,
    p_market_id => v_incident.market_id,
    p_region_id => v_incident.region_id,
    p_country_code => v_incident.country_code,
    p_currency => v_incident.currency,
    p_payment_provider => v_incident.payment_provider,
    p_capability => v_incident.capability,
    p_dependency => v_incident.dependency,
    p_expires_at => null
  ) as c;

  if v_control_id is distinct from v_active.control_id then
    raise exception 'KLYX_OPS_INCIDENT_BREAKER_CONTROL_MISMATCH';
  end if;

  update public.ops_incident_controls
     set closed_by_auth_user_id = p_operator_auth_user_id,
         closed_at = now()
   where id = v_active.id;

  update public.ops_incidents
     set version = version + 1,
         updated_at = now()
   where id = v_incident.id
   returning * into v_incident;

  insert into public.ops_incident_events (
    incident_id,
    event_key,
    event_type,
    actor_auth_user_id,
    reason_code,
    details
  ) values (
    v_incident.id,
    concat(
      'incident:',
      v_incident.id::text,
      ':',
      v_incident.version::text,
      ':circuit_closed'
    ),
    'circuit_closed',
    p_operator_auth_user_id,
    v_reason_code,
    jsonb_build_object(
      'control_id', v_control_id,
      'control_version', v_control_version,
      'control_operation_id', v_control_operation_id
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
    v_incident.operation_id,
    v_incident.correlation_id,
    'incident.circuit_closed',
    'info',
    'operations',
    'ops_incident',
    v_incident.id::text,
    'incident',
    v_incident.incident_key,
    v_incident.market_id,
    v_incident.region_id,
    v_incident.country_code,
    v_incident.currency,
    v_incident.payment_provider,
    v_incident.capability,
    v_incident.dependency,
    jsonb_build_object(
      'incident_id', v_incident.id,
      'control_id', v_control_id,
      'reason_code', v_reason_code
    )
  );

  return query
  select
    v_incident.id,
    v_control_id,
    v_control_version,
    v_incident.version;
end;
$$;

alter function public.klyx_close_incident_circuit_breaker(
  uuid, uuid, bigint, text
) owner to postgres;
revoke all on function public.klyx_close_incident_circuit_breaker(
  uuid, uuid, bigint, text
) from public, anon, authenticated;
grant execute on function public.klyx_close_incident_circuit_breaker(
  uuid, uuid, bigint, text
) to service_role;

create or replace view public.ops_incidents_current as
select
  i.*,
  active.control_id as active_control_id,
  control.state as active_control_state,
  control.reason_code as active_control_reason_code,
  control.version as active_control_version,
  active.opened_at as circuit_opened_at
from public.ops_incidents as i
left join lateral (
  select c.*
    from public.ops_incident_controls as c
   where c.incident_id = i.id
     and c.closed_at is null
   order by c.opened_at desc
   limit 1
) as active on true
left join public.ops_capability_controls as control
  on control.id = active.control_id;

comment on view public.ops_incidents_current is
  'Read-only current incident projection with active incident-owned circuit breaker, if any. Enforcement truth remains ops_capability_controls.';

revoke all privileges on table public.ops_incidents_current
  from public, anon, authenticated, service_role;
grant select on table public.ops_incidents_current to service_role;

commit;

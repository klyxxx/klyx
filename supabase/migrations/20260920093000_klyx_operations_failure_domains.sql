begin;

-- KLYX_MISSION_13_OPERATIONS_FAILURE_DOMAINS_20260920
--
-- Operations is a control plane, not a new business authority.
-- It references Booking / Ledger / Settlement / Risk / Trust & Safety facts
-- instead of copying their canonical payloads.
--
-- Failure-domain dimensions are structured columns. A derived human-readable
-- label may be emitted to logs/traces later, but is never the only authority.

create table if not exists public.ops_operations (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null default gen_random_uuid(),
  trace_id text,
  request_id text,

  account_id uuid references public.accounts(id) on delete set null,

  domain_type text,
  domain_resource_type text,
  domain_resource_id text,

  failure_domain_type text not null default 'global',
  failure_domain_key text not null default 'global',
  market_id text,
  region_id text,
  country_code text,
  currency text,
  payment_provider text,
  capability text,
  dependency text,

  operation_type text not null,
  risk_level text not null default 'normal',
  financial_impact_minor bigint,
  financial_currency text,
  status text not null default 'started',

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ops_operations_failure_domain_type_format_check
    check (
      length(failure_domain_type) between 2 and 64
      and failure_domain_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_operations_failure_domain_key_check
    check (length(failure_domain_key) between 1 and 256),
  constraint ops_operations_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint ops_operations_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint ops_operations_capability_format_check
    check (
      capability is null
      or (
        length(capability) between 2 and 128
        and capability ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_operations_payment_provider_format_check
    check (
      payment_provider is null
      or (
        length(payment_provider) between 2 and 64
        and payment_provider ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_operations_dependency_format_check
    check (
      dependency is null
      or (
        length(dependency) between 2 and 128
        and dependency ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_operations_operation_type_format_check
    check (
      length(operation_type) between 3 and 128
      and operation_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_operations_risk_level_format_check
    check (
      length(risk_level) between 2 and 32
      and risk_level ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_operations_status_format_check
    check (
      length(status) between 2 and 64
      and status ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_operations_financial_impact_check
    check (
      financial_impact_minor is null
      or (
        financial_impact_minor >= 0
        and financial_currency is not null
        and financial_currency ~ '^[A-Z]{3}$'
      )
    )
);

comment on table public.ops_operations is
  'KLYX Operations correlation/control-plane operation ledger. This table coordinates operations but never replaces domain truth.';
comment on column public.ops_operations.domain_resource_id is
  'Reference to a canonical domain resource. Operations must not copy the canonical business object as its own authority.';
comment on column public.ops_operations.failure_domain_type is
  'Structured failure-domain classifier. The readable country:BR style string is derived, not authoritative.';

create index if not exists ops_operations_correlation_idx
  on public.ops_operations (correlation_id, created_at desc);
create index if not exists ops_operations_failure_domain_idx
  on public.ops_operations (
    failure_domain_type,
    failure_domain_key,
    country_code,
    currency,
    payment_provider,
    capability,
    created_at desc
  );
create index if not exists ops_operations_status_idx
  on public.ops_operations (status, created_at desc);

alter table public.ops_operations enable row level security;
revoke all privileges on table public.ops_operations
  from public, anon, authenticated;
grant select, insert, update on table public.ops_operations
  to service_role;

create table if not exists public.ops_events (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.ops_operations(id) on delete restrict,
  correlation_id uuid not null,

  event_type text not null,
  severity text not null default 'info',

  domain_type text,
  domain_resource_type text,
  domain_resource_id text,
  domain_event_id text,

  failure_domain_type text not null default 'global',
  failure_domain_key text not null default 'global',
  market_id text,
  region_id text,
  country_code text,
  currency text,
  payment_provider text,
  capability text,
  dependency text,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint ops_events_event_type_format_check
    check (
      length(event_type) between 3 and 128
      and event_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_events_severity_format_check
    check (
      length(severity) between 2 and 32
      and severity ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_events_failure_domain_type_format_check
    check (
      length(failure_domain_type) between 2 and 64
      and failure_domain_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_events_failure_domain_key_check
    check (length(failure_domain_key) between 1 and 256),
  constraint ops_events_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint ops_events_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$')
);

comment on table public.ops_events is
  'Append-only Operations events. domain_event_id references an existing canonical domain journal when one exists.';
comment on column public.ops_events.metadata is
  'Operational metadata only. Do not mirror canonical Booking/Ledger/Settlement/Trust payloads here.';

create index if not exists ops_events_operation_idx
  on public.ops_events (operation_id, created_at asc);
create index if not exists ops_events_correlation_idx
  on public.ops_events (correlation_id, created_at asc);
create index if not exists ops_events_domain_reference_idx
  on public.ops_events (domain_type, domain_resource_id, domain_event_id);
create index if not exists ops_events_failure_domain_idx
  on public.ops_events (
    failure_domain_type,
    failure_domain_key,
    country_code,
    currency,
    payment_provider,
    capability,
    created_at desc
  );

alter table public.ops_events enable row level security;
revoke all privileges on table public.ops_events
  from public, anon, authenticated;
grant select, insert on table public.ops_events
  to service_role;

create or replace function public.klyx_ops_events_append_only_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'KLYX_OPS_EVENTS_APPEND_ONLY';
end;
$$;

alter function public.klyx_ops_events_append_only_guard() owner to postgres;
revoke all on function public.klyx_ops_events_append_only_guard()
  from public, anon, authenticated;
grant execute on function public.klyx_ops_events_append_only_guard()
  to service_role;

drop trigger if exists klyx_ops_events_append_only on public.ops_events;
create trigger klyx_ops_events_append_only
before update or delete on public.ops_events
for each row execute function public.klyx_ops_events_append_only_guard();

create table if not exists public.ops_capability_controls (
  id uuid primary key default gen_random_uuid(),
  control_key text not null unique,

  scope_type text not null,
  scope_key text not null,

  market_id text,
  region_id text,
  country_code text,
  currency text,
  payment_provider text,
  capability text,
  dependency text,

  state text not null,
  reason_code text not null,
  operator_user_id uuid not null,
  expires_at timestamptz,
  version bigint not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ops_capability_controls_scope_type_format_check
    check (
      length(scope_type) between 2 and 64
      and scope_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_capability_controls_scope_key_check
    check (length(scope_key) between 1 and 256),
  constraint ops_capability_controls_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint ops_capability_controls_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint ops_capability_controls_payment_provider_format_check
    check (
      payment_provider is null
      or (
        length(payment_provider) between 2 and 64
        and payment_provider ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_capability_controls_capability_format_check
    check (
      capability is null
      or (
        length(capability) between 2 and 128
        and capability ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_capability_controls_dependency_format_check
    check (
      dependency is null
      or (
        length(dependency) between 2 and 128
        and dependency ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_capability_controls_state_check
    check (state in ('ENABLED', 'DISABLED')),
  constraint ops_capability_controls_reason_format_check
    check (
      length(reason_code) between 3 and 128
      and reason_code ~ '^[A-Z][A-Z0-9_:-]*$'
    ),
  constraint ops_capability_controls_version_check
    check (version >= 1)
);

comment on table public.ops_capability_controls is
  'Manual scoped Operations kill-switch state. Any matching active DISABLED control blocks; ENABLED never overrides another matching DISABLED control.';
comment on column public.ops_capability_controls.control_key is
  'Deterministic structured-scope fingerprint. It is not a parsed failure-domain authority.';

create index if not exists ops_capability_controls_active_disabled_idx
  on public.ops_capability_controls (
    capability,
    country_code,
    currency,
    payment_provider,
    dependency,
    updated_at desc
  )
  where state = 'DISABLED';

alter table public.ops_capability_controls enable row level security;
revoke all privileges on table public.ops_capability_controls
  from public, anon, authenticated;
grant select, insert, update on table public.ops_capability_controls
  to service_role;

create or replace function public.klyx_ops_set_manual_control(
  p_scope_type text,
  p_scope_key text,
  p_state text,
  p_reason_code text,
  p_operator_user_id uuid,
  p_market_id text default null,
  p_region_id text default null,
  p_country_code text default null,
  p_currency text default null,
  p_payment_provider text default null,
  p_capability text default null,
  p_dependency text default null,
  p_expires_at timestamptz default null
)
returns table(control_id uuid, version bigint, operation_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_scope_type text := lower(trim(coalesce(p_scope_type, '')));
  v_scope_key text := trim(coalesce(p_scope_key, ''));
  v_state text := upper(trim(coalesce(p_state, '')));
  v_reason_code text := upper(trim(coalesce(p_reason_code, '')));
  v_market_id text := nullif(trim(p_market_id), '');
  v_region_id text := nullif(trim(p_region_id), '');
  v_country_code text := upper(nullif(trim(p_country_code), ''));
  v_currency text := upper(nullif(trim(p_currency), ''));
  v_payment_provider text := lower(nullif(trim(p_payment_provider), ''));
  v_capability text := lower(nullif(trim(p_capability), ''));
  v_dependency text := lower(nullif(trim(p_dependency), ''));
  v_control_key text;
  v_control_id uuid;
  v_control_version bigint;
  v_operation_id uuid;
  v_correlation_id uuid := gen_random_uuid();
begin
  if v_scope_type = '' or v_scope_key = '' then
    raise exception 'KLYX_OPS_SCOPE_REQUIRED';
  end if;

  if v_state not in ('ENABLED', 'DISABLED') then
    raise exception 'KLYX_OPS_CONTROL_STATE_INVALID';
  end if;

  if v_reason_code = '' then
    raise exception 'KLYX_OPS_REASON_REQUIRED';
  end if;

  if v_scope_type = 'global' then
    if lower(v_scope_key) <> 'global' then
      raise exception 'KLYX_OPS_GLOBAL_SCOPE_KEY_INVALID';
    end if;
    v_scope_key := 'global';
  elsif v_scope_type = 'country' and v_country_code is null then
    v_country_code := upper(v_scope_key);
  elsif v_scope_type = 'currency' and v_currency is null then
    v_currency := upper(v_scope_key);
  elsif v_scope_type = 'payment_provider' and v_payment_provider is null then
    v_payment_provider := lower(v_scope_key);
  elsif v_scope_type = 'capability' and v_capability is null then
    v_capability := lower(v_scope_key);
  elsif v_scope_type = 'dependency' and v_dependency is null then
    v_dependency := lower(v_scope_key);
  elsif v_scope_type = 'market' and v_market_id is null then
    v_market_id := v_scope_key;
  elsif v_scope_type = 'region' and v_region_id is null then
    v_region_id := v_scope_key;
  end if;

  if v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'KLYX_OPS_COUNTRY_CODE_INVALID';
  end if;

  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_OPS_CURRENCY_INVALID';
  end if;

  if
    v_scope_type <> 'global'
    and v_market_id is null
    and v_region_id is null
    and v_country_code is null
    and v_currency is null
    and v_payment_provider is null
    and v_capability is null
    and v_dependency is null
  then
    raise exception 'KLYX_OPS_SCOPE_NOT_STRUCTURED';
  end if;

  v_control_key := concat_ws(
    '|',
    v_scope_type,
    v_scope_key,
    coalesce(v_market_id, '*'),
    coalesce(v_region_id, '*'),
    coalesce(v_country_code, '*'),
    coalesce(v_currency, '*'),
    coalesce(v_payment_provider, '*'),
    coalesce(v_capability, '*'),
    coalesce(v_dependency, '*')
  );

  insert into public.ops_capability_controls (
    control_key,
    scope_type,
    scope_key,
    market_id,
    region_id,
    country_code,
    currency,
    payment_provider,
    capability,
    dependency,
    state,
    reason_code,
    operator_user_id,
    expires_at
  ) values (
    v_control_key,
    v_scope_type,
    v_scope_key,
    v_market_id,
    v_region_id,
    v_country_code,
    v_currency,
    v_payment_provider,
    v_capability,
    v_dependency,
    v_state,
    v_reason_code,
    p_operator_user_id,
    p_expires_at
  )
  on conflict (control_key) do update
  set
    state = excluded.state,
    reason_code = excluded.reason_code,
    operator_user_id = excluded.operator_user_id,
    expires_at = excluded.expires_at,
    version = public.ops_capability_controls.version + 1,
    updated_at = now()
  returning id, public.ops_capability_controls.version
  into v_control_id, v_control_version;

  insert into public.ops_operations (
    correlation_id,
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
    v_scope_type,
    v_scope_key,
    v_market_id,
    v_region_id,
    v_country_code,
    v_currency,
    v_payment_provider,
    v_capability,
    v_dependency,
    'ops.manual_control.set',
    case when v_state = 'DISABLED' then 'high' else 'normal' end,
    'succeeded',
    now(),
    now()
  )
  returning id into v_operation_id;

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
    'manual_control_changed',
    case when v_state = 'DISABLED' then 'warning' else 'info' end,
    'operations',
    'ops_capability_control',
    v_control_id::text,
    v_scope_type,
    v_scope_key,
    v_market_id,
    v_region_id,
    v_country_code,
    v_currency,
    v_payment_provider,
    v_capability,
    v_dependency,
    jsonb_build_object(
      'control_id', v_control_id,
      'state', v_state,
      'reason_code', v_reason_code,
      'version', v_control_version,
      'operator_user_id', p_operator_user_id,
      'expires_at', p_expires_at
    )
  );

  return query
  select v_control_id, v_control_version, v_operation_id;
end;
$$;

alter function public.klyx_ops_set_manual_control(
  text, text, text, text, uuid, text, text, text, text, text, text, text, timestamptz
) owner to postgres;
revoke all on function public.klyx_ops_set_manual_control(
  text, text, text, text, uuid, text, text, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.klyx_ops_set_manual_control(
  text, text, text, text, uuid, text, text, text, text, text, text, text, timestamptz
) to service_role;

create or replace function public.klyx_ops_capability_decision(
  p_capability text,
  p_market_id text default null,
  p_region_id text default null,
  p_country_code text default null,
  p_currency text default null,
  p_payment_provider text default null,
  p_dependency text default null
)
returns table(
  allowed boolean,
  blocking_control_id uuid,
  reason_code text,
  control_version bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_capability text := lower(nullif(trim(p_capability), ''));
  v_market_id text := nullif(trim(p_market_id), '');
  v_region_id text := nullif(trim(p_region_id), '');
  v_country_code text := upper(nullif(trim(p_country_code), ''));
  v_currency text := upper(nullif(trim(p_currency), ''));
  v_payment_provider text := lower(nullif(trim(p_payment_provider), ''));
  v_dependency text := lower(nullif(trim(p_dependency), ''));
  v_block record;
begin
  if v_capability is null then
    raise exception 'KLYX_OPS_CAPABILITY_REQUIRED';
  end if;

  select
    control.id,
    control.reason_code,
    control.version
  into v_block
  from public.ops_capability_controls as control
  where
    control.state = 'DISABLED'
    and (control.expires_at is null or control.expires_at > now())
    and (control.market_id is null or control.market_id = v_market_id)
    and (control.region_id is null or control.region_id = v_region_id)
    and (control.country_code is null or control.country_code = v_country_code)
    and (control.currency is null or control.currency = v_currency)
    and (
      control.payment_provider is null
      or control.payment_provider = v_payment_provider
    )
    and (control.capability is null or control.capability = v_capability)
    and (control.dependency is null or control.dependency = v_dependency)
  order by
    (
      (control.market_id is not null)::integer
      + (control.region_id is not null)::integer
      + (control.country_code is not null)::integer
      + (control.currency is not null)::integer
      + (control.payment_provider is not null)::integer
      + (control.capability is not null)::integer
      + (control.dependency is not null)::integer
    ) desc,
    control.updated_at desc
  limit 1;

  if found then
    return query
    select false, v_block.id::uuid, v_block.reason_code::text, v_block.version::bigint;
    return;
  end if;

  return query
  select true, null::uuid, null::text, null::bigint;
end;
$$;

alter function public.klyx_ops_capability_decision(
  text, text, text, text, text, text, text
) owner to postgres;
revoke all on function public.klyx_ops_capability_decision(
  text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.klyx_ops_capability_decision(
  text, text, text, text, text, text, text
) to service_role;

commit;

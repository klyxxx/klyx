begin;

-- Mission 14 — Durable Jobs + Retry / DLQ
--
-- Invariants:
-- - the queue is durable PostgreSQL state, never process memory;
-- - execution is at-least-once, never falsely advertised as exactly-once;
-- - enqueue is idempotent on (job_type, idempotency_key);
-- - claims are atomic and fenced by a lease token;
-- - retries are bounded with capped exponential backoff;
-- - exhausted / non-retryable work becomes explicit dead_lettered state;
-- - Operations remains a control plane and does not replace domain truth;
-- - no raw exception messages, secrets, documents, or canonical business
--   payloads belong in the queue. Payloads should contain stable references.

create table if not exists public.ops_durable_jobs (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.ops_operations(id) on delete restrict,
  correlation_id uuid not null,

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

  job_type text not null,
  idempotency_key text not null,
  request_fingerprint jsonb not null,
  payload jsonb not null default '{}'::jsonb,

  status text not null default 'queued',
  priority integer not null default 100,
  available_at timestamptz not null default now(),

  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  backoff_base_seconds integer not null default 30,
  backoff_max_seconds integer not null default 3600,

  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_claim_token uuid,
  last_worker_id text,

  last_error_code text,
  result_ref text,

  completed_at timestamptz,
  dead_lettered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ops_durable_jobs_job_type_format_check
    check (
      length(job_type) between 3 and 100
      and job_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_durable_jobs_idempotency_key_check
    check (length(idempotency_key) between 1 and 256),
  constraint ops_durable_jobs_payload_size_check
    check (octet_length(payload::text) <= 65536),
  constraint ops_durable_jobs_fingerprint_size_check
    check (octet_length(request_fingerprint::text) <= 131072),
  constraint ops_durable_jobs_status_check
    check (
      status in (
        'queued',
        'running',
        'retry_wait',
        'succeeded',
        'dead_lettered'
      )
    ),
  constraint ops_durable_jobs_priority_check
    check (priority between 0 and 10000),
  constraint ops_durable_jobs_attempt_count_check
    check (attempt_count >= 0),
  constraint ops_durable_jobs_max_attempts_check
    check (max_attempts between 1 and 25),
  constraint ops_durable_jobs_backoff_base_check
    check (backoff_base_seconds between 1 and 86400),
  constraint ops_durable_jobs_backoff_max_check
    check (
      backoff_max_seconds between 1 and 604800
      and backoff_max_seconds >= backoff_base_seconds
    ),
  constraint ops_durable_jobs_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint ops_durable_jobs_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint ops_durable_jobs_payment_provider_format_check
    check (
      payment_provider is null
      or (
        length(payment_provider) between 2 and 64
        and payment_provider ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_durable_jobs_capability_format_check
    check (
      capability is null
      or (
        length(capability) between 2 and 128
        and capability ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_durable_jobs_dependency_format_check
    check (
      dependency is null
      or (
        length(dependency) between 2 and 128
        and dependency ~ '^[a-z][a-z0-9_.:-]*$'
      )
    ),
  constraint ops_durable_jobs_failure_domain_type_format_check
    check (
      length(failure_domain_type) between 2 and 64
      and failure_domain_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_durable_jobs_failure_domain_key_check
    check (length(failure_domain_key) between 1 and 256),
  constraint ops_durable_jobs_error_code_format_check
    check (
      last_error_code is null
      or (
        length(last_error_code) between 2 and 128
        and last_error_code ~ '^[A-Z][A-Z0-9_.:-]*$'
      )
    ),
  constraint ops_durable_jobs_result_ref_check
    check (result_ref is null or length(result_ref) between 1 and 512),
  constraint ops_durable_jobs_running_lease_check
    check (
      (
        status = 'running'
        and lease_owner is not null
        and lease_token is not null
        and lease_expires_at is not null
      )
      or (
        status <> 'running'
        and lease_owner is null
        and lease_token is null
        and lease_expires_at is null
      )
    ),
  constraint ops_durable_jobs_unique_idempotency
    unique (job_type, idempotency_key)
);

comment on table public.ops_durable_jobs is
  'Durable at-least-once KLYX job queue. Domain truth remains in canonical domain tables.';
comment on column public.ops_durable_jobs.payload is
  'Small operational payload containing stable references only; never a second canonical business object or secret store.';
comment on column public.ops_durable_jobs.last_claim_token is
  'Last fencing token retained so terminal/retry acknowledgements can be retried idempotently.';

create index if not exists ops_durable_jobs_ready_idx
  on public.ops_durable_jobs (priority asc, available_at asc, created_at asc)
  where status in ('queued', 'retry_wait');

create index if not exists ops_durable_jobs_running_lease_idx
  on public.ops_durable_jobs (lease_expires_at asc)
  where status = 'running';

create index if not exists ops_durable_jobs_status_updated_idx
  on public.ops_durable_jobs (status, updated_at desc);

create index if not exists ops_durable_jobs_failure_domain_idx
  on public.ops_durable_jobs (
    failure_domain_type,
    failure_domain_key,
    country_code,
    currency,
    payment_provider,
    capability,
    status,
    updated_at desc
  );

alter table public.ops_durable_jobs enable row level security;
revoke all privileges on table public.ops_durable_jobs
  from public, anon, authenticated;
revoke all privileges on table public.ops_durable_jobs
  from service_role;
grant select on table public.ops_durable_jobs
  to service_role;

create or replace view public.ops_durable_job_dlq as
select
  id,
  operation_id,
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
  job_type,
  idempotency_key,
  priority,
  attempt_count,
  max_attempts,
  last_error_code,
  result_ref,
  dead_lettered_at,
  created_at,
  updated_at
from public.ops_durable_jobs
where status = 'dead_lettered';

revoke all privileges on table public.ops_durable_job_dlq
  from public, anon, authenticated;
grant select on table public.ops_durable_job_dlq
  to service_role;

create or replace function public.klyx_durable_job_backoff_seconds(
  p_attempt_count integer,
  p_backoff_base_seconds integer,
  p_backoff_max_seconds integer
)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select greatest(
    1,
    least(
      p_backoff_max_seconds,
      (
        p_backoff_base_seconds::numeric
        * power(2::numeric, greatest(p_attempt_count - 1, 0))
      )::bigint
    )::integer
  );
$$;

revoke all on function public.klyx_durable_job_backoff_seconds(
  integer, integer, integer
) from public, anon, authenticated, service_role;

create or replace function public.klyx_enqueue_durable_job(
  p_job_type text,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb,
  p_account_id uuid default null,
  p_domain_type text default null,
  p_domain_resource_type text default null,
  p_domain_resource_id text default null,
  p_failure_domain_type text default 'global',
  p_failure_domain_key text default 'global',
  p_market_id text default null,
  p_region_id text default null,
  p_country_code text default null,
  p_currency text default null,
  p_payment_provider text default null,
  p_capability text default null,
  p_dependency text default null,
  p_priority integer default 100,
  p_available_at timestamptz default now(),
  p_max_attempts integer default 5,
  p_backoff_base_seconds integer default 30,
  p_backoff_max_seconds integer default 3600
)
returns table(
  job_id uuid,
  job_status text,
  created boolean,
  operation_id uuid,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_type text := lower(trim(coalesce(p_job_type, '')));
  v_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_failure_domain_type text := lower(trim(coalesce(p_failure_domain_type, 'global')));
  v_failure_domain_key text := trim(coalesce(p_failure_domain_key, 'global'));
  v_country_code text := upper(nullif(trim(p_country_code), ''));
  v_currency text := upper(nullif(trim(p_currency), ''));
  v_payment_provider text := lower(nullif(trim(p_payment_provider), ''));
  v_capability text := lower(nullif(trim(p_capability), ''));
  v_dependency text := lower(nullif(trim(p_dependency), ''));
  v_request_fingerprint jsonb;
  v_existing public.ops_durable_jobs%rowtype;
  v_job public.ops_durable_jobs%rowtype;
  v_operation_id uuid;
  v_correlation_id uuid := gen_random_uuid();
begin
  if v_job_type = '' then
    raise exception 'KLYX_DURABLE_JOB_TYPE_REQUIRED';
  end if;

  if v_idempotency_key = '' then
    raise exception 'KLYX_DURABLE_JOB_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  if p_priority not between 0 and 10000 then
    raise exception 'KLYX_DURABLE_JOB_PRIORITY_INVALID';
  end if;

  if p_max_attempts not between 1 and 25 then
    raise exception 'KLYX_DURABLE_JOB_MAX_ATTEMPTS_INVALID';
  end if;

  if
    p_backoff_base_seconds not between 1 and 86400
    or p_backoff_max_seconds not between 1 and 604800
    or p_backoff_max_seconds < p_backoff_base_seconds
  then
    raise exception 'KLYX_DURABLE_JOB_BACKOFF_INVALID';
  end if;

  if v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'KLYX_DURABLE_JOB_COUNTRY_CODE_INVALID';
  end if;

  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'KLYX_DURABLE_JOB_CURRENCY_INVALID';
  end if;

  v_request_fingerprint := jsonb_build_object(
    'payload', v_payload,
    'account_id', p_account_id,
    'domain_type', nullif(trim(p_domain_type), ''),
    'domain_resource_type', nullif(trim(p_domain_resource_type), ''),
    'domain_resource_id', nullif(trim(p_domain_resource_id), ''),
    'failure_domain_type', v_failure_domain_type,
    'failure_domain_key', v_failure_domain_key,
    'market_id', nullif(trim(p_market_id), ''),
    'region_id', nullif(trim(p_region_id), ''),
    'country_code', v_country_code,
    'currency', v_currency,
    'payment_provider', v_payment_provider,
    'capability', v_capability,
    'dependency', v_dependency,
    'priority', p_priority,
    'max_attempts', p_max_attempts,
    'backoff_base_seconds', p_backoff_base_seconds,
    'backoff_max_seconds', p_backoff_max_seconds
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_job_type || '|' || v_idempotency_key, 0)
  );

  select *
    into v_existing
    from public.ops_durable_jobs
   where job_type = v_job_type
     and idempotency_key = v_idempotency_key
   for update;

  if found then
    if v_existing.request_fingerprint <> v_request_fingerprint then
      raise exception 'KLYX_DURABLE_JOB_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      v_existing.id,
      v_existing.status,
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
    nullif(trim(p_domain_type), ''),
    nullif(trim(p_domain_resource_type), ''),
    nullif(trim(p_domain_resource_id), ''),
    v_failure_domain_type,
    v_failure_domain_key,
    nullif(trim(p_market_id), ''),
    nullif(trim(p_region_id), ''),
    v_country_code,
    v_currency,
    v_payment_provider,
    v_capability,
    v_dependency,
    'durable_job.execute',
    'normal',
    'started'
  )
  returning id into v_operation_id;

  insert into public.ops_durable_jobs (
    operation_id,
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
    job_type,
    idempotency_key,
    request_fingerprint,
    payload,
    status,
    priority,
    available_at,
    max_attempts,
    backoff_base_seconds,
    backoff_max_seconds
  ) values (
    v_operation_id,
    v_correlation_id,
    p_account_id,
    nullif(trim(p_domain_type), ''),
    nullif(trim(p_domain_resource_type), ''),
    nullif(trim(p_domain_resource_id), ''),
    v_failure_domain_type,
    v_failure_domain_key,
    nullif(trim(p_market_id), ''),
    nullif(trim(p_region_id), ''),
    v_country_code,
    v_currency,
    v_payment_provider,
    v_capability,
    v_dependency,
    v_job_type,
    v_idempotency_key,
    v_request_fingerprint,
    v_payload,
    'queued',
    p_priority,
    coalesce(p_available_at, now()),
    p_max_attempts,
    p_backoff_base_seconds,
    p_backoff_max_seconds
  )
  returning * into v_job;

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
    v_job.operation_id,
    v_job.correlation_id,
    'durable_job.enqueued',
    'info',
    'operations',
    'durable_job',
    v_job.id::text,
    v_job.failure_domain_type,
    v_job.failure_domain_key,
    v_job.market_id,
    v_job.region_id,
    v_job.country_code,
    v_job.currency,
    v_job.payment_provider,
    v_job.capability,
    v_job.dependency,
    jsonb_build_object(
      'job_type', v_job.job_type,
      'priority', v_job.priority,
      'available_at', v_job.available_at,
      'max_attempts', v_job.max_attempts
    )
  );

  return query
  select v_job.id, v_job.status, true, v_job.operation_id, v_job.correlation_id;
end;
$$;

alter function public.klyx_enqueue_durable_job(
  text, text, jsonb, uuid, text, text, text, text, text, text, text,
  text, text, text, text, text, integer, timestamptz, integer, integer, integer
) owner to postgres;
revoke all on function public.klyx_enqueue_durable_job(
  text, text, jsonb, uuid, text, text, text, text, text, text, text,
  text, text, text, text, text, integer, timestamptz, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.klyx_enqueue_durable_job(
  text, text, jsonb, uuid, text, text, text, text, text, text, text,
  text, text, text, text, text, integer, timestamptz, integer, integer, integer
) to service_role;

create or replace function public.klyx_reap_expired_durable_jobs(
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.ops_durable_jobs%rowtype;
  v_delay_seconds integer;
  v_count integer := 0;
  v_next_available_at timestamptz;
begin
  if p_limit not between 1 and 1000 then
    raise exception 'KLYX_DURABLE_JOB_REAP_LIMIT_INVALID';
  end if;

  for v_job in
    select *
      from public.ops_durable_jobs
     where status = 'running'
       and lease_expires_at <= now()
     order by lease_expires_at asc
     for update skip locked
     limit p_limit
  loop
    if v_job.attempt_count >= v_job.max_attempts then
      update public.ops_durable_jobs
         set status = 'dead_lettered',
             lease_owner = null,
             lease_token = null,
             lease_expires_at = null,
             last_error_code = 'LEASE_EXPIRED',
             dead_lettered_at = now(),
             updated_at = now()
       where id = v_job.id;

      update public.ops_operations
         set status = 'failed',
             completed_at = coalesce(completed_at, now()),
             updated_at = now()
       where id = v_job.operation_id;

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
        v_job.operation_id,
        v_job.correlation_id,
        'durable_job.dead_lettered',
        'error',
        'operations',
        'durable_job',
        v_job.id::text,
        v_job.failure_domain_type,
        v_job.failure_domain_key,
        v_job.market_id,
        v_job.region_id,
        v_job.country_code,
        v_job.currency,
        v_job.payment_provider,
        v_job.capability,
        v_job.dependency,
        jsonb_build_object(
          'attempt_no', v_job.attempt_count,
          'worker_id', v_job.lease_owner,
          'error_code', 'LEASE_EXPIRED',
          'reason', 'attempt_budget_exhausted'
        )
      );
    else
      v_delay_seconds := public.klyx_durable_job_backoff_seconds(
        v_job.attempt_count,
        v_job.backoff_base_seconds,
        v_job.backoff_max_seconds
      );
      v_next_available_at := now() + make_interval(secs => v_delay_seconds);

      update public.ops_durable_jobs
         set status = 'retry_wait',
             available_at = v_next_available_at,
             lease_owner = null,
             lease_token = null,
             lease_expires_at = null,
             last_error_code = 'LEASE_EXPIRED',
             updated_at = now()
       where id = v_job.id;

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
        v_job.operation_id,
        v_job.correlation_id,
        'durable_job.retry_scheduled',
        'warning',
        'operations',
        'durable_job',
        v_job.id::text,
        v_job.failure_domain_type,
        v_job.failure_domain_key,
        v_job.market_id,
        v_job.region_id,
        v_job.country_code,
        v_job.currency,
        v_job.payment_provider,
        v_job.capability,
        v_job.dependency,
        jsonb_build_object(
          'attempt_no', v_job.attempt_count,
          'worker_id', v_job.lease_owner,
          'error_code', 'LEASE_EXPIRED',
          'available_at', v_next_available_at
        )
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

alter function public.klyx_reap_expired_durable_jobs(integer) owner to postgres;
revoke all on function public.klyx_reap_expired_durable_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.klyx_reap_expired_durable_jobs(integer)
  to service_role;

create or replace function public.klyx_claim_durable_jobs(
  p_worker_id text,
  p_job_types text[] default null,
  p_limit integer default 1,
  p_lease_seconds integer default 60
)
returns table(
  job_id uuid,
  job_type text,
  payload jsonb,
  attempt_no integer,
  max_attempts integer,
  lease_token uuid,
  lease_expires_at timestamptz,
  operation_id uuid,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_worker_id text := trim(coalesce(p_worker_id, ''));
  v_job_types text[];
  v_job public.ops_durable_jobs%rowtype;
  v_claimed public.ops_durable_jobs%rowtype;
  v_lease_token uuid;
begin
  if v_worker_id = '' or length(v_worker_id) > 128 then
    raise exception 'KLYX_DURABLE_JOB_WORKER_ID_INVALID';
  end if;

  if p_limit not between 1 and 100 then
    raise exception 'KLYX_DURABLE_JOB_CLAIM_LIMIT_INVALID';
  end if;

  if p_lease_seconds not between 15 and 3600 then
    raise exception 'KLYX_DURABLE_JOB_LEASE_SECONDS_INVALID';
  end if;

  if p_job_types is not null then
    select array_agg(lower(trim(value)))
      into v_job_types
      from unnest(p_job_types) as value
     where trim(value) <> '';

    if v_job_types is null or cardinality(v_job_types) = 0 then
      raise exception 'KLYX_DURABLE_JOB_TYPES_INVALID';
    end if;
  end if;

  perform public.klyx_reap_expired_durable_jobs(
    least(greatest(p_limit * 4, 20), 400)
  );

  for v_job in
    select *
      from public.ops_durable_jobs
     where status in ('queued', 'retry_wait')
       and available_at <= now()
       and attempt_count < max_attempts
       and (v_job_types is null or job_type = any(v_job_types))
     order by priority asc, available_at asc, created_at asc
     for update skip locked
     limit p_limit
  loop
    v_lease_token := gen_random_uuid();

    update public.ops_durable_jobs
       set status = 'running',
           attempt_count = attempt_count + 1,
           lease_owner = v_worker_id,
           lease_token = v_lease_token,
           lease_expires_at = now() + make_interval(secs => p_lease_seconds),
           last_claim_token = v_lease_token,
           last_worker_id = v_worker_id,
           updated_at = now()
     where id = v_job.id
     returning * into v_claimed;

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
      v_claimed.operation_id,
      v_claimed.correlation_id,
      'durable_job.claimed',
      'info',
      'operations',
      'durable_job',
      v_claimed.id::text,
      v_claimed.failure_domain_type,
      v_claimed.failure_domain_key,
      v_claimed.market_id,
      v_claimed.region_id,
      v_claimed.country_code,
      v_claimed.currency,
      v_claimed.payment_provider,
      v_claimed.capability,
      v_claimed.dependency,
      jsonb_build_object(
        'attempt_no', v_claimed.attempt_count,
        'worker_id', v_worker_id,
        'lease_expires_at', v_claimed.lease_expires_at
      )
    );

    return query
    select
      v_claimed.id,
      v_claimed.job_type,
      v_claimed.payload,
      v_claimed.attempt_count,
      v_claimed.max_attempts,
      v_lease_token,
      v_claimed.lease_expires_at,
      v_claimed.operation_id,
      v_claimed.correlation_id;
  end loop;
end;
$$;

alter function public.klyx_claim_durable_jobs(text, text[], integer, integer)
  owner to postgres;
revoke all on function public.klyx_claim_durable_jobs(
  text, text[], integer, integer
) from public, anon, authenticated;
grant execute on function public.klyx_claim_durable_jobs(
  text, text[], integer, integer
) to service_role;

create or replace function public.klyx_extend_durable_job_lease(
  p_job_id uuid,
  p_lease_token uuid,
  p_worker_id text,
  p_lease_seconds integer default 60
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.ops_durable_jobs%rowtype;
  v_expires_at timestamptz;
begin
  if p_lease_seconds not between 15 and 3600 then
    raise exception 'KLYX_DURABLE_JOB_LEASE_SECONDS_INVALID';
  end if;

  select *
    into v_job
    from public.ops_durable_jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'KLYX_DURABLE_JOB_NOT_FOUND';
  end if;

  if
    v_job.status <> 'running'
    or v_job.lease_token is distinct from p_lease_token
    or v_job.lease_owner is distinct from trim(coalesce(p_worker_id, ''))
  then
    raise exception 'KLYX_DURABLE_JOB_LEASE_FENCED';
  end if;

  if v_job.lease_expires_at <= now() then
    raise exception 'KLYX_DURABLE_JOB_LEASE_EXPIRED';
  end if;

  v_expires_at := now() + make_interval(secs => p_lease_seconds);

  update public.ops_durable_jobs
     set lease_expires_at = v_expires_at,
         updated_at = now()
   where id = v_job.id;

  return v_expires_at;
end;
$$;

alter function public.klyx_extend_durable_job_lease(
  uuid, uuid, text, integer
) owner to postgres;
revoke all on function public.klyx_extend_durable_job_lease(
  uuid, uuid, text, integer
) from public, anon, authenticated;
grant execute on function public.klyx_extend_durable_job_lease(
  uuid, uuid, text, integer
) to service_role;

create or replace function public.klyx_complete_durable_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_worker_id text,
  p_result_ref text default null
)
returns table(job_status text, attempt_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.ops_durable_jobs%rowtype;
  v_worker_id text := trim(coalesce(p_worker_id, ''));
  v_result_ref text := nullif(trim(p_result_ref), '');
begin
  select *
    into v_job
    from public.ops_durable_jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'KLYX_DURABLE_JOB_NOT_FOUND';
  end if;

  if
    v_job.status = 'succeeded'
    and v_job.last_claim_token is not distinct from p_lease_token
    and v_job.last_worker_id is not distinct from v_worker_id
  then
    return query select v_job.status, v_job.attempt_count;
    return;
  end if;

  if
    v_job.status <> 'running'
    or v_job.lease_token is distinct from p_lease_token
    or v_job.lease_owner is distinct from v_worker_id
  then
    raise exception 'KLYX_DURABLE_JOB_LEASE_FENCED';
  end if;

  if v_job.lease_expires_at <= now() then
    raise exception 'KLYX_DURABLE_JOB_LEASE_EXPIRED';
  end if;

  update public.ops_durable_jobs
     set status = 'succeeded',
         lease_owner = null,
         lease_token = null,
         lease_expires_at = null,
         result_ref = v_result_ref,
         completed_at = now(),
         updated_at = now()
   where id = v_job.id
   returning * into v_job;

  update public.ops_operations
     set status = 'succeeded',
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = v_job.operation_id;

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
    v_job.operation_id,
    v_job.correlation_id,
    'durable_job.succeeded',
    'info',
    'operations',
    'durable_job',
    v_job.id::text,
    v_job.failure_domain_type,
    v_job.failure_domain_key,
    v_job.market_id,
    v_job.region_id,
    v_job.country_code,
    v_job.currency,
    v_job.payment_provider,
    v_job.capability,
    v_job.dependency,
    jsonb_strip_nulls(
      jsonb_build_object(
        'attempt_no', v_job.attempt_count,
        'worker_id', v_worker_id,
        'result_ref', v_result_ref
      )
    )
  );

  return query select v_job.status, v_job.attempt_count;
end;
$$;

alter function public.klyx_complete_durable_job(
  uuid, uuid, text, text
) owner to postgres;
revoke all on function public.klyx_complete_durable_job(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.klyx_complete_durable_job(
  uuid, uuid, text, text
) to service_role;

create or replace function public.klyx_fail_durable_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_worker_id text,
  p_error_code text,
  p_retryable boolean default true
)
returns table(
  job_status text,
  attempt_count integer,
  next_available_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.ops_durable_jobs%rowtype;
  v_worker_id text := trim(coalesce(p_worker_id, ''));
  v_error_code text := upper(trim(coalesce(p_error_code, '')));
  v_delay_seconds integer;
  v_next_available_at timestamptz;
  v_dead_letter boolean;
begin
  if
    v_error_code = ''
    or length(v_error_code) > 128
    or v_error_code !~ '^[A-Z][A-Z0-9_.:-]*$'
  then
    raise exception 'KLYX_DURABLE_JOB_ERROR_CODE_INVALID';
  end if;

  select *
    into v_job
    from public.ops_durable_jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'KLYX_DURABLE_JOB_NOT_FOUND';
  end if;

  if
    v_job.status in ('retry_wait', 'dead_lettered')
    and v_job.last_claim_token is not distinct from p_lease_token
    and v_job.last_worker_id is not distinct from v_worker_id
    and v_job.last_error_code is not distinct from v_error_code
  then
    return query
    select
      v_job.status,
      v_job.attempt_count,
      case when v_job.status = 'retry_wait' then v_job.available_at else null end;
    return;
  end if;

  if
    v_job.status <> 'running'
    or v_job.lease_token is distinct from p_lease_token
    or v_job.lease_owner is distinct from v_worker_id
  then
    raise exception 'KLYX_DURABLE_JOB_LEASE_FENCED';
  end if;

  if v_job.lease_expires_at <= now() then
    raise exception 'KLYX_DURABLE_JOB_LEASE_EXPIRED';
  end if;

  v_dead_letter := (not coalesce(p_retryable, true))
    or v_job.attempt_count >= v_job.max_attempts;

  if v_dead_letter then
    update public.ops_durable_jobs
       set status = 'dead_lettered',
           lease_owner = null,
           lease_token = null,
           lease_expires_at = null,
           last_error_code = v_error_code,
           dead_lettered_at = now(),
           updated_at = now()
     where id = v_job.id
     returning * into v_job;

    update public.ops_operations
       set status = 'failed',
           completed_at = coalesce(completed_at, now()),
           updated_at = now()
     where id = v_job.operation_id;

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
      v_job.operation_id,
      v_job.correlation_id,
      'durable_job.dead_lettered',
      'error',
      'operations',
      'durable_job',
      v_job.id::text,
      v_job.failure_domain_type,
      v_job.failure_domain_key,
      v_job.market_id,
      v_job.region_id,
      v_job.country_code,
      v_job.currency,
      v_job.payment_provider,
      v_job.capability,
      v_job.dependency,
      jsonb_build_object(
        'attempt_no', v_job.attempt_count,
        'worker_id', v_worker_id,
        'error_code', v_error_code,
        'retryable', coalesce(p_retryable, true),
        'reason',
          case
            when not coalesce(p_retryable, true) then 'non_retryable'
            else 'attempt_budget_exhausted'
          end
      )
    );

    return query select v_job.status, v_job.attempt_count, null::timestamptz;
    return;
  end if;

  v_delay_seconds := public.klyx_durable_job_backoff_seconds(
    v_job.attempt_count,
    v_job.backoff_base_seconds,
    v_job.backoff_max_seconds
  );
  v_next_available_at := now() + make_interval(secs => v_delay_seconds);

  update public.ops_durable_jobs
     set status = 'retry_wait',
         available_at = v_next_available_at,
         lease_owner = null,
         lease_token = null,
         lease_expires_at = null,
         last_error_code = v_error_code,
         updated_at = now()
   where id = v_job.id
   returning * into v_job;

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
    v_job.operation_id,
    v_job.correlation_id,
    'durable_job.retry_scheduled',
    'warning',
    'operations',
    'durable_job',
    v_job.id::text,
    v_job.failure_domain_type,
    v_job.failure_domain_key,
    v_job.market_id,
    v_job.region_id,
    v_job.country_code,
    v_job.currency,
    v_job.payment_provider,
    v_job.capability,
    v_job.dependency,
    jsonb_build_object(
      'attempt_no', v_job.attempt_count,
      'worker_id', v_worker_id,
      'error_code', v_error_code,
      'available_at', v_next_available_at
    )
  );

  return query select v_job.status, v_job.attempt_count, v_next_available_at;
end;
$$;

alter function public.klyx_fail_durable_job(
  uuid, uuid, text, text, boolean
) owner to postgres;
revoke all on function public.klyx_fail_durable_job(
  uuid, uuid, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.klyx_fail_durable_job(
  uuid, uuid, text, text, boolean
) to service_role;

comment on view public.ops_durable_job_dlq is
  'Read-only DLQ projection over canonical durable jobs. Redrive is deliberately not automatic.';

commit;

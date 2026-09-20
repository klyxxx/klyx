begin;

-- KLYX_MISSION_14_DURABLE_JOBS_RETRY_DLQ_20260920
--
-- Durable Jobs is an execution substrate, not a business authority.
-- Canonical Booking / Ledger / Settlement / Risk / Webhook state stays in
-- its existing domain tables. A job only references that truth and records
-- operational execution state.
--
-- Existing Stripe / Sumsub webhook retry leases and Settlement claims remain
-- authoritative for their own fencing. They are not replaced by this table.

create table if not exists public.ops_jobs (
  id uuid primary key default gen_random_uuid(),
  ops_operation_id uuid not null
    references public.ops_operations(id) on delete restrict,
  correlation_id uuid not null,

  queue text not null,
  job_type text not null,
  idempotency_key text not null,

  domain_type text,
  domain_resource_type text,
  domain_resource_id text,

  payload jsonb not null default '{}'::jsonb,

  priority integer not null default 100,
  status text not null default 'queued',
  available_at timestamptz not null default now(),

  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  base_backoff_seconds integer not null default 30,
  max_backoff_seconds integer not null default 3600,

  lease_token uuid,
  lease_worker_id text,
  leased_at timestamptz,
  lease_expires_at timestamptz,

  last_error_code text,
  last_error_message text,

  completed_at timestamptz,
  dead_lettered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ops_jobs_queue_format_check
    check (
      length(queue) between 2 and 64
      and queue ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_jobs_job_type_format_check
    check (
      length(job_type) between 3 and 128
      and job_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint ops_jobs_idempotency_key_check
    check (length(idempotency_key) between 1 and 256),
  constraint ops_jobs_priority_check
    check (priority between 0 and 1000),
  constraint ops_jobs_status_check
    check (
      status in (
        'queued',
        'leased',
        'retry_wait',
        'succeeded',
        'dead_letter'
      )
    ),
  constraint ops_jobs_attempt_count_check
    check (attempt_count >= 0 and attempt_count <= max_attempts),
  constraint ops_jobs_max_attempts_check
    check (max_attempts between 1 and 25),
  constraint ops_jobs_backoff_check
    check (
      base_backoff_seconds between 1 and 3600
      and max_backoff_seconds between base_backoff_seconds and 86400
    ),
  constraint ops_jobs_lease_shape_check
    check (
      (
        status = 'leased'
        and lease_token is not null
        and lease_worker_id is not null
        and leased_at is not null
        and lease_expires_at is not null
      )
      or (
        status <> 'leased'
        and lease_token is null
        and lease_worker_id is null
        and leased_at is null
        and lease_expires_at is null
      )
    ),
  constraint ops_jobs_terminal_shape_check
    check (
      (
        status = 'succeeded'
        and completed_at is not null
        and dead_lettered_at is null
      )
      or (
        status = 'dead_letter'
        and completed_at is not null
        and dead_lettered_at is not null
      )
      or (
        status not in ('succeeded', 'dead_letter')
        and completed_at is null
        and dead_lettered_at is null
      )
    )
);

comment on table public.ops_jobs is
  'KLYX durable operational jobs. Jobs coordinate retries and leases but never become canonical business truth.';
comment on column public.ops_jobs.payload is
  'Execution input only. Do not mirror canonical Booking/Ledger/Settlement/Webhook objects as job truth.';
comment on column public.ops_jobs.attempt_count is
  'Monotonic attempt generation used together with lease_token to fence stale workers.';
comment on column public.ops_jobs.status is
  'DLQ is represented by terminal status dead_letter; there is no silent drop or infinite retry.';

create unique index if not exists ops_jobs_idempotency_unique
  on public.ops_jobs (queue, job_type, idempotency_key);

create index if not exists ops_jobs_claim_idx
  on public.ops_jobs (
    queue,
    status,
    available_at,
    priority desc,
    created_at
  )
  where status in ('queued', 'retry_wait', 'leased');

create index if not exists ops_jobs_dead_letter_idx
  on public.ops_jobs (dead_lettered_at desc, queue, job_type)
  where status = 'dead_letter';

create index if not exists ops_jobs_domain_ref_idx
  on public.ops_jobs (
    domain_type,
    domain_resource_type,
    domain_resource_id,
    created_at desc
  );

alter table public.ops_jobs enable row level security;
revoke all privileges on table public.ops_jobs
  from public, anon, authenticated;
grant select, insert, update on table public.ops_jobs
  to service_role;

create or replace function public.klyx_enqueue_ops_job(
  p_queue text,
  p_job_type text,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb,
  p_priority integer default 100,
  p_available_at timestamptz default now(),
  p_max_attempts integer default 5,
  p_base_backoff_seconds integer default 30,
  p_max_backoff_seconds integer default 3600,
  p_domain_type text default null,
  p_domain_resource_type text default null,
  p_domain_resource_id text default null,
  p_correlation_id uuid default null
)
returns table(
  job_id uuid,
  created boolean,
  status text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_queue text := lower(trim(coalesce(p_queue, '')));
  v_job_type text := lower(trim(coalesce(p_job_type, '')));
  v_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_operation_id uuid;
  v_job public.ops_jobs%rowtype;
begin
  if v_queue = '' then
    raise exception 'KLYX_JOB_QUEUE_REQUIRED';
  end if;

  if v_job_type = '' then
    raise exception 'KLYX_JOB_TYPE_REQUIRED';
  end if;

  if v_idempotency_key = '' then
    raise exception 'KLYX_JOB_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  if p_priority < 0 or p_priority > 1000 then
    raise exception 'KLYX_JOB_PRIORITY_INVALID';
  end if;

  if p_max_attempts < 1 or p_max_attempts > 25 then
    raise exception 'KLYX_JOB_MAX_ATTEMPTS_INVALID';
  end if;

  if
    p_base_backoff_seconds < 1
    or p_base_backoff_seconds > 3600
    or p_max_backoff_seconds < p_base_backoff_seconds
    or p_max_backoff_seconds > 86400
  then
    raise exception 'KLYX_JOB_BACKOFF_INVALID';
  end if;

  -- Serialize only identical enqueue keys. This avoids duplicate operations
  -- while keeping unrelated queues fully concurrent.
  perform pg_advisory_xact_lock(
    hashtextextended(
      v_queue || '|' || v_job_type || '|' || v_idempotency_key,
      0
    )
  );

  select *
    into v_job
    from public.ops_jobs
   where queue = v_queue
     and job_type = v_job_type
     and idempotency_key = v_idempotency_key;

  if found then
    return query
    select v_job.id, false, v_job.status, v_job.attempt_count;
    return;
  end if;

  insert into public.ops_operations (
    correlation_id,
    domain_type,
    domain_resource_type,
    domain_resource_id,
    failure_domain_type,
    failure_domain_key,
    dependency,
    operation_type,
    risk_level,
    status,
    started_at
  )
  values (
    v_correlation_id,
    nullif(trim(p_domain_type), ''),
    nullif(trim(p_domain_resource_type), ''),
    nullif(trim(p_domain_resource_id), ''),
    'job_queue',
    v_queue,
    v_job_type,
    'ops.job.execute',
    'normal',
    'started',
    now()
  )
  returning id into v_operation_id;

  insert into public.ops_jobs (
    ops_operation_id,
    correlation_id,
    queue,
    job_type,
    idempotency_key,
    domain_type,
    domain_resource_type,
    domain_resource_id,
    payload,
    priority,
    status,
    available_at,
    max_attempts,
    base_backoff_seconds,
    max_backoff_seconds
  )
  values (
    v_operation_id,
    v_correlation_id,
    v_queue,
    v_job_type,
    v_idempotency_key,
    nullif(trim(p_domain_type), ''),
    nullif(trim(p_domain_resource_type), ''),
    nullif(trim(p_domain_resource_id), ''),
    coalesce(p_payload, '{}'::jsonb),
    p_priority,
    'queued',
    coalesce(p_available_at, now()),
    p_max_attempts,
    p_base_backoff_seconds,
    p_max_backoff_seconds
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
    dependency,
    metadata
  )
  values (
    v_operation_id,
    v_correlation_id,
    'durable_job_enqueued',
    'info',
    v_job.domain_type,
    v_job.domain_resource_type,
    v_job.domain_resource_id,
    'job_queue',
    v_queue,
    v_job_type,
    jsonb_build_object(
      'job_id', v_job.id,
      'queue', v_job.queue,
      'job_type', v_job.job_type,
      'priority', v_job.priority,
      'available_at', v_job.available_at,
      'max_attempts', v_job.max_attempts
    )
  );

  return query
  select v_job.id, true, v_job.status, v_job.attempt_count;
end;
$$;

create or replace function public.klyx_claim_ops_jobs(
  p_queue text,
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 300
)
returns table(
  job_id uuid,
  ops_operation_id uuid,
  correlation_id uuid,
  job_type text,
  payload jsonb,
  domain_type text,
  domain_resource_type text,
  domain_resource_id text,
  attempt_count integer,
  max_attempts integer,
  lease_token uuid,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_queue text := lower(trim(coalesce(p_queue, '')));
  v_worker_id text := trim(coalesce(p_worker_id, ''));
  v_candidate public.ops_jobs%rowtype;
  v_token uuid;
begin
  if v_queue = '' then
    raise exception 'KLYX_JOB_QUEUE_REQUIRED';
  end if;

  if v_worker_id = '' or length(v_worker_id) > 128 then
    raise exception 'KLYX_JOB_WORKER_ID_INVALID';
  end if;

  if p_limit < 1 or p_limit > 100 then
    raise exception 'KLYX_JOB_CLAIM_LIMIT_INVALID';
  end if;

  if p_lease_seconds < 30 or p_lease_seconds > 3600 then
    raise exception 'KLYX_JOB_LEASE_SECONDS_INVALID';
  end if;

  -- Exhausted stale leases are terminal DLQ entries. Never retry forever.
  for v_candidate in
    select *
      from public.ops_jobs
     where queue = v_queue
       and status = 'leased'
       and lease_expires_at <= now()
       and attempt_count >= max_attempts
     for update skip locked
  loop
    update public.ops_jobs
       set status = 'dead_letter',
           lease_token = null,
           lease_worker_id = null,
           leased_at = null,
           lease_expires_at = null,
           last_error_code = coalesce(
             last_error_code,
             'KLYX_JOB_LEASE_EXHAUSTED'
           ),
           last_error_message = coalesce(
             last_error_message,
             'Worker lease expired after the maximum durable-job attempt.'
           ),
           completed_at = now(),
           dead_lettered_at = now(),
           updated_at = now()
     where id = v_candidate.id;

    update public.ops_operations
       set status = 'failed',
           completed_at = now(),
           updated_at = now()
     where id = v_candidate.ops_operation_id;

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
      dependency,
      metadata
    )
    values (
      v_candidate.ops_operation_id,
      v_candidate.correlation_id,
      'durable_job_dead_lettered',
      'error',
      v_candidate.domain_type,
      v_candidate.domain_resource_type,
      v_candidate.domain_resource_id,
      'job_queue',
      v_candidate.queue,
      v_candidate.job_type,
      jsonb_build_object(
        'job_id', v_candidate.id,
        'reason', 'lease_exhausted',
        'attempt_count', v_candidate.attempt_count,
        'max_attempts', v_candidate.max_attempts
      )
    );
  end loop;

  for v_candidate in
    select *
      from public.ops_jobs
     where queue = v_queue
       and attempt_count < max_attempts
       and (
         (
           status in ('queued', 'retry_wait')
           and available_at <= now()
         )
         or (
           status = 'leased'
           and lease_expires_at <= now()
         )
       )
     order by priority desc, available_at asc, created_at asc
     for update skip locked
     limit p_limit
  loop
    if v_candidate.status = 'leased' then
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
        dependency,
        metadata
      )
      values (
        v_candidate.ops_operation_id,
        v_candidate.correlation_id,
        'durable_job_lease_expired',
        'warning',
        v_candidate.domain_type,
        v_candidate.domain_resource_type,
        v_candidate.domain_resource_id,
        'job_queue',
        v_candidate.queue,
        v_candidate.job_type,
        jsonb_build_object(
          'job_id', v_candidate.id,
          'previous_attempt_count', v_candidate.attempt_count,
          'previous_worker_id', v_candidate.lease_worker_id
        )
      );
    end if;

    v_token := gen_random_uuid();

    update public.ops_jobs
       set status = 'leased',
           attempt_count = attempt_count + 1,
           lease_token = v_token,
           lease_worker_id = v_worker_id,
           leased_at = now(),
           lease_expires_at = now() + make_interval(secs => p_lease_seconds),
           updated_at = now()
     where id = v_candidate.id
     returning * into v_candidate;

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
      dependency,
      metadata
    )
    values (
      v_candidate.ops_operation_id,
      v_candidate.correlation_id,
      'durable_job_claimed',
      'info',
      v_candidate.domain_type,
      v_candidate.domain_resource_type,
      v_candidate.domain_resource_id,
      'job_queue',
      v_candidate.queue,
      v_candidate.job_type,
      jsonb_build_object(
        'job_id', v_candidate.id,
        'attempt_count', v_candidate.attempt_count,
        'worker_id', v_worker_id,
        'lease_token', v_token,
        'lease_expires_at', v_candidate.lease_expires_at
      )
    );

    job_id := v_candidate.id;
    ops_operation_id := v_candidate.ops_operation_id;
    correlation_id := v_candidate.correlation_id;
    job_type := v_candidate.job_type;
    payload := v_candidate.payload;
    domain_type := v_candidate.domain_type;
    domain_resource_type := v_candidate.domain_resource_type;
    domain_resource_id := v_candidate.domain_resource_id;
    attempt_count := v_candidate.attempt_count;
    max_attempts := v_candidate.max_attempts;
    lease_token := v_candidate.lease_token;
    lease_expires_at := v_candidate.lease_expires_at;
    return next;
  end loop;
end;
$$;

create or replace function public.klyx_complete_ops_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
returns table(job_id uuid, status text, attempt_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.ops_jobs%rowtype;
begin
  select *
    into v_job
    from public.ops_jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'KLYX_JOB_NOT_FOUND';
  end if;

  if
    v_job.status <> 'leased'
    or v_job.lease_token is distinct from p_lease_token
    or v_job.lease_worker_id is distinct from trim(p_worker_id)
  then
    raise exception 'KLYX_JOB_LEASE_LOST';
  end if;

  update public.ops_jobs
     set status = 'succeeded',
         lease_token = null,
         lease_worker_id = null,
         leased_at = null,
         lease_expires_at = null,
         last_error_code = null,
         last_error_message = null,
         completed_at = now(),
         updated_at = now()
   where id = v_job.id
   returning * into v_job;

  update public.ops_operations
     set status = 'succeeded',
         completed_at = now(),
         updated_at = now()
   where id = v_job.ops_operation_id;

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
    dependency,
    metadata
  )
  values (
    v_job.ops_operation_id,
    v_job.correlation_id,
    'durable_job_succeeded',
    'info',
    v_job.domain_type,
    v_job.domain_resource_type,
    v_job.domain_resource_id,
    'job_queue',
    v_job.queue,
    v_job.job_type,
    jsonb_build_object(
      'job_id', v_job.id,
      'attempt_count', v_job.attempt_count
    )
  );

  return query select v_job.id, v_job.status, v_job.attempt_count;
end;
$$;

create or replace function public.klyx_fail_ops_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_error_code text,
  p_error_message text default null
)
returns table(
  job_id uuid,
  status text,
  attempt_count integer,
  next_available_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.ops_jobs%rowtype;
  v_error_code text := upper(trim(coalesce(p_error_code, '')));
  v_error_message text := nullif(left(trim(coalesce(p_error_message, '')), 2000), '');
  v_retry_seconds integer;
begin
  if v_error_code = '' or v_error_code !~ '^[A-Z][A-Z0-9_:-]{2,127}$' then
    raise exception 'KLYX_JOB_ERROR_CODE_INVALID';
  end if;

  select *
    into v_job
    from public.ops_jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'KLYX_JOB_NOT_FOUND';
  end if;

  if
    v_job.status <> 'leased'
    or v_job.lease_token is distinct from p_lease_token
    or v_job.lease_worker_id is distinct from trim(p_worker_id)
  then
    raise exception 'KLYX_JOB_LEASE_LOST';
  end if;

  if v_job.attempt_count >= v_job.max_attempts then
    update public.ops_jobs
       set status = 'dead_letter',
           lease_token = null,
           lease_worker_id = null,
           leased_at = null,
           lease_expires_at = null,
           last_error_code = v_error_code,
           last_error_message = v_error_message,
           completed_at = now(),
           dead_lettered_at = now(),
           updated_at = now()
     where id = v_job.id
     returning * into v_job;

    update public.ops_operations
       set status = 'failed',
           completed_at = now(),
           updated_at = now()
     where id = v_job.ops_operation_id;

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
      dependency,
      metadata
    )
    values (
      v_job.ops_operation_id,
      v_job.correlation_id,
      'durable_job_dead_lettered',
      'error',
      v_job.domain_type,
      v_job.domain_resource_type,
      v_job.domain_resource_id,
      'job_queue',
      v_job.queue,
      v_job.job_type,
      jsonb_build_object(
        'job_id', v_job.id,
        'attempt_count', v_job.attempt_count,
        'max_attempts', v_job.max_attempts,
        'error_code', v_error_code
      )
    );

    return query
    select v_job.id, v_job.status, v_job.attempt_count, null::timestamptz;
    return;
  end if;

  v_retry_seconds := least(
    v_job.max_backoff_seconds,
    (
      v_job.base_backoff_seconds
      * power(2::numeric, least(v_job.attempt_count - 1, 20))
    )::integer
  );

  update public.ops_jobs
     set status = 'retry_wait',
         available_at = now() + make_interval(secs => v_retry_seconds),
         lease_token = null,
         lease_worker_id = null,
         leased_at = null,
         lease_expires_at = null,
         last_error_code = v_error_code,
         last_error_message = v_error_message,
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
    dependency,
    metadata
  )
  values (
    v_job.ops_operation_id,
    v_job.correlation_id,
    'durable_job_retry_scheduled',
    'warning',
    v_job.domain_type,
    v_job.domain_resource_type,
    v_job.domain_resource_id,
    'job_queue',
    v_job.queue,
    v_job.job_type,
    jsonb_build_object(
      'job_id', v_job.id,
      'attempt_count', v_job.attempt_count,
      'max_attempts', v_job.max_attempts,
      'error_code', v_error_code,
      'retry_seconds', v_retry_seconds,
      'available_at', v_job.available_at
    )
  );

  return query
  select v_job.id, v_job.status, v_job.attempt_count, v_job.available_at;
end;
$$;

alter function public.klyx_enqueue_ops_job(
  text, text, text, jsonb, integer, timestamptz, integer, integer, integer,
  text, text, text, uuid
) owner to postgres;
alter function public.klyx_claim_ops_jobs(text, text, integer, integer)
  owner to postgres;
alter function public.klyx_complete_ops_job(uuid, text, uuid)
  owner to postgres;
alter function public.klyx_fail_ops_job(uuid, text, uuid, text, text)
  owner to postgres;

revoke all on function public.klyx_enqueue_ops_job(
  text, text, text, jsonb, integer, timestamptz, integer, integer, integer,
  text, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.klyx_claim_ops_jobs(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.klyx_complete_ops_job(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.klyx_fail_ops_job(uuid, text, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.klyx_enqueue_ops_job(
  text, text, text, jsonb, integer, timestamptz, integer, integer, integer,
  text, text, text, uuid
) to service_role;
grant execute on function public.klyx_claim_ops_jobs(text, text, integer, integer)
  to service_role;
grant execute on function public.klyx_complete_ops_job(uuid, text, uuid)
  to service_role;
grant execute on function public.klyx_fail_ops_job(uuid, text, uuid, text, text)
  to service_role;

commit;

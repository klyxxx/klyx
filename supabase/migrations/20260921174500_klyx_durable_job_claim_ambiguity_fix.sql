begin;

-- Mission 19 regression fix.
--
-- klyx_claim_durable_jobs returns an output column named max_attempts.
-- Inside PL/pgSQL, an unqualified table column with the same name becomes
-- ambiguous against that output variable. Fresh local certification exposed
-- the ambiguity during worker crash/retry continuity proof.
--
-- Keep Mission 14's durable-job authority unchanged; only replace the claim
-- RPC with fully-qualified queue column references.

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
    select jobs.*
      from public.ops_durable_jobs as jobs
     where jobs.status in ('queued', 'retry_wait')
       and jobs.available_at <= now()
       and jobs.attempt_count < jobs.max_attempts
       and (
         v_job_types is null
         or jobs.job_type = any(v_job_types)
       )
     order by
       jobs.priority asc,
       jobs.available_at asc,
       jobs.created_at asc
     for update of jobs skip locked
     limit p_limit
  loop
    v_lease_token := gen_random_uuid();

    update public.ops_durable_jobs as jobs
       set status = 'running',
           attempt_count = jobs.attempt_count + 1,
           lease_owner = v_worker_id,
           lease_token = v_lease_token,
           lease_expires_at = now() + make_interval(secs => p_lease_seconds),
           last_claim_token = v_lease_token,
           last_worker_id = v_worker_id,
           updated_at = now()
     where jobs.id = v_job.id
     returning jobs.* into v_claimed;

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

alter function public.klyx_claim_durable_jobs(
  text, text[], integer, integer
) owner to postgres;

revoke all on function public.klyx_claim_durable_jobs(
  text, text[], integer, integer
) from public, anon, authenticated;

grant execute on function public.klyx_claim_durable_jobs(
  text, text[], integer, integer
) to service_role;

comment on function public.klyx_claim_durable_jobs(
  text, text[], integer, integer
) is
  'Mission 19 continuity-safe durable job claim. Queue columns are fully qualified to avoid PL/pgSQL output-variable ambiguity.';

commit;

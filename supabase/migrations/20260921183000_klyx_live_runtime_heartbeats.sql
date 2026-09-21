-- KLYX LIVE runtime component heartbeats
-- Proves that critical asynchronous finance infrastructure is actually running
-- on the same deployed SHA before any controlled or general LIVE mutation.

create table if not exists public.ops_runtime_heartbeats (
  component text primary key,
  status text not null,
  source_sha text not null,
  last_seen_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ops_runtime_heartbeats_component_check
    check (component in ('financial_durable_worker', 'critical_alert_delivery')),
  constraint ops_runtime_heartbeats_status_check
    check (status in ('healthy', 'degraded', 'stopped')),
  constraint ops_runtime_heartbeats_source_sha_check
    check (source_sha ~ '^[0-9a-f]{40}$')
);

alter table public.ops_runtime_heartbeats enable row level security;

revoke all on table public.ops_runtime_heartbeats
  from public, anon, authenticated;
grant select on table public.ops_runtime_heartbeats
  to service_role;

create or replace function public.klyx_record_ops_runtime_heartbeat(
  p_component text,
  p_status text,
  p_source_sha text,
  p_details jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_component text := lower(trim(coalesce(p_component, '')));
  v_status text := lower(trim(coalesce(p_status, '')));
  v_source_sha text := lower(trim(coalesce(p_source_sha, '')));
begin
  if v_component not in ('financial_durable_worker', 'critical_alert_delivery') then
    raise exception 'KLYX_OPS_RUNTIME_HEARTBEAT_COMPONENT_INVALID';
  end if;

  if v_status not in ('healthy', 'degraded', 'stopped') then
    raise exception 'KLYX_OPS_RUNTIME_HEARTBEAT_STATUS_INVALID';
  end if;

  if v_source_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'KLYX_OPS_RUNTIME_HEARTBEAT_SHA_INVALID';
  end if;

  insert into public.ops_runtime_heartbeats (
    component,
    status,
    source_sha,
    last_seen_at,
    details,
    updated_at
  )
  values (
    v_component,
    v_status,
    v_source_sha,
    now(),
    coalesce(p_details, '{}'::jsonb),
    now()
  )
  on conflict (component)
  do update set
    status = excluded.status,
    source_sha = excluded.source_sha,
    last_seen_at = excluded.last_seen_at,
    details = excluded.details,
    updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.klyx_record_ops_runtime_heartbeat(
  text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.klyx_record_ops_runtime_heartbeat(
  text, text, text, jsonb
) to service_role;

comment on table public.ops_runtime_heartbeats is
  'Authoritative liveness proof for finance worker and critical alert delivery. LIVE gates require fresh healthy rows on the deployed SHA.';

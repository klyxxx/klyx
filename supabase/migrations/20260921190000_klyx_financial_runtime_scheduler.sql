-- KLYX financial worker / critical alert scheduler
-- Disabled by default. The raw scheduler token lives only in Supabase Vault.
-- The application stores/reads only its SHA-256 hash.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.ops_financial_runtime_scheduler (
  scheduler_key text primary key,
  enabled boolean not null default false,
  target_origin text not null,
  token_sha256 text,
  alert_email text,
  updated_at timestamptz not null default now(),
  constraint ops_financial_runtime_scheduler_key_check
    check (scheduler_key = 'financial_runtime_tick'),
  constraint ops_financial_runtime_scheduler_origin_check
    check (target_origin ~ '^https://'),
  constraint ops_financial_runtime_scheduler_token_hash_check
    check (
      token_sha256 is null
      or token_sha256 ~ '^[0-9a-f]{64}$'
    )
);

alter table public.ops_financial_runtime_scheduler enable row level security;

revoke all on table public.ops_financial_runtime_scheduler
  from public, anon, authenticated;
grant select on table public.ops_financial_runtime_scheduler
  to service_role;

insert into public.ops_financial_runtime_scheduler (
  scheduler_key,
  enabled,
  target_origin,
  token_sha256,
  alert_email
)
values (
  'financial_runtime_tick',
  false,
  'https://www.klyx.be',
  null,
  'support@klyx.be'
)
on conflict (scheduler_key) do nothing;

create or replace function public.klyx_invoke_financial_runtime_tick()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_enabled boolean;
  v_origin text;
  v_token text;
  v_request_id bigint;
begin
  select enabled, target_origin
    into v_enabled, v_origin
  from public.ops_financial_runtime_scheduler
  where scheduler_key = 'financial_runtime_tick';

  if coalesce(v_enabled, false) is not true then
    return null;
  end if;

  select decrypted_secret
    into v_token
  from vault.decrypted_secrets
  where name = 'klyx_financial_scheduler_token'
  order by created_at desc
  limit 1;

  if coalesce(trim(v_token), '') = '' then
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_origin, '/') || '/api/ops/financial-runtime-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object(
      'source', 'supabase-pg-cron',
      'scheduled_at', now()
    ),
    timeout_milliseconds := 55000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.klyx_invoke_financial_runtime_tick()
  from public, anon, authenticated;
grant execute on function public.klyx_invoke_financial_runtime_tick()
  to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid
    into v_jobid
  from cron.job
  where jobname = 'klyx-financial-runtime-tick'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'klyx-financial-runtime-tick',
    '* * * * *',
    'select public.klyx_invoke_financial_runtime_tick();'
  );
end;
$$;

comment on table public.ops_financial_runtime_scheduler is
  'Fail-closed scheduler configuration. Raw bearer token is stored only in Supabase Vault; this table stores only its SHA-256 hash.';

comment on function public.klyx_invoke_financial_runtime_tick() is
  'Minute-level pg_cron -> pg_net wake-up for the KLYX canonical durable worker. Returns null while explicitly disabled or unconfigured.';

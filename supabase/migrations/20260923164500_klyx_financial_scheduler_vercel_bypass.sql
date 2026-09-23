-- KLYX financial scheduler -> protected Vercel production support.
--
-- The KLYX scheduler bearer token and the Vercel automation bypass secret are
-- independent authorities:
--   * KLYX bearer token authenticates /api/ops/financial-runtime-tick.
--   * Vercel automation bypass only traverses Deployment Protection.
--
-- Both raw values live only in Supabase Vault. No raw secret is stored in
-- public.ops_financial_runtime_scheduler or committed to the repository.

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
  v_vercel_bypass text;
  v_headers jsonb;
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

  select decrypted_secret
    into v_vercel_bypass
  from vault.decrypted_secrets
  where name = 'klyx_vercel_automation_bypass_secret'
  order by created_at desc
  limit 1;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_token
  );

  if coalesce(trim(v_vercel_bypass), '') <> '' then
    v_headers := v_headers || jsonb_build_object(
      'x-vercel-protection-bypass', v_vercel_bypass
    );
  end if;

  select net.http_post(
    url := rtrim(v_origin, '/') || '/api/ops/financial-runtime-tick',
    headers := v_headers,
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

comment on function public.klyx_invoke_financial_runtime_tick() is
  'Minute-level pg_cron wake-up for the KLYX financial runtime. Uses Vault-only KLYX bearer authentication and, when configured, a separate Vercel Deployment Protection automation bypass header.';

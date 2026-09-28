begin;

create table if not exists public.klyx_external_provider_usage_windows (
  provider text not null,
  metric text not null,
  window_kind text not null check (window_kind in ('day', 'month')),
  window_start date not null,
  units bigint not null default 0 check (units >= 0),
  updated_at timestamptz not null default now(),
  primary key (provider, metric, window_kind, window_start)
);

create table if not exists public.klyx_external_provider_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  metric text not null,
  units bigint not null check (units > 0),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (provider, metric, idempotency_key)
);

alter table public.klyx_external_provider_usage_windows enable row level security;
alter table public.klyx_external_provider_usage_reservations enable row level security;

revoke all on table public.klyx_external_provider_usage_windows from public, anon, authenticated;
revoke all on table public.klyx_external_provider_usage_reservations from public, anon, authenticated;
grant select, insert, update on table public.klyx_external_provider_usage_windows to service_role;
grant select, insert on table public.klyx_external_provider_usage_reservations to service_role;

create or replace function public.klyx_reserve_external_provider_usage(
  p_provider text,
  p_metric text,
  p_units bigint,
  p_daily_limit bigint,
  p_monthly_limit bigint,
  p_idempotency_key text
)
returns table (
  allowed boolean,
  deduplicated boolean,
  reason text,
  day_units bigint,
  month_units bigint,
  day_limit bigint,
  month_limit bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_metric text := lower(trim(coalesce(p_metric, '')));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_today date := (now() at time zone 'UTC')::date;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_day_units bigint := 0;
  v_month_units bigint := 0;
begin
  if v_provider not in (
    'openai', 'supabase', 'stripe', 'sumsub', 'twilio', 'resend',
    'tolgee', 'cloudflare_turnstile', 'elmah_io', 'vercel', 'github'
  ) then
    raise exception 'KLYX_EXTERNAL_PROVIDER_INVALID';
  end if;

  if v_metric !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'KLYX_EXTERNAL_PROVIDER_METRIC_INVALID';
  end if;

  if p_units is null or p_units <= 0 or p_units > 1000000 then
    raise exception 'KLYX_EXTERNAL_PROVIDER_UNITS_INVALID';
  end if;

  if p_daily_limit is null or p_daily_limit < 0 or
     p_monthly_limit is null or p_monthly_limit < 0 then
    raise exception 'KLYX_EXTERNAL_PROVIDER_LIMIT_INVALID';
  end if;

  if length(v_key) < 8 or length(v_key) > 200 then
    raise exception 'KLYX_EXTERNAL_PROVIDER_IDEMPOTENCY_KEY_INVALID';
  end if;

  if exists (
    select 1
      from public.klyx_external_provider_usage_reservations r
     where r.provider = v_provider
       and r.metric = v_metric
       and r.idempotency_key = v_key
  ) then
    select coalesce(w.units, 0)
      into v_day_units
      from public.klyx_external_provider_usage_windows w
     where w.provider = v_provider
       and w.metric = v_metric
       and w.window_kind = 'day'
       and w.window_start = v_today;

    select coalesce(w.units, 0)
      into v_month_units
      from public.klyx_external_provider_usage_windows w
     where w.provider = v_provider
       and w.metric = v_metric
       and w.window_kind = 'month'
       and w.window_start = v_month;

    return query select true, true, 'already_reserved',
      coalesce(v_day_units, 0), coalesce(v_month_units, 0),
      p_daily_limit, p_monthly_limit;
    return;
  end if;

  if p_daily_limit = 0 or p_monthly_limit = 0 then
    return query select false, false, 'budget_disabled',
      0::bigint, 0::bigint, p_daily_limit, p_monthly_limit;
    return;
  end if;

  insert into public.klyx_external_provider_usage_windows (
    provider, metric, window_kind, window_start, units
  ) values (
    v_provider, v_metric, 'day', v_today, 0
  ) on conflict do nothing;

  insert into public.klyx_external_provider_usage_windows (
    provider, metric, window_kind, window_start, units
  ) values (
    v_provider, v_metric, 'month', v_month, 0
  ) on conflict do nothing;

  select w.units
    into v_day_units
    from public.klyx_external_provider_usage_windows w
   where w.provider = v_provider
     and w.metric = v_metric
     and w.window_kind = 'day'
     and w.window_start = v_today
   for update;

  select w.units
    into v_month_units
    from public.klyx_external_provider_usage_windows w
   where w.provider = v_provider
     and w.metric = v_metric
     and w.window_kind = 'month'
     and w.window_start = v_month
   for update;

  if v_day_units + p_units > p_daily_limit then
    return query select false, false, 'daily_limit_reached',
      v_day_units, v_month_units, p_daily_limit, p_monthly_limit;
    return;
  end if;

  if v_month_units + p_units > p_monthly_limit then
    return query select false, false, 'monthly_limit_reached',
      v_day_units, v_month_units, p_daily_limit, p_monthly_limit;
    return;
  end if;

  update public.klyx_external_provider_usage_windows w
     set units = w.units + p_units,
         updated_at = now()
   where w.provider = v_provider
     and w.metric = v_metric
     and w.window_kind = 'day'
     and w.window_start = v_today
   returning w.units into v_day_units;

  update public.klyx_external_provider_usage_windows w
     set units = w.units + p_units,
         updated_at = now()
   where w.provider = v_provider
     and w.metric = v_metric
     and w.window_kind = 'month'
     and w.window_start = v_month
   returning w.units into v_month_units;

  insert into public.klyx_external_provider_usage_reservations (
    provider, metric, units, idempotency_key
  ) values (
    v_provider, v_metric, p_units, v_key
  );

  return query select true, false, 'reserved',
    v_day_units, v_month_units, p_daily_limit, p_monthly_limit;
end;
$$;

revoke all on function public.klyx_reserve_external_provider_usage(
  text, text, bigint, bigint, bigint, text
) from public, anon, authenticated;
grant execute on function public.klyx_reserve_external_provider_usage(
  text, text, bigint, bigint, bigint, text
) to service_role;

comment on table public.klyx_external_provider_usage_windows is
  'Durable daily/monthly counters used to bound external-provider calls before they can create cost.';
comment on table public.klyx_external_provider_usage_reservations is
  'Idempotent successful quota reservations for external-provider calls. No provider response is business authority.';
comment on function public.klyx_reserve_external_provider_usage(text, text, bigint, bigint, bigint, text) is
  'Atomically reserves bounded external-provider usage. Zero limits fail closed before any external call.';

commit;

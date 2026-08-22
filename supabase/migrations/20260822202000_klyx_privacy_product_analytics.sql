-- ============================================================
-- KLYX PRIVACY-SAFE PRODUCT ANALYTICS
--
-- Purpose:
-- - retain only aggregate daily product counters that cannot identify a user;
-- - keep the table and mutation RPC strictly server-only;
-- - never persist search text, city, IP, user/profile ids or browser identifiers.
--
-- KLYX_PRIVACY_PRODUCT_ANALYTICS_V1
-- ============================================================

begin;

create table if not exists public.product_analytics_daily (
  metric_date date not null default ((now() at time zone 'utc')::date),
  metric_key text not null,
  metric_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint product_analytics_daily_pkey primary key (metric_date, metric_key),
  constraint product_analytics_daily_metric_key_check check (
    metric_key = any (
      array[
        'provider_search_with_results'::text,
        'provider_search_no_results'::text
      ]
    )
  ),
  constraint product_analytics_daily_metric_count_check check (metric_count >= 0)
);

comment on table public.product_analytics_daily is
  'Aggregate KLYX product counters only. No user/profile id, query text, city, IP or browser identifier.';

alter table public.product_analytics_daily enable row level security;
alter table public.product_analytics_daily force row level security;

revoke all privileges on table public.product_analytics_daily
  from public, anon, authenticated;
grant all privileges on table public.product_analytics_daily
  to service_role;

create or replace function public.klyx_increment_product_metric(
  p_metric_key text
) returns bigint
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_count bigint;
begin
  if p_metric_key is null or p_metric_key not in (
    'provider_search_with_results',
    'provider_search_no_results'
  ) then
    raise exception 'KLYX_PRODUCT_ANALYTICS_INVALID_METRIC';
  end if;

  insert into public.product_analytics_daily (
    metric_date,
    metric_key,
    metric_count,
    updated_at
  )
  values (
    (now() at time zone 'utc')::date,
    p_metric_key,
    1,
    now()
  )
  on conflict (metric_date, metric_key)
  do update set
    metric_count = public.product_analytics_daily.metric_count + 1,
    updated_at = now()
  returning metric_count into v_count;

  return v_count;
end;
$$;

revoke all on function public.klyx_increment_product_metric(text)
  from public, anon, authenticated;
grant execute on function public.klyx_increment_product_metric(text)
  to service_role;

commit;

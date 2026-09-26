-- KLYX external-cost control plane.
-- This is accounting/decision support only. Operational blocking remains owned
-- by ops_capability_controls; financial LIVE authority remains unchanged.

begin;

create table if not exists public.external_provider_usage_monthly (
  provider text not null,
  period_start date not null,
  units_used bigint not null default 0,
  cost_microusd bigint not null default 0,
  last_action text,
  updated_at timestamptz not null default now(),
  primary key (provider, period_start),
  constraint external_provider_usage_provider_check
    check (provider in (
      'openai','supabase','stripe','sumsub','twilio','resend',
      'tolgee','cloudflare','elmah','vercel','github'
    )),
  constraint external_provider_usage_units_check check (units_used >= 0),
  constraint external_provider_usage_cost_check check (cost_microusd >= 0)
);

create table if not exists public.external_provider_usage_daily (
  provider text not null,
  day_start date not null,
  units_used bigint not null default 0,
  last_action text,
  updated_at timestamptz not null default now(),
  primary key (provider, day_start),
  constraint external_provider_daily_usage_provider_check
    check (provider in (
      'openai','supabase','stripe','sumsub','twilio','resend',
      'tolgee','cloudflare','elmah','vercel','github'
    )),
  constraint external_provider_daily_usage_units_check check (units_used >= 0)
);

alter table public.external_provider_usage_monthly enable row level security;
alter table public.external_provider_usage_daily enable row level security;
revoke all on table public.external_provider_usage_monthly from public, anon, authenticated;
revoke all on table public.external_provider_usage_daily from public, anon, authenticated;
grant select, insert, update on table public.external_provider_usage_monthly to service_role;
grant select, insert, update on table public.external_provider_usage_daily to service_role;

create or replace function public.klyx_reserve_external_provider_usage(
  p_provider text,
  p_action text,
  p_units bigint,
  p_cost_microusd bigint,
  p_unit_limit bigint default null,
  p_daily_unit_limit bigint default null,
  p_budget_microusd bigint default 0
)
returns table (
  allowed boolean,
  reason text,
  period_start date,
  day_start date,
  units_used bigint,
  daily_units_used bigint,
  cost_microusd bigint,
  units_remaining bigint,
  daily_units_remaining bigint,
  budget_remaining_microusd bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', now())::date;
  v_day date := now()::date;
  v_month public.external_provider_usage_monthly%rowtype;
  v_daily public.external_provider_usage_daily%rowtype;
  v_next_units bigint;
  v_next_daily_units bigint;
  v_next_cost bigint;
begin
  if p_provider not in (
    'openai','supabase','stripe','sumsub','twilio','resend',
    'tolgee','cloudflare','elmah','vercel','github'
  ) then
    raise exception 'KLYX_EXTERNAL_PROVIDER_INVALID';
  end if;

  if p_units <= 0 or p_cost_microusd < 0 or p_budget_microusd < 0 then
    raise exception 'KLYX_EXTERNAL_USAGE_INVALID';
  end if;

  if p_unit_limit is not null and p_unit_limit < 0 then
    raise exception 'KLYX_EXTERNAL_UNIT_LIMIT_INVALID';
  end if;

  if p_daily_unit_limit is not null and p_daily_unit_limit < 0 then
    raise exception 'KLYX_EXTERNAL_DAILY_UNIT_LIMIT_INVALID';
  end if;

  -- One provider-scoped lock keeps daily + monthly reservations atomic.
  perform pg_advisory_xact_lock(hashtext('klyx-external-cost:' || p_provider));

  insert into public.external_provider_usage_monthly (
    provider, period_start, units_used, cost_microusd, last_action
  ) values (
    p_provider, v_period, 0, 0, left(coalesce(p_action, ''), 120)
  ) on conflict (provider, period_start) do nothing;

  insert into public.external_provider_usage_daily (
    provider, day_start, units_used, last_action
  ) values (
    p_provider, v_day, 0, left(coalesce(p_action, ''), 120)
  ) on conflict (provider, day_start) do nothing;

  select u.*
    into v_month
    from public.external_provider_usage_monthly as u
   where u.provider = p_provider
     and u.period_start = v_period
   for update;

  select d.*
    into v_daily
    from public.external_provider_usage_daily as d
   where d.provider = p_provider
     and d.day_start = v_day
   for update;

  v_next_units := v_month.units_used + p_units;
  v_next_daily_units := v_daily.units_used + p_units;
  v_next_cost := v_month.cost_microusd + p_cost_microusd;

  if p_daily_unit_limit is not null and v_next_daily_units > p_daily_unit_limit then
    return query select
      false,
      'DAILY_UNIT_LIMIT_EXCEEDED'::text,
      v_period,
      v_day,
      v_month.units_used,
      v_daily.units_used,
      v_month.cost_microusd,
      case when p_unit_limit is null then null else greatest(p_unit_limit - v_month.units_used, 0) end,
      greatest(p_daily_unit_limit - v_daily.units_used, 0),
      greatest(p_budget_microusd - v_month.cost_microusd, 0);
    return;
  end if;

  if p_unit_limit is not null and v_next_units > p_unit_limit then
    return query select
      false,
      'MONTHLY_UNIT_LIMIT_EXCEEDED'::text,
      v_period,
      v_day,
      v_month.units_used,
      v_daily.units_used,
      v_month.cost_microusd,
      greatest(p_unit_limit - v_month.units_used, 0),
      case when p_daily_unit_limit is null then null else greatest(p_daily_unit_limit - v_daily.units_used, 0) end,
      greatest(p_budget_microusd - v_month.cost_microusd, 0);
    return;
  end if;

  if p_cost_microusd > 0 and v_next_cost > p_budget_microusd then
    return query select
      false,
      'MONTHLY_BUDGET_EXCEEDED'::text,
      v_period,
      v_day,
      v_month.units_used,
      v_daily.units_used,
      v_month.cost_microusd,
      case when p_unit_limit is null then null else greatest(p_unit_limit - v_month.units_used, 0) end,
      case when p_daily_unit_limit is null then null else greatest(p_daily_unit_limit - v_daily.units_used, 0) end,
      greatest(p_budget_microusd - v_month.cost_microusd, 0);
    return;
  end if;

  update public.external_provider_usage_monthly as u
     set units_used = v_next_units,
         cost_microusd = v_next_cost,
         last_action = left(coalesce(p_action, ''), 120),
         updated_at = now()
   where u.provider = p_provider
     and u.period_start = v_period
   returning u.* into v_month;

  update public.external_provider_usage_daily as d
     set units_used = v_next_daily_units,
         last_action = left(coalesce(p_action, ''), 120),
         updated_at = now()
   where d.provider = p_provider
     and d.day_start = v_day
   returning d.* into v_daily;

  return query select
    true,
    'RESERVED'::text,
    v_period,
    v_day,
    v_month.units_used,
    v_daily.units_used,
    v_month.cost_microusd,
    case when p_unit_limit is null then null else greatest(p_unit_limit - v_month.units_used, 0) end,
    case when p_daily_unit_limit is null then null else greatest(p_daily_unit_limit - v_daily.units_used, 0) end,
    greatest(p_budget_microusd - v_month.cost_microusd, 0);
end;
$$;

revoke all on function public.klyx_reserve_external_provider_usage(text,text,bigint,bigint,bigint,bigint,bigint)
  from public, anon, authenticated;
grant execute on function public.klyx_reserve_external_provider_usage(text,text,bigint,bigint,bigint,bigint,bigint)
  to service_role;

comment on table public.external_provider_usage_monthly is
  'Monthly provider usage/cost reservations. Not an operational or financial authority.';
comment on table public.external_provider_usage_daily is
  'Daily provider unit reservations used to protect free-tier and paid-provider limits.';
comment on function public.klyx_reserve_external_provider_usage(text,text,bigint,bigint,bigint,bigint,bigint) is
  'Atomically reserves daily/monthly external-provider quota and monthly cost before an outbound call; fails closed at configured limits.';

commit;

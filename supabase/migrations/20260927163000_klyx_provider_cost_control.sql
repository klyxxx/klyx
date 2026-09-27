begin;

create table if not exists public.provider_cost_policies (
  provider text not null,
  operation text not null,
  environment text not null default 'production',
  paid boolean not null default true,
  enabled boolean not null default false,
  rollout_state text not null default 'DISABLED',
  currency_code text null,
  reserve_cost_minor_per_call bigint not null default 0,
  max_calls_per_window bigint not null default 0,
  max_reserved_cost_minor_per_window bigint not null default 0,
  window_seconds integer not null default 86400,
  evidence_ref text null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (provider, operation, environment),
  constraint provider_cost_policies_rollout_check check (
    rollout_state in ('DISABLED','INTERNAL','TEST','PILOT','LIMITED','GENERAL')
  ),
  constraint provider_cost_policies_environment_check check (
    environment in ('test','production')
  ),
  constraint provider_cost_policies_window_check check (
    window_seconds between 60 and 2592000
  ),
  constraint provider_cost_policies_non_negative_check check (
    reserve_cost_minor_per_call >= 0
    and max_calls_per_window >= 0
    and max_reserved_cost_minor_per_window >= 0
  ),
  constraint provider_cost_policies_enabled_complete_check check (
    not enabled
    or (
      rollout_state <> 'DISABLED'
      and max_calls_per_window > 0
      and evidence_ref is not null
      and (
        not paid
        or (
          currency_code is not null
          and reserve_cost_minor_per_call > 0
          and max_reserved_cost_minor_per_window > 0
        )
      )
    )
  )
);

create table if not exists public.provider_cost_windows (
  provider text not null,
  operation text not null,
  environment text not null,
  window_started_at timestamptz not null,
  window_seconds integer not null,
  call_count bigint not null default 0,
  reserved_cost_minor bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (provider, operation, environment, window_started_at),
  constraint provider_cost_windows_non_negative_check check (
    call_count >= 0 and reserved_cost_minor >= 0
  )
);

create table if not exists public.provider_cost_decisions (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  operation text not null,
  environment text not null,
  request_key text not null,
  audience text not null,
  allowed boolean not null,
  reason_code text not null,
  reserved_cost_minor bigint not null default 0,
  currency_code text null,
  policy_version bigint null,
  window_started_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (provider, operation, environment, request_key),
  constraint provider_cost_decisions_audience_check check (
    audience in ('INTERNAL','TEST','PILOT','LIMITED','GENERAL')
  ),
  constraint provider_cost_decisions_cost_check check (
    reserved_cost_minor >= 0
  )
);

alter table public.provider_cost_policies enable row level security;
alter table public.provider_cost_windows enable row level security;
alter table public.provider_cost_decisions enable row level security;

revoke all on public.provider_cost_policies from anon, authenticated;
revoke all on public.provider_cost_windows from anon, authenticated;
revoke all on public.provider_cost_decisions from anon, authenticated;

grant select, insert, update, delete on public.provider_cost_policies to service_role;
grant select, insert, update on public.provider_cost_windows to service_role;
grant select, insert on public.provider_cost_decisions to service_role;

create or replace function public.reserve_provider_cost_budget(
  p_provider text,
  p_operation text,
  p_environment text,
  p_request_key text,
  p_audience text,
  p_at timestamptz default now()
)
returns table (
  allowed boolean,
  reason_code text,
  reservation_id uuid,
  reserved_cost_minor bigint,
  currency_code text,
  policy_version bigint,
  window_started_at timestamptz,
  calls_used bigint,
  reserved_cost_used bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_operation text := lower(trim(coalesce(p_operation, '')));
  v_environment text := lower(trim(coalesce(p_environment, '')));
  v_request_key text := trim(coalesce(p_request_key, ''));
  v_audience text := upper(trim(coalesce(p_audience, '')));
  v_policy public.provider_cost_policies%rowtype;
  v_existing public.provider_cost_decisions%rowtype;
  v_window_start timestamptz;
  v_calls bigint := 0;
  v_reserved bigint := 0;
  v_audience_rank integer;
  v_policy_rank integer;
  v_reason text;
  v_allowed boolean := false;
  v_decision_id uuid;
begin
  if v_provider = '' or v_operation = '' or v_request_key = '' then
    raise exception 'KLYX_PROVIDER_COST_INPUT_INVALID';
  end if;

  if v_environment not in ('test','production') then
    raise exception 'KLYX_PROVIDER_COST_ENVIRONMENT_INVALID';
  end if;

  v_audience_rank := case v_audience
    when 'INTERNAL' then 1
    when 'TEST' then 2
    when 'PILOT' then 3
    when 'LIMITED' then 4
    when 'GENERAL' then 5
    else 0
  end;

  if v_audience_rank = 0 then
    raise exception 'KLYX_PROVIDER_COST_AUDIENCE_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_provider || ':' || v_operation || ':' || v_environment || ':' || v_request_key,
      0
    )
  );

  select d.*
  into v_existing
  from public.provider_cost_decisions as d
  where d.provider = v_provider
    and d.operation = v_operation
    and d.environment = v_environment
    and d.request_key = v_request_key;

  if found then
    return query
    select
      v_existing.allowed,
      v_existing.reason_code,
      v_existing.id,
      v_existing.reserved_cost_minor,
      v_existing.currency_code,
      v_existing.policy_version,
      v_existing.window_started_at,
      coalesce(w.call_count, 0),
      coalesce(w.reserved_cost_minor, 0)
    from (select 1) as x
    left join public.provider_cost_windows as w
      on w.provider = v_existing.provider
      and w.operation = v_existing.operation
      and w.environment = v_existing.environment
      and w.window_started_at = v_existing.window_started_at;
    return;
  end if;

  select p.*
  into v_policy
  from public.provider_cost_policies as p
  where p.provider = v_provider
    and p.operation = v_operation
    and p.environment = v_environment
  for update;

  if not found then
    v_reason := 'POLICY_MISSING';
  elsif not v_policy.enabled then
    v_reason := 'POLICY_DISABLED';
  else
    v_policy_rank := case v_policy.rollout_state
      when 'INTERNAL' then 1
      when 'TEST' then 2
      when 'PILOT' then 3
      when 'LIMITED' then 4
      when 'GENERAL' then 5
      else 0
    end;

    if v_policy_rank < v_audience_rank then
      v_reason := 'ROLLOUT_BLOCKED';
    elsif v_policy.max_calls_per_window <= 0 then
      v_reason := 'CALL_BUDGET_NOT_CONFIGURED';
    elsif v_policy.paid and (
      v_policy.currency_code is null
      or v_policy.reserve_cost_minor_per_call <= 0
      or v_policy.max_reserved_cost_minor_per_window <= 0
    ) then
      v_reason := 'COST_BUDGET_NOT_CONFIGURED';
    else
      v_window_start := to_timestamp(
        floor(extract(epoch from p_at) / v_policy.window_seconds)
        * v_policy.window_seconds
      );

      insert into public.provider_cost_windows (
        provider,
        operation,
        environment,
        window_started_at,
        window_seconds
      ) values (
        v_provider,
        v_operation,
        v_environment,
        v_window_start,
        v_policy.window_seconds
      )
      on conflict do nothing;

      select w.call_count, w.reserved_cost_minor
      into v_calls, v_reserved
      from public.provider_cost_windows as w
      where w.provider = v_provider
        and w.operation = v_operation
        and w.environment = v_environment
        and w.window_started_at = v_window_start
      for update;

      if v_calls + 1 > v_policy.max_calls_per_window then
        v_reason := 'CALL_BUDGET_EXHAUSTED';
      elsif v_policy.paid and (
        v_reserved + v_policy.reserve_cost_minor_per_call
        > v_policy.max_reserved_cost_minor_per_window
      ) then
        v_reason := 'COST_BUDGET_EXHAUSTED';
      else
        v_allowed := true;
        v_reason := 'ALLOWED';

        update public.provider_cost_windows as w
        set
          call_count = w.call_count + 1,
          reserved_cost_minor = w.reserved_cost_minor + v_policy.reserve_cost_minor_per_call,
          updated_at = now()
        where w.provider = v_provider
          and w.operation = v_operation
          and w.environment = v_environment
          and w.window_started_at = v_window_start
        returning w.call_count, w.reserved_cost_minor
        into v_calls, v_reserved;
      end if;
    end if;
  end if;

  insert into public.provider_cost_decisions (
    provider,
    operation,
    environment,
    request_key,
    audience,
    allowed,
    reason_code,
    reserved_cost_minor,
    currency_code,
    policy_version,
    window_started_at
  ) values (
    v_provider,
    v_operation,
    v_environment,
    v_request_key,
    v_audience,
    v_allowed,
    v_reason,
    case when v_allowed then coalesce(v_policy.reserve_cost_minor_per_call, 0) else 0 end,
    v_policy.currency_code,
    v_policy.version,
    v_window_start
  )
  returning provider_cost_decisions.id into v_decision_id;

  return query select
    v_allowed,
    v_reason,
    v_decision_id,
    case when v_allowed then coalesce(v_policy.reserve_cost_minor_per_call, 0) else 0 end,
    v_policy.currency_code,
    v_policy.version,
    v_window_start,
    v_calls,
    v_reserved;
end;
$$;

revoke all on function public.reserve_provider_cost_budget(
  text, text, text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.reserve_provider_cost_budget(
  text, text, text, text, text, timestamptz
) to service_role;

commit;

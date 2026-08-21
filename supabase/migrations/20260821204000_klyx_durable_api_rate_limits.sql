-- KLYX durable API rate limiting.
-- Server-only counters shared by all application instances (including Vercel).

create table if not exists public.api_rate_limits (
  key_hash text not null,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint api_rate_limits_pkey primary key (key_hash, action),
  constraint api_rate_limits_key_hash_check
    check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint api_rate_limits_action_check
    check (char_length(action) between 1 and 80),
  constraint api_rate_limits_request_count_check
    check (request_count >= 0)
);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from public;
revoke all on table public.api_rate_limits from anon;
revoke all on table public.api_rate_limits from authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.klyx_consume_api_rate_limit(
  p_key_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer,
  request_count integer,
  window_started_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_window_started_at timestamptz;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'KLYX_RATE_LIMIT_INVALID_KEY';
  end if;

  if p_action is null or char_length(p_action) < 1 or char_length(p_action) > 80 then
    raise exception 'KLYX_RATE_LIMIT_INVALID_ACTION';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'KLYX_RATE_LIMIT_INVALID_LIMIT';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'KLYX_RATE_LIMIT_INVALID_WINDOW';
  end if;

  insert into public.api_rate_limits as limits (
    key_hash,
    action,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    p_key_hash,
    p_action,
    v_now,
    1,
    v_now
  )
  on conflict (key_hash, action) do update
  set
    window_started_at = case
      when limits.window_started_at <=
        v_now - make_interval(secs => p_window_seconds)
      then v_now
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at <=
        v_now - make_interval(secs => p_window_seconds)
      then 1
      else least(limits.request_count + 1, p_limit + 1)
    end,
    updated_at = v_now
  returning
    limits.request_count,
    limits.window_started_at
  into
    v_count,
    v_window_started_at;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      ceil(
        extract(
          epoch from (
            v_window_started_at + make_interval(secs => p_window_seconds) - v_now
          )
        )
      )::integer,
      1
    )
  end;
  request_count := v_count;
  window_started_at := v_window_started_at;

  return next;
end;
$$;

revoke all on function public.klyx_consume_api_rate_limit(text, text, integer, integer)
  from public;
revoke all on function public.klyx_consume_api_rate_limit(text, text, integer, integer)
  from anon;
revoke all on function public.klyx_consume_api_rate_limit(text, text, integer, integer)
  from authenticated;
grant execute on function public.klyx_consume_api_rate_limit(text, text, integer, integer)
  to service_role;

comment on table public.api_rate_limits is
  'Server-only hashed API rate-limit counters shared across KLYX instances.';
comment on function public.klyx_consume_api_rate_limit(text, text, integer, integer) is
  'Atomically consumes one server-side API quota unit. Execute is restricted to service_role.';

-- KLYX explicit financial LIVE authority.
-- LIVE is a canonical state transition, not an environment side effect.
-- Initial state is DISABLED and all transitions are immutable-audited.

begin;

create table if not exists public.ops_financial_live_authority (
  authority_key text primary key,
  state text not null,
  authorized_sha text,
  certification_profile_id uuid,
  reason_code text not null,
  operator_user_id uuid,
  version bigint not null default 1,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_financial_live_authority_key_check
    check (authority_key = 'stripe_finance'),
  constraint ops_financial_live_authority_state_check
    check (state in ('DISABLED', 'CONTROLLED', 'GENERAL')),
  constraint ops_financial_live_authority_sha_check
    check (
      authorized_sha is null
      or authorized_sha ~ '^[0-9a-f]{40}$'
    ),
  constraint ops_financial_live_authority_reason_check
    check (reason_code ~ '^[A-Z][A-Z0-9_.:-]{1,127}$'),
  constraint ops_financial_live_authority_version_check
    check (version >= 1),
  constraint ops_financial_live_authority_shape_check
    check (
      (state = 'DISABLED'
        and authorized_sha is null
        and certification_profile_id is null)
      or
      (state = 'CONTROLLED'
        and authorized_sha is not null
        and certification_profile_id is not null)
      or
      (state = 'GENERAL'
        and authorized_sha is not null
        and certification_profile_id is null)
    )
);

create table if not exists public.ops_financial_live_authority_events (
  id uuid primary key default gen_random_uuid(),
  authority_key text not null,
  previous_state text,
  new_state text not null,
  previous_authorized_sha text,
  new_authorized_sha text,
  previous_certification_profile_id uuid,
  new_certification_profile_id uuid,
  reason_code text not null,
  operator_user_id uuid,
  authority_version bigint not null,
  occurred_at timestamptz not null default now(),
  constraint ops_financial_live_authority_events_key_check
    check (authority_key = 'stripe_finance'),
  constraint ops_financial_live_authority_events_previous_state_check
    check (
      previous_state is null
      or previous_state in ('DISABLED', 'CONTROLLED', 'GENERAL')
    ),
  constraint ops_financial_live_authority_events_new_state_check
    check (new_state in ('DISABLED', 'CONTROLLED', 'GENERAL')),
  constraint ops_financial_live_authority_events_reason_check
    check (reason_code ~ '^[A-Z][A-Z0-9_.:-]{1,127}$'),
  constraint ops_financial_live_authority_events_version_check
    check (authority_version >= 1)
);

alter table public.ops_financial_live_authority enable row level security;
alter table public.ops_financial_live_authority_events enable row level security;

revoke all on table public.ops_financial_live_authority
  from public, anon, authenticated;
revoke all on table public.ops_financial_live_authority_events
  from public, anon, authenticated;
grant select on table public.ops_financial_live_authority
  to service_role;
grant select on table public.ops_financial_live_authority_events
  to service_role;

insert into public.ops_financial_live_authority (
  authority_key,
  state,
  authorized_sha,
  certification_profile_id,
  reason_code,
  operator_user_id,
  version,
  activated_at
)
values (
  'stripe_finance',
  'DISABLED',
  null,
  null,
  'INITIAL_FAIL_CLOSED',
  null,
  1,
  null
)
on conflict (authority_key) do nothing;

insert into public.ops_financial_live_authority_events (
  authority_key,
  previous_state,
  new_state,
  previous_authorized_sha,
  new_authorized_sha,
  previous_certification_profile_id,
  new_certification_profile_id,
  reason_code,
  operator_user_id,
  authority_version
)
select
  'stripe_finance',
  null,
  'DISABLED',
  null,
  null,
  null,
  null,
  'INITIAL_FAIL_CLOSED',
  null,
  1
where not exists (
  select 1
  from public.ops_financial_live_authority_events
  where authority_key = 'stripe_finance'
);

create or replace function public.klyx_financial_live_authority_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'KLYX_FINANCIAL_LIVE_AUTHORITY_DELETE_FORBIDDEN';
  end if;

  if current_setting(
    'klyx.financial_live_authority_rpc',
    true
  ) is distinct from 'on' then
    raise exception 'KLYX_FINANCIAL_LIVE_AUTHORITY_RPC_REQUIRED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_klyx_financial_live_authority_guard
  on public.ops_financial_live_authority;

create trigger trg_klyx_financial_live_authority_guard
before update or delete on public.ops_financial_live_authority
for each row
execute function public.klyx_financial_live_authority_guard();

create or replace function public.klyx_financial_live_authority_events_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'KLYX_FINANCIAL_LIVE_AUTHORITY_EVENT_IMMUTABLE';
end;
$$;

drop trigger if exists trg_klyx_financial_live_authority_events_immutable
  on public.ops_financial_live_authority_events;

create trigger trg_klyx_financial_live_authority_events_immutable
before update or delete on public.ops_financial_live_authority_events
for each row
execute function public.klyx_financial_live_authority_events_immutable();

create or replace function public.klyx_set_financial_live_authority(
  p_state text,
  p_authorized_sha text,
  p_certification_profile_id uuid,
  p_reason_code text,
  p_operator_user_id uuid,
  p_expected_version bigint
)
returns table (
  authority_key text,
  state text,
  authorized_sha text,
  certification_profile_id uuid,
  reason_code text,
  operator_user_id uuid,
  version bigint,
  activated_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.ops_financial_live_authority%rowtype;
  v_state text := upper(btrim(coalesce(p_state, '')));
  v_sha text := lower(btrim(coalesce(p_authorized_sha, '')));
  v_reason text := upper(btrim(coalesce(p_reason_code, '')));
  v_next_version bigint;
begin
  if v_state not in ('DISABLED', 'CONTROLLED', 'GENERAL') then
    raise exception 'KLYX_FINANCIAL_LIVE_STATE_INVALID';
  end if;

  if v_reason !~ '^[A-Z][A-Z0-9_.:-]{1,127}$' then
    raise exception 'KLYX_FINANCIAL_LIVE_REASON_INVALID';
  end if;

  select *
    into v_current
  from public.ops_financial_live_authority
  where authority_key = 'stripe_finance'
  for update;

  if not found then
    raise exception 'KLYX_FINANCIAL_LIVE_AUTHORITY_MISSING';
  end if;

  if p_expected_version is null
     or p_expected_version <> v_current.version then
    raise exception 'KLYX_FINANCIAL_LIVE_VERSION_CONFLICT';
  end if;

  if v_state = 'DISABLED' then
    v_sha := '';
    p_certification_profile_id := null;
  else
    if v_sha !~ '^[0-9a-f]{40}$' then
      raise exception 'KLYX_FINANCIAL_LIVE_SHA_INVALID';
    end if;

    if v_state = 'CONTROLLED'
       and p_certification_profile_id is null then
      raise exception 'KLYX_FINANCIAL_LIVE_CERTIFICATION_PROFILE_REQUIRED';
    end if;

    if v_state = 'GENERAL'
       and p_certification_profile_id is not null then
      raise exception 'KLYX_FINANCIAL_LIVE_GENERAL_PROFILE_FORBIDDEN';
    end if;
  end if;

  if v_current.state = 'DISABLED'
     and v_state = 'GENERAL' then
    raise exception 'KLYX_FINANCIAL_LIVE_CONTROLLED_STAGE_REQUIRED';
  end if;

  if v_current.state = 'GENERAL'
     and v_state = 'CONTROLLED' then
    raise exception 'KLYX_FINANCIAL_LIVE_DISABLE_BEFORE_CONTROLLED';
  end if;

  v_next_version := v_current.version + 1;

  perform set_config(
    'klyx.financial_live_authority_rpc',
    'on',
    true
  );

  update public.ops_financial_live_authority as a
     set state = v_state,
         authorized_sha = nullif(v_sha, ''),
         certification_profile_id =
           case
             when v_state = 'CONTROLLED'
               then p_certification_profile_id
             else null
           end,
         reason_code = v_reason,
         operator_user_id = p_operator_user_id,
         version = v_next_version,
         activated_at =
           case
             when v_state = 'DISABLED' then null
             else now()
           end,
         updated_at = now()
   where a.authority_key = 'stripe_finance';

  insert into public.ops_financial_live_authority_events (
    authority_key,
    previous_state,
    new_state,
    previous_authorized_sha,
    new_authorized_sha,
    previous_certification_profile_id,
    new_certification_profile_id,
    reason_code,
    operator_user_id,
    authority_version
  )
  values (
    'stripe_finance',
    v_current.state,
    v_state,
    v_current.authorized_sha,
    nullif(v_sha, ''),
    v_current.certification_profile_id,
    case
      when v_state = 'CONTROLLED'
        then p_certification_profile_id
      else null
    end,
    v_reason,
    p_operator_user_id,
    v_next_version
  );

  return query
  select
    a.authority_key,
    a.state,
    a.authorized_sha,
    a.certification_profile_id,
    a.reason_code,
    a.operator_user_id,
    a.version,
    a.activated_at,
    a.updated_at
  from public.ops_financial_live_authority as a
  where a.authority_key = 'stripe_finance';
end;
$$;

revoke all on function public.klyx_set_financial_live_authority(
  text, text, uuid, text, uuid, bigint
) from public, anon, authenticated;
grant execute on function public.klyx_set_financial_live_authority(
  text, text, uuid, text, uuid, bigint
) to service_role;

comment on table public.ops_financial_live_authority is
  'Canonical KLYX financial LIVE state. Environment variables are only configuration/fences and can never activate LIVE without this row.';

comment on table public.ops_financial_live_authority_events is
  'Immutable audit trail for every KLYX financial LIVE state transition.';

commit;

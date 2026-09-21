begin;

create table if not exists public.financial_live_authorizations (
  control_key text primary key,
  state text not null default 'disarmed',
  certified_sha text,
  operator_auth_user_id uuid,
  reason_code text not null default 'INITIAL_DISARMED',
  version bigint not null default 1,
  armed_at timestamptz,
  disarmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_live_authorizations_key_check
    check (control_key = 'stripe_platform_held'),
  constraint financial_live_authorizations_state_check
    check (state in ('disarmed', 'armed')),
  constraint financial_live_authorizations_sha_check
    check (
      certified_sha is null
      or certified_sha ~ '^[0-9a-f]{40}$'
    ),
  constraint financial_live_authorizations_armed_sha_check
    check (state <> 'armed' or certified_sha is not null),
  constraint financial_live_authorizations_version_check
    check (version >= 1)
);

create table if not exists public.financial_live_operational_proofs (
  proof_key text primary key,
  observed_at timestamptz not null,
  source text not null,
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint financial_live_operational_proofs_key_check
    check (
      proof_key in (
        'durable_jobs_worker',
        'critical_alerting',
        'settlement_reconciliation'
      )
    )
);

create table if not exists public.financial_live_authorization_events (
  id uuid primary key default gen_random_uuid(),
  control_key text not null,
  from_state text not null,
  to_state text not null,
  certified_sha text,
  operator_auth_user_id uuid not null,
  reason_code text not null,
  version bigint not null,
  created_at timestamptz not null default now(),
  constraint financial_live_authorization_events_control_fk
    foreign key (control_key)
    references public.financial_live_authorizations(control_key)
    on delete restrict,
  constraint financial_live_authorization_events_state_check
    check (
      from_state in ('disarmed', 'armed')
      and to_state in ('disarmed', 'armed')
    ),
  constraint financial_live_authorization_events_sha_check
    check (
      certified_sha is null
      or certified_sha ~ '^[0-9a-f]{40}$'
    ),
  constraint financial_live_authorization_events_version_check
    check (version >= 1)
);

create index if not exists financial_live_authorization_events_control_idx
  on public.financial_live_authorization_events(control_key, created_at desc);

alter table public.financial_live_authorizations enable row level security;
alter table public.financial_live_authorization_events enable row level security;
alter table public.financial_live_operational_proofs enable row level security;

revoke all privileges on table public.financial_live_authorizations
  from anon, authenticated, public;
revoke all privileges on table public.financial_live_authorization_events
  from anon, authenticated, public;
revoke all privileges on table public.financial_live_operational_proofs
  from anon, authenticated, public;

grant select on table public.financial_live_authorizations to service_role;
grant select on table public.financial_live_authorization_events to service_role;
grant select, insert, update on table public.financial_live_operational_proofs to service_role;

create or replace function public.klyx_financial_live_authorization_events_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'KLYX_FINANCIAL_LIVE_AUTHORIZATION_AUDIT_IMMUTABLE';
end;
$$;

drop trigger if exists financial_live_authorization_events_immutable
  on public.financial_live_authorization_events;

create trigger financial_live_authorization_events_immutable
before update or delete on public.financial_live_authorization_events
for each row
execute function public.klyx_financial_live_authorization_events_immutable();

insert into public.financial_live_authorizations (
  control_key,
  state,
  certified_sha,
  operator_auth_user_id,
  reason_code,
  version,
  armed_at,
  disarmed_at
)
values (
  'stripe_platform_held',
  'disarmed',
  null,
  null,
  'INITIAL_DISARMED',
  1,
  null,
  now()
)
on conflict (control_key) do nothing;

create or replace function public.klyx_set_financial_live_authorization(
  p_to_state text,
  p_certified_sha text,
  p_operator_auth_user_id uuid,
  p_reason_code text,
  p_expected_version bigint
)
returns table (
  control_key text,
  state text,
  certified_sha text,
  version bigint,
  armed_at timestamptz,
  disarmed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.financial_live_authorizations%rowtype;
  v_state text := lower(trim(coalesce(p_to_state, '')));
  v_sha text := lower(trim(coalesce(p_certified_sha, '')));
  v_reason text := upper(trim(coalesce(p_reason_code, '')));
  v_next_version bigint;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_FINANCIAL_LIVE_OPERATOR_REQUIRED';
  end if;

  if v_state not in ('armed', 'disarmed') then
    raise exception 'KLYX_FINANCIAL_LIVE_STATE_INVALID';
  end if;

  if v_reason = '' then
    raise exception 'KLYX_FINANCIAL_LIVE_REASON_REQUIRED';
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'KLYX_FINANCIAL_LIVE_VERSION_REQUIRED';
  end if;

  if v_state = 'armed' and v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'KLYX_FINANCIAL_LIVE_CERTIFIED_SHA_INVALID';
  end if;

  select *
    into v_row
    from public.financial_live_authorizations
   where financial_live_authorizations.control_key = 'stripe_platform_held'
   for update;

  if not found then
    raise exception 'KLYX_FINANCIAL_LIVE_CONTROL_MISSING';
  end if;

  if v_row.version <> p_expected_version then
    raise exception 'KLYX_FINANCIAL_LIVE_VERSION_CONFLICT';
  end if;

  if (
    v_row.state = v_state
    and (
      v_state = 'disarmed'
      or v_row.certified_sha = v_sha
    )
  ) then
    return query
    select
      v_row.control_key,
      v_row.state,
      v_row.certified_sha,
      v_row.version,
      v_row.armed_at,
      v_row.disarmed_at,
      v_row.updated_at;
    return;
  end if;

  v_next_version := v_row.version + 1;

  update public.financial_live_authorizations
     set state = v_state,
         certified_sha = case
           when v_state = 'armed' then v_sha
           else certified_sha
         end,
         operator_auth_user_id = p_operator_auth_user_id,
         reason_code = v_reason,
         version = v_next_version,
         armed_at = case
           when v_state = 'armed' then now()
           else armed_at
         end,
         disarmed_at = case
           when v_state = 'disarmed' then now()
           else null
         end,
         updated_at = now()
   where financial_live_authorizations.control_key = 'stripe_platform_held'
   returning *
      into v_row;

  insert into public.financial_live_authorization_events (
    control_key,
    from_state,
    to_state,
    certified_sha,
    operator_auth_user_id,
    reason_code,
    version
  )
  values (
    v_row.control_key,
    case when v_state = 'armed' then 'disarmed' else 'armed' end,
    v_state,
    v_row.certified_sha,
    p_operator_auth_user_id,
    v_reason,
    v_next_version
  );

  return query
  select
    v_row.control_key,
    v_row.state,
    v_row.certified_sha,
    v_row.version,
    v_row.armed_at,
    v_row.disarmed_at,
    v_row.updated_at;
end;
$$;

revoke all on function public.klyx_set_financial_live_authorization(
  text, text, uuid, text, bigint
) from public, anon, authenticated;
grant execute on function public.klyx_set_financial_live_authorization(
  text, text, uuid, text, bigint
) to service_role;

create or replace function public.klyx_record_financial_live_operational_proof(
  p_proof_key text,
  p_source text,
  p_details jsonb default '{}'::jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $
declare
  v_key text := lower(trim(coalesce(p_proof_key, '')));
  v_source text := trim(coalesce(p_source, ''));
  v_now timestamptz := now();
begin
  if v_key not in (
    'durable_jobs_worker',
    'critical_alerting',
    'settlement_reconciliation'
  ) then
    raise exception 'KLYX_FINANCIAL_LIVE_PROOF_KEY_INVALID';
  end if;

  if v_source = '' then
    raise exception 'KLYX_FINANCIAL_LIVE_PROOF_SOURCE_REQUIRED';
  end if;

  insert into public.financial_live_operational_proofs (
    proof_key,
    observed_at,
    source,
    details,
    updated_at
  )
  values (
    v_key,
    v_now,
    v_source,
    coalesce(p_details, '{}'::jsonb),
    v_now
  )
  on conflict (proof_key)
  do update
     set observed_at = excluded.observed_at,
         source = excluded.source,
         details = excluded.details,
         updated_at = excluded.updated_at;

  return v_now;
end;
$;

revoke all on function public.klyx_record_financial_live_operational_proof(
  text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.klyx_record_financial_live_operational_proof(
  text, text, jsonb
) to service_role;

comment on table public.financial_live_authorizations is
  'Explicit KLYX financial LIVE authorization state. Stripe mode alone never authorizes money movement.';
comment on table public.financial_live_authorization_events is
  'Immutable audit trail for KLYX financial LIVE arm/disarm transitions.';
comment on table public.financial_live_operational_proofs is
  'Freshness proofs for the financial worker, critical-alert sentinel, and settlement reconciliation. LIVE readiness fails closed when these proofs are stale.';

commit;

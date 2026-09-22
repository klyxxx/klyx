begin;

create extension if not exists pgcrypto;

-- Canonical expansion manifest.
-- This table says where KLYX intends to operate and at what rollout maturity.
-- It does NOT replace payment, tax, risk, economic eligibility, activity
-- qualification or Operations authorities.
create table if not exists public.klyx_markets (
  market_key text primary key,
  display_name text not null,
  jurisdiction_code text not null,
  country_code text,
  default_currency_code text,
  infrastructure_region text,
  rollout_state text not null default 'DISABLED',
  risk_policy_key text,
  commission_policy_key text,
  evidence_ref text,
  version bigint not null default 1,
  activated_at timestamptz,
  created_by_auth_user_id uuid not null,
  updated_by_auth_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint klyx_markets_market_key_check
    check (
      length(market_key) between 2 and 96
      and market_key ~ '^[a-z0-9][a-z0-9_.:-]*$'
    ),
  constraint klyx_markets_display_name_check
    check (length(trim(display_name)) between 2 and 160),
  constraint klyx_markets_jurisdiction_check
    check (
      length(jurisdiction_code) between 2 and 64
      and jurisdiction_code ~ '^[A-Z0-9][A-Z0-9_.:-]*$'
    ),
  constraint klyx_markets_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint klyx_markets_currency_code_check
    check (
      default_currency_code is null
      or default_currency_code ~ '^[A-Z]{3}$'
    ),
  constraint klyx_markets_infrastructure_region_check
    check (
      infrastructure_region is null
      or (
        length(infrastructure_region) between 2 and 96
        and infrastructure_region ~ '^[a-z0-9][a-z0-9_.:-]*$'
      )
    ),
  constraint klyx_markets_rollout_state_check
    check (
      rollout_state in (
        'DISABLED',
        'INTERNAL',
        'TEST',
        'PILOT',
        'LIMITED',
        'GENERAL'
      )
    ),
  constraint klyx_markets_version_check
    check (version >= 1)
);

comment on table public.klyx_markets is
  'Canonical Global Expansion manifest. Rollout intent only; payment, tax, economic eligibility, activity rules, risk and Operations remain separate authorities.';

-- Declarative requirements. These rows declare which external authority must be
-- consulted; they do not themselves prove that an account/entity is eligible.
create table if not exists public.klyx_market_requirements (
  id uuid primary key default gen_random_uuid(),
  market_key text not null
    references public.klyx_markets(market_key)
    on delete cascade,
  requirement_type text not null,
  requirement_key text not null,
  authority text not null,
  enforcement text not null default 'required',
  activity_key text,
  jurisdiction_code text,
  evidence_ref text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_by_auth_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint klyx_market_requirements_type_check
    check (
      requirement_type in (
        'economic',
        'activity',
        'regulation',
        'payment',
        'tax',
        'risk',
        'infrastructure'
      )
    ),
  constraint klyx_market_requirements_key_check
    check (
      length(requirement_key) between 2 and 128
      and requirement_key ~ '^[a-z0-9][a-z0-9_.:-]*$'
    ),
  constraint klyx_market_requirements_authority_check
    check (
      authority in (
        'economic_identity',
        'account_capability',
        'market_payment_policy',
        'payment_provider',
        'risk_engine',
        'operations',
        'external_review'
      )
    ),
  constraint klyx_market_requirements_enforcement_check
    check (enforcement in ('required', 'optional', 'blocked')),
  constraint klyx_market_requirements_activity_key_check
    check (
      activity_key is null
      or (
        length(activity_key) between 2 and 128
        and activity_key ~ '^[a-z0-9][a-z0-9_.:-]*$'
      )
    ),
  constraint klyx_market_requirements_jurisdiction_check
    check (
      jurisdiction_code is null
      or (
        length(jurisdiction_code) between 2 and 64
        and jurisdiction_code ~ '^[A-Z0-9][A-Z0-9_.:-]*$'
      )
    ),
  constraint klyx_market_requirements_validity_check
    check (valid_until is null or valid_until > valid_from),
  constraint klyx_market_requirements_version_check
    check (version >= 1),
  unique (market_key, requirement_type, requirement_key)
);

create index if not exists klyx_market_requirements_lookup_idx
  on public.klyx_market_requirements (
    market_key,
    requirement_type,
    enforcement,
    valid_from
  );

-- Feature availability is market data, never a country-specific code branch.
create table if not exists public.klyx_market_features (
  market_key text not null
    references public.klyx_markets(market_key)
    on delete cascade,
  feature_key text not null,
  rollout_state text not null default 'DISABLED',
  evidence_ref text,
  version bigint not null default 1,
  updated_by_auth_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (market_key, feature_key),

  constraint klyx_market_features_key_check
    check (
      length(feature_key) between 2 and 128
      and feature_key ~ '^[a-z0-9][a-z0-9_.:-]*$'
    ),
  constraint klyx_market_features_rollout_state_check
    check (
      rollout_state in (
        'DISABLED',
        'INTERNAL',
        'TEST',
        'PILOT',
        'LIMITED',
        'GENERAL'
      )
    ),
  constraint klyx_market_features_version_check
    check (version >= 1)
);

-- Append-only control-plane audit. Business payloads do not belong here.
create table if not exists public.klyx_market_control_events (
  id uuid primary key default gen_random_uuid(),
  market_key text not null
    references public.klyx_markets(market_key)
    on delete cascade,
  event_type text not null,
  actor_auth_user_id uuid not null,
  market_version bigint,
  from_state text,
  to_state text,
  reason_code text not null,
  evidence_ref text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint klyx_market_control_events_type_check
    check (
      event_type in (
        'market.created',
        'market.config_updated',
        'market.rollout_transition',
        'market.feature_updated',
        'market.requirement_updated'
      )
    ),
  constraint klyx_market_control_events_reason_check
    check (
      length(reason_code) between 2 and 96
      and reason_code ~ '^[A-Z0-9][A-Z0-9_.:-]*$'
    )
);

create index if not exists klyx_market_control_events_market_idx
  on public.klyx_market_control_events (market_key, created_at desc);

create or replace function public.klyx_market_control_events_append_only_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'KLYX_MARKET_CONTROL_EVENTS_APPEND_ONLY';
end;
$$;

alter function public.klyx_market_control_events_append_only_guard()
  owner to postgres;

drop trigger if exists klyx_market_control_events_append_only_guard
  on public.klyx_market_control_events;

create trigger klyx_market_control_events_append_only_guard
before update or delete on public.klyx_market_control_events
for each row
execute function public.klyx_market_control_events_append_only_guard();

-- Create/update the declarative manifest. Rollout state cannot be changed here.
create or replace function public.klyx_upsert_market_manifest(
  p_market_key text,
  p_display_name text,
  p_jurisdiction_code text,
  p_country_code text,
  p_default_currency_code text,
  p_infrastructure_region text,
  p_risk_policy_key text,
  p_commission_policy_key text,
  p_evidence_ref text,
  p_operator_auth_user_id uuid,
  p_expected_version bigint,
  p_reason_code text
)
returns table(
  market_key text,
  rollout_state text,
  version bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_market_key text := lower(trim(coalesce(p_market_key, '')));
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_jurisdiction text := upper(trim(coalesce(p_jurisdiction_code, '')));
  v_country text := nullif(upper(trim(coalesce(p_country_code, ''))), '');
  v_currency text := nullif(upper(trim(coalesce(p_default_currency_code, ''))), '');
  v_region text := nullif(lower(trim(coalesce(p_infrastructure_region, ''))), '');
  v_risk text := nullif(lower(trim(coalesce(p_risk_policy_key, ''))), '');
  v_commission text := nullif(lower(trim(coalesce(p_commission_policy_key, ''))), '');
  v_evidence text := nullif(trim(coalesce(p_evidence_ref, '')), '');
  v_reason text := upper(trim(coalesce(p_reason_code, '')));
  v_existing public.klyx_markets%rowtype;
  v_result public.klyx_markets%rowtype;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_EXPANSION_OPERATOR_REQUIRED';
  end if;

  if v_market_key = '' or v_display_name = '' or v_jurisdiction = '' then
    raise exception 'KLYX_EXPANSION_MANIFEST_REQUIRED';
  end if;

  if v_reason = '' then
    raise exception 'KLYX_EXPANSION_REASON_REQUIRED';
  end if;

  select *
    into v_existing
    from public.klyx_markets
   where public.klyx_markets.market_key = v_market_key
   for update;

  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
    end if;

    insert into public.klyx_markets (
      market_key,
      display_name,
      jurisdiction_code,
      country_code,
      default_currency_code,
      infrastructure_region,
      rollout_state,
      risk_policy_key,
      commission_policy_key,
      evidence_ref,
      version,
      created_by_auth_user_id,
      updated_by_auth_user_id
    ) values (
      v_market_key,
      v_display_name,
      v_jurisdiction,
      v_country,
      v_currency,
      v_region,
      'DISABLED',
      v_risk,
      v_commission,
      v_evidence,
      1,
      p_operator_auth_user_id,
      p_operator_auth_user_id
    )
    returning * into v_result;

    insert into public.klyx_market_control_events (
      market_key,
      event_type,
      actor_auth_user_id,
      market_version,
      reason_code,
      evidence_ref,
      details
    ) values (
      v_result.market_key,
      'market.created',
      p_operator_auth_user_id,
      v_result.version,
      v_reason,
      v_evidence,
      jsonb_build_object(
        'jurisdiction_code', v_result.jurisdiction_code,
        'country_code', v_result.country_code,
        'default_currency_code', v_result.default_currency_code,
        'infrastructure_region', v_result.infrastructure_region
      )
    );
  else
    if v_existing.version <> p_expected_version then
      raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
    end if;

    update public.klyx_markets
       set display_name = v_display_name,
           jurisdiction_code = v_jurisdiction,
           country_code = v_country,
           default_currency_code = v_currency,
           infrastructure_region = v_region,
           risk_policy_key = v_risk,
           commission_policy_key = v_commission,
           evidence_ref = v_evidence,
           version = version + 1,
           updated_by_auth_user_id = p_operator_auth_user_id,
           updated_at = now()
     where public.klyx_markets.market_key = v_market_key
       and version = p_expected_version
    returning * into v_result;

    if not found then
      raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
    end if;

    insert into public.klyx_market_control_events (
      market_key,
      event_type,
      actor_auth_user_id,
      market_version,
      reason_code,
      evidence_ref,
      details
    ) values (
      v_result.market_key,
      'market.config_updated',
      p_operator_auth_user_id,
      v_result.version,
      v_reason,
      v_evidence,
      jsonb_build_object(
        'jurisdiction_code', v_result.jurisdiction_code,
        'country_code', v_result.country_code,
        'default_currency_code', v_result.default_currency_code,
        'infrastructure_region', v_result.infrastructure_region
      )
    );
  end if;

  return query
  select
    v_result.market_key,
    v_result.rollout_state,
    v_result.version;
end;
$$;

alter function public.klyx_upsert_market_manifest(
  text, text, text, text, text, text, text, text, text, uuid, bigint, text
) owner to postgres;

-- Rollout progression is explicit. Operational DEGRADED/SUSPENDED state is
-- derived from Operations and circuit breakers; it is not stored here.
create or replace function public.klyx_transition_market_rollout(
  p_market_key text,
  p_expected_version bigint,
  p_to_state text,
  p_operator_auth_user_id uuid,
  p_reason_code text,
  p_evidence_ref text default null
)
returns table(
  market_key text,
  rollout_state text,
  version bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_market_key text := lower(trim(coalesce(p_market_key, '')));
  v_to_state text := upper(trim(coalesce(p_to_state, '')));
  v_reason text := upper(trim(coalesce(p_reason_code, '')));
  v_evidence text := nullif(trim(coalesce(p_evidence_ref, '')), '');
  v_market public.klyx_markets%rowtype;
  v_from_state text;
  v_allowed boolean := false;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_EXPANSION_OPERATOR_REQUIRED';
  end if;

  if v_reason = '' then
    raise exception 'KLYX_EXPANSION_REASON_REQUIRED';
  end if;

  select *
    into v_market
    from public.klyx_markets
   where public.klyx_markets.market_key = v_market_key
   for update;

  if not found then
    raise exception 'KLYX_EXPANSION_MARKET_NOT_FOUND';
  end if;

  if v_market.version <> p_expected_version then
    raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
  end if;

  v_from_state := v_market.rollout_state;

  if v_from_state = v_to_state then
    return query
    select v_market.market_key, v_market.rollout_state, v_market.version;
    return;
  end if;

  v_allowed :=
    (v_from_state = 'DISABLED' and v_to_state = 'INTERNAL')
    or (v_from_state = 'INTERNAL' and v_to_state in ('DISABLED', 'TEST'))
    or (v_from_state = 'TEST' and v_to_state in ('INTERNAL', 'PILOT'))
    or (v_from_state = 'PILOT' and v_to_state in ('TEST', 'LIMITED'))
    or (v_from_state = 'LIMITED' and v_to_state in ('PILOT', 'GENERAL'))
    or (v_from_state = 'GENERAL' and v_to_state = 'LIMITED');

  if not v_allowed then
    raise exception 'KLYX_EXPANSION_TRANSITION_INVALID';
  end if;

  if
    v_to_state in ('INTERNAL', 'TEST', 'PILOT', 'LIMITED', 'GENERAL')
    and v_evidence is null
  then
    raise exception 'KLYX_EXPANSION_EVIDENCE_REQUIRED';
  end if;

  update public.klyx_markets
     set rollout_state = v_to_state,
         version = version + 1,
         activated_at = case
           when v_to_state <> 'DISABLED'
           then coalesce(activated_at, now())
           else activated_at
         end,
         updated_by_auth_user_id = p_operator_auth_user_id,
         updated_at = now()
   where public.klyx_markets.market_key = v_market_key
     and version = p_expected_version
  returning * into v_market;

  if not found then
    raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
  end if;

  insert into public.klyx_market_control_events (
    market_key,
    event_type,
    actor_auth_user_id,
    market_version,
    from_state,
    to_state,
    reason_code,
    evidence_ref
  ) values (
    v_market.market_key,
    'market.rollout_transition',
    p_operator_auth_user_id,
    v_market.version,
    v_from_state,
    v_to_state,
    v_reason,
    v_evidence
  );

  return query
  select v_market.market_key, v_market.rollout_state, v_market.version;
end;
$$;

alter function public.klyx_transition_market_rollout(
  text, bigint, text, uuid, text, text
) owner to postgres;

create or replace function public.klyx_set_market_feature(
  p_market_key text,
  p_feature_key text,
  p_expected_version bigint,
  p_rollout_state text,
  p_operator_auth_user_id uuid,
  p_reason_code text,
  p_evidence_ref text default null
)
returns table(
  market_key text,
  feature_key text,
  rollout_state text,
  version bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_market_key text := lower(trim(coalesce(p_market_key, '')));
  v_feature_key text := lower(trim(coalesce(p_feature_key, '')));
  v_state text := upper(trim(coalesce(p_rollout_state, '')));
  v_reason text := upper(trim(coalesce(p_reason_code, '')));
  v_evidence text := nullif(trim(coalesce(p_evidence_ref, '')), '');
  v_feature public.klyx_market_features%rowtype;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_EXPANSION_OPERATOR_REQUIRED';
  end if;

  if v_feature_key = '' or v_reason = '' then
    raise exception 'KLYX_EXPANSION_FEATURE_REQUIRED';
  end if;

  if v_state not in (
    'DISABLED',
    'INTERNAL',
    'TEST',
    'PILOT',
    'LIMITED',
    'GENERAL'
  ) then
    raise exception 'KLYX_EXPANSION_FEATURE_STATE_INVALID';
  end if;

  if v_state <> 'DISABLED' and v_evidence is null then
    raise exception 'KLYX_EXPANSION_EVIDENCE_REQUIRED';
  end if;

  select *
    into v_feature
    from public.klyx_market_features
   where public.klyx_market_features.market_key = v_market_key
     and public.klyx_market_features.feature_key = v_feature_key
   for update;

  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
    end if;

    insert into public.klyx_market_features (
      market_key,
      feature_key,
      rollout_state,
      evidence_ref,
      version,
      updated_by_auth_user_id
    ) values (
      v_market_key,
      v_feature_key,
      v_state,
      v_evidence,
      1,
      p_operator_auth_user_id
    )
    returning * into v_feature;
  else
    if v_feature.version <> p_expected_version then
      raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
    end if;

    update public.klyx_market_features
       set rollout_state = v_state,
           evidence_ref = v_evidence,
           version = version + 1,
           updated_by_auth_user_id = p_operator_auth_user_id,
           updated_at = now()
     where public.klyx_market_features.market_key = v_market_key
       and public.klyx_market_features.feature_key = v_feature_key
       and version = p_expected_version
    returning * into v_feature;

    if not found then
      raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
    end if;
  end if;

  insert into public.klyx_market_control_events (
    market_key,
    event_type,
    actor_auth_user_id,
    reason_code,
    evidence_ref,
    details
  ) values (
    v_market_key,
    'market.feature_updated',
    p_operator_auth_user_id,
    v_reason,
    v_evidence,
    jsonb_build_object(
      'feature_key', v_feature_key,
      'rollout_state', v_feature.rollout_state,
      'feature_version', v_feature.version
    )
  );

  return query
  select
    v_feature.market_key,
    v_feature.feature_key,
    v_feature.rollout_state,
    v_feature.version;
end;
$$;

alter function public.klyx_set_market_feature(
  text, text, bigint, text, uuid, text, text
) owner to postgres;

create or replace function public.klyx_set_market_requirement(
  p_market_key text,
  p_requirement_type text,
  p_requirement_key text,
  p_authority text,
  p_enforcement text,
  p_activity_key text,
  p_jurisdiction_code text,
  p_evidence_ref text,
  p_operator_auth_user_id uuid,
  p_expected_version bigint,
  p_reason_code text
)
returns table(
  requirement_id uuid,
  market_key text,
  version bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_market_key text := lower(trim(coalesce(p_market_key, '')));
  v_type text := lower(trim(coalesce(p_requirement_type, '')));
  v_key text := lower(trim(coalesce(p_requirement_key, '')));
  v_authority text := lower(trim(coalesce(p_authority, '')));
  v_enforcement text := lower(trim(coalesce(p_enforcement, '')));
  v_activity text := nullif(lower(trim(coalesce(p_activity_key, ''))), '');
  v_jurisdiction text := nullif(upper(trim(coalesce(p_jurisdiction_code, ''))), '');
  v_evidence text := nullif(trim(coalesce(p_evidence_ref, '')), '');
  v_reason text := upper(trim(coalesce(p_reason_code, '')));
  v_requirement public.klyx_market_requirements%rowtype;
begin
  if p_operator_auth_user_id is null then
    raise exception 'KLYX_EXPANSION_OPERATOR_REQUIRED';
  end if;

  if
    v_market_key = ''
    or v_type = ''
    or v_key = ''
    or v_authority = ''
    or v_enforcement = ''
    or v_reason = ''
  then
    raise exception 'KLYX_EXPANSION_REQUIREMENT_REQUIRED';
  end if;

  select *
    into v_requirement
    from public.klyx_market_requirements
   where public.klyx_market_requirements.market_key = v_market_key
     and public.klyx_market_requirements.requirement_type = v_type
     and public.klyx_market_requirements.requirement_key = v_key
   for update;

  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
    end if;

    insert into public.klyx_market_requirements (
      market_key,
      requirement_type,
      requirement_key,
      authority,
      enforcement,
      activity_key,
      jurisdiction_code,
      evidence_ref,
      version,
      updated_by_auth_user_id
    ) values (
      v_market_key,
      v_type,
      v_key,
      v_authority,
      v_enforcement,
      v_activity,
      v_jurisdiction,
      v_evidence,
      1,
      p_operator_auth_user_id
    )
    returning * into v_requirement;
  else
    if v_requirement.version <> p_expected_version then
      raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
    end if;

    update public.klyx_market_requirements
       set authority = v_authority,
           enforcement = v_enforcement,
           activity_key = v_activity,
           jurisdiction_code = v_jurisdiction,
           evidence_ref = v_evidence,
           version = version + 1,
           updated_by_auth_user_id = p_operator_auth_user_id,
           updated_at = now()
     where id = v_requirement.id
       and version = p_expected_version
    returning * into v_requirement;

    if not found then
      raise exception 'KLYX_EXPANSION_VERSION_CONFLICT';
    end if;
  end if;

  insert into public.klyx_market_control_events (
    market_key,
    event_type,
    actor_auth_user_id,
    reason_code,
    evidence_ref,
    details
  ) values (
    v_market_key,
    'market.requirement_updated',
    p_operator_auth_user_id,
    v_reason,
    v_evidence,
    jsonb_build_object(
      'requirement_id', v_requirement.id,
      'requirement_type', v_requirement.requirement_type,
      'requirement_key', v_requirement.requirement_key,
      'authority', v_requirement.authority,
      'enforcement', v_requirement.enforcement,
      'requirement_version', v_requirement.version
    )
  );

  return query
  select v_requirement.id, v_requirement.market_key, v_requirement.version;
end;
$$;

alter function public.klyx_set_market_requirement(
  text, text, text, text, text, text, text, text, uuid, bigint, text
) owner to postgres;

alter table public.klyx_markets enable row level security;
alter table public.klyx_market_requirements enable row level security;
alter table public.klyx_market_features enable row level security;
alter table public.klyx_market_control_events enable row level security;

revoke all privileges on table public.klyx_markets
  from public, anon, authenticated, service_role;
revoke all privileges on table public.klyx_market_requirements
  from public, anon, authenticated, service_role;
revoke all privileges on table public.klyx_market_features
  from public, anon, authenticated, service_role;
revoke all privileges on table public.klyx_market_control_events
  from public, anon, authenticated, service_role;

grant select on table public.klyx_markets to service_role;
grant select on table public.klyx_market_requirements to service_role;
grant select on table public.klyx_market_features to service_role;
grant select on table public.klyx_market_control_events to service_role;

revoke all on function public.klyx_upsert_market_manifest(
  text, text, text, text, text, text, text, text, text, uuid, bigint, text
) from public, anon, authenticated;
grant execute on function public.klyx_upsert_market_manifest(
  text, text, text, text, text, text, text, text, text, uuid, bigint, text
) to service_role;

revoke all on function public.klyx_transition_market_rollout(
  text, bigint, text, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.klyx_transition_market_rollout(
  text, bigint, text, uuid, text, text
) to service_role;

revoke all on function public.klyx_set_market_feature(
  text, text, bigint, text, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.klyx_set_market_feature(
  text, text, bigint, text, uuid, text, text
) to service_role;

revoke all on function public.klyx_set_market_requirement(
  text, text, text, text, text, text, text, text, uuid, bigint, text
) from public, anon, authenticated;
grant execute on function public.klyx_set_market_requirement(
  text, text, text, text, text, text, text, text, uuid, bigint, text
) to service_role;

commit;

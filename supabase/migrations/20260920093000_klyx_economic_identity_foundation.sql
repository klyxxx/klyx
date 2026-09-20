-- ============================================================
-- KLYX ECONOMIC IDENTITY FOUNDATION
--
-- Mission 10 authority model:
--   accounts.id                         = canonical KLYX user identity
--   economic_identities                 = economic/compliance facts
--   account_stripe_connect_identities   = canonical external Stripe identity
--   account_actor_capabilities          = canonical account capability authority
--   account_capability_qualifications   = canonical qualification authority
--   trust_eligibility_decisions         = deterministic activity eligibility authority
--
-- This migration is additive. It does not authorize financial mutations and
-- does not replace Trust & Safety, provider verification, or Stripe identity.
-- ============================================================

begin;

-- ============================================================
-- 1. ONE ECONOMIC IDENTITY PER CANONICAL KLYX ACCOUNT
-- ============================================================

create table if not exists public.economic_identities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null
    references public.accounts(id)
    on delete cascade,
  status text not null default 'created',
  primary_country_code text,
  human_review_required boolean not null default false,
  review_reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint economic_identities_account_key unique (account_id),
  constraint economic_identities_status_check
    check (status in (
      'created',
      'collecting',
      'ready',
      'restricted',
      'human_review',
      'closed'
    )),
  constraint economic_identities_country_code_check
    check (
      primary_country_code is null
      or primary_country_code ~ '^[A-Z]{2}$'
    ),
  constraint economic_identities_review_consistency_check
    check (
      status <> 'human_review'
      or human_review_required = true
    )
);

comment on table public.economic_identities is
  'One canonical economic/compliance identity per public.accounts.id. Its status is not, by itself, permission to perform an activity or receive money.';
comment on column public.economic_identities.account_id is
  'Canonical KLYX account authority. Never a legacy profiles.id.';
comment on column public.economic_identities.primary_country_code is
  'Optional ISO-style country fact. No country is a permanent product boundary or schema default.';

create index if not exists economic_identities_status_idx
  on public.economic_identities (status, updated_at desc);

insert into public.economic_identities (account_id)
select account.id
from public.accounts as account
on conflict (account_id) do nothing;

create or replace function public.klyx_seed_economic_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.economic_identities (account_id)
  values (new.id)
  on conflict (account_id) do nothing;

  return new;
end;
$$;

alter function public.klyx_seed_economic_identity() owner to postgres;
revoke all on function public.klyx_seed_economic_identity()
  from public, anon, authenticated;
grant execute on function public.klyx_seed_economic_identity()
  to service_role;

drop trigger if exists klyx_accounts_seed_economic_identity
  on public.accounts;
create trigger klyx_accounts_seed_economic_identity
after insert on public.accounts
for each row
execute function public.klyx_seed_economic_identity();

-- ============================================================
-- 2. MINIMAL LEGAL ENTITY / PERSON REFERENCES
-- ============================================================

create table if not exists public.economic_legal_entities (
  id uuid primary key default gen_random_uuid(),
  economic_identity_id uuid not null
    references public.economic_identities(id)
    on delete cascade,
  entity_type text not null,
  is_primary boolean not null default false,
  legal_name text,
  country_code text,
  source text not null default 'account',
  external_provider text,
  external_reference text,
  verification_status text not null default 'declared',
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint economic_legal_entities_type_check
    check (entity_type in (
      'individual',
      'sole_proprietor',
      'company',
      'nonprofit',
      'government_entity',
      'other'
    )),
  constraint economic_legal_entities_country_code_check
    check (
      country_code is null
      or country_code ~ '^[A-Z]{2}$'
    ),
  constraint economic_legal_entities_source_check
    check (source in ('account', 'trusted_provider', 'human', 'migration')),
  constraint economic_legal_entities_status_check
    check (verification_status in (
      'declared',
      'required',
      'pending',
      'pending_external_review',
      'verified',
      'failed',
      'expired',
      'restricted',
      'human_review'
    )),
  constraint economic_legal_entities_external_reference_check
    check (
      (external_provider is null and external_reference is null)
      or
      (external_provider is not null and external_reference is not null)
    ),
  constraint economic_legal_entities_expiry_check
    check (
      expires_at is null
      or verified_at is null
      or expires_at > verified_at
    )
);

comment on table public.economic_legal_entities is
  'Minimal legal-entity facts for an economic identity. Prefer opaque external references over copying tax ids, raw KYC payloads, or identity documents into KLYX.';
comment on column public.economic_legal_entities.external_reference is
  'Opaque provider reference when an external verification provider remains responsible for the underlying sensitive data.';

create unique index if not exists economic_legal_entities_one_primary_idx
  on public.economic_legal_entities (economic_identity_id)
  where is_primary = true;

create unique index if not exists economic_legal_entities_external_ref_idx
  on public.economic_legal_entities (
    economic_identity_id,
    external_provider,
    external_reference
  )
  where external_provider is not null
    and external_reference is not null;

create table if not exists public.economic_persons (
  id uuid primary key default gen_random_uuid(),
  economic_identity_id uuid not null
    references public.economic_identities(id)
    on delete cascade,
  legal_entity_id uuid
    references public.economic_legal_entities(id)
    on delete cascade,
  relationship text not null,
  is_primary boolean not null default false,
  source text not null default 'account',
  external_provider text,
  external_reference text,
  verification_status text not null default 'declared',
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint economic_persons_relationship_check
    check (relationship in (
      'self',
      'representative',
      'director',
      'owner',
      'beneficial_owner',
      'other'
    )),
  constraint economic_persons_source_check
    check (source in ('account', 'trusted_provider', 'human', 'migration')),
  constraint economic_persons_status_check
    check (verification_status in (
      'declared',
      'required',
      'pending',
      'pending_external_review',
      'verified',
      'failed',
      'expired',
      'restricted',
      'human_review'
    )),
  constraint economic_persons_external_reference_check
    check (
      (external_provider is null and external_reference is null)
      or
      (external_provider is not null and external_reference is not null)
    ),
  constraint economic_persons_expiry_check
    check (
      expires_at is null
      or verified_at is null
      or expires_at > verified_at
    )
);

comment on table public.economic_persons is
  'Minimal related-person references for KYC/KYB composition. Raw identity documents and unnecessary personal data remain with the responsible verification provider whenever possible.';

create unique index if not exists economic_persons_external_ref_idx
  on public.economic_persons (
    economic_identity_id,
    external_provider,
    external_reference
  )
  where external_provider is not null
    and external_reference is not null;

-- ============================================================
-- 3. KYC / KYB / SANCTIONS / REGULATORY VERIFICATION CASES
-- ============================================================

create table if not exists public.economic_verification_cases (
  id uuid primary key default gen_random_uuid(),
  economic_identity_id uuid not null
    references public.economic_identities(id)
    on delete cascade,
  legal_entity_id uuid
    references public.economic_legal_entities(id)
    on delete set null,
  economic_person_id uuid
    references public.economic_persons(id)
    on delete set null,
  trust_verification_id uuid
    references public.trust_verifications(id)
    on delete set null,
  legacy_provider_verification_id uuid
    references public.provider_verifications(id)
    on delete set null,
  verification_type text not null,
  provider text not null,
  external_reference text,
  requirement_key text,
  status text not null default 'required',
  decision_source text not null,
  reason_code text,
  human_review_required boolean not null default false,
  reviewed_by_auth_user_id uuid
    references auth.users(id)
    on delete set null,
  verified_at timestamptz,
  expires_at timestamptz,
  provider_observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint economic_verification_cases_type_format_check
    check (
      char_length(verification_type) between 2 and 120
      and verification_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint economic_verification_cases_provider_format_check
    check (
      char_length(provider) between 2 and 80
      and provider ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint economic_verification_cases_status_check
    check (status in (
      'not_required',
      'required',
      'pending',
      'pending_external_review',
      'verified',
      'failed',
      'expired',
      'restricted',
      'human_review'
    )),
  constraint economic_verification_cases_decision_source_check
    check (decision_source in (
      'trusted_provider',
      'deterministic_rule',
      'human'
    )),
  constraint economic_verification_cases_human_review_check
    check (
      status <> 'human_review'
      or human_review_required = true
    ),
  constraint economic_verification_cases_human_actor_check
    check (
      decision_source <> 'human'
      or reviewed_by_auth_user_id is not null
    ),
  constraint economic_verification_cases_expiry_check
    check (
      expires_at is null
      or verified_at is null
      or expires_at > verified_at
    )
);

comment on table public.economic_verification_cases is
  'Multi-state economic verification cases for KYC, KYB, sanctions and regulated-activity compliance. No LLM is an allowed final decision source.';
comment on column public.economic_verification_cases.external_reference is
  'Opaque external-provider reference. Prefer this over storing raw provider KYC payloads or document contents.';

create index if not exists economic_verification_cases_identity_status_idx
  on public.economic_verification_cases (
    economic_identity_id,
    verification_type,
    status,
    updated_at desc
  );

create unique index if not exists economic_verification_cases_external_requirement_idx
  on public.economic_verification_cases (
    economic_identity_id,
    provider,
    external_reference,
    coalesce(requirement_key, '')
  )
  where external_reference is not null;

-- ============================================================
-- 4. STRIPE IS A PROVIDER PROJECTION, NEVER KLYX AUTHORITY
-- ============================================================

create table if not exists public.economic_stripe_account_projections (
  economic_identity_id uuid primary key
    references public.economic_identities(id)
    on delete cascade,
  stripe_account_id text not null,
  country_code text,
  business_type text,
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  currently_due jsonb not null default '[]'::jsonb,
  eventually_due jsonb not null default '[]'::jsonb,
  past_due jsonb not null default '[]'::jsonb,
  pending_verification jsonb not null default '[]'::jsonb,
  requirement_errors jsonb not null default '[]'::jsonb,
  disabled_reason text,
  capabilities jsonb not null default '{}'::jsonb,
  provider_observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint economic_stripe_projection_country_code_check
    check (
      country_code is null
      or country_code ~ '^[A-Z]{2}$'
    ),
  constraint economic_stripe_projection_currently_due_array_check
    check (jsonb_typeof(currently_due) = 'array'),
  constraint economic_stripe_projection_eventually_due_array_check
    check (jsonb_typeof(eventually_due) = 'array'),
  constraint economic_stripe_projection_past_due_array_check
    check (jsonb_typeof(past_due) = 'array'),
  constraint economic_stripe_projection_pending_verification_array_check
    check (jsonb_typeof(pending_verification) = 'array'),
  constraint economic_stripe_projection_errors_array_check
    check (jsonb_typeof(requirement_errors) = 'array'),
  constraint economic_stripe_projection_capabilities_object_check
    check (jsonb_typeof(capabilities) = 'object')
);

comment on table public.economic_stripe_account_projections is
  'Observed Stripe Connect status/requirements/capabilities for the canonical account Stripe identity. This table is a provider projection only.';
comment on column public.economic_stripe_account_projections.payouts_enabled is
  'Stripe provider fact only. payouts_enabled=true must never, by itself, authorize a KLYX economic or financial action.';

create unique index if not exists economic_stripe_projection_account_unique
  on public.economic_stripe_account_projections (stripe_account_id);

-- ============================================================
-- 5. ECONOMIC/COMPLIANCE RESTRICTIONS
--    Distinct from Trust & Safety restrictions; Mission 11 composes both.
-- ============================================================

create table if not exists public.economic_restrictions (
  id uuid primary key default gen_random_uuid(),
  economic_identity_id uuid not null
    references public.economic_identities(id)
    on delete cascade,
  verification_case_id uuid
    references public.economic_verification_cases(id)
    on delete set null,
  trust_case_id uuid
    references public.trust_cases(id)
    on delete set null,
  restricted_action text not null,
  scope_type text not null default 'global',
  activity_key text,
  jurisdiction_code text,
  status text not null default 'active',
  source text not null,
  reason_code text not null,
  human_review_required boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  reviewed_by_auth_user_id uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),

  constraint economic_restrictions_action_format_check
    check (
      char_length(restricted_action) between 2 and 120
      and restricted_action ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint economic_restrictions_scope_type_check
    check (scope_type in (
      'global',
      'activity',
      'jurisdiction',
      'activity_jurisdiction'
    )),
  constraint economic_restrictions_scope_shape_check
    check (
      (scope_type = 'global'
        and activity_key is null
        and jurisdiction_code is null)
      or
      (scope_type = 'activity'
        and activity_key is not null
        and jurisdiction_code is null)
      or
      (scope_type = 'jurisdiction'
        and activity_key is null
        and jurisdiction_code is not null)
      or
      (scope_type = 'activity_jurisdiction'
        and activity_key is not null
        and jurisdiction_code is not null)
    ),
  constraint economic_restrictions_jurisdiction_format_check
    check (
      jurisdiction_code is null
      or char_length(trim(jurisdiction_code)) between 2 and 32
    ),
  constraint economic_restrictions_status_check
    check (status in ('active', 'revoked', 'expired')),
  constraint economic_restrictions_source_check
    check (source in (
      'trusted_provider',
      'deterministic_rule',
      'human'
    )),
  constraint economic_restrictions_human_actor_check
    check (
      source <> 'human'
      or reviewed_by_auth_user_id is not null
    ),
  constraint economic_restrictions_window_check
    check (ends_at is null or ends_at > starts_at)
);

comment on table public.economic_restrictions is
  'Scoped economic/compliance restrictions. They do not replace public.trust_restrictions; future enforcement composes both authorities.';
comment on column public.economic_restrictions.activity_key is
  'Activity dimension only when the restriction is activity-scoped. No fixed activity catalogue is encoded in schema.';
comment on column public.economic_restrictions.jurisdiction_code is
  'Jurisdiction dimension only when scoped. No country-specific product limit is encoded in schema.';

create unique index if not exists economic_restrictions_one_active_scope_idx
  on public.economic_restrictions (
    economic_identity_id,
    restricted_action,
    scope_type,
    coalesce(activity_key, ''),
    coalesce(jurisdiction_code, '')
  )
  where status = 'active';

create index if not exists economic_restrictions_review_idx
  on public.economic_restrictions (
    human_review_required,
    starts_at asc
  )
  where status = 'active';

-- ============================================================
-- 6. EXTEND THE EXISTING QUALIFICATION AUTHORITY
--    Do not create economic_capabilities/activity_qualifications.
-- ============================================================

alter table public.account_capability_qualifications
  add column if not exists activity_key text;

alter table public.account_capability_qualifications
  add column if not exists jurisdiction_code text;

comment on column public.account_capability_qualifications.activity_key is
  'Optional explicit activity dimension for the existing canonical qualification authority.';
comment on column public.account_capability_qualifications.jurisdiction_code is
  'Optional explicit jurisdiction dimension for the existing canonical qualification authority.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'account_capability_qualifications_activity_key_format_check'
      and conrelid = 'public.account_capability_qualifications'::regclass
  ) then
    alter table public.account_capability_qualifications
      add constraint account_capability_qualifications_activity_key_format_check
      check (
        activity_key is null
        or (
          char_length(activity_key) between 1 and 160
          and activity_key ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'account_capability_qualifications_jurisdiction_format_check'
      and conrelid = 'public.account_capability_qualifications'::regclass
  ) then
    alter table public.account_capability_qualifications
      add constraint account_capability_qualifications_jurisdiction_format_check
      check (
        jurisdiction_code is null
        or char_length(trim(jurisdiction_code)) between 2 and 32
      );
  end if;
end
$$;

create unique index if not exists account_capability_qualifications_activity_jurisdiction_unique
  on public.account_capability_qualifications (
    account_id,
    capability,
    qualification_key,
    coalesce(activity_key, ''),
    coalesce(jurisdiction_code, '')
  )
  where activity_key is not null
     or jurisdiction_code is not null;

-- ============================================================
-- 7. APPEND-ONLY ECONOMIC IDENTITY AUDIT
-- ============================================================

create table if not exists public.economic_identity_events (
  id uuid primary key default gen_random_uuid(),
  economic_identity_id uuid not null
    references public.economic_identities(id)
    on delete restrict,
  actor_type text not null,
  actor_account_id uuid
    references public.accounts(id)
    on delete set null,
  actor_auth_user_id uuid
    references auth.users(id)
    on delete set null,
  source text not null,
  event_type text not null,
  reason_code text,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  correlation_id text,
  deduplication_key text,
  created_at timestamptz not null default now(),

  constraint economic_identity_events_actor_type_check
    check (actor_type in (
      'system',
      'account',
      'trusted_provider',
      'human',
      'migration'
    )),
  constraint economic_identity_events_source_check
    check (source in (
      'deterministic_rule',
      'trusted_provider',
      'human',
      'migration',
      'stripe',
      'provider_verification',
      'trust_safety'
    )),
  constraint economic_identity_events_type_format_check
    check (
      char_length(event_type) between 2 and 160
      and event_type ~ '^[a-z][a-z0-9_.:-]*$'
    ),
  constraint economic_identity_events_before_object_check
    check (jsonb_typeof(before_state) = 'object'),
  constraint economic_identity_events_after_object_check
    check (jsonb_typeof(after_state) = 'object')
);

comment on table public.economic_identity_events is
  'Append-only economic identity audit. Store normalized facts/references only; never copy raw identity documents or unnecessary sensitive provider payloads here.';

create index if not exists economic_identity_events_identity_idx
  on public.economic_identity_events (
    economic_identity_id,
    created_at desc
  );

create unique index if not exists economic_identity_events_dedup_idx
  on public.economic_identity_events (
    economic_identity_id,
    deduplication_key
  )
  where deduplication_key is not null;

create or replace function public.klyx_reject_economic_identity_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'KLYX_ECONOMIC_IDENTITY_EVENTS_APPEND_ONLY';
end;
$$;

alter function public.klyx_reject_economic_identity_event_mutation()
  owner to postgres;
revoke all on function public.klyx_reject_economic_identity_event_mutation()
  from public, anon, authenticated;
grant execute on function public.klyx_reject_economic_identity_event_mutation()
  to service_role;

drop trigger if exists klyx_economic_identity_events_append_only
  on public.economic_identity_events;
create trigger klyx_economic_identity_events_append_only
before update or delete on public.economic_identity_events
for each row
execute function public.klyx_reject_economic_identity_event_mutation();

-- ============================================================
-- 8. HUMAN-REVIEW TRANSITION
-- ============================================================

create or replace function public.klyx_mark_economic_identity_human_review(
  p_account_id uuid,
  p_reason_code text,
  p_source text,
  p_correlation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.economic_identities%rowtype;
  v_before jsonb;
begin
  if p_source not in ('deterministic_rule', 'trusted_provider', 'human') then
    raise exception 'KLYX_ECONOMIC_REVIEW_SOURCE_INVALID';
  end if;

  if p_reason_code is null
     or char_length(trim(p_reason_code)) < 2
     or char_length(trim(p_reason_code)) > 160 then
    raise exception 'KLYX_ECONOMIC_REVIEW_REASON_INVALID';
  end if;

  insert into public.economic_identities (account_id)
  values (p_account_id)
  on conflict (account_id) do nothing;

  select *
    into v_identity
    from public.economic_identities
   where account_id = p_account_id
   for update;

  v_before := jsonb_build_object(
    'status', v_identity.status,
    'human_review_required', v_identity.human_review_required,
    'review_reason_code', v_identity.review_reason_code
  );

  update public.economic_identities
     set status = 'human_review',
         human_review_required = true,
         review_reason_code = trim(p_reason_code),
         updated_at = now()
   where id = v_identity.id;

  insert into public.economic_identity_events (
    economic_identity_id,
    actor_type,
    source,
    event_type,
    reason_code,
    before_state,
    after_state,
    correlation_id,
    deduplication_key
  )
  values (
    v_identity.id,
    case when p_source = 'human' then 'human' else 'system' end,
    p_source,
    'human_review_required',
    trim(p_reason_code),
    v_before,
    jsonb_build_object(
      'status', 'human_review',
      'human_review_required', true,
      'review_reason_code', trim(p_reason_code)
    ),
    p_correlation_id,
    case
      when p_correlation_id is null then null
      else 'human_review:' || p_correlation_id
    end
  )
  on conflict do nothing;

  return v_identity.id;
end;
$$;

alter function public.klyx_mark_economic_identity_human_review(
  uuid, text, text, text
) owner to postgres;
revoke all on function public.klyx_mark_economic_identity_human_review(
  uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.klyx_mark_economic_identity_human_review(
  uuid, text, text, text
) to service_role;

-- ============================================================
-- 9. CANONICAL STRIPE PROJECTION UPSERT
--    Defensively re-checks #799 authority before accepting provider facts.
-- ============================================================

create or replace function public.klyx_upsert_economic_stripe_projection(
  p_account_id uuid,
  p_stripe_account_id text,
  p_country_code text,
  p_business_type text,
  p_details_submitted boolean,
  p_charges_enabled boolean,
  p_payouts_enabled boolean,
  p_currently_due jsonb,
  p_eventually_due jsonb,
  p_past_due jsonb,
  p_pending_verification jsonb,
  p_requirement_errors jsonb,
  p_disabled_reason text,
  p_capabilities jsonb,
  p_provider_observed_at timestamptz,
  p_correlation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_economic_identity_id uuid;
  v_stripe_identity_state text;
  v_canonical_stripe_account_id text;
  v_before jsonb;
begin
  if jsonb_typeof(p_currently_due) <> 'array'
     or jsonb_typeof(p_eventually_due) <> 'array'
     or jsonb_typeof(p_past_due) <> 'array'
     or jsonb_typeof(p_pending_verification) <> 'array'
     or jsonb_typeof(p_requirement_errors) <> 'array'
     or jsonb_typeof(p_capabilities) <> 'object' then
    raise exception 'KLYX_ECONOMIC_STRIPE_PROJECTION_SHAPE_INVALID';
  end if;

  select identity.id
    into v_economic_identity_id
    from public.economic_identities as identity
   where identity.account_id = p_account_id;

  if not found then
    insert into public.economic_identities (account_id)
    values (p_account_id)
    returning id into v_economic_identity_id;
  end if;

  select
    stripe_identity.identity_state,
    stripe_identity.stripe_account_id
    into
      v_stripe_identity_state,
      v_canonical_stripe_account_id
    from public.account_stripe_connect_identities as stripe_identity
   where stripe_identity.account_id = p_account_id;

  if not found
     or v_stripe_identity_state <> 'linked'
     or v_canonical_stripe_account_id is distinct from p_stripe_account_id then
    raise exception 'KLYX_ECONOMIC_STRIPE_IDENTITY_REVIEW_REQUIRED';
  end if;

  select to_jsonb(projection)
    into v_before
    from public.economic_stripe_account_projections as projection
   where projection.economic_identity_id = v_economic_identity_id;

  insert into public.economic_stripe_account_projections (
    economic_identity_id,
    stripe_account_id,
    country_code,
    business_type,
    details_submitted,
    charges_enabled,
    payouts_enabled,
    currently_due,
    eventually_due,
    past_due,
    pending_verification,
    requirement_errors,
    disabled_reason,
    capabilities,
    provider_observed_at,
    updated_at
  )
  values (
    v_economic_identity_id,
    trim(p_stripe_account_id),
    nullif(upper(trim(coalesce(p_country_code, ''))), ''),
    nullif(trim(coalesce(p_business_type, '')), ''),
    coalesce(p_details_submitted, false),
    coalesce(p_charges_enabled, false),
    coalesce(p_payouts_enabled, false),
    p_currently_due,
    p_eventually_due,
    p_past_due,
    p_pending_verification,
    p_requirement_errors,
    nullif(trim(coalesce(p_disabled_reason, '')), ''),
    p_capabilities,
    coalesce(p_provider_observed_at, now()),
    now()
  )
  on conflict (economic_identity_id) do update
  set
    stripe_account_id = excluded.stripe_account_id,
    country_code = excluded.country_code,
    business_type = excluded.business_type,
    details_submitted = excluded.details_submitted,
    charges_enabled = excluded.charges_enabled,
    payouts_enabled = excluded.payouts_enabled,
    currently_due = excluded.currently_due,
    eventually_due = excluded.eventually_due,
    past_due = excluded.past_due,
    pending_verification = excluded.pending_verification,
    requirement_errors = excluded.requirement_errors,
    disabled_reason = excluded.disabled_reason,
    capabilities = excluded.capabilities,
    provider_observed_at = excluded.provider_observed_at,
    updated_at = now();

  insert into public.economic_identity_events (
    economic_identity_id,
    actor_type,
    source,
    event_type,
    reason_code,
    before_state,
    after_state,
    correlation_id,
    deduplication_key
  )
  values (
    v_economic_identity_id,
    'trusted_provider',
    'stripe',
    'stripe_projection_observed',
    null,
    coalesce(v_before, '{}'::jsonb),
    jsonb_build_object(
      'stripe_account_id', trim(p_stripe_account_id),
      'country_code', nullif(upper(trim(coalesce(p_country_code, ''))), ''),
      'business_type', nullif(trim(coalesce(p_business_type, '')), ''),
      'details_submitted', coalesce(p_details_submitted, false),
      'charges_enabled', coalesce(p_charges_enabled, false),
      'payouts_enabled', coalesce(p_payouts_enabled, false),
      'currently_due', p_currently_due,
      'eventually_due', p_eventually_due,
      'past_due', p_past_due,
      'pending_verification', p_pending_verification,
      'disabled_reason', nullif(trim(coalesce(p_disabled_reason, '')), ''),
      'capabilities', p_capabilities,
      'provider_observed_at', coalesce(p_provider_observed_at, now())
    ),
    p_correlation_id,
    case
      when p_correlation_id is null then null
      else 'stripe_projection:' || p_correlation_id
    end
  )
  on conflict do nothing;

  return v_economic_identity_id;
end;
$$;

alter function public.klyx_upsert_economic_stripe_projection(
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text,
  jsonb,
  timestamptz,
  text
) owner to postgres;

revoke all on function public.klyx_upsert_economic_stripe_projection(
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text,
  jsonb,
  timestamptz,
  text
) from public, anon, authenticated;

grant execute on function public.klyx_upsert_economic_stripe_projection(
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text,
  jsonb,
  timestamptz,
  text
) to service_role;

-- ============================================================
-- 10. COMPATIBILITY PROJECTIONS — NO SECOND AUTHORITY
-- ============================================================

create or replace view public.economic_provider_verification_projection as
select
  economic_identity.id as economic_identity_id,
  economic_identity.account_id,
  profile.id as legacy_profile_id,
  verification.id as legacy_provider_verification_id,
  verification.status,
  verification.identity_status,
  verification.address_status,
  verification.business_status,
  verification.insurance_status,
  verification.professional_status,
  verification.trust_level,
  verification.submitted_at,
  verification.reviewed_at,
  verification.updated_at
from public.economic_identities as economic_identity
join public.profiles as profile
  on profile.account_id = economic_identity.account_id
join public.provider_verifications as verification
  on verification.profile_id = profile.id;

comment on view public.economic_provider_verification_projection is
  'Read-only compatibility projection over existing provider_verifications. The legacy table remains the source of those historical facts during migration.';

create or replace view public.economic_provider_verification_document_projection as
select
  economic_identity.id as economic_identity_id,
  economic_identity.account_id,
  profile.id as legacy_profile_id,
  document.id as legacy_document_id,
  document.document_type,
  document.status,
  document.uploaded_at,
  document.reviewed_at
from public.economic_identities as economic_identity
join public.profiles as profile
  on profile.account_id = economic_identity.account_id
join public.provider_verification_documents as document
  on document.profile_id = profile.id;

comment on view public.economic_provider_verification_document_projection is
  'Metadata-only compatibility projection. It intentionally omits storage_path, original_name and raw document content.';

create or replace view public.economic_activity_qualification_projection as
select
  economic_identity.id as economic_identity_id,
  qualification.id as qualification_id,
  qualification.account_id,
  qualification.capability,
  qualification.qualification_key,
  qualification.scope_type,
  qualification.scope_key,
  qualification.activity_key,
  qualification.jurisdiction_code,
  qualification.status,
  qualification.source,
  qualification.valid_from,
  qualification.valid_until,
  qualification.updated_at
from public.account_capability_qualifications as qualification
join public.economic_identities as economic_identity
  on economic_identity.account_id = qualification.account_id;

comment on view public.economic_activity_qualification_projection is
  'Read-only projection over account_capability_qualifications. No second qualification authority is created.';

create or replace view public.economic_activity_eligibility_projection as
select distinct on (
  decision.account_id,
  decision.category_key,
  decision.jurisdiction_code,
  decision.target_type,
  coalesce(decision.target_ref, '')
)
  economic_identity.id as economic_identity_id,
  decision.account_id,
  decision.id as source_decision_id,
  decision.policy_id,
  decision.target_type,
  decision.target_ref,
  decision.category_key as activity_key,
  decision.jurisdiction_code,
  decision.decision,
  decision.decision_source,
  decision.human_review_required,
  decision.review_status,
  decision.reason_codes,
  decision.required_actions,
  decision.created_at as evaluated_at,
  decision.expires_at
from public.trust_eligibility_decisions as decision
join public.economic_identities as economic_identity
  on economic_identity.account_id = decision.account_id
order by
  decision.account_id,
  decision.category_key,
  decision.jurisdiction_code,
  decision.target_type,
  coalesce(decision.target_ref, ''),
  decision.created_at desc,
  decision.id desc;

comment on view public.economic_activity_eligibility_projection is
  'Latest read-only Trust & Safety eligibility projection. It never becomes an independent activity-eligibility engine or authority.';

revoke all privileges on table public.economic_provider_verification_projection
  from public, anon, authenticated;
revoke all privileges on table public.economic_provider_verification_document_projection
  from public, anon, authenticated;
revoke all privileges on table public.economic_activity_qualification_projection
  from public, anon, authenticated;
revoke all privileges on table public.economic_activity_eligibility_projection
  from public, anon, authenticated;

grant select on table public.economic_provider_verification_projection
  to service_role;
grant select on table public.economic_provider_verification_document_projection
  to service_role;
grant select on table public.economic_activity_qualification_projection
  to service_role;
grant select on table public.economic_activity_eligibility_projection
  to service_role;

-- ============================================================
-- 11. SERVER-ONLY SECURITY BOUNDARY
-- ============================================================

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'economic_identities',
    'economic_legal_entities',
    'economic_persons',
    'economic_verification_cases',
    'economic_stripe_account_projections',
    'economic_restrictions',
    'economic_identity_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      table_name
    );

    if table_name = 'economic_identity_events' then
      execute format(
        'grant select, insert on table public.%I to service_role',
        table_name
      );
    else
      execute format(
        'grant all privileges on table public.%I to service_role',
        table_name
      );
    end if;

    execute format(
      'drop policy if exists klyx_server_only_deny_all on public.%I',
      table_name
    );
    execute format(
      'create policy klyx_server_only_deny_all on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name
    );
  end loop;
end
$$;

-- ============================================================
-- 12. KEEP FOUNDER SECURITY AUDIT AUTHORITATIVE
-- ============================================================

create or replace function public.klyx_security_audit()
returns table(
  table_name text,
  rls_enabled boolean,
  policy_count bigint
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    c.relname::text as table_name,
    c.relrowsecurity as rls_enabled,
    count(p.policyname)::bigint as policy_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n
    on n.oid = c.relnamespace
  left join pg_catalog.pg_policies p
    on p.schemaname = n.nspname
   and p.tablename = c.relname
  where
    n.nspname = 'public'
    and c.relkind = 'r'
    and (
      c.relname in (
        'profiles',
        'accounts',
        'account_actor_capabilities',
        'account_capability_qualifications',
        'user_services',
        'service_profiles',
        'provider_profiles',
        'provider_legal_profiles',
        'provider_service_zones',
        'availability_slots',
        'favorites',
        'bookings',
        'service_quotes',
        'messages',
        'reviews',
        'disputes',
        'notifications',
        'user_notifications'
      )
      or c.relname like 'trust\_%' escape '\'
      or c.relname like 'economic\_%' escape '\'
    )
  group by
    c.relname,
    c.relrowsecurity
  order by c.relname;
$$;

alter function public.klyx_security_audit() owner to postgres;
revoke all on function public.klyx_security_audit()
  from public, anon, authenticated;
grant execute on function public.klyx_security_audit()
  to service_role;

commit;

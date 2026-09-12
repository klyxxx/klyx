-- ============================================================
-- KLYX TRUST & SAFETY + LEGAL DELIVERY FOUNDATION
--
-- Cross-cutting, account-level foundation. It is intentionally independent
-- from the historical client/provider role model.
--
-- Core rule:
--   KLYX decides whether an account may perform a concrete mission under a
--   versioned policy. It does not automatically assign a person's legal
--   employment/self-employment status.
--
-- Sensitive evidence remains server-only. Browser clients receive only
-- purpose-limited, redacted explanations through future application APIs.
-- ============================================================

begin;

-- ============================================================
-- 1. DECLARED WORK CONTEXT — FACTS, NEVER AN IRREVERSIBLE STATUS
-- ============================================================

create table if not exists public.trust_work_contexts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  jurisdiction_code text not null default 'BE',
  declared_pathway_intent text not null default 'unknown',
  declared_activity_frequency text not null default 'unknown',
  declared_enterprise_number text,
  declared_social_insurance_affiliation text not null default 'unknown',
  declared_employment_structure_ref text,
  declared_facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trust_work_contexts_account_jurisdiction_key
    unique (account_id, jurisdiction_code),
  constraint trust_work_contexts_jurisdiction_length_check
    check (char_length(trim(jurisdiction_code)) between 2 and 32),
  constraint trust_work_contexts_pathway_intent_check
    check (declared_pathway_intent in (
      'unknown',
      'occasional',
      'employment_structure',
      'independent'
    )),
  constraint trust_work_contexts_activity_frequency_check
    check (declared_activity_frequency in (
      'unknown',
      'one_off',
      'intermittent',
      'recurring'
    )),
  constraint trust_work_contexts_social_affiliation_check
    check (declared_social_insurance_affiliation in ('unknown', 'no', 'yes')),
  constraint trust_work_contexts_enterprise_number_check
    check (
      declared_enterprise_number is null
      or char_length(trim(declared_enterprise_number)) between 1 and 64
    ),
  constraint trust_work_contexts_declared_facts_object_check
    check (jsonb_typeof(declared_facts) = 'object')
);

comment on table public.trust_work_contexts is
  'Account-level declarations used as evidence for mission eligibility. Declarations are facts/intents, not a legal classification.';
comment on column public.trust_work_contexts.declared_pathway_intent is
  'Self-declared intent only. KLYX must not treat this field as proof that a legal status applies.';

-- ============================================================
-- 2. VERIFICATIONS AND QUALIFICATIONS
-- ============================================================

create table if not exists public.trust_verifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  verification_kind text not null,
  scope_key text,
  status text not null default 'pending',
  verifier text,
  evidence_ref text,
  verified_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trust_verifications_kind_length_check
    check (char_length(trim(verification_kind)) between 2 and 80),
  constraint trust_verifications_status_check
    check (status in (
      'pending',
      'verified',
      'rejected',
      'expired',
      'revoked'
    )),
  constraint trust_verifications_facts_object_check
    check (jsonb_typeof(facts) = 'object'),
  constraint trust_verifications_expiry_check
    check (expires_at is null or expires_at > created_at)
);

comment on table public.trust_verifications is
  'Reusable account-level verification ledger: identity, age, enterprise registration, insurance, right-to-work evidence, social-insurance evidence and future verification kinds.';
comment on column public.trust_verifications.evidence_ref is
  'Opaque reference to evidence stored in an approved secure evidence system. Do not store raw identity documents in this table.';

create index if not exists trust_verifications_account_kind_idx
  on public.trust_verifications (account_id, verification_kind, status, created_at desc);
create index if not exists trust_verifications_expiry_idx
  on public.trust_verifications (expires_at)
  where status = 'verified' and expires_at is not null;

create table if not exists public.trust_credentials (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  credential_kind text not null,
  category_key text,
  jurisdiction_code text not null default 'BE',
  status text not null default 'pending',
  issuer text,
  credential_ref text,
  verification_id uuid references public.trust_verifications(id) on delete set null,
  issued_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trust_credentials_kind_length_check
    check (char_length(trim(credential_kind)) between 2 and 120),
  constraint trust_credentials_status_check
    check (status in ('pending', 'verified', 'rejected', 'expired', 'revoked')),
  constraint trust_credentials_jurisdiction_length_check
    check (char_length(trim(jurisdiction_code)) between 2 and 32),
  constraint trust_credentials_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint trust_credentials_expiry_check
    check (expires_at is null or issued_at is null or expires_at > issued_at)
);

comment on table public.trust_credentials is
  'Category/jurisdiction-scoped qualifications, licences, attestations and competency evidence. Requirements are policy-driven and must not be inferred from the historical provider role.';

create index if not exists trust_credentials_account_category_idx
  on public.trust_credentials (account_id, category_key, status, created_at desc);

-- ============================================================
-- 3. EXPLAINABLE TRUST LEVEL — NO OPAQUE PERMANENT SCORE
-- ============================================================

create table if not exists public.trust_level_assessments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  trust_level text not null default 'unassessed',
  basis_version text not null,
  source text not null default 'policy_engine',
  reason_codes jsonb not null default '[]'::jsonb,
  explanation text not null,
  assessed_at timestamptz not null default now(),
  expires_at timestamptz,
  supersedes_id uuid references public.trust_level_assessments(id) on delete set null,

  constraint trust_level_assessments_level_check
    check (trust_level in ('unassessed', 'basic', 'verified', 'enhanced')),
  constraint trust_level_assessments_source_check
    check (source in ('policy_engine', 'human', 'hybrid')),
  constraint trust_level_assessments_reason_codes_array_check
    check (jsonb_typeof(reason_codes) = 'array'),
  constraint trust_level_assessments_explanation_length_check
    check (char_length(trim(explanation)) between 1 and 4000),
  constraint trust_level_assessments_expiry_check
    check (expires_at is null or expires_at > assessed_at)
);

comment on table public.trust_level_assessments is
  'Versioned explainable trust-level history. Restrictions and suspensions live separately and must not be hidden inside a numeric trust score.';

create index if not exists trust_level_assessments_account_idx
  on public.trust_level_assessments (account_id, assessed_at desc);

-- ============================================================
-- 4. VERSIONED CATEGORY / JURISDICTION POLICY
-- ============================================================

create table if not exists public.trust_category_policies (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null,
  category_key text not null,
  version integer not null,
  status text not null default 'draft',
  requirements jsonb not null default '{}'::jsonb,
  requires_human_review boolean not null default false,
  effective_from timestamptz,
  effective_until timestamptz,
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint trust_category_policies_scope_version_key
    unique (jurisdiction_code, category_key, version),
  constraint trust_category_policies_jurisdiction_length_check
    check (char_length(trim(jurisdiction_code)) between 2 and 32),
  constraint trust_category_policies_category_length_check
    check (char_length(trim(category_key)) between 1 and 120),
  constraint trust_category_policies_version_check
    check (version > 0),
  constraint trust_category_policies_status_check
    check (status in ('draft', 'active', 'retired')),
  constraint trust_category_policies_requirements_object_check
    check (jsonb_typeof(requirements) = 'object'),
  constraint trust_category_policies_effective_window_check
    check (
      effective_until is null
      or effective_from is null
      or effective_until > effective_from
    )
);

comment on table public.trust_category_policies is
  'Versioned mission eligibility policy by category and jurisdiction. It can require identity, verification kinds, credentials, trust level, legal-pathway compatibility, category restrictions and/or human review.';

create unique index if not exists trust_category_policies_one_active_idx
  on public.trust_category_policies (jurisdiction_code, category_key)
  where status = 'active';

-- ============================================================
-- 5. CASE MANAGEMENT: REPORTS, FRAUD, NO-SHOW, SAFETY, DISPUTES
-- ============================================================

create table if not exists public.trust_cases (
  id uuid primary key default gen_random_uuid(),
  case_type text not null,
  subject_account_id uuid references public.accounts(id) on delete set null,
  reporter_account_id uuid references public.accounts(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  legacy_dispute_id uuid references public.disputes(id) on delete set null,
  source text not null default 'user',
  severity text not null default 'medium',
  status text not null default 'open',
  reason_code text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  assigned_to_auth_user_id uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint trust_cases_type_check
    check (case_type in (
      'report',
      'fraud',
      'no_show',
      'dispute',
      'safety',
      'identity',
      'legal_compliance',
      'qualification',
      'other'
    )),
  constraint trust_cases_source_check
    check (source in ('user', 'system', 'reviewer', 'payment', 'support')),
  constraint trust_cases_severity_check
    check (severity in ('low', 'medium', 'high', 'critical')),
  constraint trust_cases_status_check
    check (status in (
      'open',
      'triage',
      'in_review',
      'waiting_party',
      'resolved',
      'closed'
    )),
  constraint trust_cases_reason_code_length_check
    check (char_length(trim(reason_code)) between 2 and 120),
  constraint trust_cases_summary_length_check
    check (char_length(trim(summary)) between 1 and 1000),
  constraint trust_cases_details_object_check
    check (jsonb_typeof(details) = 'object')
);

comment on table public.trust_cases is
  'Unified Trust & Safety case ledger. A report is evidence to investigate, not proof of wrongdoing. Existing disputes can be linked without rewriting their historical lifecycle.';

create index if not exists trust_cases_subject_status_idx
  on public.trust_cases (subject_account_id, status, opened_at desc);
create index if not exists trust_cases_booking_idx
  on public.trust_cases (booking_id, opened_at desc)
  where booking_id is not null;
create index if not exists trust_cases_queue_idx
  on public.trust_cases (status, severity, opened_at asc)
  where status in ('open', 'triage', 'in_review', 'waiting_party');

create table if not exists public.trust_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.trust_cases(id) on delete cascade,
  actor_type text not null,
  actor_account_id uuid references public.accounts(id) on delete set null,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  reason_code text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint trust_case_events_actor_type_check
    check (actor_type in ('system', 'account', 'reviewer')),
  constraint trust_case_events_type_check
    check (event_type in (
      'opened',
      'evidence_added',
      'status_changed',
      'restriction_applied',
      'restriction_revoked',
      'review_requested',
      'review_completed',
      'linked_dispute',
      'note'
    )),
  constraint trust_case_events_payload_object_check
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists trust_case_events_case_idx
  on public.trust_case_events (case_id, created_at asc);

-- ============================================================
-- 6. JUSTIFIED, SCOPED, REVERSIBLE RESTRICTIONS / SUSPENSIONS
-- ============================================================

create table if not exists public.trust_restrictions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  case_id uuid not null references public.trust_cases(id) on delete restrict,
  scope_type text not null default 'platform',
  scope_key text,
  restricted_action text not null,
  status text not null default 'active',
  reason_code text not null,
  rationale text not null,
  imposed_by text not null,
  imposed_by_auth_user_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  human_review_required boolean not null default true,
  review_due_at timestamptz,
  revoked_at timestamptz,
  revoked_by_auth_user_id uuid references auth.users(id) on delete set null,
  revocation_reason text,
  created_at timestamptz not null default now(),

  constraint trust_restrictions_scope_type_check
    check (scope_type in ('platform', 'category', 'service', 'booking')),
  constraint trust_restrictions_scope_key_check
    check (
      (scope_type = 'platform' and scope_key is null)
      or (scope_type <> 'platform' and scope_key is not null)
    ),
  constraint trust_restrictions_action_check
    check (restricted_action in (
      'perform_missions',
      'accept_bookings',
      'receive_payouts',
      'contact_users',
      'use_platform'
    )),
  constraint trust_restrictions_status_check
    check (status in ('active', 'revoked', 'expired')),
  constraint trust_restrictions_imposed_by_check
    check (imposed_by in ('system', 'human')),
  constraint trust_restrictions_reason_code_length_check
    check (char_length(trim(reason_code)) between 2 and 120),
  constraint trust_restrictions_rationale_length_check
    check (char_length(trim(rationale)) between 1 and 4000),
  constraint trust_restrictions_window_check
    check (ends_at is null or ends_at > starts_at),
  constraint trust_restrictions_system_safeguard_check
    check (
      imposed_by <> 'system'
      or (
        human_review_required = true
        and ends_at is not null
        and review_due_at is not null
      )
    )
);

comment on table public.trust_restrictions is
  'Scoped restriction/suspension ledger. Every restriction must point to a Trust & Safety case and carry a reason. System-imposed restrictions must be temporary and queued for human review.';

create unique index if not exists trust_restrictions_one_active_scope_idx
  on public.trust_restrictions (
    account_id,
    restricted_action,
    scope_type,
    coalesce(scope_key, '')
  )
  where status = 'active';
create index if not exists trust_restrictions_review_queue_idx
  on public.trust_restrictions (review_due_at asc)
  where status = 'active' and human_review_required = true;

-- ============================================================
-- 7. EXPLAINABLE MISSION ELIGIBILITY DECISIONS
-- ============================================================

create table if not exists public.trust_eligibility_decisions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  policy_id uuid references public.trust_category_policies(id) on delete restrict,
  target_type text not null,
  target_ref text,
  category_key text not null,
  jurisdiction_code text not null,
  decision text not null,
  legal_pathway text not null default 'undetermined',
  decision_source text not null default 'policy_engine',
  human_review_required boolean not null default false,
  review_status text not null default 'not_required',
  reason_codes jsonb not null default '[]'::jsonb,
  required_actions jsonb not null default '[]'::jsonb,
  explanation text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  supersedes_id uuid references public.trust_eligibility_decisions(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,

  constraint trust_eligibility_decisions_target_type_check
    check (target_type in ('category', 'service', 'request', 'booking', 'mission')),
  constraint trust_eligibility_decisions_category_length_check
    check (char_length(trim(category_key)) between 1 and 120),
  constraint trust_eligibility_decisions_jurisdiction_length_check
    check (char_length(trim(jurisdiction_code)) between 2 and 32),
  constraint trust_eligibility_decisions_decision_check
    check (decision in (
      'eligible',
      'eligible_with_conditions',
      'requirements_missing',
      'human_review_required',
      'ineligible'
    )),
  constraint trust_eligibility_decisions_legal_pathway_check
    check (legal_pathway in (
      'undetermined',
      'occasional_compatible',
      'employment_structure_required',
      'independent_compatible',
      'multiple_possible'
    )),
  constraint trust_eligibility_decisions_source_check
    check (decision_source in ('policy_engine', 'human', 'hybrid')),
  constraint trust_eligibility_decisions_review_status_check
    check (review_status in ('not_required', 'pending', 'approved', 'rejected')),
  constraint trust_eligibility_decisions_reason_codes_array_check
    check (jsonb_typeof(reason_codes) = 'array'),
  constraint trust_eligibility_decisions_required_actions_array_check
    check (jsonb_typeof(required_actions) = 'array'),
  constraint trust_eligibility_decisions_input_snapshot_object_check
    check (jsonb_typeof(input_snapshot) = 'object'),
  constraint trust_eligibility_decisions_explanation_length_check
    check (char_length(trim(explanation)) between 1 and 4000),
  constraint trust_eligibility_decisions_review_gate_check
    check (
      (decision <> 'human_review_required' or human_review_required = true)
      and (
        decision_source <> 'policy_engine'
        or decision <> 'ineligible'
        or human_review_required = true
      )
    ),
  constraint trust_eligibility_decisions_expiry_check
    check (expires_at is null or expires_at > created_at)
);

comment on table public.trust_eligibility_decisions is
  'Immutable-style, explainable snapshots of whether an account may perform a mission. legal_pathway is an operational compatibility assessment, never an irreversible legal-status declaration.';
comment on column public.trust_eligibility_decisions.input_snapshot is
  'Store normalized decision inputs/statuses only. Do not copy raw identity documents, full private messages or unnecessary sensitive evidence into the decision snapshot.';

create index if not exists trust_eligibility_decisions_account_idx
  on public.trust_eligibility_decisions (account_id, created_at desc);
create index if not exists trust_eligibility_decisions_target_idx
  on public.trust_eligibility_decisions (target_type, target_ref, created_at desc);

create table if not exists public.trust_decision_reviews (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.trust_eligibility_decisions(id) on delete cascade,
  review_kind text not null,
  requested_by_account_id uuid references public.accounts(id) on delete set null,
  status text not null default 'requested',
  reviewer_auth_user_id uuid references auth.users(id) on delete set null,
  rationale text,
  outcome_decision_id uuid references public.trust_eligibility_decisions(id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  constraint trust_decision_reviews_kind_check
    check (review_kind in ('human_review', 'appeal', 'quality_check')),
  constraint trust_decision_reviews_status_check
    check (status in (
      'requested',
      'in_progress',
      'upheld',
      'overturned',
      'modified',
      'closed'
    )),
  constraint trust_decision_reviews_completed_check
    check (
      completed_at is null
      or status in ('upheld', 'overturned', 'modified', 'closed')
    )
);

comment on table public.trust_decision_reviews is
  'Human-review and appeal ledger. A changed outcome should create a new eligibility decision linked through outcome_decision_id/supersedes_id rather than mutating history.';

create unique index if not exists trust_decision_reviews_one_open_idx
  on public.trust_decision_reviews (decision_id, review_kind)
  where status in ('requested', 'in_progress');
create index if not exists trust_decision_reviews_queue_idx
  on public.trust_decision_reviews (status, requested_at asc)
  where status in ('requested', 'in_progress');

-- ============================================================
-- 8. SERVER-ONLY SECURITY BOUNDARY
-- ============================================================

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'trust_work_contexts',
    'trust_verifications',
    'trust_credentials',
    'trust_level_assessments',
    'trust_category_policies',
    'trust_cases',
    'trust_case_events',
    'trust_restrictions',
    'trust_eligibility_decisions',
    'trust_decision_reviews'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      table_name
    );
    execute format(
      'grant all privileges on table public.%I to service_role',
      table_name
    );
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
-- 9. KEEP FOUNDER SECURITY AUDIT AUTHORITATIVE
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
    and c.relname in (
      'profiles',
      'accounts',
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
      'user_notifications',
      'trust_work_contexts',
      'trust_verifications',
      'trust_credentials',
      'trust_level_assessments',
      'trust_category_policies',
      'trust_cases',
      'trust_case_events',
      'trust_restrictions',
      'trust_eligibility_decisions',
      'trust_decision_reviews'
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

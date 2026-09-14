-- ============================================================
-- KLYX TRUST & SAFETY AUTHORITY — ROLE-INDEPENDENT FOUNDATION
--
-- This migration deliberately separates:
--   1. participant declarations,
--   2. verified evidence,
--   3. reports / risk signals,
--   4. human restrictions and reviews.
--
-- A report never creates a suspension by itself. Legal-path data is an
-- operational KLYX pathway and must not be treated as an automatic legal
-- classification of employee / independent / occasional work status.
-- ============================================================

begin;

create table if not exists public.trust_safety_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  jurisdiction_country_code text,
  declared_legal_path text not null default 'unknown',
  declared_activity_frequency text not null default 'unknown',
  identity_level text not null default 'unknown',
  trust_level text not null default 'unknown',
  legal_path_review_status text not null default 'not_reviewed',
  legal_path_reviewed_path text,
  legal_path_reviewed_by uuid,
  legal_path_reviewed_at timestamptz,
  legal_path_review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trust_safety_profiles_legal_path_check
    check (declared_legal_path in (
      'unknown',
      'occasional_compatible',
      'employment_via_structure',
      'professional_independent'
    )),
  constraint trust_safety_profiles_activity_frequency_check
    check (declared_activity_frequency in (
      'unknown', 'one_off', 'intermittent', 'recurring'
    )),
  constraint trust_safety_profiles_identity_level_check
    check (identity_level in ('unknown', 'basic', 'verified')),
  constraint trust_safety_profiles_trust_level_check
    check (trust_level in (
      'unknown', 'limited', 'standard', 'strong', 'restricted'
    )),
  constraint trust_safety_profiles_legal_review_check
    check (legal_path_review_status in (
      'not_reviewed', 'pending', 'approved', 'rejected'
    )),
  constraint trust_safety_profiles_reviewed_path_check
    check (
      legal_path_reviewed_path is null
      or legal_path_reviewed_path in (
        'occasional_compatible',
        'employment_via_structure',
        'professional_independent'
      )
    ),
  constraint trust_safety_profiles_country_check
    check (
      jurisdiction_country_code is null
      or jurisdiction_country_code ~ '^[A-Z]{2}$'
    )
);

comment on table public.trust_safety_profiles is
  'Role-independent Trust & Safety state for any KLYX profile. Declarations do not establish legal employment status.';
comment on column public.trust_safety_profiles.legal_path_review_status is
  'Human-review state. A profile cannot approve its own legal pathway.';

create table if not exists public.trust_safety_category_policies (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_country_code text not null,
  category_key text not null,
  risk_tier text not null default 'standard',
  required_identity_level text not null default 'basic',
  minimum_trust_level text not null default 'limited',
  required_qualifications text[] not null default '{}',
  required_verifications text[] not null default '{}',
  allowed_legal_paths text[] not null default array[
    'occasional_compatible',
    'employment_via_structure',
    'professional_independent'
  ]::text[],
  human_review_mode text not null default 'never',
  policy_note text,
  is_active boolean not null default true,
  updated_by_admin_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trust_safety_category_policy_unique
    unique (jurisdiction_country_code, category_key),
  constraint trust_safety_category_policy_country_check
    check (jurisdiction_country_code ~ '^[A-Z]{2}$'),
  constraint trust_safety_category_policy_risk_tier_check
    check (risk_tier in ('standard', 'elevated', 'sensitive')),
  constraint trust_safety_category_policy_identity_check
    check (required_identity_level in ('unknown', 'basic', 'verified')),
  constraint trust_safety_category_policy_trust_check
    check (minimum_trust_level in ('unknown', 'limited', 'standard', 'strong')),
  constraint trust_safety_category_policy_review_mode_check
    check (human_review_mode in ('never', 'if_sensitive', 'always')),
  constraint trust_safety_category_policy_category_key_check
    check (category_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$' or category_key = '*'),
  constraint trust_safety_category_policy_paths_check
    check (
      allowed_legal_paths <@ array[
        'unknown',
        'occasional_compatible',
        'employment_via_structure',
        'professional_independent'
      ]::text[]
    )
);

comment on table public.trust_safety_category_policies is
  'Server-controlled category requirements. Policy rows express KLYX operational requirements, not a legal-status determination.';

create table if not exists public.trust_safety_qualifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category_key text not null default '*',
  qualification_key text not null,
  status text not null default 'unknown',
  evidence_reference text,
  reviewed_by_admin_user_id uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trust_safety_qualification_unique
    unique (profile_id, category_key, qualification_key),
  constraint trust_safety_qualification_status_check
    check (status in ('unknown', 'pending', 'verified', 'rejected')),
  constraint trust_safety_qualification_key_check
    check (char_length(trim(qualification_key)) between 1 and 100),
  constraint trust_safety_qualification_category_check
    check (category_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$' or category_key = '*')
);

create table if not exists public.trust_safety_verifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  verification_key text not null,
  status text not null default 'unknown',
  source text not null default 'klyx',
  evidence_reference text,
  reviewed_by_admin_user_id uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trust_safety_verification_unique
    unique (profile_id, verification_key),
  constraint trust_safety_verification_status_check
    check (status in ('unknown', 'pending', 'verified', 'rejected')),
  constraint trust_safety_verification_key_check
    check (char_length(trim(verification_key)) between 1 and 100)
);

create table if not exists public.trust_safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid references public.profiles(id) on delete set null,
  subject_profile_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  category_key text,
  report_type text not null,
  severity text not null default 'normal',
  description text not null,
  status text not null default 'open',
  requires_human_review boolean not null default true,
  assigned_admin_user_id uuid,
  resolution_code text,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trust_safety_report_type_check
    check (report_type in (
      'safety',
      'fraud',
      'no_show',
      'identity',
      'qualification',
      'harassment',
      'category_violation',
      'other'
    )),
  constraint trust_safety_report_severity_check
    check (severity in ('normal', 'high', 'urgent')),
  constraint trust_safety_report_status_check
    check (status in (
      'open', 'under_review', 'waiting_information', 'resolved', 'dismissed'
    )),
  constraint trust_safety_report_description_check
    check (char_length(trim(description)) between 20 and 4000),
  constraint trust_safety_report_subject_check
    check (reporter_profile_id is null or reporter_profile_id <> subject_profile_id),
  constraint trust_safety_report_category_check
    check (
      category_key is null
      or category_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'
    )
);

create index if not exists trust_safety_reports_subject_status_idx
  on public.trust_safety_reports(subject_profile_id, status, created_at desc);
create index if not exists trust_safety_reports_booking_idx
  on public.trust_safety_reports(booking_id)
  where booking_id is not null;

create table if not exists public.trust_safety_restrictions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null default 'global',
  category_key text,
  action text not null,
  status text not null default 'active',
  reason_code text not null,
  explanation text not null,
  source_report_id uuid references public.trust_safety_reports(id) on delete set null,
  imposed_by_admin_user_id uuid not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  review_status text not null default 'not_requested',
  review_requested_at timestamptz,
  review_request_note text,
  reviewed_by_admin_user_id uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trust_safety_restriction_scope_check
    check (scope in ('global', 'category')),
  constraint trust_safety_restriction_action_check
    check (action in ('manual_review_only', 'category_block', 'mission_block')),
  constraint trust_safety_restriction_status_check
    check (status in ('active', 'under_review', 'lifted', 'expired')),
  constraint trust_safety_restriction_review_status_check
    check (review_status in (
      'not_requested', 'pending', 'upheld', 'modified', 'lifted'
    )),
  constraint trust_safety_restriction_explanation_check
    check (char_length(trim(explanation)) between 20 and 4000),
  constraint trust_safety_restriction_reason_check
    check (char_length(trim(reason_code)) between 3 and 100),
  constraint trust_safety_restriction_category_scope_check
    check (
      (scope = 'global' and category_key is null)
      or
      (scope = 'category' and category_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
    ),
  constraint trust_safety_restriction_time_check
    check (ends_at is null or ends_at > starts_at)
);

create index if not exists trust_safety_restrictions_profile_status_idx
  on public.trust_safety_restrictions(profile_id, status, starts_at desc);

create table if not exists public.trust_safety_audit_events (
  id uuid primary key default gen_random_uuid(),
  subject_profile_id uuid references public.profiles(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_admin_user_id uuid,
  event_type text not null,
  object_type text not null,
  object_id uuid,
  reason_codes text[] not null default '{}',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint trust_safety_audit_event_type_check
    check (char_length(trim(event_type)) between 3 and 100),
  constraint trust_safety_audit_object_type_check
    check (char_length(trim(object_type)) between 3 and 100)
);

-- Baseline KLYX platform policy. Category-specific legal qualifications are not
-- guessed here; they must be explicitly configured from verified requirements.
insert into public.trust_safety_category_policies (
  jurisdiction_country_code,
  category_key,
  risk_tier,
  required_identity_level,
  minimum_trust_level,
  required_qualifications,
  required_verifications,
  allowed_legal_paths,
  human_review_mode,
  policy_note
)
values
  (
    'BE',
    '*',
    'standard',
    'basic',
    'limited',
    '{}',
    '{}',
    array[
      'occasional_compatible',
      'employment_via_structure',
      'professional_independent'
    ]::text[],
    'never',
    'KLYX baseline: identity and trust are platform safety requirements; legal path remains fact-sensitive.'
  ),
  (
    'BE',
    'babysitting',
    'sensitive',
    'verified',
    'standard',
    '{}',
    '{}',
    array[
      'occasional_compatible',
      'employment_via_structure',
      'professional_independent'
    ]::text[],
    'if_sensitive',
    'Sensitive-person service: enhanced KLYX identity and human review. No professional qualification is presumed by this seed.'
  )
on conflict (jurisdiction_country_code, category_key) do nothing;

-- All Trust & Safety authority tables are server-only. Users go through bounded
-- authenticated APIs so they cannot approve verifications, lower trust signals,
-- impose restrictions or rewrite audit history themselves.
alter table public.trust_safety_profiles enable row level security;
alter table public.trust_safety_category_policies enable row level security;
alter table public.trust_safety_qualifications enable row level security;
alter table public.trust_safety_verifications enable row level security;
alter table public.trust_safety_reports enable row level security;
alter table public.trust_safety_restrictions enable row level security;
alter table public.trust_safety_audit_events enable row level security;

revoke all privileges on table public.trust_safety_profiles from public, anon, authenticated;
revoke all privileges on table public.trust_safety_category_policies from public, anon, authenticated;
revoke all privileges on table public.trust_safety_qualifications from public, anon, authenticated;
revoke all privileges on table public.trust_safety_verifications from public, anon, authenticated;
revoke all privileges on table public.trust_safety_reports from public, anon, authenticated;
revoke all privileges on table public.trust_safety_restrictions from public, anon, authenticated;
revoke all privileges on table public.trust_safety_audit_events from public, anon, authenticated;

grant all privileges on table public.trust_safety_profiles to service_role;
grant all privileges on table public.trust_safety_category_policies to service_role;
grant all privileges on table public.trust_safety_qualifications to service_role;
grant all privileges on table public.trust_safety_verifications to service_role;
grant all privileges on table public.trust_safety_reports to service_role;
grant all privileges on table public.trust_safety_restrictions to service_role;
grant all privileges on table public.trust_safety_audit_events to service_role;

do $$
begin
  execute 'drop policy if exists "klyx_server_only_deny_all" on public.trust_safety_profiles';
  execute 'create policy "klyx_server_only_deny_all" on public.trust_safety_profiles for all to anon, authenticated using (false) with check (false)';
  execute 'drop policy if exists "klyx_server_only_deny_all" on public.trust_safety_category_policies';
  execute 'create policy "klyx_server_only_deny_all" on public.trust_safety_category_policies for all to anon, authenticated using (false) with check (false)';
  execute 'drop policy if exists "klyx_server_only_deny_all" on public.trust_safety_qualifications';
  execute 'create policy "klyx_server_only_deny_all" on public.trust_safety_qualifications for all to anon, authenticated using (false) with check (false)';
  execute 'drop policy if exists "klyx_server_only_deny_all" on public.trust_safety_verifications';
  execute 'create policy "klyx_server_only_deny_all" on public.trust_safety_verifications for all to anon, authenticated using (false) with check (false)';
  execute 'drop policy if exists "klyx_server_only_deny_all" on public.trust_safety_reports';
  execute 'create policy "klyx_server_only_deny_all" on public.trust_safety_reports for all to anon, authenticated using (false) with check (false)';
  execute 'drop policy if exists "klyx_server_only_deny_all" on public.trust_safety_restrictions';
  execute 'create policy "klyx_server_only_deny_all" on public.trust_safety_restrictions for all to anon, authenticated using (false) with check (false)';
  execute 'drop policy if exists "klyx_server_only_deny_all" on public.trust_safety_audit_events';
  execute 'create policy "klyx_server_only_deny_all" on public.trust_safety_audit_events for all to anon, authenticated using (false) with check (false)';
end;
$$;

-- Preserve the Founder security audit and add the new authority tables.
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
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  left join pg_catalog.pg_policies p
    on p.schemaname = n.nspname
   and p.tablename = c.relname
  where
    n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'profiles',
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
      'trust_safety_profiles',
      'trust_safety_category_policies',
      'trust_safety_qualifications',
      'trust_safety_verifications',
      'trust_safety_reports',
      'trust_safety_restrictions',
      'trust_safety_audit_events'
    )
  group by c.relname, c.relrowsecurity
  order by c.relname;
$$;

alter function public.klyx_security_audit() owner to postgres;
revoke all on function public.klyx_security_audit() from public, anon, authenticated;
grant execute on function public.klyx_security_audit() to service_role;

commit;

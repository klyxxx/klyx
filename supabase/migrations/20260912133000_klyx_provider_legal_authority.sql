-- ============================================================
-- KLYX PROVIDER LEGAL AUTHORITY — BELGIUM V1
--
-- This table stores provider declarations and server-controlled verification
-- evidence separately. It does NOT establish an irreversible legal status.
-- The application derives a versioned KLYX operational assessment from these
-- facts and requires human review where Belgian classification is uncertain.
-- ============================================================

begin;

create table if not exists public.provider_legal_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,

  declared_path text not null default 'unknown',
  declared_student_context text not null default 'unknown',
  declared_activity_frequency text not null default 'unknown',
  declared_self_employment_capacity text not null default 'unknown',
  declared_enterprise_number text,
  declared_social_insurance_fund_affiliation text not null default 'unknown',

  enterprise_registration_verification text not null default 'unknown',
  social_insurance_fund_verification text not null default 'unknown',
  employment_arrangement_verification text not null default 'unknown',

  human_review_status text not null default 'not_reviewed',
  human_reviewed_path text,
  human_reviewed_by uuid,
  human_reviewed_at timestamptz,
  human_review_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint provider_legal_profiles_path_check
    check (declared_path in (
      'unknown',
      'occasional',
      'employee_compatible',
      'professional_independent'
    )),
  constraint provider_legal_profiles_student_context_check
    check (declared_student_context in ('unknown', 'no', 'yes')),
  constraint provider_legal_profiles_activity_frequency_check
    check (declared_activity_frequency in (
      'unknown',
      'one_off',
      'intermittent',
      'recurring'
    )),
  constraint provider_legal_profiles_self_employment_capacity_check
    check (declared_self_employment_capacity in (
      'unknown',
      'main',
      'complementary',
      'student_independent',
      'other'
    )),
  constraint provider_legal_profiles_social_fund_declaration_check
    check (declared_social_insurance_fund_affiliation in ('unknown', 'no', 'yes')),
  constraint provider_legal_profiles_enterprise_verification_check
    check (enterprise_registration_verification in (
      'unknown',
      'pending',
      'verified',
      'rejected'
    )),
  constraint provider_legal_profiles_social_fund_verification_check
    check (social_insurance_fund_verification in (
      'unknown',
      'pending',
      'verified',
      'rejected'
    )),
  constraint provider_legal_profiles_employment_verification_check
    check (employment_arrangement_verification in (
      'unknown',
      'pending',
      'verified',
      'rejected'
    )),
  constraint provider_legal_profiles_human_review_status_check
    check (human_review_status in (
      'not_reviewed',
      'pending',
      'approved',
      'rejected'
    )),
  constraint provider_legal_profiles_human_reviewed_path_check
    check (
      human_reviewed_path is null
      or human_reviewed_path in (
        'occasional',
        'employee_compatible',
        'professional_independent'
      )
    ),
  constraint provider_legal_profiles_enterprise_number_check
    check (
      declared_enterprise_number is null
      or char_length(trim(declared_enterprise_number)) between 1 and 40
    )
);

comment on table public.provider_legal_profiles is
  'Server-only provider legal declarations and verification evidence. KLYX operational assessment is derived in application code; this table is not an irreversible legal-status classification.';
comment on column public.provider_legal_profiles.declared_student_context is
  'Context only. Student status must never be treated as a standalone legal work status.';
comment on column public.provider_legal_profiles.human_review_status is
  'Server-controlled reversible review state. Providers cannot write this column directly.';

alter table public.provider_legal_profiles enable row level security;
revoke all privileges on table public.provider_legal_profiles
  from public, anon, authenticated;
grant all privileges on table public.provider_legal_profiles
  to service_role;

drop policy if exists "klyx_server_only_deny_all"
  on public.provider_legal_profiles;
create policy "klyx_server_only_deny_all"
  on public.provider_legal_profiles
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Keep the Founder security audit authoritative for the new server-only table.
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

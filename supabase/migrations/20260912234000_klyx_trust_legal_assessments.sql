-- ============================================================
-- KLYX TRUST LEGAL PATHWAY ASSESSMENTS
--
-- Separates:
--   declarations/facts -> legal-pathway assessment -> mission eligibility.
--
-- A legal-pathway assessment is an operational compatibility assessment for a
-- concrete KLYX context. It is not an irreversible declaration that a person
-- is legally an employee, self-employed worker or any other legal category.
-- ============================================================

begin;

create table if not exists public.trust_legal_assessments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  jurisdiction_code text not null,
  category_key text not null,
  target_type text not null,
  target_ref text,
  pathway text not null default 'undetermined',
  confidence text not null default 'low',
  assessment_source text not null default 'policy_engine',
  human_review_required boolean not null default false,
  review_status text not null default 'not_required',
  reason_codes jsonb not null default '[]'::jsonb,
  explanation text not null,
  facts_snapshot jsonb not null default '{}'::jsonb,
  assessed_by_auth_user_id uuid references auth.users(id) on delete set null,
  supersedes_id uuid references public.trust_legal_assessments(id) on delete set null,
  assessed_at timestamptz not null default now(),
  expires_at timestamptz,

  constraint trust_legal_assessments_jurisdiction_length_check
    check (char_length(trim(jurisdiction_code)) between 2 and 32),
  constraint trust_legal_assessments_category_length_check
    check (char_length(trim(category_key)) between 1 and 120),
  constraint trust_legal_assessments_target_type_check
    check (target_type in ('category', 'service', 'request', 'booking', 'mission')),
  constraint trust_legal_assessments_pathway_check
    check (pathway in (
      'undetermined',
      'occasional_compatible',
      'employment_structure_required',
      'independent_compatible',
      'multiple_possible'
    )),
  constraint trust_legal_assessments_confidence_check
    check (confidence in ('low', 'medium', 'high')),
  constraint trust_legal_assessments_source_check
    check (assessment_source in ('policy_engine', 'human', 'hybrid')),
  constraint trust_legal_assessments_review_status_check
    check (review_status in ('not_required', 'pending', 'approved', 'rejected')),
  constraint trust_legal_assessments_reason_codes_array_check
    check (jsonb_typeof(reason_codes) = 'array'),
  constraint trust_legal_assessments_facts_snapshot_object_check
    check (jsonb_typeof(facts_snapshot) = 'object'),
  constraint trust_legal_assessments_explanation_length_check
    check (char_length(trim(explanation)) between 1 and 4000),
  constraint trust_legal_assessments_ambiguous_review_check
    check (
      pathway not in ('undetermined', 'multiple_possible')
      or human_review_required = true
    ),
  constraint trust_legal_assessments_review_consistency_check
    check (
      (human_review_required = true and review_status <> 'not_required')
      or (human_review_required = false and review_status = 'not_required')
    ),
  constraint trust_legal_assessments_human_actor_check
    check (
      assessment_source <> 'human'
      or assessed_by_auth_user_id is not null
    ),
  constraint trust_legal_assessments_expiry_check
    check (expires_at is null or expires_at > assessed_at)
);

comment on table public.trust_legal_assessments is
  'Auditable operational assessment of which delivery framework is compatible with a concrete KLYX context. It does not establish an irreversible legal employment/self-employment status.';
comment on column public.trust_legal_assessments.facts_snapshot is
  'Normalized facts used for the assessment. Do not copy raw identity documents, private-message bodies or unnecessary sensitive evidence.';

create index if not exists trust_legal_assessments_account_idx
  on public.trust_legal_assessments (account_id, assessed_at desc);
create index if not exists trust_legal_assessments_target_idx
  on public.trust_legal_assessments (target_type, target_ref, assessed_at desc);
create index if not exists trust_legal_assessments_review_queue_idx
  on public.trust_legal_assessments (review_status, assessed_at asc)
  where human_review_required = true and review_status in ('pending');

alter table public.trust_eligibility_decisions
  add column if not exists legal_assessment_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trust_eligibility_decisions_legal_assessment_fkey'
      and conrelid = 'public.trust_eligibility_decisions'::regclass
  ) then
    alter table public.trust_eligibility_decisions
      add constraint trust_eligibility_decisions_legal_assessment_fkey
      foreign key (legal_assessment_id)
      references public.trust_legal_assessments(id)
      on delete restrict;
  end if;
end
$$;

comment on column public.trust_eligibility_decisions.legal_assessment_id is
  'Optional link to the auditable legal-pathway assessment used by this decision. Historical decisions remain valid even before this link is populated.';

create index if not exists trust_eligibility_decisions_legal_assessment_idx
  on public.trust_eligibility_decisions (legal_assessment_id)
  where legal_assessment_id is not null;

alter table public.trust_legal_assessments enable row level security;
revoke all privileges on table public.trust_legal_assessments
  from public, anon, authenticated;
grant all privileges on table public.trust_legal_assessments
  to service_role;

drop policy if exists klyx_server_only_deny_all
  on public.trust_legal_assessments;
create policy klyx_server_only_deny_all
  on public.trust_legal_assessments
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Future Trust & Safety tables should automatically remain visible in the
-- founder audit without requiring another static allow-list edit.
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

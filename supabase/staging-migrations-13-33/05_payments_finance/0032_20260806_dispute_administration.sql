-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260806_dispute_administration.sql
-- SHA256: 46d69cbddf3ead12513644738d0fe87020a5f54d2a1b7394c59fac05c6b8def1
-- PHASE: 05_payments_finance
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

alter table public.disputes
  add column if not exists assigned_admin_user_id uuid null,
  add column if not exists decision_code text null,
  add column if not exists decision_note text null,
  add column if not exists last_reviewed_at timestamp with time zone null;

alter table public.disputes
  drop constraint if exists disputes_decision_code_check;

alter table public.disputes
  add constraint disputes_decision_code_check
  check (
    decision_code is null
    or decision_code = any (
      array[
        'no_action'::text,
        'warning_recorded'::text,
        'refund_review_required'::text,
        'provider_compensation_review'::text,
        'more_information_required'::text,
        'safety_escalation'::text
      ]
    )
  );

create index if not exists disputes_admin_status_idx
  on public.disputes(status, priority, created_at asc);

create index if not exists disputes_assigned_admin_idx
  on public.disputes(assigned_admin_user_id, status)
  where assigned_admin_user_id is not null;

commit;

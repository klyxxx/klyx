-- ============================================================
-- KLYX 12B.12H SERVER AUDIT TABLE PRIVILEGE HARDENING
--
-- The canonical baseline granted ALL to browser roles on several
-- operational/audit tables even though their data is produced by KLYX
-- server routes and protected with RLS. Remove that unnecessary surface.
--
-- KLYX_SERVER_AUDIT_TABLE_PRIVILEGES_12B_12H
-- ============================================================

begin;

-- ============================================================
-- 1. STRICT SERVER-ONLY JOURNALS
-- ============================================================
-- These tables have no browser-facing policy/use case. Stripe/Sumsub
-- webhook state, financial ledger entries and cancellation audit events
-- are written/read by trusted KLYX server flows using service_role.

revoke all privileges on table public.booking_financial_ledger
  from public, anon, authenticated;
revoke all privileges on table public.booking_group_cancellation_events
  from public, anon, authenticated;
revoke all privileges on table public.stripe_webhook_events
  from public, anon, authenticated;
revoke all privileges on table public.sumsub_webhook_events
  from public, anon, authenticated;

-- Keep the intended administrative access explicit and idempotent.
grant all privileges on table public.booking_financial_ledger to service_role;
grant all privileges on table public.booking_group_cancellation_events to service_role;
grant all privileges on table public.stripe_webhook_events to service_role;
grant all privileges on table public.sumsub_webhook_events to service_role;

-- ============================================================
-- 2. USER-VISIBLE SECURITY STATUS: READ-ONLY
-- ============================================================
-- Existing RLS policies allow an authenticated owner to read only their
-- own risk assessment / security alerts. Preserve that read capability,
-- while removing all anonymous access and every direct browser mutation.

revoke all privileges on table public.profile_risk_assessments
  from public, anon, authenticated;
revoke all privileges on table public.security_alerts
  from public, anon, authenticated;

grant select on table public.profile_risk_assessments to authenticated;
grant select on table public.security_alerts to authenticated;

grant all privileges on table public.profile_risk_assessments to service_role;
grant all privileges on table public.security_alerts to service_role;

commit;

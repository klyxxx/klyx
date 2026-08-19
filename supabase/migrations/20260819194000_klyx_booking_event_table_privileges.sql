-- ============================================================
-- KLYX 12B.12N BOOKING EVENT TABLE PRIVILEGE HARDENING
--
-- Booking status/tracking timelines are intentionally readable by an
-- authenticated booking participant, including tracking Realtime refreshes.
-- Mutations already pass through KLYX server APIs using service_role, so the
-- browser only needs SELECT and must not keep structural/write privileges.
--
-- KLYX_BOOKING_EVENT_TABLE_PRIVILEGES_12B_12N
-- ============================================================

begin;

revoke all privileges on table public.booking_status_events
  from public, anon, authenticated;
revoke all privileges on table public.booking_tracking_events
  from public, anon, authenticated;

grant select on table public.booking_status_events
  to authenticated;
grant select on table public.booking_tracking_events
  to authenticated;

grant all privileges on table public.booking_status_events
  to service_role;
grant all privileges on table public.booking_tracking_events
  to service_role;

-- Existing participant RLS remains authoritative for authenticated reads.
-- SELECT on booking_tracking_events is retained so Supabase Realtime can
-- continue delivering participant-visible tracking changes.

commit;

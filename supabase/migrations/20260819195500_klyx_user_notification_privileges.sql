-- ============================================================
-- KLYX 12B.12O USER NOTIFICATION PRIVILEGE HARDENING
--
-- The browser reads the active profile's notification feed directly, but
-- notification creation and read-state mutations already happen through
-- SECURITY DEFINER triggers or authenticated KLYX server APIs using
-- service_role. Keep only owner-scoped SELECT for authenticated sessions.
--
-- KLYX_USER_NOTIFICATION_PRIVILEGES_12B_12O
-- ============================================================

begin;

revoke all privileges on table public.user_notifications
  from public, anon, authenticated;

drop policy if exists "klyx_user_notifications_all"
  on public.user_notifications;

drop policy if exists "klyx_user_notifications_select"
  on public.user_notifications;

create policy "klyx_user_notifications_select"
  on public.user_notifications
  for select
  to authenticated
  using (public.klyx_owns_profile(user_id));

grant select on table public.user_notifications
  to authenticated;

grant all privileges on table public.user_notifications
  to service_role;

-- notify_new_booking/notify_booking_status/notify_new_message are existing
-- postgres-owned SECURITY DEFINER trigger functions, so server-generated
-- notifications do not depend on authenticated table INSERT privileges.
-- /api/notifications/read performs read-state updates through supabaseAdmin.

commit;

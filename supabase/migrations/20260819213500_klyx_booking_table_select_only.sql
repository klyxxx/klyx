-- KLYX_BOOKING_TABLE_SELECT_ONLY_12B_12V
-- Booking creation and every mutation are server-owned. Authenticated clients
-- retain participant reads through the existing klyx_bookings_select RLS policy.

revoke all privileges on table public.bookings
  from public, anon, authenticated;

grant select on table public.bookings
  to authenticated;

grant all privileges on table public.bookings
  to service_role;

-- Direct PostgREST booking creation is obsolete. Keeping this policy would make
-- a future accidental INSERT grant dangerous again, so fail closed at RLS too.
drop policy if exists "klyx_bookings_insert"
  on public.bookings;

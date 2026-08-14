-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260806_mission_confirmation.sql
-- SHA256: e300d5a470eb72740ed06dcf13e47cdc0642903d7218534359f1be89ac6e4afd
-- PHASE: 04_bookings
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

alter table public.bookings
  add column if not exists provider_finished_at timestamp with time zone null,
  add column if not exists provider_finish_note text null,
  add column if not exists client_confirmed_at timestamp with time zone null;

create index if not exists bookings_provider_finished_idx
  on public.bookings (provider_finished_at)
  where provider_finished_at is not null
    and client_confirmed_at is null;

commit;

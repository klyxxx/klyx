-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations\20260812205500_klyx_group_review_12_88.sql
-- SHA256: 1439a3bfa08b7bcdbf77d6a1c2f223c31205ef196165ceb733018539c185f8e6
-- PHASE: 04_bookings
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
-- KLYX_GROUP_REVIEW_12_88

alter table public.reviews
  add column if not exists booking_group_id uuid
    references public.booking_groups(id)
    on delete cascade;

create index if not exists
  reviews_booking_group_idx
on public.reviews (
  booking_group_id
);

create unique index if not exists
  reviews_booking_group_author_uidx
on public.reviews (
  booking_group_id,
  author_id
)
where booking_group_id is not null;
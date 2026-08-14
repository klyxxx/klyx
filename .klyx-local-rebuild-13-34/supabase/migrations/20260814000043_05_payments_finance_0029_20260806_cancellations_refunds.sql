-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: C:\Users\fenjo\Documents\klyx\supabase\migrations_legacy_20260812-161308\20260806_cancellations_refunds.sql
-- SHA256: 4e4ca9bfafca6acb1bbcac0e3d59103abf2a685509db0f01d8f09355479767f2
-- PHASE: 05_payments_finance
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================
begin;

alter table public.bookings
  add column if not exists refund_status text null,
  add column if not exists stripe_refund_id text null,
  add column if not exists refunded_amount_cents integer null,
  add column if not exists refunded_at timestamp with time zone null,
  add column if not exists refund_reason text null,
  add column if not exists refund_requested_by uuid null references public.profiles(id) on delete set null;

alter table public.bookings
  drop constraint if exists bookings_refund_status_check;

alter table public.bookings
  add constraint bookings_refund_status_check
  check (
    refund_status is null
    or refund_status = any (
      array[
        'processing'::text,
        'succeeded'::text,
        'failed'::text
      ]
    )
  );

create unique index if not exists bookings_stripe_refund_id_unique
  on public.bookings (stripe_refund_id)
  where stripe_refund_id is not null;

create index if not exists bookings_refund_status_idx
  on public.bookings (refund_status, refunded_at desc);

commit;

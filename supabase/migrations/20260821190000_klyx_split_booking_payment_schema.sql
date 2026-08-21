-- KLYX_SPLIT_BOOKING_PAYMENT_SCHEMA_2026
--
-- One Stripe Checkout Session / Refund belongs to a split payment unit and may
-- therefore cover several child bookings. Preserve uniqueness for ordinary
-- single-booking payments while explicitly allowing the shared identifiers on
-- rows marked as connect_destination_split.

begin;

alter table public.bookings
  drop constraint if exists bookings_payment_mode_check;

alter table public.bookings
  add constraint bookings_payment_mode_check
  check (
    payment_mode is null
    or payment_mode in (
      'connect_destination',
      'connect_destination_split',
      'platform_test_only'
    )
  );

comment on column public.bookings.payment_mode is
  'Payment topology snapshot. connect_destination_split means one Stripe payment unit may cover several child bookings.';

-- A normal booking still owns its Checkout Session exclusively. Split children
-- intentionally share the unit-level session, so exclude only that explicit
-- payment mode from the uniqueness predicate.
drop index if exists public.bookings_stripe_checkout_session_unique;

create unique index bookings_stripe_checkout_session_unique
  on public.bookings (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null
    and coalesce(payment_mode, '') <> 'connect_destination_split';

-- The same rule applies to the latest Stripe refund snapshot: one split refund
-- event is unit-level and is propagated to every child booking in that unit.
drop index if exists public.bookings_stripe_refund_id_unique;

create unique index bookings_stripe_refund_id_unique
  on public.bookings (stripe_refund_id)
  where stripe_refund_id is not null
    and coalesce(payment_mode, '') <> 'connect_destination_split';

commit;

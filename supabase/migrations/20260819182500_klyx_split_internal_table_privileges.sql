-- ============================================================
-- KLYX 12B.12I SPLIT INTERNAL TABLE PRIVILEGE HARDENING
--
-- Split booking/payment state is created and mutated by KLYX server APIs,
-- SECURITY DEFINER RPCs and integrity triggers. Browser roles do not need
-- direct table privileges on these proof/payment orchestration records.
--
-- KLYX_SPLIT_INTERNAL_TABLE_PRIVILEGES_12B_12I
-- ============================================================

begin;

-- Explicit multi-provider plan proof.
revoke all privileges on table public.market_split_plan_confirmations
  from public, anon, authenticated;
grant all privileges on table public.market_split_plan_confirmations
  to service_role;

-- Atomic split booking creation state.
revoke all privileges on table public.split_booking_batch_items
  from public, anon, authenticated;
revoke all privileges on table public.split_booking_batches
  from public, anon, authenticated;
grant all privileges on table public.split_booking_batch_items
  to service_role;
grant all privileges on table public.split_booking_batches
  to service_role;

-- Immutable price/payment confirmations and checkout execution state.
revoke all privileges on table public.split_booking_price_confirmations
  from public, anon, authenticated;
revoke all privileges on table public.split_booking_payment_confirmations
  from public, anon, authenticated;
revoke all privileges on table public.split_booking_payment_runs
  from public, anon, authenticated;
revoke all privileges on table public.split_booking_payment_units
  from public, anon, authenticated;
revoke all privileges on table public.split_booking_payment_refunds
  from public, anon, authenticated;

grant all privileges on table public.split_booking_price_confirmations
  to service_role;
grant all privileges on table public.split_booking_payment_confirmations
  to service_role;
grant all privileges on table public.split_booking_payment_runs
  to service_role;
grant all privileges on table public.split_booking_payment_units
  to service_role;
grant all privileges on table public.split_booking_payment_refunds
  to service_role;

-- One-time consumption proof tying a confirmation to its created batch.
revoke all privileges on table public.split_booking_proof_consumptions
  from public, anon, authenticated;
grant all privileges on table public.split_booking_proof_consumptions
  to service_role;

commit;

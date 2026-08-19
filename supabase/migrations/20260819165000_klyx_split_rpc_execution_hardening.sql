-- ============================================================
-- KLYX 12B.12D SPLIT RPC EXECUTION HARDENING
--
-- Server-side split booking/payment mutations are invoked through
-- Supabase service_role in KLYX API routes. They must never be callable
-- directly with the public/anonymous database role.
--
-- KLYX_SPLIT_RPC_EXECUTION_HARDENING_12B_12D
-- ============================================================

begin;

-- Future postgres-owned functions are fail-closed by default.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- 1. Attach Stripe checkout metadata to a payment unit.
revoke all on function public.klyx_attach_split_checkout_13_27(
  uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.klyx_attach_split_checkout_13_27(
  uuid, text, text, text
) to service_role;

-- 2. Claim a split payment unit / checkout attempt.
revoke all on function public.klyx_claim_split_payment_unit_13_27(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.klyx_claim_split_payment_unit_13_27(
  uuid, uuid, text
) to service_role;

-- 3. Confirm the immutable booking-price snapshot.
revoke all on function public.klyx_confirm_split_booking_prices_13_23(
  uuid, uuid, text, jsonb, integer, bigint, text
) from public, anon, authenticated;
grant execute on function public.klyx_confirm_split_booking_prices_13_23(
  uuid, uuid, text, jsonb, integer, bigint, text
) to service_role;

-- 4. Confirm the immutable payment-plan snapshot.
revoke all on function public.klyx_confirm_split_payment_plan_13_26(
  uuid, uuid, uuid, text, jsonb, integer, integer, bigint, text
) from public, anon, authenticated;
grant execute on function public.klyx_confirm_split_payment_plan_13_26(
  uuid, uuid, uuid, text, jsonb, integer, integer, bigint, text
) to service_role;

-- 5. Confirm the multi-provider allocation plan.
revoke all on function public.klyx_confirm_split_plan_13_18(
  uuid, uuid, text, jsonb, integer, integer
) from public, anon, authenticated;
grant execute on function public.klyx_confirm_split_plan_13_18(
  uuid, uuid, text, jsonb, integer, integer
) to service_role;

-- 6. Finalize a split-payment run.
revoke all on function public.klyx_finalize_split_payment_run_13_27(
  uuid, uuid
) from public, anon, authenticated;
grant execute on function public.klyx_finalize_split_payment_run_13_27(
  uuid, uuid
) to service_role;

-- 7. Recompute a split-refund run. This RPC only takes a run id, so
-- direct anonymous execution would be especially inappropriate.
revoke all on function public.klyx_recompute_split_refund_run_13_28(
  uuid
) from public, anon, authenticated;
grant execute on function public.klyx_recompute_split_refund_run_13_28(
  uuid
) to service_role;

-- 8. Release an expired/failed split checkout lock.
revoke all on function public.klyx_release_split_checkout_13_27(
  uuid, text
) from public, anon, authenticated;
grant execute on function public.klyx_release_split_checkout_13_27(
  uuid, text
) to service_role;

commit;

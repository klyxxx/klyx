-- KLYX provider certification hardening.
-- Trigger functions are invoked by PostgreSQL triggers and must not be exposed
-- as PostgREST RPC entry points to anon/authenticated users.

alter function public.klyx_reject_workflow_event_mutation()
  set search_path = public, pg_temp;

revoke execute on function public.klyx_classify_market_request_price_band()
  from public, anon, authenticated;
revoke execute on function public.klyx_financial_live_authority_events_immutable()
  from public, anon, authenticated;
revoke execute on function public.klyx_financial_live_authority_guard()
  from public, anon, authenticated;
revoke execute on function public.klyx_guard_platform_held_booking_economics()
  from public, anon, authenticated;
revoke execute on function public.klyx_guard_platform_held_ledger_economics()
  from public, anon, authenticated;
revoke execute on function public.klyx_liquidity_booking_trigger()
  from public, anon, authenticated;
revoke execute on function public.klyx_liquidity_candidate_trigger()
  from public, anon, authenticated;
revoke execute on function public.klyx_liquidity_group_booking_trigger()
  from public, anon, authenticated;
revoke execute on function public.klyx_liquidity_incident_event_trigger()
  from public, anon, authenticated;
revoke execute on function public.klyx_liquidity_offer_trigger()
  from public, anon, authenticated;
revoke execute on function public.klyx_liquidity_request_trigger()
  from public, anon, authenticated;
revoke execute on function public.klyx_mark_platform_held_booking_paid()
  from public, anon, authenticated;
revoke execute on function public.klyx_mark_platform_held_refunded()
  from public, anon, authenticated;
revoke execute on function public.klyx_market_control_events_append_only_guard()
  from public, anon, authenticated;
revoke execute on function public.klyx_mirror_booking_financial_ledger_to_central()
  from public, anon, authenticated;
revoke execute on function public.klyx_mirror_booking_settlement_to_central()
  from public, anon, authenticated;
revoke execute on function public.klyx_reject_financial_audit_mutation()
  from public, anon, authenticated;
revoke execute on function public.klyx_reject_workflow_event_mutation()
  from public, anon, authenticated;

-- Preserve server-side administrative access. Trigger invocation itself does not
-- depend on direct EXECUTE grants to the application roles.
grant execute on function public.klyx_classify_market_request_price_band()
  to service_role;
grant execute on function public.klyx_financial_live_authority_events_immutable()
  to service_role;
grant execute on function public.klyx_financial_live_authority_guard()
  to service_role;
grant execute on function public.klyx_guard_platform_held_booking_economics()
  to service_role;
grant execute on function public.klyx_guard_platform_held_ledger_economics()
  to service_role;
grant execute on function public.klyx_liquidity_booking_trigger()
  to service_role;
grant execute on function public.klyx_liquidity_candidate_trigger()
  to service_role;
grant execute on function public.klyx_liquidity_group_booking_trigger()
  to service_role;
grant execute on function public.klyx_liquidity_incident_event_trigger()
  to service_role;
grant execute on function public.klyx_liquidity_offer_trigger()
  to service_role;
grant execute on function public.klyx_liquidity_request_trigger()
  to service_role;
grant execute on function public.klyx_mark_platform_held_booking_paid()
  to service_role;
grant execute on function public.klyx_mark_platform_held_refunded()
  to service_role;
grant execute on function public.klyx_market_control_events_append_only_guard()
  to service_role;
grant execute on function public.klyx_mirror_booking_financial_ledger_to_central()
  to service_role;
grant execute on function public.klyx_mirror_booking_settlement_to_central()
  to service_role;
grant execute on function public.klyx_reject_financial_audit_mutation()
  to service_role;
grant execute on function public.klyx_reject_workflow_event_mutation()
  to service_role;

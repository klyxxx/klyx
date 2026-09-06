# KLYX RLS server-only boundary

## Purpose

This document records the KLY-18 audit boundary for `public` tables that intentionally have Row Level Security enabled with no policies.

A table in this registry is **server-only**. Browser/client code must not access it directly. Access is expected to go through authenticated KLYX server routes or trusted backend jobs that use the service-role boundary.

## Live audit — 2026-09-06

The live Supabase audit verified all tables below with the same invariant:

- RLS is enabled;
- no RLS policy exists;
- `anon` has no SELECT/INSERT/UPDATE/DELETE privilege;
- `authenticated` has no SELECT/INSERT/UPDATE/DELETE privilege;
- `service_role` retains the required DML privilege.

No user-facing access defect was found, so KLY-18 intentionally adds no production migration and does not widen any database permission.

## Certified server-only tables

- `api_rate_limits`
- `booking_financial_ledger`
- `booking_group_cancellation_events`
- `booking_groups`
- `client_agent_plan_events`
- `market_request_provider_candidates`
- `market_service_offers`
- `market_service_request_slots`
- `market_service_requests`
- `market_split_plan_confirmations`
- `phone_contact_access_logs`
- `phone_verification_limits`
- `photo_service_requests`
- `product_analytics_daily`
- `project_services`
- `projects`
- `provider_skill_documents`
- `provider_skill_verifications`
- `service_proposals`
- `service_requests`
- `skill_qualification_rules`
- `split_booking_batch_items`
- `split_booking_batches`
- `split_booking_payment_confirmations`
- `split_booking_payment_refunds`
- `split_booking_payment_runs`
- `split_booking_payment_units`
- `split_booking_price_confirmations`
- `split_booking_proof_consumptions`
- `stores`
- `stripe_webhook_events`
- `sumsub_webhook_events`
- `transactional_email_deliveries`
- `user_preferences`

## Fail-closed rules

1. Do not add an `anon` or `authenticated` table grant to a certified server-only table without a dedicated security review and corresponding RLS policies.
2. Do not query a certified server-only table directly from a module carrying the `use client` directive.
3. User-facing features that need data from these tables must use a server-owned boundary that authenticates and authorizes the caller before returning a minimal response.
4. A future decision to make one of these tables client-readable must remove it from this registry in the same reviewed change that introduces the new RLS policy/grants.

The unit contract `tests/unit/rls-server-only-boundary.test.ts` keeps this registry unique/sorted and rejects direct Supabase `.from(...)` access to these tables from client modules.
# KLYX Vercel Deployment Protection automation bypass

## Why this exists

KLYX keeps Vercel Deployment Protection enabled. Supabase `pg_cron` must still be able to invoke the internal financial runtime endpoint:

`POST /api/ops/financial-runtime-tick`

A protected production deployment otherwise returns Vercel `401 Protected deployment` before the KLYX route can evaluate its own bearer token.

The solution is **not** to make production public and is **not** to remove KLYX endpoint authentication.

## Two independent authentication boundaries

Every scheduled request uses:

1. `x-vercel-protection-bypass`
   - authority: Vercel Deployment Protection only;
   - purpose: allow the automation request to reach the KLYX deployment;
   - source: Supabase Vault secret `klyx_vercel_automation_bypass_secret`.

2. `Authorization: Bearer <KLYX scheduler token>`
   - authority: KLYX `/api/ops/financial-runtime-tick` authorization;
   - purpose: authenticate the scheduler to KLYX;
   - source: Supabase Vault secret `klyx_financial_scheduler_token`;
   - KLYX stores only its SHA-256 hash in `public.ops_financial_runtime_scheduler`.

Possession of the Vercel bypass secret alone does not authorize the KLYX worker endpoint.

## Activation sequence

Keep `public.ops_financial_runtime_scheduler.enabled=false` until all configuration is ready.

1. Generate a Vercel **Protection Bypass for Automation** secret in the project Deployment Protection settings.
2. Store that raw value only in Supabase Vault with name:

   `klyx_vercel_automation_bypass_secret`

3. Keep the independent KLYX scheduler token in Vault as:

   `klyx_financial_scheduler_token`

4. Confirm `target_origin` is the canonical production origin.
5. Confirm the deployed Vercel SHA equals current `main`.
6. Enable the scheduler.
7. Trigger one controlled tick.
8. Require HTTP 200 from the protected origin.
9. Require fresh `financial_durable_worker` and `critical_alert_delivery` heartbeats from the deployed SHA.
10. Require the critical alert sentinel to be `sent`.
11. Require finance/Stripe DLQ empty, no critical monitoring signal, and no open financial reconciliation/human_review.
12. Only then may controlled LIVE financial certification be considered.

## Failure behavior

If the bypass secret is absent or invalid while Deployment Protection is active, Vercel returns 401 before KLYX is reached. The scheduler must be disabled until corrected.

Do not disable Deployment Protection to obtain a green heartbeat.

Do not store either raw token in GitHub, application tables, logs, profiles, or client-side environment variables.

## Financial authority

This bypass changes no financial authority. The scheduler/worker does not create Checkout Sessions, Transfers, Transfer Reversals, Refunds, or Payouts.

Stripe LIVE remains governed independently by the exact-SHA financial runtime gates and Mission 1 production financial certification.

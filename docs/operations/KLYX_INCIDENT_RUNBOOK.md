# KLYX Production Incident Runbook

This runbook covers production incidents. It is intentionally separate from `docs/KLYX_RECOVERY_GUIDE.md`, which primarily covers local/project recovery.

## Safety rules

1. Preserve evidence before changing anything.
2. Freeze unrelated merges while a production incident is unresolved.
3. Never paste production secrets, database dumps, full `.env` files, Stripe secrets or user data into issues, logs or chat.
4. Do not use destructive Supabase commands as an incident shortcut.
5. Do not rewrite payment, booking or ledger rows manually to make dashboards look healthy.
6. Prefer a code fix or a reviewed forward migration over ad-hoc production SQL.
7. Payment, booking, cancellation and publication boundaries remain explicit; an incident does not authorize silent transactional actions.

## Severity

### SEV-1 — critical

Use when one of these is true:
- KLYX is broadly unavailable;
- authentication or authorization is materially broken;
- bookings/payments can be duplicated, lost or attributed to the wrong account;
- sensitive data may be exposed;
- financial ledger integrity is uncertain.

Action: stop unrelated deployment activity and investigate immediately.

### SEV-2 — major

Use for major degradation without evidence of data/financial corruption, for example:
- search or booking is failing for a significant subset of users;
- provider onboarding is unavailable;
- Stripe webhook processing is delayed while persisted state remains internally consistent;
- production latency/error rate is clearly abnormal.

### SEV-3 — limited

Use for isolated defects with a safe workaround and no material security/financial risk.

## Detection sources

Treat these as independent signals, not interchangeable proof:
- `KLYX Operational Sentinel`: public `/api/health` plus homepage GET-only smoke;
- protected `Playwright browser verification`: build/browser regression proof;
- `KLYX Golden Path`: deterministic transaction lifecycle against ephemeral Supabase;
- `KLYX Performance Certification`: isolated k6 + ApacheBench thresholds;
- Vercel deployment/runtime logs;
- Supabase project/database/Auth/Storage dashboards;
- Stripe TEST/production dashboards and webhook delivery evidence as appropriate.

`/api/health` is a liveness endpoint only. A 200 response does **not** prove Supabase, Stripe, Auth, Storage, webhooks or a complete booking lifecycle are healthy.

## First response checklist

Record before changing code or infrastructure:
- UTC start time and first observed symptom;
- affected user surface(s);
- current `main` commit SHA;
- last known green E2E/Golden/Performance run numbers;
- current Vercel deployment state;
- whether the issue is read-only, transactional, financial, authentication or data-integrity related.

Then:
1. reproduce with the smallest safe read-only check possible;
2. inspect structured `KLYX_SERVER_LOG_V1` records without copying secrets or user content;
3. compare production behavior with deterministic CI/golden evidence;
4. isolate whether the failure is app code, deployment, Supabase, Stripe or another dependency;
5. avoid broad changes until the failure domain is known.

## Scenario: site or liveness failure

1. Check the latest Vercel deployment status for the exact current `main` SHA.
2. Run `KLYX Operational Sentinel` manually against the canonical production origin.
3. If `/api/health` fails, treat the web runtime/deployment as suspect before blaming Supabase or Stripe.
4. If `/api/health` succeeds but `/` fails, inspect Next.js/Vercel route/runtime logs.
5. Re-run the protected build/browser workflow on the exact candidate fix before merge.

Do not point production DNS at an unverified deployment during diagnosis.

## Scenario: Supabase/Auth/data failure

1. Confirm the affected project/environment before any command.
2. Check whether the symptom affects Auth, Postgres, Storage or all three.
3. Inspect the latest migration history and the exact `main` SHA that introduced a schema change.
4. Reproduce schema/migration issues first on ephemeral local Supabase when possible.
5. Use reviewed forward fixes for schema defects.

Never improvise with:
- `supabase db reset --linked`;
- unreviewed `supabase migration repair`;
- destructive linked pushes/resets;
- manual row edits to bookings, payment state or the financial ledger.

### Data recovery

Source-code backups are **not** database backups.

`KLYX Source Backup` protects repository source artifacts only.

`KLYX Supabase Restore Drill` is a separate manual proof that performs a read-only logical production dump and restores it into ephemeral local Supabase. It must not be described as completed until a real manual run has succeeded with the required secrets/DB password.

The current drill explicitly does not claim full managed Auth/Storage object recovery.

## Scenario: Stripe/payment/webhook anomaly

1. Determine whether the symptom is Checkout creation, PaymentIntent, webhook delivery, Connect, refund or ledger reconciliation.
2. Record Stripe object IDs only in appropriate private operational evidence; do not paste secrets.
3. Check idempotency/replay evidence before retrying anything.
4. Do not manually mark a booking `paid` or `refunded` in the database.
5. Keep TEST and production evidence separate.
6. For network proof, use the dedicated `KLYX Stripe Network Test` with real Stripe TEST credentials; deterministic local signed-webhook Golden evidence remains a separate proof.

If financial integrity is uncertain, treat the incident as SEV-1 until reconciled.

## Scenario: suspected security/privacy incident

1. Stop unrelated changes and preserve logs/evidence.
2. Avoid posting sensitive evidence to the public repository.
3. Identify the affected boundary: Auth/session, RLS/database privilege, Storage, API authorization, secrets or third-party integration.
4. Rotate/revoke credentials only through the owning provider dashboard and only when compromise is plausible or confirmed.
5. Verify the remediation through the relevant security contract tests and protected E2E before deployment.

Do not destroy logs or data that may be needed to determine impact.

## Recovery and rollback

For application-code regressions:
- prefer a reviewed revert/fix PR against the actual current `main`;
- do not use `git reset --hard` as a production rollback procedure;
- verify tests, TypeScript, production build and the relevant protected workflow before merge.

For database migrations:
- prefer a reviewed forward migration;
- validate against ephemeral Supabase first;
- never claim a restore succeeded without the restore drill evidence.

For a payment-related fix:
- re-run deterministic Golden coverage;
- use Stripe TEST network proof when the fix depends on Stripe network behavior;
- do not infer production payout/refund success from local mocks.

## Recovery verification

An incident is not resolved merely because the original error disappeared.

Use the smallest set that proves the affected boundary, then broaden as needed:
- `npm test`;
- `npx tsc --noEmit --pretty false`;
- `npm run build`;
- protected `Playwright browser verification`;
- `KLYX Golden Path` for transactional changes;
- `KLYX Performance Certification` for runtime/performance-sensitive changes;
- `KLYX Operational Sentinel` against the canonical production origin after deployment;
- dedicated Stripe TEST or restore drill workflows when those external boundaries are involved.

Record the exact commit and run IDs that prove recovery.

## Operational Sentinel activation

The scheduled sentinel is deliberately opt-in while the canonical production deployment is not yet a stable launch proof.

Repository variables:
- `KLYX_PRODUCTION_URL`: canonical HTTPS production origin, with no path/query/credentials;
- `KLYX_OPERATIONAL_SENTINEL_ENABLED=true`: enables the scheduled 30-minute smoke.

Manual workflow dispatch can provide `target_url` without enabling the schedule.

The sentinel:
- performs GET requests only;
- checks only `/api/health` and `/`;
- rejects remote HTTP;
- rejects credentials/query/fragment in the target URL;
- rejects every redirect and requires the canonical deployment origin directly;
- does not send Supabase, Stripe, session or application secrets;
- does not mutate KLYX data.

A failed scheduled workflow is an operational alert in GitHub Actions. External paging/notification services are intentionally not assumed or claimed by this repository.

## Closure record

Before closing an incident, capture a sanitized summary:
- severity and UTC window;
- user-visible impact;
- root cause;
- exact fix/rollback commit;
- exact verification runs;
- whether data/financial reconciliation was required;
- remaining follow-up actions.

Never include passwords, tokens, database URLs, raw dumps or sensitive user content in the closure record.

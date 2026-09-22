# KLYX Financial Runtime Worker

## Authority

The canonical durable queue remains:

`public.ops_durable_jobs`

No Vercel Queue, ad-hoc in-memory queue, or second retry authority is introduced.

The runtime worker consumes only explicit job types:

- `financial_reconciliation`
- `critical_alert_delivery`

Financial reconciliation delegates to:

`reconcileCentralFinancialTruth()`

The worker never creates Checkout Sessions, Transfers, Transfer Reversals, Refunds, or Payouts.

## Scheduling

Scheduling is independent from the Vercel plan.

Supabase provides:

- `pg_cron`
- `pg_net`
- `supabase_vault`

The migration installs a once-per-minute cron that calls:

`POST /api/ops/financial-runtime-tick`

The scheduler is **disabled by default**.

While disabled, the cron function returns without issuing an HTTP request.

## Authentication

The raw scheduler bearer token exists only in Supabase Vault under:

`klyx_financial_scheduler_token`

KLYX stores only its SHA-256 hash in:

`public.ops_financial_runtime_scheduler.token_sha256`

The application hashes the presented bearer token and uses a timing-safe comparison.

Do not commit the raw token and do not store it in `profiles`, application tables, logs, GitHub, or Vercel source.

## Activation sequence

Do not enable the scheduler before the exact production deployment is healthy.

1. merge the worker code;
2. apply production migrations;
3. certify the exact new `main` SHA;
4. deploy that exact SHA through `KLYX_DEPLOYMENT_GATE`;
5. verify `/api/health/build` reports the exact SHA;
6. generate a high-entropy scheduler token out of band;
7. store the raw token in Supabase Vault;
8. store only its SHA-256 hash in `ops_financial_runtime_scheduler`;
9. confirm `alert_email`;
10. set scheduler `enabled=true`;
11. wait for a fresh `financial_durable_worker` heartbeat;
12. wait for a fresh `critical_alert_delivery` heartbeat;
13. verify the daily alert sentinel is actually `sent`;
14. verify the finance/Stripe DLQ is empty;
15. verify no critical monitoring signal is open;
16. verify no financial reconciliation/human_review is open;
17. only then permit controlled LIVE certification.

## Worker heartbeat

A healthy worker writes:

`component=financial_durable_worker`

with:

- `status=healthy`
- `source_sha=VERCEL_GIT_COMMIT_SHA`
- `last_seen_at` fresh within the LIVE gate window

A later deployment immediately invalidates the old heartbeat because the SHA no longer matches.

## Critical alert heartbeat

A healthy alert component writes:

`component=critical_alert_delivery`

The heartbeat is degraded when:

- the alert recipient is missing;
- `RESEND_API_KEY` is missing;
- an alert delivery fails during the tick.

## Alert sentinel

Once per UTC day, the worker enqueues:

`critical_alert_delivery`

with the deduplication key:

`klyx-critical-alert-sentinel:YYYY-MM-DD`

It uses the exact same durable queue and email delivery registry as real critical alerts.

General or controlled LIVE requires a successful sentinel email in the last 36 hours.

A configured provider without a recent delivered sentinel is not considered operational.

## Reconciliation jobs

Open `financial_reconciliation_current.state=reconciliation` cases are projected into durable jobs.

The worker calls the existing central reconciliation authority.

- `coherent` -> job succeeds;
- `human_review` -> job succeeds with human-review result, because automation must not silently repair it;
- still `reconciliation` -> retry/backoff;
- retry budget exhausted -> DLQ.

LIVE remains fail-closed while reconciliation truth or DLQ truth is unhealthy.

## Critical signal jobs

Critical rows from:

- `ops_observability_signals_current`
- `financial_monitoring_signals_current`

are projected into deduplicated durable alert jobs.

The email body intentionally excludes user data, booking IDs, Stripe IDs, and raw financial identifiers.

## Rollback

Fast stop:

1. use the Operations circuit breaker for Stripe payments;
2. set `ops_financial_runtime_scheduler.enabled=false`.

Disabling the scheduler stops new worker wake-ups but does not delete queue state.

Do not delete DLQ rows, reconciliation cases, ledger truth, or Stripe webhook evidence to obtain a green gate.

Observation and reconciliation of already-created Stripe truth must remain available.

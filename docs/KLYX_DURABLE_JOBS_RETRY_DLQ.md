# KLYX Durable Jobs + Retry / DLQ

Mission 14 adds a durable, PostgreSQL-backed operational execution substrate.

## Boundary

Durable Jobs coordinates execution. It does **not** become business truth.

Canonical authority remains in the existing domains:

- Booking owns booking state.
- Canonical Financial Ledger owns accounting truth.
- Settlement owns settlement state and Stripe truth reconciliation.
- Risk / Economic Eligibility own authorization.
- Stripe and Sumsub webhook tables keep their existing webhook retry leases.
- Operations owns operational controls and failure-domain coordination.

A durable job stores small execution references and parameters. Its payload must never become a second canonical Booking, Ledger, Settlement, KYC/KYB or webhook object.

## Delivery semantics

Mission 14 is explicitly **at-least-once**.

It does not claim exactly-once execution.

Correctness comes from two layers:

1. the durable-job lease fences stale workers;
2. the invoked domain mutation must still enforce its own idempotency, authorization and domain fencing.

## Lifecycle

```text
enqueue
  -> queued
  -> running
      -> succeeded
      -> retry_wait
          -> running
      -> dead_lettered
```

Expired running leases are reaped deterministically:

- attempts remaining → `retry_wait`;
- attempt budget exhausted → `dead_lettered`.

There is no infinite retry and no silent drop.

## Idempotent enqueue

The durable identity is:

```text
(job_type, idempotency_key)
```

Concurrent identical enqueue calls are serialized with a transaction-scoped advisory lock.

The first call creates the job and one Mission 13 `ops_operations` correlation record.

Later calls return the existing job only when their immutable request fingerprint matches.

A reused idempotency key with different payload/scope/policy fails with:

```text
KLYX_DURABLE_JOB_IDEMPOTENCY_CONFLICT
```

Terminal jobs are never silently resurrected by enqueue.

## Request fingerprint

The fingerprint binds the idempotency key to:

- payload;
- account/domain references;
- structured failure-domain scope;
- market / region / country / currency;
- payment provider / capability / dependency;
- priority;
- attempt budget and backoff policy.

Scheduling time is not part of the fingerprint. A duplicate enqueue never
silently changes the schedule of the existing job.

This prevents the same idempotency key from being reused for semantically different work.

## Claim + lease fencing

Claims use:

```sql
FOR UPDATE SKIP LOCKED
```

Every claim:

- increments `attempt_count`;
- assigns a random `lease_token`;
- records `lease_owner`;
- sets `lease_expires_at`;
- retains `last_claim_token` / `last_worker_id` for idempotent acknowledgements.

Completion, failure and lease extension are accepted only for the matching worker + token.

Expired leases cannot be extended or finalized by stale workers.

Long-running workers may explicitly extend a still-valid lease through `klyx_extend_durable_job_lease`.

## Retry policy

Retryable failure schedules deterministic capped exponential backoff:

```text
delay = max(1, min(backoff_max, backoff_base * 2^(attempt_count - 1)))
```

The same policy is used when the reaper recovers an expired lease.

A non-retryable failure or exhausted attempt budget becomes `dead_lettered`.

Mission 14 intentionally does not add random jitter at this foundation layer.

## DLQ

The DLQ is the read-only view:

```text
ops_durable_job_dlq
```

It projects jobs where:

```text
status = dead_lettered
```

Mission 14 provides **read access only** to the DLQ through the server boundary.

There is no automatic redrive and no Founder requeue action in Mission 14.

Human ownership, case creation and explicit redrive belong to Mission 15 — Human Operations / Case Management.

## Audit

Every durable job owns one `ops_operations` correlation record.

Transitions append to the existing Mission 13 `ops_events` stream:

- `durable_job.enqueued`
- `durable_job.claimed`
- `durable_job.retry_scheduled`
- `durable_job.succeeded`
- `durable_job.dead_lettered`

Expired leases are converted into retry/dead-letter transitions by the reaper and audited through the same events.

No second universal audit log is introduced.

## Existing retry authorities are preserved

Mission 14 does **not** rewrite or absorb:

- Stripe webhook retry lease;
- Sumsub webhook retry lease;
- Settlement release claim;
- Settlement reconciliation;
- Checkout claim/idempotency fencing.

Those mechanisms remain authoritative for their domain-level side effects.

A future worker may enqueue a durable job that invokes one of those domain functions, but the domain function must still revalidate current truth and fencing before mutation.

## Data minimization

The queue is not a secret store.

The schema limits payload/fingerprint size and stores only a normalized `last_error_code`, not raw exception stacks or arbitrary failure messages.

Prefer stable identifiers and references over copied business payloads.

## Security

`ops_durable_jobs` is server-only:

- RLS enabled;
- no privileges for `public`, `anon` or `authenticated`;
- `service_role` receives read access only to the table;
- all state transitions occur through service-role-only RPCs;
- DLQ is a read-only projection.

The server boundary is `lib/durable-jobs-server.ts`.

Mission 14 creates:

- no public worker endpoint;
- no browser job mutation endpoint;
- no automatic DLQ redrive;
- no Stripe LIVE activation;
- no Vercel mutation;
- no production Supabase migration application.

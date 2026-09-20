# KLYX Durable Jobs + Retry / DLQ

Mission 14 adds a durable operational execution substrate.

## Boundary

Durable Jobs coordinates execution. It does **not** become business truth.

Canonical authority remains in the existing domains:

- Booking owns booking state.
- Canonical Financial Ledger owns accounting truth.
- Settlement owns settlement state and Stripe truth reconciliation.
- Risk / Eligibility own authorization.
- Stripe and Sumsub webhook tables keep their existing webhook retry leases.
- Operations owns operational controls and failure-domain coordination.

A durable job references domain resources. It must not mirror a canonical domain object and later treat its payload as more authoritative than the domain itself.

## Lifecycle

```text
enqueue
  -> queued
  -> leased
      -> succeeded
      -> retry_wait
          -> leased
      -> dead_letter
```

A stale lease is reclaimable only while attempts remain.

An exhausted stale lease is moved to `dead_letter`.

There is no infinite retry and no silent drop.

## Enqueue idempotency

The unique identity is:

```text
(queue, job_type, idempotency_key)
```

Identical concurrent enqueue attempts are serialized with a transaction-scoped advisory lock. The first creates the Operations record and job. Later calls return the existing job without resetting status, attempts or schedule.

Terminal jobs are not silently resurrected by enqueue.

## Lease fencing

A claim requires:

- queue;
- worker id;
- bounded claim size;
- bounded lease duration.

Claims use:

```sql
FOR UPDATE SKIP LOCKED
```

Each successful claim gets a new random `lease_token` and increments `attempt_count`.

Completion or failure must match both:

- `lease_worker_id`;
- `lease_token`.

A stale worker therefore cannot finalize a job after another worker has reclaimed it.

## Retry policy

Failure before `max_attempts` schedules deterministic capped exponential backoff:

```text
delay = min(max_backoff, base_backoff * 2^(attempt_count - 1))
```

Backoff is deterministic. Mission 14 does not add random jitter because correctness and replayability are more important at this foundation stage.

At `max_attempts`, failure becomes terminal `dead_letter`.

## DLQ

DLQ is the set of `ops_jobs` where:

```text
status = dead_letter
```

Mission 14 intentionally provides **read access only** to DLQ through the server boundary.

It does not provide an automatic requeue or a Founder requeue button. Human requeue/case ownership belongs to Mission 15 — Human Operations / Case Management.

## Audit

Every job has one `ops_operations` correlation record.

Important transitions append to Mission 13 `ops_events`:

- `durable_job_enqueued`
- `durable_job_claimed`
- `durable_job_lease_expired`
- `durable_job_retry_scheduled`
- `durable_job_succeeded`
- `durable_job_dead_lettered`

No second universal audit log is introduced.

## Existing retries are not migrated

Mission 14 does not rewrite:

- Stripe webhook retry lease;
- Sumsub webhook retry lease;
- Settlement release claim;
- Settlement reconciliation;
- Checkout claim/idempotency fencing.

Those mechanisms remain authoritative for their domain-level side effects.

A later integration may enqueue a durable job that invokes a domain reconciliation function, but the domain function must still revalidate its own authority, idempotency and fencing.

## Security

`ops_jobs` is server-only:

- RLS enabled;
- no privileges for `public`, `anon` or `authenticated`;
- job RPCs executable only by `service_role`.

Mission 14 creates no public worker endpoint, no browser job mutation endpoint, no Stripe LIVE activation and no production deployment side effect.

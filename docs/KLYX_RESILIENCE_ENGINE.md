# KLYX Pure Resilience Engine

## Purpose

This layer models failure/recovery semantics without Supabase, Stripe, Vercel, queues, webhooks, or any real financial mutation.

It is deliberately adapter-first so the same state machine can be certified with local mocks before any production adapter is connected.

## Boundary

The engine coordinates execution safety. It is **not** business truth and it is **not** financial authority.

Existing production authorities remain unchanged:

- Booking owns booking truth.
- Economic Eligibility owns settlement permission.
- Ledger owns accounting truth.
- Settlement owns settlement truth.
- Existing PostgreSQL durable jobs remain the current production durable-job substrate.

The pure engine does not import or call any of them.

## State machine

```text
queued
  -> running
      -> succeeded
      -> retry_wait
          -> running
      -> dead_lettered
      -> human_review
```

`human_review` is mandatory when the engine cannot prove whether an external action happened.

## Delivery semantics

The model is at-least-once, never exactly-once.

Safety is provided by:

1. required idempotency keys;
2. deterministic request fingerprints;
3. lease tokens + worker ownership;
4. optimistic version fencing for concurrent mutation;
5. deterministic retry policy;
6. recovery handlers before replaying ambiguous work;
7. duplicate inbound-event detection;
8. DLQ for poison/permanent/exhausted jobs;
9. `human_review` for unprovable state.

## Retry policy

```text
delay = min(backoff_max, backoff_base * 2^(attempt_count - 1))
```

No jitter is used in the pure foundation so tests are reproducible.

## Failure coverage

| Failure | Behavior |
|---|---|
| timeout | recovery handler must prove success/not-applied; otherwise `human_review` |
| retryable failure | exponential backoff, bounded attempts |
| duplicate event | exact duplicate is ignored idempotently |
| conflicting duplicate event | `human_review` |
| double click | same `(jobType, idempotencyKey, fingerprint)` returns same job |
| delayed webhook | accepted once; event handler reconciles current job state |
| absent webhook | deadline recovery handler probes truth |
| worker crash | expired lease recovered; replay only when declared safe or proved |
| worker restart | new engine instance can reuse the same durable adapter |
| action replay | enqueue/ack replay is idempotent when semantically identical |
| stale claim | stale worker cannot blindly finalize; recovery path is required |
| concurrent mutation | compare-and-swap conflict escalates to `human_review` if not provable |
| unknown external state | no blind retry; recovery evidence or `human_review` |
| poison job | immediate DLQ |
| attempts exhausted | DLQ |

## Adapter contracts

`KlyxResilienceStore` defines the durable storage boundary.

Current certification adapter:

```text
InMemoryKlyxResilienceStore
```

It provides deterministic local job IDs, lease tokens, event deduplication, optimistic version fencing, DLQ inspection, and audit events.

`ManualKlyxResilienceClock` makes timeout/retry/lease scenarios reproducible in tests.

## Recovery handlers

Each job type can define a recovery handler returning one of:

```text
proved_succeeded
proved_not_applied
retry
unknown
human_review
```

The engine must never turn `unknown` into a retry automatically.

## Inbound events

Inbound events are deduplicated by:

```text
(source, event_id)
```

The full event fingerprint binds source, event id, type, job, occurrence time and payload.

Same key + same fingerprint:

```text
duplicate -> no second effect
```

Same key + different fingerprint:

```text
conflict -> human_review
```

## DLQ and redrive

Poison jobs, permanent failures and exhausted retry budgets become `dead_lettered`.

Redrive is explicit and creates a **new** job with:

- a new idempotency key;
- `parentJobId` pointing to the dead-lettered job;
- an explicit reason code.

The old job remains immutable history.

## Financial safety

This mission contains no Stripe SDK import, no Supabase import, no transfer, refund, payout, PaymentIntent, ledger mutation, or settlement mutation.

Any future financial adapter must remain behind existing KLYX financial authorities and must re-check eligibility, ledger, settlement and environment certification before side effects.

## CI certification semantics

KLYX pull-request E2E is repository-serialized through GitHub concurrency. A run cancelled before any job is created is an orchestration event, not certification success and not evidence of a product failure.

The exact pull-request head SHA must still obtain a successful `Playwright browser verification` before merge. A previous SHA, a zero-job cancellation, or a successful sibling pull request never substitutes for certification of the head being merged.

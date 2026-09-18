# KLYX Settlement Recovery / Reconciliation — Mission 4

## Scope

Mission 4 is deliberately limited to **single-booking `platform_held` settlements**.

It does not enable group booking, split missions, Stripe live, bank payouts, or a new settlement engine.

The recovery layer exists for one purpose: reconcile KLYX database state with authoritative Stripe TEST objects after partial failures without ever guessing whether money moved.

## Financial safety rule

Recovery never creates money movement.

The recovery module may read:

- PaymentIntent;
- Charge;
- Transfer;
- TransferReversal.

It must never call:

- `stripe.transfers.create`;
- `stripe.transfers.createReversal`;
- `stripe.refunds.create`;
- `stripe.payouts.create`.

If a financial action is still required after reconciliation, the already-certified settlement/refund path must perform it under its own atomic claim and idempotency contract.

## Stripe environment

Recovery accepts only `sk_test_*`.

`sk_live_*` fails closed with `KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY`.

A missing or non-test secret fails closed with `KLYX_SETTLEMENT_STRIPE_TEST_KEY_REQUIRED`.

## Authority order

Before a recovery state write:

1. load frozen KLYX settlement truth;
2. verify the canonical KLYX account still owns the frozen Connect identity;
3. retrieve the Stripe TEST PaymentIntent/Charge;
4. verify booking id, payment mode, gross amount, currency, charge id and transfer group;
5. list every Transfer for the frozen transfer group;
6. when exactly one Transfer exists, verify amount, currency, destination, `source_transaction`, transfer group and metadata;
7. list its reversals and verify reversal amount/metadata;
8. classify the observation;
9. only then apply one row-locked database recovery action.

Any contradiction in canonical identity, amount, currency, charge, destination, `source_transaction`, transfer group or multiplicity is not auto-repaired.

## Recovery cases

### Transfer accepted, DB finalize lost

If exactly one valid Stripe Transfer exists for the booking and DB is still `held`, `release_claimed` or `release_failed`, recovery records that Transfer and converges to:

- `released` when no refund is active;
- `refund_pending` when a refund raced with release.

It never creates a second Transfer.

### Stripe timeout / unknown result

A Stripe read failure records an observation failure only.

Settlement financial state does not move and recovery performs no financial retry.

A later operator-triggered reconciliation may query Stripe again.

### Expired claim

A stale `release_claimed` row becomes `release_failed` only after Stripe TEST has been queried and **zero** Transfers are observed for the immutable transfer group.

A fresh claim remains pending.

### Reversal accepted, DB finalize lost

If one valid Transfer and one valid reversal exist, recovery records both.

The settlement converges to:

- `refund_pending` while the customer refund is not terminal in KLYX;
- `refunded` when KLYX already has terminal refund truth.

Recovery never creates the reversal.

### Duplicate or conflicting Stripe objects

Multiple Transfers, multiple reversals, wrong amount, wrong currency, wrong destination, wrong charge, wrong `source_transaction`, wrong transfer group, or provider identity conflict result in `review_required`.

Human review is sticky: recovery does not silently turn an existing review decision back into an automatic release.

### Webhook gaps and duplicates

Recovery reconstructs settlement truth from Stripe objects rather than trusting webhook delivery count.

Duplicate recovery observations are deduplicated by `(booking_id, observation_key)`.

If Stripe shows a terminal refund that KLYX has not persisted, recovery fails closed to human review instead of inventing booking payment state.

### Refund/release concurrency

The database recovery RPC locks the settlement row and re-reads booking refund state before applying an observation.

If a Transfer exists while a refund is active, recovery preserves the Transfer truth and moves to `refund_pending`; it does not pretend provider funds never moved.

## Audit

`booking_settlement_recovery_events` is server-only and immutable through the recovery API.

Each event records:

- booking id;
- deterministic observation key;
- action;
- state before/after;
- observed Transfer/reversal ids;
- reason codes;
- non-secret operational details;
- observation timestamp.

## Metrics

`klyx_booking_settlement_recovery_metrics()` exposes server-only operational metrics:

- held;
- pending release;
- failed;
- review;
- released;
- reversed;
- refunded;
- average settlement duration;
- p95 settlement duration.

## Operations

Founder-only endpoint:

- `GET /api/founder/settlement-recovery` — metrics + recent audit;
- `POST /api/founder/settlement-recovery` with `bookingId` — reconcile one booking;
- `POST /api/founder/settlement-recovery` without `bookingId` — bounded backlog observation/reconciliation.

The backlog is bounded to at most 50 rows per request.

## Certification

Mission 4 must be certified on one immutable SHA with:

- `npm test`;
- `npx tsc --noEmit --pretty false`;
- `npm run build`;
- Security;
- Golden Path;
- Performance;
- E2E + UX/Visual;
- real Stripe TEST network proof.

No Vercel deployment is part of this mission.

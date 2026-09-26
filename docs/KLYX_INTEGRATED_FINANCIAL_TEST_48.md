# KLYX Integrated Financial TEST 48

## Purpose

This certification proves the integrated KLYX financial chain without any real LIVE money movement.

It does **not** replace `KLYX Production Financial Certification` and it does not weaken the existing 40-cell controlled-LIVE gate.

The scope is:

```text
payment
-> canonical ledger
-> booking financial state
-> commission
-> provider liability
-> settlement
-> simulated Stripe TEST Transfer truth
-> reconciliation
```

The invariant is:

```text
KLYX Ledger
=
Settlement truth
=
Stripe truth
```

Any divergence must remain fail-closed:

```text
block
-> reconciliation
-> human_review
```

## Required matrix

Scenarios:

1. `success`
2. `failed_payment`
3. `failed_transfer`
4. `timeout`
5. `duplicate_webhook`
6. `late_webhook`
7. `missing_webhook`
8. `retry`
9. `double_click`
10. `partial_refund`
11. `full_refund`
12. `reversal`

Topologies:

1. `single`
2. `group`
3. `split`
4. `multi_provider`

The matrix therefore contains exactly **48 required cells**.

One missing or failing cell means:

```text
KLYX Integrated Financial TEST 48 = FAIL
```

## Existing authorities reused

The bank does not create a new financial engine.

It composes the existing authorities:

- `lib/pure-finance/engine.ts`;
- `lib/pure-finance/ledger-projection.ts`;
- `lib/pure-finance/runtime-shadow.ts`;
- `lib/resilience-engine.ts`;
- `lib/resilience-memory-adapter.ts` for deterministic certification only.

The test Stripe truth is an in-memory idempotent adapter. It cannot call Stripe LIVE or Stripe TEST network APIs and cannot move money.

## Exact deployed SHA gate

A manual certification run fails unless all of the following are simultaneously true:

1. `expected_sha` is an exact 40-character Git SHA;
2. the workflow itself is running on that SHA;
3. GitHub `main` still points to that SHA;
4. KLYX production `/api/health/build` exposes the same SHA and reports `environment=production`;
5. existing exact-SHA `KLYX E2E`, `KLYX Golden Path` and `KLYX Pure Finance Certification` runs are already `success`;
6. Supabase production migration verification is read-only and reports no pending migration;
7. all 48 matrix cells pass;
8. `KLYX_LIVE_PAYMENTS_ENABLED=false` throughout the run.

If `main` moves after a successful run, the proof no longer certifies the new `main`.

If Vercel still serves an older SHA, the run fails instead of certifying a repository state that is not actually deployed.

## Scenario semantics

- `success`: charge/economics recognition, settlement Transfer and final reconciliation are coherent.
- `failed_payment`: failed payment creates no successful canonical charge or beneficiary Transfer.
- `failed_transfer`: payment truth remains recognized while beneficiary release is blocked and routed to review; no false Transfer is accepted.
- `timeout`: a simulated remote Transfer may exist while local completion is unknown; reconciliation discovers the existing remote truth and finalizes locally without creating a second Transfer.
- `duplicate_webhook`: the same immutable event id is applied once; replay is classified as duplicate.
- `late_webhook`: delayed delivery is observed and the final canonical state is applied once.
- `missing_webhook`: external payment truth initially diverges from local truth, forcing block/reconciliation/human review; recovery proves remote truth and restores coherence.
- `retry`: first execution fails retryably with zero financial side effect; the later attempt succeeds once.
- `double_click`: duplicate enqueue with the same idempotency key executes the chain once.
- `partial_refund`: refund and any required provider Transfer reversal reconcile exactly.
- `full_refund`: cumulative refund equals the charge and released provider funds are reversed as required.
- `reversal`: explicit Transfer reversal is reflected identically in Ledger, Settlement and simulated Stripe truth.

## Evidence

The workflow uploads a 90-day artifact containing:

- Vitest JSON output;
- `proof.json`;
- `summary.md`;
- Supabase migration-list and dry-run evidence on manual exact-deployed runs.

`proof.json` records:

- candidate SHA;
- deployed SHA;
- production origin;
- `liveMoneyMovement=false`;
- `stripeMode=simulated_test`;
- PASS/FAIL for every topology/scenario cell;
- total PASS and FAIL counts.

No booking IDs, Stripe object IDs, payment secrets or database credentials are written to the artifact.

Every PR branch update reruns CI; an infrastructure-level cancellation must be replaced by a fresh run rather than being treated as PASS.

## Safety boundary

This certification must never contain or invoke:

```text
sk_live_*
pk_live_*
stripe.transfers.create
stripe.refunds.create
stripe.paymentIntents.create
```

The production financial certification remains a separate gate with its own controlled-LIVE rules.

# KLYX LIVE Financial Activation

## Principle

`LIVE` is not an environment. It is an explicitly authorized, observable and
reversible KLYX financial state.

A live Stripe secret never authorizes money movement by itself.

The runtime invariant is:

```text
certified SHA
= deployed SHA
+ explicit LIVE arm
+ LIVE webhooks certified
+ Connect LIVE certified
+ critical alerts certified
+ durable jobs certified
+ canonical ledger certified
+ Economic Eligibility mandatory
+ reconciliation certified
+ Operations control plane allows the capability
+ no critical monitoring signal
+ no financial DLQ item
+ no unresolved financial reconciliation
=> financial side effect may be attempted
```

Any missing, stale, ambiguous or contradictory proof fails closed.

## Master state

The master switch is:

```text
KLYX_LIVE_FINANCIAL_STATE=armed
```

It is deliberately separate from:

```text
KLYX_STRIPE_MODE=live
KLYX_LIVE_PAYMENTS_ENABLED=true
```

Those values alone must never activate KLYX money movement.

## Required explicit proofs

The static runtime gate requires all of the following:

```text
KLYX_STRIPE_MODE=live
KLYX_LIVE_PAYMENTS_ENABLED=true
KLYX_LIVE_FINANCIAL_STATE=armed
KLYX_LIVE_CERTIFIED_SHA=<40-char certified SHA>
KLYX_DEPLOYED_SHA=<40-char deployed SHA>
KLYX_LIVE_WEBHOOKS_READY=true
KLYX_LIVE_CONNECT_READY=true
KLYX_LIVE_CRITICAL_ALERTS_READY=true
KLYX_LIVE_DURABLE_JOBS_READY=true
KLYX_LIVE_LEDGER_READY=true
KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED=true
KLYX_LIVE_RECONCILIATION_READY=true
KLYX_SETTLEMENT_CONTROL_LIVE_READY=true
```

`KLYX_LIVE_CERTIFIED_SHA` and `KLYX_DEPLOYED_SHA` must be exactly equal.

The server then re-checks operational truth before every new Stripe financial
side effect:

- Operations circuit breakers permit Stripe payments;
- the specific capability permits the requested mutation;
- the canonical financial ledger is readable;
- no unresolved financial reconciliation exists;
- no Stripe/financial durable job is in DLQ;
- no critical operational or financial monitoring signal exists.

## Economic Eligibility

Economic Eligibility remains authoritative before provider Settlement.

Stripe readiness is evidence, not KLYX authorization.

```text
Stripe transfers enabled
+
KLYX Economic Eligibility blocked
=
Settlement blocked
```

The existing deterministic settlement path must continue to call
`canReceiveSettlementForBooking` immediately before release.

## Stripe object mode equality

A Stripe object is accepted only when its `livemode` matches the configured
KLYX Stripe runtime.

- TEST runtime + LIVE Stripe object => fail closed.
- LIVE runtime + TEST Stripe object => fail closed.
- LIVE runtime + unknown object mode => fail closed.

Read-only reconciliation remains allowed while new LIVE mutations are disarmed.
This is necessary to observe and repair previously created Stripe truth.

## Controlled activation sequence

Do not reorder these steps.

```text
1. true main certified
2. production migrations current
3. exact main deployed manually
4. deployment metadata proves klyxMainSha
5. KLYX_DEPLOYED_SHA equals the same immutable SHA
6. production LIVE secrets verified
7. LIVE payment webhook events verified
8. Connect LIVE recipient configuration verified
9. durable financial worker + heartbeat certified
10. critical alert delivery certified
11. ledger + reconciliation healthy
12. Economic Eligibility test matrix green
13. Operations breakers verified open/close
14. LIVE readiness re-check
15. arm master state
16. execute one controlled low-value real transaction
17. reconcile charge -> ledger -> settlement -> Stripe truth
18. only then widen rollout
```

## First real transaction

The first real transaction is a certification event, not a normal launch.

Before Checkout:

- no critical signal;
- no financial DLQ;
- no unresolved financial reconciliation;
- exact SHA equality;
- payer market allowed;
- provider canonical Connect identity linked;
- provider Economic Eligibility allowed.

After customer charge:

- webhook must be claimed idempotently;
- booking/payment truth must converge;
- canonical ledger must record the charge and provider liability;
- no duplicate financial movement may exist.

Before provider release:

- Economic Eligibility is recomputed from current truth;
- Stripe recipient truth is re-read;
- Operations breaker is re-checked;
- the LIVE runtime gate is re-checked.

After Transfer:

- Stripe Transfer truth must reconcile with the frozen provider liability;
- canonical ledger must record the Transfer;
- monitoring must remain non-critical;
- reconciliation must return to a resolved state.

Do not execute a second real transaction until the first one is fully
reconciled.

## Immediate rollback

### Level 0 — Operations kill switch

Open a global Stripe payments circuit breaker through the Founder Operations
control plane.

This is the fastest rollback because the LIVE mutation gate reads Operations
truth before each new side effect. It requires no Stripe key rotation and no
code deployment.

The breaker should target at least:

```text
payment_provider=stripe
capability=payments
state=disabled
```

Scoped settlement/refund breakers may be added when isolation is preferable.

### Level 1 — Disarm LIVE

Set:

```text
KLYX_LIVE_FINANCIAL_STATE=disarmed
KLYX_LIVE_PAYMENTS_ENABLED=false
```

and release the same certified application through the controlled deployment
gate.

Do not rotate webhook secrets as a normal rollback action. KLYX still needs
incoming Stripe events to reconcile financial truth created before the stop.

### Level 2 — Traffic rollback

If application deployment itself is unhealthy, restore the last known healthy
Vercel deployment according to `docs/operations/KLYX_DEPLOYMENT_GATE.md`.

Traffic rollback does not authorize money movement. If the rollback deployment
does not contain the exact certified financial SHA, LIVE must remain disarmed.

## Current activation blockers

This document does not declare LIVE ready.

At the time this gate was introduced, the following remained blocking evidence
to resolve before arming:

- the active production deployment was not proven to equal the certified main
  SHA;
- recent Vercel redeploy attempts had failed before build;
- the durable-job foundation existed but no production worker consumed
  `claimKlyxDurableJobs`;
- at least one canonical Stripe Connect identity conflict existed in production;
- the final LIVE webhook event set and critical alert delivery still required
  re-certification.

Therefore all LIVE flags must remain OFF until those proofs are resolved on the
then-current immutable `main`.

# KLYX Canonical Financial LIVE Authority

## Principle

`LIVE` is not an environment.

Stripe mode, keys and Vercel environment variables are configuration and
secondary fences. They never authorize KLYX money movement by themselves.

The canonical authority is the singleton row:

`public.ops_financial_live_authority`

with exactly one of:

```text
DISABLED
CONTROLLED
GENERAL
```

Initial production state is always:

```text
DISABLED
```

## States

### DISABLED

No new LIVE customer Checkout, beneficiary Transfer, Transfer Reversal or
Refund may be created.

Signed Stripe webhooks and read-only reconciliation remain available so already
existing Stripe truth can converge.

### CONTROLLED

Used only for the first real certification transaction(s).

Required authority fields:

```text
state = CONTROLLED
authorized_sha = exact deployed SHA
certification_profile_id = dedicated canary client profile
```

The runtime additionally requires:

- deployed SHA = DR-certified SHA;
- Operations payments capability open;
- operation-specific breaker open;
- financial scheduler enabled;
- healthy same-SHA worker heartbeat;
- healthy same-SHA critical-alert heartbeat;
- recent delivered alert sentinel;
- canonical ledger readable;
- finance/Stripe DLQ empty;
- no unresolved canonical financial reconciliation;
- no critical monitoring signal;
- transaction risk gate;
- current KLYX Economic Eligibility;
- current Stripe recipient truth.

Any other client profile is blocked before a new Stripe money mutation.

### GENERAL

General LIVE cannot be entered directly from `DISABLED`.

Required sequence:

```text
DISABLED
→ CONTROLLED
→ exact-SHA Mission 1 financial certification
→ GENERAL
```

`GENERAL` requires:

- authority SHA = deployed SHA;
- deployed SHA = DR-certified SHA;
- deployed SHA = `KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA`;
- `KLYX_LIVE_PAYMENTS_ENABLED=true` as an additional deployment fence;
- all operational readiness checks required by CONTROLLED.

The environment flag is therefore necessary but never sufficient.

## Founder control plane

Read:

`GET /api/founder/financial-live`

Mutate:

`POST /api/founder/financial-live`

Mutation requires optimistic version fencing:

```json
{
  "state": "CONTROLLED",
  "authorizedSha": "<exact deployed 40-char SHA>",
  "certificationProfileId": "<dedicated client profile UUID>",
  "reasonCode": "FIRST_REAL_TRANSACTION_CERTIFICATION",
  "expectedVersion": 1
}
```

The server refuses to arm a SHA different from `VERCEL_GIT_COMMIT_SHA`.

`GENERAL` is refused unless the exact deployed SHA already equals
`KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA`.

## Rollback

Immediate financial rollback is a DB state transition:

```text
CONTROLLED or GENERAL
→ DISABLED
```

This does not require:

- Vercel redeployment;
- Stripe key rotation;
- webhook shutdown;
- deleting ledger or reconciliation evidence.

Operations circuit breakers remain an independent faster/scoped kill switch.

A robust incident response is:

```text
scope-specific Operations breaker
→ financial LIVE authority DISABLED
→ reconciliation
→ human_review if needed
```

## Audit

Every transition is appended to:

`public.ops_financial_live_authority_events`

Events are immutable.

Direct updates/deletes of the canonical authority are rejected. Mutations must
go through the version-fenced RPC:

`public.klyx_set_financial_live_authority(...)`

## Deployment interaction

A newly deployed SHA does not inherit financial authority.

If the authority points to SHA A and Vercel deploys SHA B:

```text
authorized_sha != VERCEL_GIT_COMMIT_SHA
→ fail closed
```

A Founder must explicitly authorize the new exact SHA after all release,
migration, DR and readiness evidence has been verified.

## First real transaction

Before the first real Checkout:

1. exact main deployed;
2. production migrations current;
3. LIVE secrets/webhooks/Connect verified;
4. scheduler + worker + alert sentinel healthy;
5. no critical monitoring/reconciliation/DLQ blockers;
6. authority set to `CONTROLLED` for one dedicated client profile;
7. execute one low-value real transaction;
8. reconcile customer charge → canonical ledger → provider liability →
   settlement → Stripe Transfer;
9. certify all required failure scenarios/topologies;
10. only then transition authority to `GENERAL`.

Never widen rollout merely because one payment succeeded.

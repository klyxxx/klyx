# KLYX Mission 1 — Production Financial Certification

## Status

`NOT CERTIFIED` is the default state.

A successful customer payment is **not** Mission 1 certification.

Mission 1 becomes certified only when one exact production Git SHA proves the complete financial lifecycle and the complete controlled-failure matrix defined below.

## Canonical invariant

For every certified booking and every minor currency unit:

```text
KLYX Canonical Financial Ledger
=
Settlement truth
=
Stripe truth
```

The KLYX ledger remains the accounting authority. Stripe remains external financial evidence. Settlement remains execution state.

This certification gate is evidence-only. It does not create a second ledger, mutate financial truth, silently repair a discrepancy, issue a refund, create a Transfer, reverse a Transfer, or activate Stripe LIVE.

Any discrepancy must remain fail-closed:

```text
block
→ financial_reconciliation
→ human_review
```

## Happy-path chain

Every topology must prove:

```text
payment
→ canonical ledger charge
→ booking paid
→ commission
→ provider liability
→ settlement held/released
→ Stripe Transfer
→ central reconciliation = coherent
```

## Required controlled-failure matrix

Every scenario below must be certified for every topology below.

Scenarios:

1. `happy_path`
2. `partial_refund`
3. `full_refund`
4. `reversal`
5. `failed_payment`
6. `failed_transfer`
7. `late_webhook`
8. `duplicate_webhook`
9. `timeout`
10. `recovery`

Topologies:

1. `single`
2. `group`
3. `split`
4. `multi_provider`

Therefore the certification matrix contains exactly **40 required cells**. Missing one cell means `NOT CERTIFIED`.

## Evidence manifest

The manual certification workflow accepts a **private** JSON manifest encoded
in Base64. The manifest is decoded only on the runner and is never uploaded as
the certification artifact.

```json
{
  "version": 1,
  "certificationSha": "0123456789abcdef0123456789abcdef01234567",
  "cells": [
    {
      "scenario": "happy_path",
      "topology": "single",
      "bookingIds": ["00000000-0000-0000-0000-000000000000"]
    }
  ]
}
```

The manifest is not financial authority and contains no asserted Ledger,
Settlement or Stripe result. For every booking, the verifier independently
re-reads production canonical tables, validates the requested topology/scenario,
checks that the booking belongs to the dedicated certification profile, and
re-runs the existing central reconciliation engine against Stripe truth.

A booking cannot be reused in another matrix cell. The uploaded 90-day proof is
sanitized: it contains scenario/topology names and booking counts, never booking
IDs or Stripe object IDs.

## Exact-SHA prerequisites

The certification workflow fails unless all of these refer to the same exact 40-character `main` SHA:

- GitHub workflow execution SHA;
- requested certification SHA;
- production Vercel build SHA returned by `/api/health/build`;
- successful `KLYX Disaster Recovery Certification` commit status.

A different or unprovable deployed SHA blocks certification.

## Production prerequisites

Before the matrix may be evaluated:

- Stripe runtime is LIVE;
- **general LIVE payments remain disabled** during certification;
- the controlled certification canary is explicitly enabled for the exact SHA;
- Stripe secret and publishable keys match LIVE mode;
- LIVE webhook secret is configured;
- canonical Connect identity is available;
- Supabase production schema is current;
- Operations control plane does not block payments;
- Circuit breakers and incident engine are operational;
- central financial reconciliation is configured;
- DR is certified for the exact SHA.

## Scenario evidence rules

The verifier does not accept labels alone.

- `happy_path`: charge + commission + provider liability + Transfer evidence and coherent reconciliation.
- `partial_refund`: succeeded refund evidence strictly between zero and the frozen gross amount; if provider funds had already moved, corresponding reversal evidence is required.
- `full_refund`: cumulative succeeded refund equals frozen gross amount.
- `reversal`: canonical reversal movement and Stripe reversal identity are present.
- `failed_payment`: canonical booking/payment failure evidence exists and no succeeded charge/Transfer is invented.
- `failed_transfer`: Settlement records a release failure/review path and no false released state is accepted.
- `late_webhook`: recovery audit proves Stripe truth was recovered after missing/late webhook persistence.
- `duplicate_webhook`: webhook claim history proves repeated delivery/replay while canonical financial effects remain idempotent.
- `timeout`: immutable operational/settlement evidence records a timeout/fenced interruption without duplicate Stripe side effects.
- `recovery`: reconciliation audit records recovery and final central reconciliation is coherent.

## Topology evidence rules

- `single`: one canonical booking settlement, not a group/split member.
- `group`: grouped booking evidence with canonical grouped financial state.
- `split`: split booking batch/payment-unit evidence.
- `multi_provider`: at least two distinct canonical provider accounts in one platform-held multi-executor settlement.

A topology label in the manifest cannot substitute for database evidence.

## Certification result

Only a complete and coherent 40/40 matrix can publish:

```text
KLYX Production Financial Certification = success
```

Otherwise:

```text
Mission 1 = NOT CERTIFIED
```

A later `main` commit invalidates the certification until it is rerun for that exact new SHA.

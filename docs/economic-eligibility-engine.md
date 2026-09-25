# KLYX Pure Economic Eligibility Engine

The canonical decision core lives in `lib/economic-eligibility-engine.ts`.

It is deliberately independent from Supabase, Stripe and any payment-provider SDK. Persistence and provider adapters may supply normalized facts, but they are not decision authorities.

## Authority chain

```text
account
→ economic identity
→ legal person/entity
→ verification
→ qualifications
→ activity eligibility
→ country eligibility
→ economic eligibility
→ external payment-provider rail readiness
```

The authorities remain distinct. A verified external payment account never overrides a KLYX block.

## Critical invariant

```text
external payment provider = READY
+
KLYX economic eligibility != ALLOWED
=
NO NEW SETTLEMENT
```

`settlementIsAuthorized(result)` is true only when the evaluated action is `settlement` and the deterministic decision is `allowed`.

## Canonical states

```text
verified
pending
expired
restricted
qualification_missing
country_restricted
payouts_disabled
requirements_due
human_review
```

`pending`, `expired`, `restricted`, `qualification_missing`, `country_restricted`, `payouts_disabled`, and `requirements_due` fail closed.

`human_review` also forbids new money movement until an external human-review process produces a new normalized authority state and the engine is re-evaluated.

## Settlement rail vs payout rail

A provider's settlement/transfer rail and bank-payout rail are separate facts.

For a `settlement` evaluation:

- `settlementEnabled = false` blocks settlement;
- settlement-scoped requirements due block settlement;
- `payoutsEnabled = false` is recorded as evidence but does not by itself veto an otherwise-enabled settlement rail.

For a `payout` evaluation, `payoutsEnabled = false` blocks the payout.

This prevents provider-specific payout semantics from becoming KLYX settlement authority.

## Decision output

Every evaluation returns:

- canonical state;
- `allowed | blocked | human_review` decision;
- explicit `authorized` boolean;
- stable reason codes;
- normalized evidence by authority;
- audit event;
- previous state;
- new state.

The caller supplies `evaluatedAt`. The engine does not read the clock, generate random IDs, call the network, mutate storage or inspect environment variables. Identical inputs therefore produce identical outputs.

## Evidence minimization

Evidence contains normalized statuses, stable references, reason codes and small non-sensitive facts only. Raw KYC documents, tax identifiers, payment-provider payloads and conversation content must stay outside the engine.

## Adapter rule

Supabase, Stripe or another provider may only act as adapters:

```text
external data
→ normalize facts
→ evaluateEconomicEligibility(...)
→ persist audit event
→ enforce authorized=false before money movement
```

The adapter must never reconstruct or bypass the eligibility rules independently.

## Certification

`tests/unit/economic-eligibility-engine.test.ts` certifies the decision matrix with local fixtures only.

`tests/integration/economic-eligibility-pure-contract.test.ts` locks the dependency boundary and rejects Supabase/Stripe SDK coupling in the pure engine.

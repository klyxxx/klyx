# KLYX Autonomous Offline Certification Bench

## Scope

This bench certifies the **real durable orchestration core** of KLYX with deterministic local adapters.

It is not a parallel toy state machine and it does not reproduce business logic inside the certification script.

The executable chain is:

```text
KlyxDurableOrchestrator
→ KlyxOrchestrationStore abstraction
→ KlyxResilienceEngine
→ fake persistence / fake Stripe effects
→ deterministic report
```

## Isolation contract

The certification must run with:

```text
KLYX_AUTONOMOUS_OFFLINE_ONLY=true
KLYX_LIVE_PAYMENTS_ENABLED=false
KLYX_STRIPE_MODE=offline-fake
```

No Supabase project, Stripe credential, browser, Vercel deployment or external API is required.

Every scenario must report:

```text
externalNetworkCalls = 0
```

## Adapters

The report identifies:

```text
supabase = fake-supabase
stripe = fake-stripe
persistence = abstract-klyx-orchestration-store
resilience = in-memory-klyx-resilience-store
```

These names are certification evidence, not claims that the real Supabase/Stripe systems were tested.

## Determinism

The bench uses:

- manual deterministic clock;
- deterministic IDs;
- canonical command fingerprints;
- explicit idempotency keys;
- in-memory durable stores reused across process recreation;
- deterministic fault injection.

No wall-clock timestamp or random UUID is required by the core test runtime.

## Scenarios

The certification executes and reports PASS/FAIL for:

1. full DEMANDER lifecycle;
2. full GAGNER lifecycle;
3. browser close + process recreation;
4. conversation deletion + rebind;
5. LLM model replacement;
6. double click / command replay;
7. worker crash + expired-lease recovery;
8. external action applied then response unknown;
9. payment failure + deterministic retry;
10. incident → refund → resume;
11. beneficiary becomes economically ineligible before settlement.

## Critical proofs

### Workflow survives UI loss

Closing a browser or deleting a conversation changes interface context only.

The canonical workflow and facts remain in the persistence adapter.

### LLM is not authority

Changing `llmModel` does not change:

- workflow step;
- confirmed facts;
- booking/payment truth;
- eligibility;
- pending actions.

### Replay does not duplicate mutation

For each action:

```text
actionId
→ durable job idempotency key
→ effect receipt
```

A replay returns the same persisted effect receipt.

The certification counts attempts and actual mutations separately.

### Worker crash is recoverable

The worker lease can expire. A new engine instance reuses the same persistent stores, recovers the stale claim, applies retry/backoff and resumes the pending action.

### Unknown external state is proved

The `apply_then_unknown` fault simulates:

```text
effect committed
→ worker loses response/crashes
```

Recovery reads the effect receipt. It marks the job succeeded without executing the effect twice.

### Economic Eligibility overrides payment readiness

The fake Stripe adapter is capable of settlement, but if canonical KLYX eligibility is changed to blocked before Settlement, the state machine refuses to create `settlement_release` at all.

## Run locally

```bash
npm run test:durable:orchestration
npm run test:autonomous:offline
npm run certify:autonomous:offline
```

The certification command writes:

```text
artifacts/klyx-autonomous-certification/report.json
artifacts/klyx-autonomous-certification/report.md
```

CI writes the same report under `certification-artifacts/` and uploads it as a GitHub Actions artifact.

## Meaning of PASS

PASS means:

- the pure deterministic workflow engine behaves correctly under the listed failures;
- its in-memory persistence contract is sufficient for restart/replay certification;
- no external network call occurred;
- fake financial side effects remained idempotent;
- the workflow is independent from LLM/browser/conversation lifecycle.

PASS does **not** mean production Supabase, Stripe, workers, webhooks, secrets, Vercel or LIVE settlement are healthy. Those remain separate certification layers.

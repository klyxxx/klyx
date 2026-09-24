# KLYX Autonomous Offline Certification Bench

## Purpose

This bench certifies the KLYX product continuity contract for both **DEMANDER** and **GAGNER** without Supabase, Stripe, browser automation, external APIs or LIVE credentials.

It complements Mission 19's database-backed Golden Path. It does not replace production/local-Supabase certification.

## Isolation contract

The bench uses only:

- `FakeSupabaseAdapter` — in-memory canonical workflow/domain state;
- `FakeStripeAdapter` — in-memory payments, refunds, webhooks and transfers;
- `DeterministicClock` — no wall-clock dependency;
- `DeterministicIds` — no UUID/random dependency;
- `FaultInjector` — deterministic crash/transient-failure injection.

Every scenario records `externalNetworkCalls = 0`. The certification fails if any scenario does not return PASS.

No LIVE secret is read or required.

## Certified scenarios

The executable matrix covers:

### DEMANDER

- browser closed/reopened;
- LLM model replacement;
- conversation deletion + workflow rebind;
- double click + action replay;
- booking price drift after snapshot;
- delayed payment webhook + webhook replay;
- simulated payment failure + retry;
- worker crash + expired-lease recovery;
- deterministic exponential retry boundary;
- paid mission incident -> refund -> replacement -> workflow resume.

### GAGNER

- browser closed/reopened;
- LLM model replacement;
- conversation deletion + workflow rebind;
- proposal double click/action replay;
- proposal economic snapshot preserved against replayed price change;
- worker crash + durable retry;
- beneficiary allowed then blocked before settlement;
- successful settlement replay remains one transfer.

## Critical invariants

```text
browser != workflow truth
conversation != workflow truth
LLM != mutation authority
worker process != durable job truth
mutable catalog price != confirmed economic truth
external payment provider OK != KLYX settlement authorization
```

For settlement:

```text
latest KLYX eligibility != allowed
=> no new transfer
```

For payment/refund/replay:

```text
stable idempotency identity
+ canonical snapshot
+ deterministic recovery
=> one domain mutation
```

## Run locally

```bash
npm run certify:autonomous:offline
```

The command writes:

```text
artifacts/klyx-autonomous-certification/report.json
artifacts/klyx-autonomous-certification/report.md
```

The process exits non-zero if any scenario is FAIL.

For the Vitest contract:

```bash
npm run test:autonomous:offline
```

## CI

`.github/workflows/klyx-autonomous-offline-certification.yml` runs the pure Node bench without starting Supabase or providing Stripe credentials. It uploads the generated JSON/Markdown report as a GitHub Actions artifact.

## Certification meaning

A PASS proves the deterministic orchestration and recovery model implemented by this fake-adapter bench.

It does **not** prove that production Supabase, production workers, Stripe network behavior, infrastructure, secrets, migrations or LIVE settlement are healthy. Those remain separate certification layers.

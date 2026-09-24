# KLYX Durable Orchestration Engine

## Purpose

KLYX orchestration must survive the loss of every conversational surface.

The assistant can understand and propose. It is never the source of business truth and never the mutation authority.

```text
LLM != workflow truth
conversation != workflow truth
browser process != workflow truth
worker process != durable action truth
external provider response != KLYX authorization
```

The engine is provider-agnostic and persistence-agnostic. The current certification uses only in-memory fake adapters. A future Supabase adapter must implement the same `KlyxOrchestrationStore` contract instead of changing the state machine.

## Canonical lifecycles

### DEMANDER

```text
intention
→ comprehension
→ plan
→ search
→ matching
→ quote
→ confirmation
→ booking
→ payment
→ mission
→ tracking
→ incident
→ refund_replacement
→ closure
```

### GAGNER

```text
skill
→ opportunities
→ eligibility
→ proposal
→ acceptance
→ mission
→ completion
→ settlement
```

`mission → settlement` is forbidden. `completion` is an explicit canonical boundary.

## Deterministic state machine

Pure state lives in:

`lib/durable-orchestration-engine.ts`

A workflow contains:

- canonical mode;
- canonical current step;
- status;
- monotonic version;
- persisted business facts;
- at most one pending durable action;
- human-review reason;
- interface context.

The reducer accepts explicit commands only. It does not call an LLM, Stripe, Supabase, the network, the wall clock or a random UUID source.

## Interface context is not business truth

The following fields are deliberately isolated in `KlyxInterfaceContext`:

```text
conversationId
browserSessionId
llmModel
```

They can be deleted, replaced or rebound without changing canonical business facts or the workflow step.

Therefore:

- browser close/reopen does not reset the workflow;
- conversation deletion does not delete the workflow;
- changing LLM model does not alter price, booking, payment, eligibility or settlement truth.

## Persistence abstraction

`KlyxOrchestrationStore` is the durable persistence boundary.

It owns:

```text
createOrGetWorkflow
getWorkflow
listWorkflows
getCommand
applyCommand
appendEvent
listEvents
```

The critical method is `applyCommand`.

A real adapter must atomically prove:

```text
expected workflow version
+ idempotency key absent or identical
+ state transition persisted
+ command receipt persisted
+ audit event persisted
```

If the expected version has changed, the adapter returns `version_conflict`.

If the same idempotency key has a different command fingerprint, it returns `conflict`.

The in-memory `FakeSupabaseAdapter` implements this contract for certification. It is not production Supabase and makes no network call.

## Idempotent command protocol

Every external command requires an idempotency key.

```text
(workflow id, idempotency key, deterministic command fingerprint)
```

Identical replay returns the original persisted result without a second mutation.

Same key + different fingerprint fails closed.

This protects double click, HTTP retry, action replay and client reconnect.

## Durable action boundary

Sensitive or externally executed transitions are never direct state jumps.

Examples:

```text
plan → market_search → search
search → matching_compute → matching
confirmation → booking_create → booking
booking → payment_capture → payment
incident → refund_issue/replacement_create → refund_replacement
completion → settlement_release → settlement
```

The command first persists `pendingAction`.

Only afterward is a resilience job enqueued.

This creates a recoverable ordering:

```text
workflow mutation committed
→ durable job enqueue
→ worker lease
→ adapter effect
→ effect receipt
→ workflow completion
```

## Crash boundaries

### 1. Crash after pending action commit, before queue enqueue

`resumePendingActions()` scans canonical workflows in `waiting_action` and recreates the deterministic job idempotently.

No workflow truth is lost.

### 2. Worker crashes after claim

The resilience engine uses a lease with expiry and generation fencing.

After expiry:

```text
worker crash
→ recoverExpiredClaims
→ retry/backoff
→ new lease
```

A stale worker cannot safely complete the newer claim.

### 3. External effect applied, response unknown

Effects use the canonical orchestration `actionId` as idempotency identity.

The fake adapters persist an effect receipt before returning `unknown_external_state` in the injected crash scenario.

Recovery performs:

```text
unknown external state
→ read effect receipt
→ receipt exists: proved_succeeded
→ receipt absent: proved_not_applied / safe retry
```

It never blindly creates a second payment/refund/settlement mutation.

### 4. Effect succeeded, workflow completion is replayed

The internal workflow completion command uses:

```text
action-complete:<actionId>
```

It is itself idempotent. Replaying the worker cannot advance the workflow twice.

## Retry / DLQ / human review

The orchestrator composes the pure `KlyxResilienceEngine`.

It inherits:

- bounded exponential backoff;
- leases;
- stale-claim recovery;
- duplicate/conflicting inbound-event handling;
- unknown external-state recovery;
- poison/permanent failure DLQ;
- explicit DLQ redrive;
- concurrent mutation fencing;
- fail-closed `human_review` when truth cannot be proved.

No resilience truth is kept only in a worker process.

## Economic Eligibility

GAGNER Settlement has an additional deterministic fence.

Before `settlement_release` can even become a pending action, the latest canonical workflow facts must prove economic eligibility is allowed.

```text
external payment adapter ready
+
KLYX economic eligibility blocked
=
no settlement action
```

The offline fake adapter proves this invariant without Stripe.

## Fake adapters

`lib/durable-orchestration-fakes.ts` contains only deterministic certification adapters.

### FakeSupabaseAdapter

Provides:

- durable workflow store abstraction;
- command idempotency registry;
- optimistic versions;
- audit events;
- deterministic non-financial effect receipts;
- fault injection.

### FakeStripeAdapter

Provides only:

- fake payment capture;
- fake refund;
- fake settlement transfer;
- idempotent receipt lookup;
- attempt/mutation counters;
- deterministic fault injection.

It has no Stripe SDK import and makes zero external calls.

### Faults

```text
retryable_before_apply
apply_then_unknown
permanent_before_apply
```

These exercise retry and prove-before-replay semantics deterministically.

## Certification

Run:

```bash
npm run test:durable:orchestration
npm run certify:autonomous:offline
```

The certification report proves per scenario:

```text
PASS / FAIL
externalNetworkCalls = 0
```

It covers:

- full DEMANDER lifecycle;
- full GAGNER lifecycle;
- browser/process restart;
- conversation deletion/rebind;
- LLM model replacement;
- double click / command replay;
- worker crash / lease recovery;
- action applied then unknown state;
- payment failure/retry;
- incident/refund/resume;
- beneficiary becoming ineligible before settlement.

## Supabase integration later

A future production Supabase adapter may replace `FakeSupabaseAdapter` only at the persistence boundary.

It must not redefine:

- states;
- transitions;
- idempotency semantics;
- action identities;
- version fencing;
- eligibility gate;
- resilience rules.

The durable engine remains the application-level state-machine authority.

## Safety

This engine and its certification introduce:

- no real Supabase access;
- no Stripe SDK access from the orchestration core;
- no LIVE credentials;
- no Vercel mutation;
- no production migration;
- no real financial mutation.

# KLYX End-to-End Autonomous Certification

Mission 19 certifies the KLYX product workflow itself, not merely infrastructure availability.

## Canonical lifecycles

### DEMANDER

```text
conversation
-> besoin
-> plan
-> search
-> matching
-> devis
-> confirmation
-> booking
-> paiement
-> mission
-> suivi
-> incident
-> refund/replacement
-> cloture
```

The canonical server state machine maps this to:

```text
intention
-> comprehension
-> plan
-> search
-> matching
-> quote
-> negotiation_confirmation
-> booking
-> payment
-> execution
-> tracking
-> incident
-> refund_replacement
-> closure
```

### GAGNER

```text
competence
-> opportunite
-> eligibility
-> proposition
-> acceptation
-> mission
-> completion
-> settlement
```

The canonical server state machine persists every provider-side phase explicitly:

```text
skill
-> opportunities
-> eligibility
-> proposal
-> acceptance
-> mission
-> completion
-> settlement
```

`completion` is mandatory. A provider workflow may not jump directly from `mission` to `settlement`.

Settlement is terminal only after explicit server-controlled completion backed by canonical booking, Settlement, central Ledger and reconciliation truth.

## Product continuity invariant

A KLYX workflow is server-owned canonical state. The browser, conversation and LLM are replaceable surfaces.

```text
browser state != workflow truth
conversation != workflow truth
LLM context != workflow truth
worker process != workflow truth
Stripe webhook arrival time != workflow truth
```

The workflow must be reconstructible from persistent server state and domain authorities.

## Required chaos matrix

| Scenario | Required invariant | KLYX authority / proof |
| --- | --- | --- |
| Browser closed then reopened | No critical state exists only in browser memory | `klyx_workflows`, domain tables |
| Conversation deleted | Workflow survives and can be rebound to a new conversation | `conversation_id ON DELETE SET NULL` + `klyx_resume_orphaned_workflow` |
| LLM model changed | Model cannot become mutation authority | deterministic state machine + server action policy |
| Webhook delayed | Arrival order/timing cannot create duplicate money/state | webhook event idempotency + reconciliation |
| Worker crash | Work remains claimable after lease expiry | durable jobs lease/fencing |
| Retry | At-least-once execution is safe through durable idempotency | `(job_type, idempotency_key)` |
| Double click | Same user intent cannot duplicate a domain mutation | workflow action idempotency + domain claims |
| Action replay | Same action identity returns/reconciles existing truth | workflow/domain idempotency keys |
| Price modified during workflow | Confirmed booking economics do not silently follow mutable catalog price | booking monetary snapshot; split price hash/snapshot |
| Beneficiary becomes ineligible before Settlement | No new transfer may be created | Economic Eligibility -> Settlement gate |

## Conversation deletion recovery

The original orchestrator migration intentionally uses:

```sql
conversation_id uuid references public.brain_conversations(id) on delete set null
```

Mission 19 adds an atomic recovery RPC. It may only select an orphaned active workflow matching the same account and profile, and optionally the same mode. It locks the row, binds the new conversation, increments workflow version and appends a `workflow_conversation_rebound` event.

This avoids two bad designs:

1. deleting a conversation deleting the actual workflow;
2. enforcing only one active workflow per profile, which would prevent legitimate parallel KLYX missions.

## Model replacement

The LLM may interpret and propose. It does not own transitions or execute sensitive mutations.

```text
LLM output
-> deterministic server validation
-> persistent action identity
-> domain authorization
-> domain mutation
-> canonical state
```

Changing the LLM must therefore be equivalent to replacing a planner, not replacing the database or financial authority.

## Price drift

For single bookings, the authoritative payment path must prefer the booking monetary snapshot:

```text
booking.subtotal_amount_minor
-> booking.estimated_amount_cents
-> booking.amount_total
-> legacy catalog fallback (test/backward compatibility only)
```

LIVE checkout requires the global-money snapshot. A later catalog price edit must not silently change the already-created booking amount.

For split missions, the confirmed `price_hash` + `price_snapshot` is the authority used by payment readiness/checkout.

## Crash, retry and replay

KLYX Durable Jobs intentionally promises at-least-once execution, not exactly-once delivery.

Safety therefore comes from:

```text
stable operation identity
+ idempotency key
+ atomic claim
+ lease token
+ retry
+ DLQ
+ domain reconciliation
```

A worker dying after a remote side effect but before local completion must be recovered by reconciling existing remote/domain truth. It must not create a second mutation.

## Settlement eligibility

For every NEW settlement money movement:

```text
canonical account/activity
-> economic eligibility
-> transaction risk
-> settlement claim
-> Stripe Transfer
-> reconciliation
```

`Stripe payouts_enabled = true` is insufficient. If KLYX eligibility becomes blocked before a new Transfer, release must remain blocked.

A previously-created remote Transfer discovered during recovery is reconciled; reconciliation is not a second money movement.

## Executable Mission 19 runtime evidence

The Golden Path now requires both Mission 19 chaos harnesses on the same candidate SHA.

```text
scripts/mission19-autonomous-continuity.mjs
-> browser close/reopen
-> LLM replacement
-> conversation deletion/rebind
-> double click/action replay
-> worker crash/lease recovery
-> retry/ack replay
-> price drift snapshot preservation
```

The provider-side local runtime proof runs after a real paid/completed mission lifecycle and proves ordering plus the fail-closed Settlement boundary:

```text
scripts/mission19-earn-lifecycle.mjs
-> active provider skill
-> canonical offer_services capability
-> real completed + paid booking
-> skill
-> opportunities
-> eligibility
-> proposal
-> acceptance
-> mission
-> completion
-> settlement
-> attempt terminal completion without released Settlement truth
-> BLOCKED
-> workflow remains active at settlement
```

This prevents a false certification where DEMANDER is exercised end-to-end but GAGNER exists only as static state-machine code. It also proves that `completed + paid` alone is not sufficient to close GAGNER.

Final GAGNER Settlement certification runs in Stripe TEST on the platform-held network scenario:

```text
accepted provider quote + booking
-> earn workflow acceptance
-> real TEST payment / charge
-> mission
-> domain completion
-> completion
-> fresh Economic Eligibility + Risk
-> settlement
-> real Stripe TEST Transfer
-> simulated lost DB response
-> beneficiary becomes KLYX-ineligible
-> recovery reconciles the existing Transfer only
-> booking_settlements = released
-> central Ledger contains the provider transfer
-> no open financial reconciliation
-> workflow settlement completed
```

The terminal RPC derives the booking from persistent workflow context. It must independently verify:

```text
booking provider == workflow provider
booking.status = completed
booking.payment_status = paid
booking.service_status = completed
booking_settlements.state = released
stripe_transfer_id exists
central financial ledger contains the matching provider transfer
no financial_reconciliation_current row remains in reconciliation/human_review
```

Caller payloads such as `settlement_truth: released` are audit context only. They are never authority.

The workflow may therefore become terminal only after KLYX has reconciled the exact Transfer that already exists at Stripe. A second Transfer is forbidden.

The signed Stripe lifecycle uses an event whose Stripe `event.created` is one hour older than delivery. KLYX must still process it once, persist the paid booking/ledger state, and reject replay idempotently.

```text
old Stripe event.created
-> signed delivery now
-> webhook claim
-> canonical payment state
-> processed event record
-> duplicate replay rejected
```

The final local-only settlement harness creates no Stripe object and performs no external money movement. It proves the authorization boundary directly:

```text
fresh economic ALLOWED
+ fresh risk ALLOW
-> release claim = create

same booking
-> claim reset before any remote side effect
-> newer economic BLOCKED
-> release claim = not_ready
-> release_attempt_number unchanged
-> stripe_transfer_id remains NULL
```

This final harness runs after the normal payment, finance, refund and split-reconciliation proofs so its isolated fixture cannot contaminate those validations.

## Certification rule

Mission 19 is certified only when the exact candidate SHA passes:

1. unit/integration contracts;
2. TypeScript;
3. production build;
4. existing payment/webhook/settlement golden paths;
5. controlled chaos evidence covering every row in the required chaos matrix;
6. Stripe TEST network evidence binding the GAGNER settlement step to the real provider Transfer, central Ledger and reconciliation truth.

Static contracts prove that the architecture contains the required boundaries. They are not, by themselves, runtime certification.

Any divergence must fail closed:

```text
block
-> reconciliation / recovery
-> human_review when deterministic recovery cannot prove truth
```
<!-- MISSION19_EXACT_SHA_DISPATCH_ANCHOR -->
<!-- MISSION19_EXACT_SHA_FINAL_DISPATCH -->
<!-- MISSION19_EXACT_SHA_FINAL_RETRY_2 -->
<!-- MISSION19_EXACT_SHA_FINAL_RETRY_3 -->

<!-- MISSION19_EXACT_SHA_DISPATCH_FINAL_20260921 -->

<!-- MISSION19_WEBHOOK_DIAGNOSTIC_EXACT_SHA -->

<!-- MISSION19_WEBHOOK_DIAGNOSTIC_EXACT_SHA_V2 -->

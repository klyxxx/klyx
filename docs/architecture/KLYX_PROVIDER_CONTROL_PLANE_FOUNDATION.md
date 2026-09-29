# KLYX Provider Control Plane Foundation

Status: foundation only. This layer does not activate a provider, change production credentials, mutate financial state, or silently reroute traffic.

## Goal

Canonical chain:

```text
provider registry
-> capabilities
-> adapter contract
-> health
-> quota
-> budget
-> rate limit
-> timeout
-> retry policy
-> fallback policy
-> circuit breaker
-> audit
-> observability
```

The control plane governs whether and how KLYX may attempt an external provider call. It never becomes domain truth.

## Authority invariant

```text
provider result != KLYX authority
```

Examples:

- Stripe remains an external payment rail; Ledger / Settlement / Economic Eligibility remain authoritative.
- Sumsub supplies verification evidence; KLYX eligibility decides whether activity or settlement is allowed.
- OpenAI can interpret/generate; it cannot authorize a sensitive mutation.
- Resend and elmah.io are non-authoritative delivery/telemetry providers.

## Files

- `lib/providers/control-plane-contracts.ts`
  - generic execution adapter contract;
  - health, quota, budget, rate-limit, timeout, retry, fallback and circuit-breaker contracts;
  - redaction-safe audit/metric contracts.
- `lib/providers/control-plane-registry.ts`
  - derives the registry from the existing canonical `KLYX_PROVIDER_CATALOG`;
  - maps failure semantics to explicit fallback actions;
  - defaults to **no quota/budget/rate-limit/timeout/circuit enforcement and one attempt** so this foundation cannot silently change current production behavior.
- `lib/providers/control-plane.ts`
  - deterministic admission controller;
  - rolling counters;
  - health state;
  - circuit state machine;
  - bounded execution wrapper;
  - safe retry gate;
  - audit and observability sinks.
- `tests/unit/provider-control-plane-foundation.test.ts`
  - registry/fallback contract;
  - quota/budget/rate-limit;
  - circuit breaker;
  - retry safety;
  - timeout + reconciliation requirement;
  - audit/metrics.

## Retry safety

Automatic retry is allowed only when all conditions hold:

1. the provider policy marks the error code retryable;
2. the adapter classifies the failure as retryable;
3. attempts remain;
4. the operation is either:
   - a retry-safe read; or
   - a mutation with provider-level idempotency **and a stable idempotency key**.

An unsafe mutation with unknown external outcome is never retried automatically:

```text
timeout / unknown outcome
-> stop automatic retry
-> requiresReconciliation = true
-> explicit recovery or human_review
```

This preserves the existing rule against blind POST retries.

## Fallback safety

Fallback is declarative. The foundation returns a fallback action; it does not execute a second provider automatically.

Default actions:

- Stripe / Supabase / Turnstile -> `block`;
- Sumsub / Twilio -> `human_review`;
- OpenAI / Resend / Tolgee -> `degrade`;
- elmah.io -> `continue_without_provider`;
- GitHub / Vercel -> `stop_control_plane`.

There is no automatic cross-provider financial failover.

## Health and circuit breaker

Health and circuit state are separate:

```text
health: unknown -> healthy | degraded | unhealthy
circuit: closed -> open -> half_open -> closed
```

Health can be fed by passive call outcomes or an explicit health probe. A provider may be unhealthy without blocking if policy says so. The circuit breaker is an execution guard and is enabled only when explicitly configured.

## Quota, budget and rate limit

- **rate limit**: request admission frequency;
- **quota**: provider-call allowance over a larger policy window;
- **budget**: spend envelope in one configured currency.

Budget admission can use estimated cost; actual cost is recorded after execution when known. Currency mismatches fail the budget check rather than converting implicitly. FX is outside this control plane.

## Audit and observability

The engine emits metadata only: provider, capability, operation, reason code, counters and circuit/health transitions. Provider request payloads, secrets, OTP codes, tokens, KYC documents and response bodies are never part of the audit contract.

The engine uses injected sinks so production persistence/telemetry can be connected later without coupling this foundation to Supabase, elmah.io or another vendor.

## Activation rule

This mission is intentionally non-invasive. Runtime enforcement must be activated capability-by-capability only after policy values and adapter semantics are certified. Exact provider quotas, budgets and limits must come from verified account/runtime data; they must not be guessed from public pricing.

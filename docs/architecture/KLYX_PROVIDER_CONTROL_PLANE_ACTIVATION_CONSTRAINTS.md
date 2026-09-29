# KLYX Provider Control Plane — Activation Constraints

The Provider Control Plane Foundation is intentionally **not a distributed production quota authority yet**.

## Current state ownership

The foundation keeps health, quota, budget, rate-limit, circuit-breaker and active-attempt state in the process that instantiated `KlyxProviderControlPlane`.

That is sufficient for:

- deterministic unit/integration certification;
- adapter contract enforcement;
- local recovery semantics;
- proving retry/fallback/circuit invariants.

It is **not** sufficient for globally authoritative enforcement across multiple Vercel/server/worker instances.

## Production activation gate

Before any quota, budget, global rate limit or circuit breaker is treated as production-wide truth, move the relevant counter/state behind a shared atomic store with deterministic compare-and-set / claim semantics and prove concurrency behavior.

Required proof:

```text
multiple instances
+ concurrent admissions
+ retries
+ worker restart
+ stale process state
+ duplicate result replay
-> one coherent provider policy decision
```

Until that migration is certified:

- provider registration and adapter contracts may be used;
- safe timeout/retry semantics may be adopted capability-by-capability;
- in-memory counters may be used for tests or instance-local protection;
- they must not be presented as a global spend cap, global quota, or global circuit-breaker authority.

## Financial providers

Stripe never receives automatic cross-provider failover. An unknown mutation outcome remains:

```text
block
-> reconciliation
-> retry only when external state is proven or provider idempotency makes retry safe
-> human_review when truth cannot be proven
```

The Provider Control Plane does not replace KLYX Ledger, Settlement, Economic Eligibility, LIVE authorization, Operations controls, or incident authority.

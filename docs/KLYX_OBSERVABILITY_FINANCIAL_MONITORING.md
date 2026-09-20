# KLYX Observability + Financial Monitoring

Mission 16 adds a read-only observability and financial-monitoring layer over canonical KLYX authorities.

## Boundary

Monitoring observes truth. It does not become truth.

Canonical authorities remain unchanged:

- Booking owns booking state.
- Canonical Financial Ledger owns accounting truth.
- Financial Reconciliation owns divergence / human-review truth.
- Settlement owns settlement state and Stripe reconciliation.
- Risk / Economic Eligibility own authorization.
- Durable Jobs owns durable execution state.
- Human Operations owns human case ownership and explicit manual redrive.
- Operations owns the append-only operational event stream.

Mission 16 introduces no financial mutation, no automatic refund, no automatic settlement release, no sanction and no kill-switch mutation.

Circuit breaking and incident state belong to Mission 17.

## Read-only projections

### `ops_observability_signals_current`

Derived operational signals include:

- failed Operations operations;
- error / critical Operations events;
- dead-lettered durable jobs;
- overdue Human Operations cases.

The projection carries correlation and structured failure-domain dimensions but does not copy canonical business payloads.

### `financial_monitoring_signals_current`

Derived financial signals include:

- unresolved financial reconciliation cases;
- Settlement `review_required`;
- Settlement `release_failed`;
- Settlement `release_claimed` as an informational observation;
- canonical ledger movements whose provider beneficiary remains explicitly unresolved.

A `release_claimed` row is not automatically considered stale in SQL. Staleness is evaluated by the monitoring server using an explicit runtime threshold.

Default:

```text
staleReleaseSeconds = 900
```

The threshold is bounded to 60–86400 seconds.

## Multi-currency monitoring

`financial_monitoring_flow_24h` groups canonical ledger movements by:

```text
currency + movement_type
```

For each group it exposes:

- movement count;
- total `amount_minor`;
- earliest occurrence;
- latest occurrence.

Amounts are never summed across currencies.

This preserves KLYX Global Money invariants, including currencies whose minor unit is not “cents” and zero-decimal currencies.

## Monitoring health

The server boundary is:

```text
lib/observability-financial-monitoring-server.ts
```

It reads the projections and returns:

- operational signals;
- financial signals;
- severity counts;
- 24h financial flow per currency / movement type;
- explicit monitoring policy values.

Health is derived only for operational visibility:

```text
critical signal present -> critical
error or warning present -> degraded
otherwise -> healthy
```

This health label has no authority to authorize, block or mutate business operations.

## Settlement release staleness

Settlement `release_claimed` is projected as informational.

The server elevates it to a warning only when:

```text
age_seconds >= staleReleaseSeconds
```

The derived reason code becomes:

```text
SETTLEMENT_RELEASE_CLAIM_STALE
```

This does not change Settlement state. Mission 17 may later consume the signal when implementing circuit breakers / incident handling.

## Founder API

Founder-only endpoint:

```text
GET /api/founder/operations/monitoring
```

Optional query parameters:

- `limit` — 1..500;
- `staleReleaseSeconds` — 60..86400.

The endpoint uses the existing Founder authorization boundary and sanitized API error handling.

## Security

The three Mission 16 views are read-only projections.

- `public`, `anon`, `authenticated`: no privileges;
- `service_role`: SELECT only;
- no Mission 16 SECURITY DEFINER mutation RPC;
- no browser mutation endpoint;
- no new public worker endpoint.

## Explicit non-goals

Mission 16 does not add:

- a second ledger;
- a second reconciliation system;
- mutable monitoring alerts as business authority;
- an incident table;
- automatic kill-switches;
- automatic DLQ redrive;
- automatic refunds;
- automatic settlement release;
- Stripe LIVE activation;
- Vercel mutation;
- production Supabase migration application.

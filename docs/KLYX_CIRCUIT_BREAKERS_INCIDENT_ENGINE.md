# KLYX Circuit Breakers + Incident Engine

Mission 17 adds explicit operational incident state and incident-owned circuit breakers.

## Authority boundary

Incidents coordinate response. They do not replace canonical truth.

Existing authorities remain canonical:

- Booking owns booking state.
- Canonical Financial Ledger owns accounting truth.
- Financial Reconciliation owns divergence truth.
- Settlement owns settlement state.
- Risk / Economic Eligibility own authorization.
- Durable Jobs owns durable execution state.
- Human Operations owns human case work.
- Operations `ops_capability_controls` remains the enforcement authority for kill-switch decisions.

Mission 17 never creates a second blocking authority.

## Incident lifecycle

```text
open
  -> acknowledged
      -> mitigating
          -> resolved
              -> closed
```

A direct `acknowledged -> resolved` transition is allowed when no mitigation phase is needed.

All transitions use optimistic version fencing.

An incident cannot become `resolved` or `closed` while an incident-owned circuit breaker link remains active.

## Circuit breaker ownership

Opening a breaker calls the existing Mission 13 RPC:

```text
klyx_ops_set_manual_control
```

with:

```text
scope_type = incident
scope_key  = incident_id
state      = DISABLED
```

The incident's structured scope dimensions are copied into the existing control plane:

- market;
- region;
- country;
- currency;
- payment provider;
- capability;
- dependency.

At least one structured dimension is required before an incident can open a breaker.

Using `incident_id` as the control scope key makes the control row incident-owned. Two incidents affecting the same capability therefore receive independent DISABLED controls.

Closing one incident's breaker changes only that incident-owned control to `ENABLED`. The existing control-plane invariant remains decisive:

> An ENABLED control never overrides another matching active DISABLED control.

Therefore resolving one incident cannot silently re-enable a capability still blocked by another incident or a manual Operations control.

## Breaker expiry

A breaker may have `expires_at` in the underlying control plane.

If the control expires or is otherwise no longer DISABLED while the incident link is still open, a repeated open request fails closed with:

```text
KLYX_OPS_INCIDENT_BREAKER_STALE_LINK
```

The operator must explicitly close the stale incident link before opening a new breaker.

## Audit

Mission 17 adds:

- `ops_incidents` — current operational incident coordination state;
- `ops_incident_events` — append-only incident history;
- `ops_incident_controls` — incident-to-control activation history;
- `ops_incidents_current` — read-only current projection.

Incident actions also append to Mission 13 `ops_events`.

## Founder boundary

Founder-only endpoint:

```text
GET  /api/founder/operations/incidents
POST /api/founder/operations/incidents
```

POST actions:

- `open`;
- `transition`;
- `open_circuit`;
- `close_circuit`.

No public worker or browser mutation boundary is introduced.

## Security

- RLS enabled on Mission 17 tables;
- public / anon / authenticated receive no table privileges;
- service role receives SELECT-only table/view access;
- mutations happen through SECURITY DEFINER RPCs;
- incident events are append-only;
- Founder authorization protects the HTTP API.

## Out of scope

Mission 17 does not:

- mutate Booking, Ledger, Settlement or Reconciliation truth;
- trigger Stripe transfers, refunds or payouts;
- auto-resolve financial divergences;
- auto-redrive DLQ jobs;
- infer incident decisions with an LLM;
- activate Stripe LIVE;
- mutate Vercel;
- apply production Supabase migrations.

Mission 18 owns Disaster Recovery Certification.

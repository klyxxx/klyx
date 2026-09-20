# KLYX Mission 13 — Operations Foundation + Failure Domains

## Invariant

**One failure domain must never disable more of KLYX than necessary.**

Mission 13 introduces the minimum control-plane primitives required before real
money activation can be considered. It does not add automatic circuit breakers;
those belong to Mission 17.

## Authority boundary

Operations does not replace domain truth.

Canonical Booking, Payment, Ledger, Settlement, Risk, Trust & Safety and
Incident records remain authoritative in their own domains. Operations stores
correlation data and references such as:

- `domain_type`
- `domain_resource_type`
- `domain_resource_id`
- `domain_event_id`
- `correlation_id`

It must not mirror a canonical domain payload and then treat the copy as a new
business authority.

There is deliberately no second universal `ops_audit_log`. Existing canonical
domain journals remain canonical. `ops_events` is an append-only operational
journal.

## Structured failure domains

The canonical model stores queryable dimensions:

- `failure_domain_type`
- `failure_domain_key`
- `market_id`
- `region_id`
- `country_code`
- `currency`
- `payment_provider`
- `capability`
- `dependency`

A readable value such as
`country:BR/payment_provider:stripe/capability:payments` may be derived for
logs and traces. It is not the only source of truth and must never be parsed
back to make authorization decisions.

KLYX currently has no canonical `markets` or `regions` tables in `main`, so
`market_id` and `region_id` intentionally remain structured text keys rather
than fabricated foreign keys. A later canonical market/region authority may
tighten those references additively.

## Manual scoped kill switch

`ops_capability_controls` is the pre-LIVE manual isolation primitive.

Examples:

```text
scope_type = country
scope_key = BR
country_code = BR
payment_provider = stripe
capability = payments
state = DISABLED
```

This blocks matching operations without implying that Belgium, France, search,
messaging, or other unrelated capabilities are unavailable.

Control semantics are intentionally fail-safe:

- any matching unexpired `DISABLED` control blocks;
- `ENABLED` never overrides another matching `DISABLED` control;
- no matching control means allowed;
- inability to obtain a valid control-plane decision is an application error,
  not an implicit allow;
- control changes are made through a server-only Founder boundary and produce
  an `ops_operations` row plus an append-only `ops_events` entry;
- controls are changed by versioned upsert, not deleted.

Automatic `CLOSED / OPEN / HALF_OPEN / FORCED_OPEN` breaker behavior remains
Mission 17.

## Security

The three Operations tables are server-only:

- browser roles receive no table privileges;
- `ops_events` grants only `SELECT, INSERT` to `service_role`;
- a trigger also rejects `UPDATE` and `DELETE` on `ops_events`;
- control RPCs are executable only by `service_role`;
- the HTTP mutation boundary requires `requireKlyxFounder()`.

## LIVE relationship

Mission 13 does **not** activate Stripe LIVE and does not rewrite any certified
Stripe engine.

Founder transaction readiness now checks:

1. Operations tables exist;
2. the Operations decision RPC is readable;
3. no matching scoped control blocks the Stripe `payments` capability.

Actual LIVE mutation boundaries must use the same fail-closed control-plane
decision when the separate LIVE activation mission is eventually performed.

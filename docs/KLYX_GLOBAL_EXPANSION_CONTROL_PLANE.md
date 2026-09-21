# KLYX Global Expansion Control Plane

## Purpose

The Global Expansion Control Plane makes geography and rollout a configuration problem rather than a code-branch problem.

A market such as Belgium, France, Brazil, the United States or Japan must be represented by reviewed data. No country becomes a permanent product branch.

This mission adds the ability to describe and progressively expose:

- a new market;
- a new country or jurisdiction;
- a new currency;
- a new payment rail/provider;
- a new activity;
- a new regulation;
- a new infrastructure region.

It does not open any market by default.

## Authority boundary

The expansion manifest is not a new business-truth authority.

Existing authorities remain canonical:

| Concern | Canonical authority |
| --- | --- |
| Money / tax / commission | klyx_market_payment_rules |
| Currency / payment-provider capability | klyx_payment_currency_capabilities |
| Economic identity / KYC-KYB | Economic Identity |
| Settlement authorization | Economic Eligibility |
| Account capability | account_actor_capabilities |
| Activity qualification | account_capability_qualifications |
| Risk decision | Risk Engine / transaction-risk decisions |
| Operational blocking | ops_capability_controls |
| Incident coordination | Mission 17 incident engine |

The Global Expansion Control Plane only declares rollout intent, feature availability and which external authorities must be consulted.

## Data model

### klyx_markets

Canonical market manifest:

- market_key;
- display name;
- jurisdiction;
- optional country;
- default currency;
- infrastructure region;
- rollout state;
- risk-policy reference;
- commission-policy reference;
- evidence reference;
- optimistic version.

New markets are always created as:

~~~text
DISABLED
~~~

No RPC can create a market directly in PILOT, LIMITED or GENERAL.

### klyx_market_requirements

Declarative requirements identify what must be checked:

- economic;
- activity;
- regulation;
- payment;
- tax;
- risk;
- infrastructure.

A requirement may point to:

- Economic Identity;
- account capability / qualification;
- market payment policy;
- payment-provider capability;
- Risk Engine;
- Operations;
- reviewed external evidence.

These rows do not issue KYC, qualification, settlement or risk decisions.

### klyx_market_features

Feature availability is market data.

Examples:

~~~text
market=fr feature=request_services rollout=PILOT
market=br feature=offer_services rollout=INTERNAL
market=jp feature=instant_quote rollout=TEST
~~~

These are examples only. This mission seeds none of them.

### klyx_market_control_events

Append-only audit for:

- manifest creation;
- config changes;
- rollout transitions;
- feature changes;
- requirement changes.

Business payloads must not be copied into this audit.

## Rollout state

Persistent rollout maturity is deliberately progressive and reversible one step at a time:

~~~text
DISABLED
  -> INTERNAL
  -> TEST
  -> PILOT
  -> LIMITED
  -> GENERAL
~~~

Controlled rollback is the reverse path.

Every upward transition requires explicit evidence.

### DEGRADED and SUSPENDED

DEGRADED and SUSPENDED are effective operational states, not stored rollout maturity.

That separation is intentional:

~~~text
rollout state  = product exposure maturity
health         = Operations / incident reality
effective state = composition of both
~~~

If a GENERAL market is temporarily degraded, KLYX must not lose the fact that its rollout maturity is GENERAL. Mission 17 remains the operational authority.

The effective state returned to callers is therefore one of:

~~~text
DISABLED
INTERNAL
TEST
PILOT
LIMITED
GENERAL
DEGRADED
SUSPENDED
~~~

## Effective decision

The server resolver composes:

~~~text
market rollout
AND feature rollout
AND declared market requirements
AND market payment policy when payment is required
AND payment/currency provider capability
AND Operations controls
AND incident health
~~~

For actor-specific or transaction-specific actions, the deterministic domain boundary must still run its canonical checks:

~~~text
Economic Eligibility
Activity Qualification
Risk
Booking / Settlement rules
~~~

A Global Expansion decision never replaces them.

GENERAL is not an authorization bypass.

For example:

~~~text
market rollout = GENERAL
Stripe capability = OK
Economic Eligibility = BLOCKED
=> action remains BLOCKED
~~~

Likewise:

~~~text
market rollout = GENERAL
Ops country control = DISABLED
=> effective state = SUSPENDED
~~~

## Legacy market readiness

lib/klyx-market-readiness.ts remains a fail-closed compatibility helper for the historical monetary catalogue.

Its in-code override map must not become the future Global Expansion authority. Reviewed rollout/configuration belongs in the server-side control plane.

The historical KLYX_SUPPORTED_MARKETS name still means monetary catalogue, not commercial launch permission.

## Security

- tables are server-only;
- browser roles receive no table access;
- service role receives read access;
- mutations happen through SECURITY DEFINER RPCs;
- HTTP mutation is Founder-only;
- rollout/config changes use optimistic version fencing;
- audit events are append-only;
- missing configuration fails closed.

## Operational scope

This mission does not:

- activate a country;
- activate a currency;
- activate a payment rail;
- create a Stripe account;
- perform a charge, transfer, refund or payout;
- override Economic Eligibility;
- override Risk;
- override activity qualifications;
- change Stripe LIVE state;
- deploy Vercel;
- apply Supabase production migrations.

Stripe LIVE remains unchanged.

This implementation creates control-plane capability only and does not deploy Vercel or Supabase production migrations.

## Invariant

> A country is data. A market is data. A rollout is data. Authorization remains with the domain that owns the truth.

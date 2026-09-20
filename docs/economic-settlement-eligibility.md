# KLYX Mission 11 — Economic Eligibility → Settlement Gate

Mission 11 adds the KLYX authorization boundary that decides whether a canonical account may receive a settlement for a specific activity, jurisdiction and transaction context.

## Authority order

```text
accounts.id
  + account_actor_capabilities
  + account_capability_qualifications
  + economic identity / verification / restrictions
  + Trust & Safety activity eligibility
  + canonical Stripe identity and provider projection
        ↓
canReceiveSettlement(...)
        ↓
allowed | human_review | blocked
        ↓
transaction-risk gate
        ↓
atomic release claim
        ↓
remote Stripe truth
        ↓
Stripe Transfer
```

The economic decision is necessary but not sufficient. The independent transaction-risk gate, atomic money claim and remote Stripe verification remain mandatory.

## Stripe is evidence, not authority

`payouts_enabled=true` is necessary evidence when present in the canonical provider projection, but it is never sufficient to authorize settlement.

An `allowed` decision also requires, among other applicable facts:

- canonical `accounts.id` with `offer_services` enabled;
- no blocking or human-review economic identity state;
- satisfied KYC/KYB/regulatory verification cases;
- no applicable economic restriction;
- no contradictory applicable account qualification;
- an applicable non-expired Trust & Safety activity-eligibility decision;
- no applicable Trust & Safety payout/platform restriction;
- a linked canonical Stripe identity matching the frozen settlement destination;
- a non-divergent economic Stripe projection with no current blocking requirements.

Immediately before a new Transfer, KLYX re-evaluates economic eligibility and reads remote Stripe recipient capability/status again.

## Group settlements

A group member may contain multiple bookings. Mission 11 evaluates each booking independently. It does not collapse several activities or jurisdictions into one inferred context.

The SQL claim requires a fresh `allowed` economic decision for every booking in the member before it accepts the independent transaction-risk allow.

## Reconciliation exception

Authorization gates control **new money movement**. They must not hide money that Stripe already moved.

If a prior attempt created an already-existing Stripe Transfer but local finalization was interrupted, KLYX first validates the remote Transfer truth and reconciles it locally. This reconciliation does not create another Transfer and therefore is not blocked by a later eligibility change.

## Data minimization

The Mission 11 decision ledger stores normalized statuses, ids, counts and reason codes only. It must not store raw identity documents, tax identifiers, full KYC payloads or private conversation content.

## Explicit non-scope

Mission 11 does not:

- enable Stripe LIVE;
- change settlement amounts;
- change refund or reversal economics;
- create a second capability or qualification authority;
- replace Trust & Safety activity eligibility;
- add a country-specific product boundary;
- deploy to Vercel.

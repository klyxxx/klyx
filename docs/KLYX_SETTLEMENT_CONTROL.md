# KLYX Settlement Control

## Decision

KLYX must not call a provider payout-risk gate while the current payment path still uses Stripe destination charges as its authoritative money-movement boundary.

The durable target flow is:

1. the customer pays KLYX;
2. Stripe confirms the platform charge;
3. the provider amount is recorded as held settlement truth in KLYX;
4. the mission reaches a release-eligible terminal state;
5. KLYX re-evaluates canonical account risk for the provider;
6. KLYX atomically claims the settlement release;
7. KLYX creates one idempotent Stripe Transfer tied to the source charge;
8. KLYX atomically finalizes the settlement with the Stripe transfer id;
9. Stripe handles the connected-account-to-bank payout according to the connected account's payout configuration.

This is a settlement gate, not an escrow product. Product copy and internal documentation must not describe KLYX as providing escrow.

## Current production boundary

General production financial traffic remains fail-closed until Mission 1 is certified. The legacy `connect_destination` flow is still available as a compatibility path, but the durable target is `platform_held`.

Mission 1 introduces a **controlled LIVE certification canary**, not a general LIVE override. `platform_held` with a LIVE Stripe secret is permitted only when the deployed Git SHA is also the DR-certified SHA and either:

- the exact SHA is explicitly armed for controlled certification, with every financial mutation restricted again to `KLYX_LIVE_CERTIFICATION_PROFILE_ID`; or
- Mission 1 has already produced `KLYX Production Financial Certification = success` for that exact SHA and general LIVE is explicitly enabled.

A missing/mismatched SHA, disabled canary, wrong client profile, unavailable Operations control plane, or absent financial certification remains fail-closed.

## Phase-1 database control plane

`booking_settlements` is server-only and stores one settlement unit per single booking:

- frozen provider profile and Stripe account;
- gross, platform fee and provider amounts;
- frozen currency and transfer group;
- Stripe checkout/payment/charge/transfer identifiers;
- monotonic settlement state;
- release attempt number and claim token;
- review/failure audit fields.

The table is not readable or writable by `anon` or `authenticated` roles.

### State machine

`pending_payment -> held -> release_claimed -> released`

Exceptional states:

- `review_required`: a human/risk decision is required before another claim;
- `release_failed`: Stripe or persistence failed before finalization; a later idempotent retry may claim again;
- `refund_pending` / `refunded`: settlement cannot be released;
- stale `release_claimed` claims become reclaimable after 10 minutes.

`released` is terminal for phase 1. A refund after release requires a transfer reversal/reconciliation path and must not be represented by simply changing the row back to `held`.

## Atomic release contract

`klyx_claim_booking_settlement_release` is the only supported claim boundary. It requires:

- booking `status = completed`;
- booking `payment_status = paid`;
- no refund in `processing` or `succeeded`;
- settlement state eligible for claim.

The claim increments `release_attempt_number`, records a unique claim token and prevents parallel Stripe Transfer creation.

After Stripe accepts the Transfer, `klyx_finalize_booking_settlement_release` persists the transfer id only when the claim token still owns the release. If Stripe fails before accepting the transfer, `klyx_fail_booking_settlement_release` releases the claim into `release_failed`.

Stripe Transfer creation must use an idempotency key derived from the immutable booking id and the claimed attempt number. When the PaymentIntent's charge is known, the Transfer must use that charge as `source_transaction`.

## Activation sequence

The following order is mandatory:

1. merge/certify the server-only control plane;
2. create settlement rows only for TEST `platform_held` charges;
3. implement canonical provider risk action `settlement_release`;
4. implement the single-booking Stripe Transfer side effect behind the atomic claim;
5. reconcile refunds before release and transfer reversals after release;
6. certify TEST network behavior, Golden Path, Security, Performance, E2E and UX on one SHA;
7. extend the same invariant to booking groups and split-payment units;
8. perform the required legal/accounting review of business-of-record, funds-flow and country constraints;
9. certify Operations, durable jobs, human review, observability, circuit breakers and Disaster Recovery;
10. deploy one exact SHA with general LIVE still OFF;
11. arm only the dedicated controlled-certification profile for that exact SHA;
12. certify all 40 Mission 1 production financial cells with `Ledger = Settlement = Stripe`;
13. only after that exact-SHA certification may general LIVE be enabled explicitly.

## Permanent non-goals

The settlement control plane does **not**:

- silently enable general Stripe LIVE;
- treat one successful payment as certification;
- change Express payout schedules as part of settlement certification;
- claim KLYX controls bank payouts;
- bypass Economic Eligibility, Risk, Operations or reconciliation;
- silently repair financial divergence;
- certify a SHA different from the deployed and DR-certified SHA.

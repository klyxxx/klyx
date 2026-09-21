# KLYX Live Readiness Gate

## Purpose

This gate is the final fail-closed checklist before any future Stripe Live
activation of Platform-Held settlement.

**General Live is OFF.** The automated network proofs in this document remain
strictly TEST-only. Mission 1 may arm a separate controlled LIVE certification
canary for one exact deployed/DR-certified SHA and one dedicated client profile;
that canary does not authorize general production financial traffic.

The gate is conjunctive:

`single + recovery + group + split + refunds + Trust & Safety + Stripe identity + reconciliation`

If any one proof is absent, stale, red, ambiguous, or based on a different
immutable SHA than the certification being accepted, **Live remains OFF**.

## Evidence already merged into `main`

| Gate | Evidence | Status |
| --- | --- | --- |
| single | TEST-only single-booking Platform-Held settlement introduced by #803 and integrated through #809 | proven in TEST |
| recovery | #813 Settlement Recovery / Reconciliation merged into `main` | proven in TEST |
| group | #817 multi-executor Group Booking settlement merged as `80ae8f09eefefab1733e0e0d20ef10911472c3e8` | proven in TEST |
| refunds | single + multi-executor refund/reversal engines, including partial + total refunds and reversal-before-refund | proven in TEST |
| Trust & Safety | deterministic account-level transaction risk gates and human-review outcomes; no LLM financial mutation | present |
| Stripe identity | canonical account-first Connect identity via `account_stripe_connect_identities`; legacy profile Stripe id is not authority | present |
| reconciliation | #813 Stripe-truth-first recovery plus group member/refund reconciliation before new writes | proven in TEST |

## Split certification in this PR

This certification does not create a second Split engine. It certifies the
multi-executor settlement engine already merged by #817 as the true Split
financial primitive.

The dedicated Stripe TEST network proof must demonstrate on one immutable PR
head:

- at least two distinct beneficiaries;
- one platform-held customer charge funding the split;
- frozen gross, KLYX commission and provider amount per beneficiary;
- deterministic cent rounding with exact aggregate reconciliation;
- at least three child bookings / multi-participant execution;
- independent, idempotent beneficiary Transfers;
- aggregate releases never exceeding frozen provider funds / captured charge;
- a beneficiary becoming Stripe-ineligible after payment and before release,
  isolated to review without losing sibling beneficiaries;
- explicit partial customer refund;
- matching partial provider Transfer reversal when funds were already released;
- total remainder refund;
- no reversal for an unreleased beneficiary;
- Stripe truth lookup before Transfer, reversal or refund creation;
- retry/reconciliation that does not mint duplicate Stripe side effects;
- TEST-only runtime in the automated Split proof; the proof workflow never uses
  `sk_live_*`.

## Final decision rule

The Split gate becomes **proven in TEST** only when this PR's exact immutable
head is green for:

- Security;
- Golden Path;
- Performance;
- Provider Storage Golden;
- exact Playwright browser verification;
- UX / Visual Certification;
- dedicated Stripe TEST true Split Settlement network proof.

Even after TEST certification and merge:

**KLYX general Stripe Live remains OFF.**

Mission 1 production certification is a separate, fail-closed gate. It requires
the exact deployed SHA to be DR-certified, general LIVE to remain disabled
during the canary, a dedicated certification profile, current production
migrations, and all 40 scenario/topology cells to satisfy
`KLYX Ledger = Settlement truth = Stripe truth`. Only a later explicit
general-LIVE activation for that same certified SHA may remove the canary-only
restriction.

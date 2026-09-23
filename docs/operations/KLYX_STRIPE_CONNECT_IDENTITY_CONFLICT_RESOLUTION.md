# KLYX Stripe Connect Identity Conflict Resolution

## Purpose

A canonical KLYX account may enter `account_stripe_connect_identities.identity_state = 'conflict'`
when historical profile-level Stripe mirrors disagree.

This state is fail-closed. KLYX must not select a Stripe account automatically.

Resolution is allowed only after an external financial review has identified one
Stripe account as the valid canonical account for the KLYX account.

## Authority

Use only:

`public.klyx_resolve_stripe_connect_identity_conflict(...)`

The RPC is executable only by `service_role`.

Do not resolve conflicts with ad-hoc direct updates to:

- `profiles.stripe_account_id`;
- `account_stripe_connect_identities`;
- booking settlement tables;
- the canonical ledger.

## Preconditions

Before invoking the RPC, prove all of the following:

1. the canonical KLYX row is currently `conflict`;
2. the exact recorded conflict set is known;
3. every conflicting Stripe account has been checked against Stripe in the
   correct mode;
4. the selected Stripe account is accessible to the KLYX platform and belongs
   to the expected KLYX economic identity;
5. the selected Stripe account has the required Recipient/transfer capability
   for its intended use;
6. every rejected Stripe account is proven stale, revoked, inaccessible, or
   otherwise non-authoritative;
7. the selected Stripe account is not already canonical or historical evidence
   for another KLYX account;
8. no LIVE money movement is required to perform the repair.

If any evidence is ambiguous, keep the conflict unresolved.

## Atomic repair

The RPC requires:

- `p_account_id`;
- `p_selected_stripe_account_id`;
- the exact `p_expected_conflicting_stripe_account_ids` set;
- a stable `p_reason_code`;
- a `p_correlation_id`;
- non-empty JSON evidence.

It then fails closed unless the database conflict and historical profile evidence
still match the supplied conflict set exactly.

If the checks pass, one transaction:

1. clears obsolete legacy `profiles.stripe_account_id` mirrors;
2. resets the cleared profiles' legacy Stripe readiness booleans to `false`;
3. links the selected Stripe account as the account-level canonical identity;
4. retains only profiles that actually carried the selected Stripe account as
   canonical source evidence;
5. clears `conflicting_stripe_account_ids`;
6. writes an append-only row to
   `account_stripe_connect_identity_resolutions`.

The RPC never copies the selected Stripe account onto unrelated profiles.

## Idempotent replay

`(account_id, correlation_id)` is unique.

If the caller loses the response after the transaction committed, replay the
**exact same** command with the same `correlation_id`.

KLYX returns the original resolution only when:

- selected Stripe account is identical;
- expected conflict set is identical;
- reason code is identical;
- canonical state is already `linked` to that selected account.

Reusing the correlation id with different semantics, or replaying it against an
unexpected canonical state, fails closed. Never generate a new correlation id
merely to bypass an ambiguous result.

## Post-resolution verification

Immediately after resolution, verify:

- canonical state is `linked`;
- canonical Stripe account equals the externally reviewed Stripe account;
- conflict array is empty;
- historical profile evidence contains only the selected Stripe account or
  `NULL` mirrors;
- the selected Stripe account does not appear under another KLYX account;
- global canonical conflict count is zero or every remaining conflict has a
  separate documented review;
- Stripe webhook reconciliation can update the selected canonical account;
- Economic Eligibility remains independent and still gates Settlement.

A successful identity resolution does **not** authorize Settlement and does not
arm Stripe LIVE.

## Evidence policy

The audit JSON must contain operational facts only, for example:

- Stripe mode checked;
- selected account accessible;
- Recipient transfer capability status;
- requirements due / not due;
- rejected account inaccessible or revoked;
- external review timestamp/reference.

Do not store secrets, bank details, personal addresses, full names, or other
unnecessary personal data in the audit JSON.

## Rollback / disagreement after resolution

Do not rewrite historical financial records.

If new contradictory identity evidence appears after resolution:

1. mark the account back for Connect identity review through the existing KLYX
   review path;
2. keep new financial mutation fail-closed;
3. investigate the new evidence;
4. use a new audited resolution only after explicit review.

An identity repair is operational metadata reconciliation, never a transfer,
payout, refund, booking, or ledger mutation.

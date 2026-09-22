# KLYX Stripe Connect Identity Conflict Resolution

## Authority

The canonical financial identity is:

`accounts.id -> account_stripe_connect_identities.stripe_account_id`

Legacy `profiles.stripe_account_id` values are historical compatibility
evidence only. They are never an independent LIVE financial authority.

## Why manual resolution exists

Multiple historical profiles under one canonical KLYX account may contain
different Stripe account ids.

KLYX must fail closed when that contradiction is first discovered.

It must not:

- pick the newest profile;
- pick the provider role automatically;
- pick the account with `payouts_enabled=true`;
- overwrite history silently;
- authorize Settlement because Stripe looks healthy.

A human-reviewed resolution may select exactly one Stripe account only after
independent provider evidence is verified.

## Resolution boundary

Founder route:

`/api/founder/stripe-connect-identities`

The POST boundary requires:

1. authenticated KLYX Founder;
2. `KLYX_STRIPE_MODE=live`;
3. a configured `sk_live_` key;
4. successful retrieval of the selected connected account from Stripe LIVE;
5. selected Stripe account already present in the recorded conflict;
6. selected Stripe account not already owned by another KLYX account;
7. structured reason code.

The route stores only non-PII readiness evidence:

- verification timestamp;
- country;
- business type;
- details submitted;
- charges enabled;
- payouts enabled;
- transfer capability state;
- requirement counts.

## Append-only audit

Every resolution creates a row in:

`account_stripe_connect_identity_events`

The journal records:

- canonical account;
- previous identity state;
- previous canonical Stripe account, if any;
- all conflicting Stripe account ids;
- selected Stripe account;
- operator;
- reason;
- non-PII verification evidence;
- timestamp.

UPDATE and DELETE are rejected by a database trigger.

## Stable manual authority

After an audited resolution:

`manually_resolved=true`

The compatibility reader may still read historical profile fields, but those
fields cannot revert the resolved canonical identity merely because old values
remain different.

If KLYX later receives genuinely new contradictory Stripe identity evidence,
the conflict is reopened and `manually_resolved` is cleared.

## What resolution does not authorize

Resolving identity does **not** imply:

- KYC/KYB verified;
- qualification valid;
- activity eligible;
- country allowed;
- risk allowed;
- Economic Eligibility allowed;
- Settlement allowed;
- LIVE enabled.

Settlement still requires the complete KLYX chain immediately before the
beneficiary Transfer.

## Production resolution procedure

For each conflict:

1. read the canonical conflict and historical evidence;
2. retrieve every candidate Stripe account through the KLYX LIVE platform key;
3. confirm the selected account is accessible and belongs to the intended KLYX
   economic identity;
4. record the reason code;
5. execute the Founder resolution boundary;
6. verify the append-only event exists;
7. re-read the strict canonical identity;
8. re-run Stripe readiness and Economic Eligibility;
9. do not arm LIVE unless all other readiness gates are green.

Never resolve a conflict solely to make the LIVE readiness page green.

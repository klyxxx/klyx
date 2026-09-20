# KLYX Economic Identity Foundation

Mission 10 introduces a canonical economic/compliance layer without changing financial execution.

## Authority boundaries

| Concern | Authority |
| --- | --- |
| Canonical KLYX user | \`accounts.id\` |
| Account actions | \`account_actor_capabilities\` |
| Qualifications | \`account_capability_qualifications\` |
| Mission/activity eligibility | Trust & Safety \`trust_eligibility_decisions\` |
| Canonical Stripe Connect identity | \`account_stripe_connect_identities\` |
| Economic/compliance facts | \`economic_identities\` and its child records |

The economic layer composes existing authorities. It does not create
\`economic_capabilities\` or \`activity_qualifications\`.

## Canonical model

\`\`\`text
accounts.id
   ↓
economic_identities
   ├── economic_legal_entities
   ├── economic_persons
   ├── economic_verification_cases
   ├── economic_stripe_account_projections
   ├── economic_restrictions
   └── economic_identity_events
\`\`\`

There is exactly one \`economic_identities\` row per \`accounts.id\`.

## Existing-authority composition

### Qualifications

\`account_capability_qualifications\` remains canonical. Mission 10 only adds
optional \`activity_key\` and \`jurisdiction_code\` dimensions and exposes the
read-only \`economic_activity_qualification_projection\`.

### Activity eligibility

\`economic_activity_eligibility_projection\` is a read-only latest projection
over \`trust_eligibility_decisions\`. It contains no independent evaluator and
does not write eligibility decisions.

### Provider verification

Existing \`provider_verifications\` and \`provider_verification_documents\`
remain intact. Read-only economic projections expose compatibility metadata.
The document projection intentionally omits storage paths and raw document
content.

## KYC/KYB and regulated verification

\`economic_verification_cases.status\` is multi-state:

- \`not_required\`
- \`required\`
- \`pending\`
- \`pending_external_review\`
- \`verified\`
- \`failed\`
- \`expired\`
- \`restricted\`
- \`human_review\`

A verification is never represented by a single \`verified boolean\`.

Final decision sources are limited to:

- \`trusted_provider\`
- \`deterministic_rule\`
- \`human\`

A language model may assist with classification or summarization elsewhere, but
it cannot be persisted as the final KYC/KYB, sanctions, or regulated-activity
decision source.

## Sensitive-data minimization

Prefer:

\`\`\`text
provider
external_reference
requirement_key
status
verified_at
expires_at
\`\`\`

over copying tax identifiers, identity documents, UBO documents, or complete
provider KYC payloads into KLYX.

Raw data should be stored by KLYX only when KLYX has a concrete product/legal
reason to become responsible for it.

## Stripe projection

Stripe remains an external financial provider.

The canonical Stripe binding still comes from
\`account_stripe_connect_identities\`. The economic projection records observed
facts such as:

- country;
- business type;
- details submitted;
- charges enabled;
- payouts enabled;
- \`currently_due\`;
- \`eventually_due\`;
- \`past_due\`;
- \`pending_verification\`;
- requirement errors / disabled reason;
- Stripe capabilities.

The database RPC re-checks the canonical account/Stripe binding before accepting
the projection.

\`payouts_enabled = true\` is only a provider fact. It is not KLYX permission to
perform any financial action.

## Restrictions

\`economic_restrictions\` contains economic/compliance restrictions only and is
separate from Trust & Safety \`trust_restrictions\`.

Scopes are data-driven:

- global;
- activity;
- jurisdiction;
- activity + jurisdiction.

No country list or Belgium-specific branch is encoded in the economic schema.

## Audit

\`economic_identity_events\` is append-only. Updates and deletes are rejected by
a database trigger. Sensitive raw evidence must not be copied into event
snapshots.

## Mission boundary

Mission 10 does **not** change financial execution.

It does not modify payment amounts, financial release logic, refunds, reversals,
or production payment activation.

Mission 11 will separately compose these facts into a deterministic economic
eligibility gate.

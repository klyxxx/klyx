# KLYX Provider Cost Control

## Invariant

A metered external provider must never receive a KLYX runtime call unless the KLYX cost authority has approved that provider for the current period.

```text
provider configured
!=
provider cost-authorized
```

The runtime path is:

```text
KLYX operation
-> claim_external_provider_cost
-> durable cost decision + audit event
-> outbound provider call only when allowed
```

The gate is fail-closed. Missing configuration, an inactive budget period, a missing estimate, or an exhausted budget blocks the outbound call.

## Governed providers

The first enforced metered providers are:

- OpenAI;
- Sumsub;
- Twilio;
- Resend.

Stripe is intentionally excluded. Stripe remains governed by the independent KLYX financial runtime, ledger, Economic Eligibility, settlement, reconciliation and explicit LIVE authority.

Tolgee runtime uses committed static snapshots and therefore does not require a runtime provider claim. Observability remains fail-open and must never stop user or financial execution merely because telemetry is unavailable.

## Modes

`disabled` is the default and permits no outbound provider call.

`free` requires an explicit approval record and is intended only when the audited account plan confirms that the applicable operation is covered without variable cost. It does not mean KLYX assumes a provider is free.

`budgeted` requires all of:

- ISO currency;
- period budget in minor units;
- conservative estimated cost per call in minor units;
- active period start/end;
- explicit approver and approval timestamp.

Each allowed call atomically reserves the configured estimate before the provider is called. A call that would exceed the period budget is denied. Provider prices are never hard-coded in application source; operations must update the estimate after provider-account audits.

## Audit

`ops_external_provider_cost_events` records every allowed or denied claim. Resend can pass its existing idempotency key so a replay of the same delivery does not reserve budget twice.

The reservation is deliberately conservative and is not an accounting ledger. Actual provider invoices/usage should be reconciled into the business-cost reporting process; this gate exists to ensure that paid runtime usage cannot start accidentally or exceed the configured reservation ceiling.

## Activation procedure

A provider may move from `disabled` only after an operator has verified the account plan and recorded the approved control. Production activation must remain independent from code deployment.

For a budgeted provider, configure the control in Supabase using a server-authorized operational path. Do not expose this mutation in browser or mobile clients.

Before PILOT or later rollout, verify:

1. the provider control is current;
2. the estimate is conservative for the provider account/plan;
3. the remaining budget is sufficient for the rollout cohort;
4. provider failure semantics match `KLYX_EXTERNAL_PROVIDER_CONTROL_PLANE.md`;
5. rollback to `disabled` has been tested;
6. Stripe LIVE authority remains a separate explicit decision.

## Rollback

Setting a governed provider back to `disabled` stops new outbound calls immediately while preserving all cost events and historical reservations. No audit row is deleted during rollback.

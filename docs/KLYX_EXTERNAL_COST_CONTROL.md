# KLYX External Cost Control Plane

## Objective

KLYX must not create an external bill merely because a secret is configured.

The cost control plane is an additional server-side fence around external providers. It does not replace provider-specific security, financial, compliance or LIVE authorities.

## Modes

### `zero` — default

`KLYX_EXTERNAL_COST_MODE` absent or anything other than `guarded`.

Paid runtime providers are blocked before their chargeable network boundary:

- OpenAI
- Sumsub
- Twilio
- elmah.io

Zero-cost/free-tier paths remain usable subject to conservative KLYX quotas and their existing authority boundaries.

### `guarded`

A paid provider is callable only when all conditions are true:

1. `KLYX_EXTERNAL_COST_MODE=guarded`
2. provider-specific `KLYX_COST_<PROVIDER>_ENABLED=1`
3. `KLYX_EXTERNAL_MONTHLY_BUDGET_USD > 0`
4. provider-specific `KLYX_COST_<PROVIDER>_MONTHLY_BUDGET_USD > 0`
5. sum of configured paid-provider budgets does not exceed the global budget
6. daily provider quota has capacity
7. 30-day provider quota has capacity
8. the durable quota authority is available

The USD values are governance envelopes, not vendor price calculators. Vendor prices are intentionally not hardcoded because they change and many calls have variable cost.

## Durable quotas

KLYX reuses the existing server-side Supabase-backed atomic rate limiter.

Each provider uses one shared bucket across all call types:

- `external_cost_<provider>_day`
- `external_cost_<provider>_30d`

This prevents splitting traffic across endpoints to bypass the cap.

Default conservative limits:

| Provider | Daily | 30 days | Zero mode |
| --- | ---: | ---: | --- |
| OpenAI | 30 | 300 | blocked |
| Sumsub | 5 | 20 | blocked |
| Twilio | 10 | 100 | blocked |
| Resend | 80 | 2400 | allowed |
| elmah.io | 100 | 2500 | blocked |

Limits can be reduced or raised explicitly with:

- `KLYX_COST_<PROVIDER>_DAILY_CALLS`
- `KLYX_COST_<PROVIDER>_ROLLING_30D_CALLS`

If the quota authority cannot prove remaining capacity, the external call is denied.

## AI routing

KLYX answers deterministic/common questions locally before considering OpenAI.

The OpenAI boundary additionally limits:

- serialized conversation size
- serialized context size
- maximum output tokens
- reasoning effort (`low`)
- timeout

This reduces variable-token spend without changing KLYX mutation authority.

## Degraded behavior

- OpenAI blocked/exhausted -> deterministic KLYX assistant
- Sumsub blocked/exhausted -> no external verification session; required economic eligibility stays blocked
- Twilio blocked/exhausted -> email/manual verification only when KLYX policy explicitly permits it
- Resend exhausted -> durable in-app notification/outbox
- elmah.io blocked/exhausted -> Vercel/runtime logs + KLYX internal logs

## Non-goals

This control plane does not:

- infer or hardcode volatile vendor prices
- enable Stripe LIVE
- replace KLYX Ledger or settlement truth
- weaken KYC/KYB requirements
- silently bypass Turnstile
- make a third-party provider authoritative

## Financial invariant

The cost plane cannot authorize a financial mutation. Existing KLYX financial authority remains mandatory:

```text
cost permission
+
financial authority
+
eligibility
+
LIVE authorization when applicable
=
external financial mutation may proceed
```

Cost permission alone is never sufficient.

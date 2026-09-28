# KLYX External Cost Control

Status: zero-budget baseline, 2026-09-27.

## Invariant

```text
external provider call
-> deterministic cost policy
-> durable quota reservation when metered
-> external call only if allowed

no reservation / no explicit budget
-> no potentially billable external call
```

KLYX has no `unlimited` cost mode. Runtime modes are only:

- `zero` (default): potentially paid providers are disabled; explicitly safe free-tier providers remain bounded below their free quota.
- `bounded`: paid providers remain disabled until that provider has explicit positive daily **and** monthly call limits.

Prices are deliberately not stored in runtime code because provider prices change. Limits are units/actions, while billing audits remain an operational responsibility.

## Zero-budget behavior

| Provider | Zero-budget behavior | Runtime fallback |
| --- | --- | --- |
| OpenAI | disabled | deterministic KLYX replies/engines |
| Supabase | allowed while Free-plan quotas hold | local Supabase + pure-engine fixtures for development |
| Stripe | TEST only; LIVE remains controlled by independent financial authority | Stripe TEST + pure-finance fixtures |
| Sumsub | new verification session blocked | local fixtures in development/test; production never fakes verified identity |
| Twilio | new SMS verification blocked | local OTP fixtures in development/test or another approved channel |
| Resend | max 90/day and 2700/month | durable in-app notification/outbox |
| Tolgee | runtime uses committed catalogs | committed locale catalogs |
| Cloudflare Turnstile | free provider path allowed | server rate limits only where policy permits degradation |
| elmah.io | disabled | Vercel/runtime logs + KLYX telemetry |
| Vercel | current control plane; keep platform hard caps enabled | local build/test; portable artifacts |
| GitHub | public standard Actions path | local Git + local certification commands |

## Bounded-mode activation

Set:

```text
KLYX_EXTERNAL_COST_MODE=bounded
```

A potentially paid provider still stays OFF until both of its limits are positive:

```text
KLYX_COST_OPENAI_DAILY_LIMIT
KLYX_COST_OPENAI_MONTHLY_LIMIT

KLYX_COST_SUMSUB_DAILY_LIMIT
KLYX_COST_SUMSUB_MONTHLY_LIMIT

KLYX_COST_TWILIO_DAILY_LIMIT
KLYX_COST_TWILIO_MONTHLY_LIMIT

KLYX_COST_ELMAH_DAILY_LIMIT
KLYX_COST_ELMAH_MONTHLY_LIMIT
```

Resend can be overridden if the account plan changes:

```text
KLYX_COST_RESEND_DAILY_LIMIT
KLYX_COST_RESEND_MONTHLY_LIMIT
```

Do not set these limits above the provider account's own free/paid hard cap without a separate billing review.

## Cost alerts

Durable metered calls emit local structured warnings at:

- 50%
- 80%
- 100%

These alerts use KLYX/Vercel logs rather than another paid provider, so cost-alert delivery cannot itself create an uncontrolled external bill.

At 100%:

- non-critical functions degrade/disable automatically;
- critical verification functions fail closed;
- KLYX never substitutes a fake KYC/OTP/payment success.

## AI cost path

```text
known/deterministic KLYX capability
-> local deterministic reply or existing deterministic engine
-> zero OpenAI call

unknown free-form conversation
-> OpenAI allowed only if openai_request quota is armed
-> GPT-5.6 Luna default
-> bounded context
-> bounded output
-> low reasoning effort
```

OpenAI is not a mutation authority and is never required for payment, KYC, eligibility, settlement or refund decisions.

## Durable quota authority

Supabase stores quota reservations in:

- `klyx_external_provider_usage_windows`
- `klyx_external_provider_usage_reservations`

Only `service_role` may reserve usage through:

- `klyx_reserve_external_provider_usage(...)`

Daily/monthly counters are atomic and shared across all Vercel instances. Browser/localStorage counters are forbidden because they can reset or be bypassed.

## Platform-level controls

Application-level cost gates do not replace vendor billing controls.

Keep these vendor-side controls enabled where available:

- Vercel: Spend Management alerts + hard pause/cap; Hobby automatically stops at free-tier limits.
- OpenAI: prepaid/limited API balance; no automatic unlimited recharge.
- Resend: stay on Free while within the KLYX 90/day + 2700/month envelope; do not enable pay-as-you-go without budget review.
- GitHub: standard runners only for the public repository; avoid larger paid runners.
- Supabase: keep the organization on Free until measured usage requires an upgrade.
- elmah.io: no active external calls in zero mode.

## CI/deployment optimization

KLYX should not create a production deployment merely to prove code correctness. CI runs first; production deployment follows only the central exact-main release gate. Duplicate production deployments for the same SHA should be treated as waste and investigated before any paid Vercel plan is enabled.

## Upgrade trigger

A provider moves from zero/free to paid only when all are true:

1. the capability cannot be served correctly by a local/free fallback;
2. measured user demand needs it;
3. a monthly budget exists;
4. daily and monthly KLYX limits are configured below the vendor hard cap;
5. cost alerts and vendor-side hard limits are active;
6. rollback to zero/degraded mode is proven.

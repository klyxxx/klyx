# KLYX External Cost Control

Audit date: 2026-09-26.

## Invariant

> No uncontrolled external invoice.

KLYX must remain developable and testable with **0 EUR available**.
A configured API key is never an authorization to spend.

The External Cost Control Plane is a decision/accounting layer. It does not replace `ops_capability_controls`, Stripe/ledger authority, economic eligibility, or any LIVE activation gate.

## Zero-budget defaults

- `KLYX_EXTERNAL_PAID_BUDGET_USD=0` unless explicitly changed.
- OpenAI, Twilio, Sumsub and elmah.io default to zero paid runtime budget.
- Sumsub also requires `KLYX_SUMSUB_PAID_SUBSCRIPTION_AUTHORIZED=1` because its public Basic plan carries a fixed monthly commitment.
- elmah.io requires `KLYX_ELMAH_PAID_SUBSCRIPTION_AUTHORIZED=1` before paid telemetry is considered authorized.
- Vercel Pro is modeled as a fixed-cost commitment and is never activated by runtime traffic.
- Resend is internally capped at **90/day** and **2700/month**, below its public Free limits of 100/day and 3000/month.
- Tests use local/mocked providers unless a dedicated certification explicitly opts into an external TEST path.

## AI routing

```text
question deterministic for KLYX
→ local deterministic answer
→ 0 OpenAI call

otherwise
→ OpenAI only if:
   KLYX_OPENAI_ENABLED=1
   + key exists
   + global budget > 0
   + provider budget > 0
   + daily/monthly call quota available
   + durable reservation succeeds

otherwise
→ local fallback
```

The default OpenAI model is `gpt-5.6-luna`, the cost-optimized GPT-5.6 tier. A more expensive model must be selected explicitly with `KLYX_OPENAI_MODEL`.

## Provider audit

| Provider | Current KLYX cost posture | Public free/price reference | Necessary calls | Avoid | Zero-cost fallback | Cache / batch | Replaceable | Paid threshold |
|---|---|---|---|---|---|---|---|---|
| OpenAI | $0 authorized by default | Luna: $0.20/M input, $0.02/M cached input, $1.20/M output; no permanent API free tier assumed | only non-deterministic reasoning | greetings, KLYX state/rules, deterministic decisions, repeated context | deterministic KLYX | deterministic cache; compact context; batch non-real-time work | yes | explicit global + provider budget and call limits |
| Supabase | target Free | Free: unlimited API requests, 50k MAU, 500 MB DB, 5 GB egress, 1 GB storage, 2 active projects | canonical DB/Auth/Storage/RLS/workflows | polling, unbounded SELECT, duplicate blobs | local Supabase for dev/CI | grouped reads, pagination, application cache | yes, migration expensive | review at sustained 75%, plan before 90% |
| Stripe | TEST only for development | TEST is free; Belgium LIVE standard EEA card pricing starts at 1.5% + EUR 0.25; Bancontact EUR 0.35 | real payment only after confirmation and LIVE authorization | LIVE tests, polling, duplicate sessions | Stripe TEST/fake adapters | idempotency + webhooks | partial | separate LIVE gate; never implied by API key |
| Sumsub | $0 authorized by default | Basic $1.35/verification with $149 minimum monthly commitment; Compliance $1.85 with $299 minimum | KYC/KYB only when eligibility requires it | early token creation, repeated verification | local fixtures in dev/test only | reuse verified state; webhook instead of polling | yes | explicit subscription authorization + budget >= commitment |
| Twilio Verify | $0 authorized by default | $0.05/successful verification + channel fees; SMS attempts are billable | phone proof only when required | convenience OTP, aggressive resend | test-only OTP fixture | cooldown/deduplication | yes | explicit provider + global budget and daily/monthly limits |
| Resend | Free tier | $0: 3000 emails/month, 100/day, 3 domains | critical transactional email | duplicates, email when in-app suffices | in-app notification/server log | idempotency, batch non-urgent mail | yes | internal 90/day + 2700/month; paid only after sustained need |
| Tolgee | runtime cost 0 | Free: 500 keys, 3 seats | development translation sync | runtime translation API calls | committed JSON catalogs | full build/runtime cache | yes | no runtime paid dependency |
| Cloudflare Turnstile | Free | Free: up to 20 widgets, unlimited challenges/verification requests | anti-bot challenge | paid Workers/features without need | KLYX server rate limits | browser/CDN caching | yes | remain on Turnstile Free |
| elmah.io | $0 new spend authorized | no permanent free tier; 21-day trial; Small Business $26/month | high-value server errors only | heartbeat/noisy telemetry when unpaid | Vercel/server logs | deduplicate and aggregate errors | yes | explicit paid-subscription authorization + budget |
| Vercel | develop locally at $0 | Hobby $0 for personal/non-commercial use; Pro $20/month with $20 usage credit | intentional production/preview deploys | deploy every commit, uncached dynamic work | local Next.js | CDN/data cache, grouped deploys | yes | explicit product/commercial need and spend controls |
| GitHub | $0 compute for current public repo standard runners | standard hosted runners are free/unlimited for public repos; larger runners billed | CI/certification | redundant workflows, long artifacts, larger runners | local git/tests | npm cache; combine matrices; short artifact retention | yes | standard runners only while public |

## Durable quota reservation

Two service-role-only tables store reservations:

- `external_provider_usage_daily`: daily action units;
- `external_provider_usage_monthly`: monthly action units and reserved maximum cost.

`klyx_reserve_external_provider_usage(...)` locks provider usage atomically before an outbound call. It checks, in one transaction:

1. daily unit limit;
2. monthly unit limit;
3. monthly cost budget.

If any next reservation would exceed a limit, the outbound call is not made.

## Alerts and circuit breaker

KLYX emits structured server markers at:

- **75%**: early cost/quota warning;
- **90%**: critical approach warning;
- **100%** or rejected next reservation: `KLYX_EXTERNAL_COST_CIRCUIT_OPEN`.

When the circuit is open, the external call is refused. Non-critical features fall back locally or skip delivery; critical functions fail closed rather than spending silently.

This cost circuit is not a second operational authority. `ops_capability_controls` remains the canonical operator kill switch.

## Development fallbacks at 0 EUR

- AI: deterministic/local KLYX response.
- DB/Auth: ephemeral/local Supabase.
- Payments: Stripe TEST/fake adapters, never financial LIVE.
- KYC: local fixtures for tests only, never production truth.
- Phone OTP: local test fixture only, never production bypass.
- Email: in-app notification/server log.
- Translation: committed catalogs.
- Observability: server/Vercel logs.
- Hosting: `npm run dev` / `npm run start` locally.
- CI: GitHub standard runners for the public repository.

## Paid activation rule

A paid provider is enabled only when all relevant conditions are true:

1. the product need cannot be met by the free/local path;
2. global monthly budget is explicitly non-zero;
3. provider monthly budget is explicitly non-zero;
4. daily/monthly unit limits are explicit where usage is metered;
5. monitoring + fallback/circuit breaker are operational;
6. any fixed subscription commitment has a separate explicit authorization;
7. Stripe LIVE, when applicable, passes its independent LIVE authority gate.

Budget configuration is authorization, not a target to spend.

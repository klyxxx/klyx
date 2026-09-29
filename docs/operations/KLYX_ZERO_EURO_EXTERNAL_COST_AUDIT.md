# KLYX Zero-Euro External Cost Audit

Audit date: 2026-09-29.

## Invariant

```text
0 EUR available
=> KLYX development + certification still work
=> paid/metered external providers are not implicitly called
=> deterministic KLYX result is preferred over an LLM call
=> non-critical delivery/generation degrades locally
=> critical external proof stays blocked rather than forged
```

Public list prices are audit context, never runtime cost authority. Exact account invoices are marked `unknown` unless observable from the connected account. Runtime budgets use operator-approved controls in `ops_external_provider_cost_controls`; provider prices are never hard-coded in application code.

## Current account / public-price matrix

| Provider | Current observable cost/state | Public free quota / list price | Necessary calls | Avoid / remove | Free fallback | Cache | Batch | Replaceable | Paid threshold for KLYX now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI | Exact KLYX invoice/usage not observable | GPT-5.6 Terra: $2/M input, $0.20/M cached input, $12/M output | Open-ended language/reasoning only after deterministic KLYX handling cannot answer | Cosmetic rewrite of deterministic answers; shadow calls outside explicit experiments; repeated equivalent prompts | Deterministic KLYX reply + deterministic intent/rules | Yes: stable instructions/context benefit from provider prompt caching; KLYX may also cache safe non-personal deterministic results | Offline/non-interactive workloads may use provider batch APIs; interactive assistant must not wait for a batch | Yes, behind the KLYX LLM adapter | **$0 by default.** Keep provider control `disabled`; enable only with explicit period budget and conservative per-call estimate |
| Supabase | Connected project `supabase-amber-ferry` is ACTIVE_HEALTHY; provider audit records Free plan / $0 base | Free plan available; paid Pro begins at published $25/mo | Canonical DB/Auth/Storage and durable KLYX authorities | Duplicate reads, polling, unbounded result sets, unnecessary realtime subscriptions | Local Supabase / fakes for development and certification; never a transparent production-write fallback | Yes: application/read caching only where stale data cannot violate authority | Yes: bulk SQL/RPC and grouped reads/writes where semantics allow | Yes long-term, but expensive migration; not transparent during writes | Remain on Free until measured DB/storage/egress/auth limits require paid capacity; do not upgrade pre-emptively |
| Stripe | Connected KLYX LIVE balance currently EUR 0 available / 0 pending; this does not prove a zero invoice | Standard Belgium has no setup/monthly fee; transaction pricing applies only when real payments execute | Checkout/payment/refund/Connect/settlement operations that are explicitly authorized | Polling when webhooks/reconciliation already provide truth; duplicate status reads; LIVE test traffic | Stripe TEST + fake adapters; no production-money fallback | Cache read-only capability/config metadata briefly; never cache financial truth as authority | Do not batch irreversible financial mutations; reconciliation reads may be grouped | Yes only behind financial adapter after reconciliation/certification | No paid subscription threshold. Cost starts with real successful payment activity; Stripe LIVE remains separately gated |
| Sumsub | Exact account bill/plan not observable | Basic public list price $1.35/verification with $149 minimum monthly commitment | KYC/KYB only when policy/legal/activity eligibility actually requires external evidence | Verification at signup when activity does not require it; repeated checks while existing proof remains valid | Local fake evidence for tests; human/manual evidence workflow in production, with eligibility blocked until valid proof | Cache verified evidence/status according to expiry and compliance policy; never cache beyond validity | No KYC batching for user-facing verification; backend reconciliation may group status reads | Yes behind identity-verification adapter | **Do not activate paid plan while budget is 0.** Provider control stays `disabled`; activate only when real regulated demand justifies monthly commitment |
| Twilio Verify | Exact account usage/bill not observable | $0.05 per successful verification + channel fees; free trial available | Phone OTP only when phone proof is required | OTP on every login/action; resend before cooldown; duplicate verification sessions | Email/manual policy only where explicitly allowed; deterministic local OTP fixtures for tests only | Cache verified-phone state subject to policy; never cache OTP codes as reusable proof | No OTP batching | Yes behind phone-verification adapter | **$0 by default.** Enable only with explicit budget; use cooldown/rate limits before every send |
| Resend | Connected usage: 15/3,000 emails this cycle and 1/100 today; limits match Free plan | Free: $0, 3,000 emails/month, 100/day, 3 domains; paid Pro $20/mo for 50k | Security/transactional messages that cannot be represented only in-app | Cosmetic/duplicate notifications; repeated delivery without idempotency; high-frequency status mail | Durable in-app notification/outbox + server log; delivery becomes `skipped` when cost gate blocks | Cache templates/rendering; not delivery results as business truth | Yes: digest non-urgent notifications; transactional security mail stays immediate | Yes behind email-delivery adapter | Stay Free. Do not move to paid until sustained real need approaches free quota and business value justifies it; provider control can remain disabled during 0-EUR development |
| Tolgee | Exact cloud account invoice unknown; runtime does not depend on Tolgee Cloud | Cloud Free: €0, 500 keys, 3 seats; committed catalogs are already local runtime source | Translation authoring/sync, not request runtime | Runtime translation API calls | Committed `messages/tolgee` catalogs; local authoring; self-host when justified | Full runtime cache is the committed catalog | Pull/push catalogs in build/authoring batches | Yes; can self-host or replace authoring tool | Keep cloud Free while within authoring limits; no paid runtime dependency |
| Cloudflare Turnstile | Exact account invoice unknown | Free plan: unlimited challenges, up to 20 widgets, 10 hostnames/widget | Public auth anti-abuse challenge when policy requires it | Challenge on trusted/internal flows where server abuse controls suffice | Explicit server rate-limit policy only; never silently bypass protected auth | Verification tokens must not be reused/cached as proof | No useful challenge batching | Yes, but replacement must preserve bot-proof boundary | Remain Free until enterprise-only compliance/scale features are genuinely required |
| elmah.io | Connected account previously reported `Starter`; exact current invoice is unknown | Current exact account charge cannot safely be inferred from public pricing | Production error/uptime telemetry only | Duplicate verbose success logs, high-cardinality noise, development telemetry | Vercel/runtime logs + KLYX internal operations telemetry | Aggregate/reduce duplicate error fingerprints | Prefer aggregation/deduplication over per-event noise | Yes; observability is non-authoritative | Runtime calls may be disabled without breaking KLYX, but a fixed subscription must be downgraded/cancelled in the provider account to remove its fixed bill |
| Vercel | Connected team/project verified; exact account plan/invoice not exposed | Hobby $0; Pro public list $20/mo and includes usage credit | Current hosting/deployment and runtime | Redundant previews/builds; unnecessary image transforms/functions/polling | Local Next.js for development; portable deployment artifacts | CDN/Data Cache where authority/staleness rules permit | Consolidate CI/builds and avoid duplicate deployments | Yes, with explicit hosting migration | Use free development path while eligible; commercial production must follow Vercel plan terms and measured usage rather than assuming Hobby forever |
| GitHub | Connected public repository; exact account invoice not exposed | GitHub Free $0; Actions minutes are free for public repositories; Team public list $4/user/mo | Source, protected CI, release evidence | Duplicate workflows that certify identical artifacts; repeated expensive matrices without new risk coverage | Local Git + local certification; running production is independent from GitHub availability | Dependency/build caches inside CI | Yes: combine compatible tests/builds into one exact-SHA certification run | Yes, source/CI portable | Keep repository/Actions on free public usage while viable; set platform budget/spend limits to zero for optional metered features |

## Official pricing references checked

- OpenAI: https://developers.openai.com/api/docs/models/gpt-5.6-terra
- Supabase: https://supabase.com/pricing
- Stripe Belgium: https://stripe.com/en-be/pricing
- Sumsub: https://sumsub.com/pricing/
- Twilio Verify: https://www.twilio.com/en-us/verify/pricing
- Resend: https://resend.com/pricing
- Tolgee: https://tolgee.io/pricing
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/plans/
- Vercel: https://vercel.com/pricing
- GitHub: https://github.com/pricing

## Zero-Euro runtime profile

The safe baseline is deliberately conservative:

```text
OpenAI      disabled -> deterministic KLYX
Sumsub      disabled -> eligibility remains blocked when external proof is required
Twilio      disabled -> alternate proof only when policy permits
Resend      disabled -> in-app/durable notification; email skipped
Tolgee      no runtime dependency -> committed catalogs
Stripe      TEST/fakes for development -> LIVE authority unchanged/off unless separately authorized
Supabase    current free authoritative backend -> local Supabase for isolated development/certification
Turnstile   free tier
elmah.io    optional/fail-open -> local/Vercel logs
Vercel      free/local development path
GitHub      free/public source + CI path
```

A credential existing in an environment **never** authorizes spend.

## AI routing

```text
request
-> deterministic KLYX state/rules/search/booking result available?
   -> YES: serve local deterministic answer
   -> NO: is OpenAI explicitly cost-authorized for this period?
      -> NO: deterministic/degraded fallback
      -> YES: reserve budget atomically
         -> allowed: call model
         -> denied/error: fallback, no provider call
```

Cosmetic rewriting of already-valid deterministic KLYX replies is disabled by default. It requires `KLYX_AI_REPHRASE_DETERMINISTIC=1` **and** a successful OpenAI cost claim.

## Cost controls

- Default provider state is `disabled` for OpenAI, Sumsub, Twilio and Resend.
- `free` requires an explicit operator approval based on the actual account plan.
- `budgeted` requires an ISO currency, a bounded period, a period budget, a conservative estimated cost/call and explicit approval.
- Budget is reserved atomically **before** an outbound metered call.
- Denial, missing control, expired period or unavailable cost authority means no outbound call.
- Resend is non-authoritative and degrades to `skipped`; OpenAI falls back locally; Sumsub/Twilio remain fail-closed.
- Local warnings are emitted at 75%, 90% and 100%/blocked. Alerts themselves do not call another paid provider.
- Existing durable API rate limits remain the request-rate authority; this cost plane does not create a second rate-limit store.
- Existing Mission 17 `ops_capability_controls` remains the operational circuit-breaker authority. The cost gate is only permission to incur provider usage.

## Caching and batching rules

Cache only data whose staleness cannot create a false financial, identity, booking or eligibility decision. Never turn cache into authority.

Batch only independent/read-oriented work. Never batch/replay irreversible external mutations merely to reduce cost. Idempotency/reconciliation requirements remain stronger than batching efficiency.

## Threshold policy

KLYX uses three internal warning levels for budgeted providers:

- 75%: warning;
- 90%: critical warning / prepare degradation;
- 100% or next reservation would exceed budget: deny the call and open the local cost circuit marker.

Non-critical features degrade automatically. Critical proof providers fail closed. No budget overrun is converted into a silent paid upgrade.

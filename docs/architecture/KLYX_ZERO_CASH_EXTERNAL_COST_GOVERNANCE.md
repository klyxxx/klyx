# KLYX Zero-Cash External Cost Governance

Audit date: 2026-09-29.

Goal: KLYX must remain developable and testable with **0 EUR available**, while external paid capabilities fail closed or degrade without inventing business truth.

## Hard invariant

```text
missing budget / unknown billing / exhausted free tier
=> no new uncontrolled paid external call
```

Current default:

```text
KLYX_EXTERNAL_COST_MODE missing or invalid
=> zero_cash
```

`zero_cash` blocks OpenAI, Sumsub, Twilio and elmah.io external calls, blocks Tolgee runtime dependency, permits Stripe only in TEST, and keeps free-path Supabase / Resend / Turnstile plus GitHub/Vercel control-plane access available.

`guarded` is an explicit future paid-mode opt-in. It is **not** financial authority and must not be enabled for production paid providers until persistent budgets/provider hard caps are certified.

## Current observed account state

- **Supabase**: last connected audit on 2026-09-28 proved the KLYX organization on Free, `$0/month` base. The current Free limits are 50,000 MAU, 500 MB DB, 1 GB storage, 5 GB egress + 5 GB cached egress, 500,000 Edge Function calls and 2 million Realtime messages.
- **Stripe**: connected LIVE account currently has no observed balance transactions. Observed transaction fees are therefore `0`, not a guarantee that the account has no other invoice item. KLYX financial LIVE remains a separate explicit authority.
- **Resend**: connected usage observed on 2026-09-29 is `1/100` daily and `15/3000` monthly emails, with API rate limit `10 req/s`. This matches the public Free envelope.
- **elmah.io**: connected KLYX organization reports plan label `Starter`, but the connector cannot return current subscription/usage details. Public elmah.io documentation states there is no permanent free plan after the trial. Treat this as a possible fixed-cost risk until billing is manually verified/downgraded/cancelled.
- **Vercel**: connected KLYX team/project exists, but the connector does not expose its billing plan. Hobby is `$0`, but Vercel restricts Hobby to personal/non-commercial use; it is not a valid long-term free production strategy for commercial KLYX.
- **GitHub**: KLYX repository is public. Standard GitHub-hosted Actions runners are free for public repositories. Larger runners and excess storage are different billing surfaces and must remain disabled/unneeded.
- Other exact account invoices are not observable from the connected tools; no cost is invented.

## Provider-by-provider cost audit

| Provider | Current/known cost | Free quota / zero-cost envelope | Marginal cost per user/action | Calls actually needed | Calls to avoid | Free fallback | Cache | Batch | Replaceable? | Threshold before paid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **OpenAI** | Exact account spend unknown. `zero_cash` now blocks calls. | API Free tier is not supported for GPT-6 Luna. | GPT-6 Luna: `$0.10 / 1M` input tokens, `$0.50 / 1M` output tokens in Standard short-context pricing. Example 1k input + 500 output ~= `$0.00035`. | Only non-deterministic interpretation/generation where local KLYX rules are insufficient. | Greetings, KLYX help, generic service-start, budget prompts, health pings, unnecessary vision. | Deterministic local KLYX response; description-assisted photo flow. | Prompt/output cache only for non-personal reusable facts; never cache sensitive/user-specific truth globally. | Batch/Flex only for asynchronous non-interactive work; not chat latency path. | Yes, behind LLM capability contract. | **Now: 0 paid calls.** Later enable only with explicit certified spend budget. Default paid model: GPT-6 Luna. |
| **Supabase** | Last connected audit: Free `$0/month` base. | 50k MAU; 500 MB DB; 1 GB storage; 5 GB egress + 5 GB cached; 500k Edge Function invocations; 2M Realtime messages. | `$0` marginal while within Free limits. | Authoritative DB/Auth/Storage calls needed for KLYX state. | Duplicate polling, repeated full-row reads, unnecessary realtime subscriptions, storing derived blobs twice. | Local Supabase / fake adapters for development and certification. Production authoritative writes do not silently fall back. | Cache public/read-heavy derived data; never cache authorization/eligibility as authority. | Batch DB reads/writes where semantics permit. | Technically yes, but high migration cost. | Alert at ~80% of any Free quota. Upgrade only when sustained real usage approaches hard limits; Pro starts at `$25/month`. |
| **Stripe** | Connected LIVE account currently shows zero balance transactions. | TEST mode is free and is the only Stripe mode allowed by `zero_cash`. | Belgium standard EEA card: `1.5% + EUR0.25`; Bancontact `EUR0.35` per successful charge. | Payment/Connect/refund/transfer only when actual financial workflow requires it. | Health charges, duplicate PaymentIntents, repeated retrieval when local reconciled state is sufficient. | Stripe TEST + deterministic fake adapters. No alternate rail during unknown financial state. | Cache immutable/reference metadata only; never treat cached payment state as financial truth. | No unsafe batching of financial mutations; reconciliation reads may batch safely. | Yes before execution; not during uncertain live transaction. | LIVE only after explicit LIVE gate and revenue-bearing transaction; fee must be covered by unit economics. |
| **Sumsub** | Exact KLYX bill unknown. Public Basic: `$1.35/verification` with `$149 minimum/month`. | No sustainable production free tier assumed. | `$1.35+` per verification, subject to minimum commitment/add-ons. | Only when legal/economic eligibility actually requires KYC/KYB proof. | Creating applicants/tokens before eligibility flow reaches verification requirement; repeated checks already backed by valid evidence. | Fake adapter in dev/test; human/manual evidence path where policy allows, while eligibility stays blocked until proof exists. | Cache bounded non-sensitive verification state/evidence references until expiry; never cache approval beyond policy validity. | Batch is not appropriate for interactive identity mutation; back-office screening may use provider features later. | Yes behind identity-verification contract. | **Now: blocked.** Consider paid plan only when compliance need is real and volume/unit economics justify the monthly minimum (~111 Basic verifications at list unit price). |
| **Twilio Verify** | Exact KLYX usage/bill unknown. | Trial exists, but KLYX does not treat trial credit as a reliable free budget. | `$0.05` per successful verification + channel fees; SMS attempts can also incur channel cost. | Phone OTP only when phone verification is a real product/compliance requirement. | OTP on every login, duplicate sends, automatic retry after uncertain POST timeout. | Email/manual alternative only when explicit KLYX policy allows; dev/test uses mocks. | Do not cache OTP secrets; cache cooldown/verified-phone state according to policy. | No batching for OTP. | Yes behind phone-verification contract. | **Now: blocked.** Enable only when phone verification is materially required and a per-verification budget is approved. |
| **Resend** | Connected usage: `15/3000` monthly, `1/100` daily; current Free envelope `$0/month`. | 3,000 emails/month, 100/day, 3 domains, 10k automation runs. | `$0` while Free limits hold. Paid Pro starts `$20/month`; paid overage `$0.90/1k`. | Transactional messages that add value beyond durable in-app state. | Duplicate confirmations, polling emails, low-value status noise. | Durable KLYX in-app state/outbox; email failure is non-authoritative. | Template/static content cache; recipient-specific delivery not shared-cacheable. | Digest non-urgent notifications where product semantics allow. | Yes. | KLYX soft cap: **90/day** and **8 req/s**; this stays below both connected daily and API rate limits. Move paid only when sustained email need exceeds Free limits. |
| **Tolgee** | Exact account bill unknown. Public Free `EUR0`; Team `EUR49/month` billed annually. | Free: 500 keys, 3 seats. | Runtime marginal cost should be `0` because app uses committed catalogs. | Authoring/sync during localization workflow only. | Runtime lookup per request/user. | Committed static translation snapshots; self-hosting is possible. | Full static cache/CDN. | Batch translation sync in development/release. | Yes. | Stay static/free until >500 managed keys or >3 active localization seats genuinely require cloud paid features. |
| **Cloudflare Turnstile** | Public Free plan is free; exact account bill not independently observed. | Up to 20 widgets, 10 hostnames/widget, unlimited challenges/verification requests. | `$0` on Free. | Public abuse/bot challenge on protected auth surfaces. | Re-challenging trusted flow unnecessarily; duplicate server verification. | Explicit server anti-abuse/rate-limit policy; never silently bypass protected production auth. | Cache configuration, never cache challenge validity across uses. | No. | Yes with equivalent anti-abuse contract. | Free is enough until enterprise-only anti-bot/compliance features are actually required. |
| **elmah.io** | Connected plan label `Starter`; exact invoice unknown. Public docs say only a trial is free. | 21-day trial only; no permanent public free plan. | Fixed-plan economics rather than a useful zero-cost per-call envelope. | None required for KLYX correctness. Only exceptional production observability if paid plan is intentionally retained. | Routine heartbeat/error duplication already available in platform/runtime logs. | Vercel/runtime structured logs + KLYX audit/metrics. | Aggregate/deduplicate repeated errors locally where useful. | Batch export/reporting rather than per-event external posts if re-enabled. | Yes. | **External calls now disabled in `zero_cash`.** To guarantee total account cost `0`, manually verify and cancel/downgrade any existing paid subscription; code cannot cancel a fixed subscription. |
| **Vercel** | Connected team/project, exact account plan/bill not exposed. Hobby `$0`; Pro `$20/month` + usage. | Hobby includes 1M Edge Requests/month and 100 GB Fast Data Transfer, but is personal/non-commercial only. | `$0` within Hobby caps for eligible personal use; commercial Pro has base/usage economics. | Deploy/serve production if Vercel remains hosting provider. | Excess previews, uncached expensive server work, unnecessary build churn and optional paid add-ons. | Local Next.js for dev/test; architecture remains portable to another host. | Aggressive static/CDN caching where semantically safe. | CI/build coalescing; avoid duplicate deployments. | Yes, with migration work. | **0 EUR development/test must be local.** Do not rely on Hobby for commercial KLYX. If KLYX is on Pro, set Vercel hard spend limits/alerts; exact current plan must be verified in billing UI. |
| **GitHub** | Public repository; exact account subscription unknown. GitHub Free `$0`; Team `$4/user/month`. | Standard GitHub-hosted Actions are free for public repos. Free plan includes 500 MB Actions/package storage; cache 10 GB/repo. | Standard public-repo runner minutes `$0`; larger runners are billable. | Source control, PR checks and release gates. | Larger runners, duplicate CI matrices, long artifact retention, redundant full certifications on irrelevant changes. | Local git/build/test; mirror/export if GitHub unavailable. | Actions dependency/npm caches within quota. | Combine compatible verification steps and path-filter heavyweight jobs. | Yes for source hosting, with operational migration. | Keep repo public + standard runners + bounded artifact retention. Configure GitHub metered-product budgets with **stop usage at limit** if any billable feature is enabled. |

## IA: local first, external only when justified

Canonical path:

```text
question deterministic KLYX
  -> local rule / deterministic response
  -> cost = 0

otherwise
  -> zero_cash ? deterministic safe fallback : external LLM
```

Implemented deterministic local classes include:

- greeting;
- what KLYX can do / how KLYX works;
- generic price/budget setup;
- generic service/reservation-start prompt;
- empty input guidance.

OpenAI direct transport, photo vision and admin health probes are also guarded, so a secondary route cannot bypass the financial circuit breaker.

When paid AI is eventually enabled, the current default model is `gpt-6-luna`, chosen because it is the current low-cost general model supporting Responses, structured output and image input. The model remains non-authoritative.

## Budgets, quotas, rate limits and automatic shedding

### Zero-cash hard budget

For providers that can create variable paid spend:

```text
OpenAI  = disabled
Sumsub  = disabled
Twilio  = disabled
elmah.io external telemetry = disabled
Stripe LIVE = disabled
Tolgee runtime cloud dependency = disabled
```

This is stronger than an in-process monetary counter: a serverless restart cannot reset a disabled provider into spending money.

### Free-tier protected provider

Resend zero-cash control-plane policy:

```text
quota      = 90 sends / 24h
rate limit = 8 requests / second
timeout    = 5 seconds
circuit    = open after 3 failures for 60 seconds
```

The connected Free provider itself also hard-limits delivery and does not expose paid overage unless a paid subscription enables it.

### Existing generic provider control plane

KLYX already has deterministic enforcement for:

- quota;
- monetary budget;
- rate limit;
- timeout;
- bounded retry;
- fallback action;
- circuit breaker;
- audit events;
- metrics;
- `budget_threshold_reached` alerts.

`createKlyxCostGovernedProviderControlPlaneRegistry()` applies the zero-cash overrides without replacing the canonical provider registry.

### Alerting

Any blocked paid-provider attempt emits a redaction-safe structured event:

```text
KLYX_EXTERNAL_COST_GUARD_BLOCKED
```

A blocked non-critical provider degrades instead of taking down KLYX where the capability contract permits it. Sensitive authorities still fail closed.

## Cache policy

Cache only when it cannot become business authority:

- safe: public catalog metadata, static translation files, immutable provider configuration, reusable deterministic assistant content;
- conditional: search/matching reads with short TTL and invalidation;
- forbidden as truth: payment status, settlement eligibility, KYC/KYB authorization, OTP secrets, booking mutation outcome.

## Batching policy

Batch only operations whose semantics remain safe:

- safe: analytics aggregation, translation sync, non-urgent notification digest, read-only reconciliation queries;
- unsafe: payment mutations, OTP sends, identity verification creation, booking confirmation, settlement/refund when individual idempotency/authority is required.

## Fixed-cost caveat

Application code can stop **new usage-based spend**, but it cannot cancel subscriptions that were already purchased outside KLYX.

To reach a true account-level `0 EUR` fixed cost, billing must still be checked for:

1. elmah.io `Starter`;
2. Vercel current team plan;
3. any paid GitHub seat/add-on;
4. any Sumsub/Twilio/Tolgee subscription or prepaid commitment not visible to the connectors.

Until proven otherwise, KLYX treats these bills as **unknown**, not zero.

## Official references checked 2026-09-29

- OpenAI GPT-6 Luna: https://developers.openai.com/api/docs/models/gpt-6-luna
- OpenAI pricing: https://developers.openai.com/api/docs/pricing
- Supabase: https://supabase.com/pricing
- Stripe Belgium: https://stripe.com/en-be/pricing
- Sumsub: https://sumsub.com/pricing/
- Twilio Verify: https://www.twilio.com/en-us/verify/pricing
- Resend: https://resend.com/pricing
- Tolgee: https://tolgee.io/pricing
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/plans/
- elmah.io FAQ: https://elmah.io/faq/
- Vercel pricing/terms: https://vercel.com/pricing and https://vercel.com/legal/terms
- GitHub pricing/Actions billing: https://github.com/pricing and https://docs.github.com/en/billing/concepts/product-billing/github-actions

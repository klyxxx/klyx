# KLYX External Cost Control

Status date: 2026-09-26

## Invariant

```text
No external invoice may be created by an implicit KLYX code path.

ZERO_COST
→ local/deterministic answer first
→ free-tier infrastructure only
→ paid/degradable dependencies disabled
→ no silent fallback to a paid provider

PAID_CONTROLLED
→ explicit provider budget
→ durable global quota reservation
→ 75 / 90 / 100 alerts
→ hard stop at budget
→ noncritical/degradable feature disabled when exhausted
```

`KLYX_EXTERNAL_COST_MODE` defaults to `ZERO_COST`. Unknown values also resolve to
`ZERO_COST`.

The cost-control plane is a spend-authorization layer. It does **not** replace
canonical KLYX operational circuit breakers (`ops_capability_controls`),
financial LIVE authority, Risk, Eligibility, Ledger, Settlement or provider
truth.

## Current account evidence available to KLYX

- Supabase project `supabase-amber-ferry` is `ACTIVE_HEALTHY`; billing plan is
  not exposed by the connected project API.
- Vercel project `klyx` / production `klyx-ten.vercel.app` is connected; its
  billing plan is not exposed by the available connector.
- Vercel production logs observed for the previous 7 days at audit time:
  approximately 59 `/api/ops/financial-runtime-tick`, 26 `/`, 8
  `/api/health/build`, 6 `/api/health`, and 1 `/robots.txt` route groups. This
  is a very small request volume and does not justify a paid infrastructure
  upgrade by itself.
- GitHub repository `klyxxx/klyx` is public, so standard GitHub-hosted Actions
  runners are free under GitHub's public-repository policy. Larger runners must
  not be introduced without an explicit budget.
- Stripe financial LIVE remains independently gated off. Development and
  certification use TEST / fake / isolated paths.
- Exact current subscription invoices for OpenAI, Sumsub, Twilio, Resend,
  Tolgee, Cloudflare and elmah.io are not exposed by the available account
  connectors. KLYX therefore never assumes that a provider is free merely
  because credentials exist.

## Provider audit

Provider prices and quotas below were checked against official provider pages on
2026-09-26. They are pricing references, not a claim about the user's current
subscription invoice.

| Provider | Current public price / free quota | KLYX required calls | Calls to avoid | Free fallback | Cache / batch | Replaceable | KLYX paid threshold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI | GPT-5.6 Luna: $0.20/M input, $0.02/M cached input, $1.20/M output. Terra is roughly 10x more expensive on standard text tokens. No permanent API free tier is assumed. | Only non-deterministic conversation/reasoning and explicitly requested vision when local rules cannot answer. | Greetings, help, generic pricing questions, deterministic state explanations, automatic health probes, shadow traffic, duplicate retries, oversized memory/prompt history. | Deterministic KLYX responder + canonical engines. | Prompt/cache reuse where available; trim memory; short output; batch only offline/non-interactive work. | Yes. | $0 by default. Explicit `PAID_CONTROLLED` budget required; Luna is default. |
| Supabase | Free: $0; unlimited API requests; 50k MAU; 500MB DB; 5GB egress + 5GB cached; 1GB storage; max 2 active projects. Pro starts $25/mo. | Auth, canonical state, DB, storage and durable server authorities. | Polling the same state, N+1 reads, duplicate writes, repeated public catalog reads, storing disposable certification artifacts in production. | Local Supabase CLI for development/tests; fake adapters for pure engines. | Cache immutable/static catalogs; combine reads/RPCs; batch writes/events where semantics allow. | Yes, but high migration cost. | Stay Free until real sustained quota pressure; only move to Pro after measured need and revenue/budget >= $25/mo. |
| Stripe | Belgium standard: no setup/monthly fee; standard EEA cards 1.5% + €0.25. Connect may add platform fees depending on pricing model. TEST mode has no real-money processing fee. | Checkout/payment, Connect onboarding/status when economically required, webhooks, refund/settlement in real paid operation. | Polling payment status instead of webhooks, repeated onboarding links/status calls, financial calls during ordinary development, LIVE smoke tests. | Existing `offline-fake`, Stripe TEST and pure finance engine. | Webhook-driven state; idempotency; batch reconciliation reads where supported. | Yes, but high financial/compliance switching cost. | No fixed paid threshold for development: remain TEST. LIVE fees must be transaction-funded and LIVE authority must stay independently certified. |
| Sumsub | Basic: $1.35/successful verification with $149 monthly minimum. Compliance: $1.85 with $299 minimum. | Only actual KYC/KYB when regulation/risk policy requires external identity verification. | Creating applicant/token flows before the user reaches KYC; status polling; re-verifying reusable evidence without policy need. | Test fixtures, deterministic eligibility states, `human_review` for development. | Cache KYC result/reference until expiry; webhooks instead of polling; no useful batching for identity verification. | Yes. | Disabled at €0. Activate only when compliance requires it and monthly budget can cover at least $149. |
| Twilio Verify | $0.05 per successful verification + channel fee. Belgium outbound SMS public rate: $0.1113/segment before possible carrier fees. | Real phone possession proof only where KLYX policy requires it. | SMS for ordinary login when email/session is enough, repeated OTP resend, polling/check loops, SMS notifications that can be in-app/email. | Test OTP in development; email/in-app; later TOTP/passkeys where appropriate. | Cooldowns and idempotency; no meaningful batching for OTP. | Yes. | Disabled at €0. Enable by market only with explicit per-provider monthly budget. |
| Resend | Free: $0, 3,000 emails/mo, 100/day, 3 domains. Pro: $20/mo for 50k. | Critical transactional email not already handled safely by auth/provider; user-facing notices where email is materially useful. | Duplicate email, internal alerts, high-frequency state updates, messages already visible in-app. | In-app notification + persisted alert; Supabase Auth email for low-volume auth within its limits. | Existing idempotency; digest/batch non-urgent notifications. | Yes. | KLYX hard cap is 80/day and 2,400/month, leaving 20% safety margin. Upgrade only when real usage and revenue justify $20/mo. |
| Tolgee | Free: €0, 500 keys, 3 seats, standard localization/automation. | Authoring/sync during development only. | Runtime translation/TMS network calls for strings already shipped with the app. | Committed JSON catalogs. | Entire runtime catalog is local/cacheable; batch translation/sync outside request path. | Yes. | Stay Free until >500 keys or >3 editors materially needed. Runtime must remain independent. |
| Cloudflare Turnstile | Free: up to 20 widgets, unlimited challenges/verification requests, 10 hostnames/widget. | Abuse protection on sensitive public/auth actions. | Challenges on every page/view or internal authenticated server calls. | Existing KLYX auth/rate-limit controls if Turnstile unavailable in development. | Token verification is per sensitive action; no batching. | Yes. | No paid threshold currently justified. Free tier covers development and most production. |
| elmah.io | No permanent general free plan assumed; Small Business public price starts around $26/mo. Trial/free OSS arrangements may exist but are not guaranteed. | Optional production error telemetry only. | Development/test events, success logs, routine heartbeats, duplicate stack traces, high-volume low-value warnings. | Vercel logs, KLYX structured logs, Supabase ops/audit, GitHub artifacts. | Deduplicate/sample repeated errors; aggregate metrics instead of per-event telemetry where safe. | Yes. | Disabled unless `PAID_CONTROLLED` and explicit elmah budget >= $26/mo. |
| Vercel | Hobby $0/mo; Pro $20/mo with included usage credit and advanced Spend Management. | Production hosting/deploy, static/CDN, necessary server routes. | Repeated dynamic computation for cacheable content, unnecessary redeploys, high-frequency polling/cron, uncached static data through functions. | Local Next.js server for development and certification. | Vercel cache/CDN; cache deterministic GETs; consolidate scheduled work. | Yes. | Stay on no-cost allowance while sufficient. If Pro is ever enabled, set hard Spend Management pause at the approved budget before enabling metered growth. |
| GitHub | Standard hosted Actions are free for public repos. GitHub Free private allowance is 2,000 min/mo and 500MB artifact storage; larger runners are always billable. | Source control, PR checks, required certification workflows. | Duplicate overlapping workflows, long artifact retention, large runners, rerunning full suites when path filters can prove irrelevance. | Local git + local test runner. | npm cache; path filters; concurrency cancellation; short artifact retention; reusable workflows. | Yes. | Current public repo standard runners: $0. Configure GitHub metered-product budget with hard stop before any paid runner/product is introduced. |

## AI routing policy

```text
incoming user message
→ deterministicKlyxReply()
    → known deterministic KLYX question? local answer, $0
    → otherwise continue
→ is external AI explicitly enabled?
    → no: deterministic/local fallback
→ Cost Control Plane
    → ZERO_COST: OpenAI blocked
    → PAID_CONTROLLED: reserve durable global quota
        → budget available: Luna
        → budget exhausted/unavailable: local fallback
```

The default text and vision model for paid KLYX calls is `gpt-5.6-luna` unless
`KLYX_OPENAI_MODEL` / `KLYX_VISION_MODEL` is explicitly overridden.

### Current local deterministic examples

- greeting;
- thanks;
- “what can KLYX do / how does KLYX work”;
- generic price/budget setup;
- fallback intent classification already performed by deterministic code.

This list should grow whenever production traces show recurring prompts that can
be answered from canonical KLYX state without generative reasoning.

## Cost-control configuration

### Global mode

```text
KLYX_EXTERNAL_COST_MODE=ZERO_COST       # default
KLYX_EXTERNAL_COST_MODE=FREE_TIER       # explicitly use permanent free quotas
KLYX_EXTERNAL_COST_MODE=PAID_CONTROLLED # explicit provider budgets only
```

`ZERO_COST` is the development/test default and requires no paid provider.

### Provider budgets

```text
KLYX_EXTERNAL_COST_BUDGET_OPENAI_USD=0
KLYX_EXTERNAL_COST_BUDGET_SUMSUB_USD=0
KLYX_EXTERNAL_COST_BUDGET_TWILIO_USD=0
KLYX_EXTERNAL_COST_BUDGET_ELMAH_USD=0
```

Missing/invalid/non-positive budget means **no paid authorization**.

Optional quota overrides:

```text
KLYX_EXTERNAL_COST_<PROVIDER>_DAILY_ACTIONS=<integer>
KLYX_EXTERNAL_COST_<PROVIDER>_MONTHLY_ACTIONS=<integer>
```

The server reuses the existing concurrency-safe Supabase
`klyx_consume_api_rate_limit` authority for global durable reservation. If the
quota authority is unavailable, metered external calls fail closed.

## Alerts and circuit breaker

The cost-control layer emits structured `KLYX_EXTERNAL_COST_CONTROL` events at:

```text
75% → warning
90% → critical warning
100% → hard stop
```

At 100%:

```text
critical free infrastructure
→ stay available if the provider operation is truly free

noncritical / degradable paid feature
→ block external call
→ use free fallback
→ continue KLYX core workflow where safe

financial LIVE / Stripe authority
→ unchanged
→ never activated by cost control
```

The cost budget is a **hard spend breaker**, while `ops_capability_controls`
remains the canonical operational incident/kill-switch authority. These are
complementary, not competing authorities.

## Cache and batching rules

1. Never call a paid provider for data already in canonical KLYX state.
2. Prefer webhooks/events to provider status polling.
3. Use idempotency before retrying any provider call.
4. Cache immutable catalogs, translations and public configuration locally.
5. Cache/dedupe repeat AI requests only when privacy and canonical-state version
   make reuse safe; never reuse stale transactional answers.
6. Batch analytics, telemetry, reconciliation reads and non-urgent
   notifications; do not batch user-critical OTP/KYC decisions.
7. Do not retain large CI artifacts longer than their certification purpose.
8. Keep development certification isolated and provider-fake by default.

## Zero-euro development matrix

| Capability | €0 path |
| --- | --- |
| Conversation | deterministic/local fallback |
| LLM-dependent UX development | mocked provider / fixtures |
| Vision | description-assisted analysis + mocked vision |
| Database/Auth/Storage | local Supabase CLI or free project |
| Payments | pure finance + Stripe TEST / offline fake |
| KYC/KYB | eligibility fixtures + human-review states |
| Phone OTP | deterministic test OTP fixture |
| Email | in-app/persisted notification; Resend Free only under KLYX safety cap |
| Translation | committed local JSON catalogs |
| Bot protection | Cloudflare Turnstile Free |
| Observability | local/Vercel/KLYX logs + GitHub artifacts |
| Hosting | local Next.js; Vercel free allowance if account plan permits |
| CI | public-repo standard GitHub-hosted runners |

## Paid activation rule

A provider may move from `ZERO_COST` to `PAID_CONTROLLED` only when all are true:

1. the feature cannot be fulfilled safely by a local/free fallback;
2. the provider is required by product, regulation, or measured reliability;
3. a monthly KLYX provider budget is explicitly configured;
4. external account-level spend caps/alerts are configured where the provider
   supports them;
5. the KLYX hard quota is set below the provider/account billing ceiling;
6. monitoring can prove provider usage and cost attribution;
7. rollback to the free/degraded path is tested.

Until then, the correct threshold is **0 €**.

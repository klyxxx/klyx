# KLYX Zero-Cost External Cost Control

Status: active design for development/testing. Pricing snapshot: 2026-09-29.

## Invariant

```text
uncontrolled external invoice = forbidden

KLYX_EXTERNAL_COST_MODE absent or unknown
-> zero
-> no variable-cost runtime provider call

zero-cost deterministic KLYX answer available
-> local deterministic answer
-> no LLM call

non-deterministic AI request
+ guarded mode
+ provider explicitly enabled
+ provider-side spend cap explicitly confirmed
+ positive KLYX monthly budget configured
+ KLYX_OPENAI_ENABLED=1
-> model may be used

otherwise
-> deterministic fallback / degraded path / human review
```

The existing Provider Control Plane remains the canonical quota/rate-limit/timeout/retry/fallback/circuit abstraction. Its current counters are process-local and are **not** a global billing authority. Therefore the zero-cost guarantee is implemented with a stateless hard deny before network execution. A future paid/guarded mode additionally requires a provider-side hard spend cap so a Vercel multi-instance race cannot create an uncontrolled bill.

## Runtime modes

### `zero` — default

No environment variable is required. The following variable-cost runtime providers are blocked before an external request:

- OpenAI;
- Sumsub;
- Twilio;
- Resend;
- elmah.io.

KLYX continues through local/deterministic or existing degraded paths.

### `guarded` — explicit future opt-in

Requires:

```text
KLYX_EXTERNAL_COST_MODE=guarded
KLYX_PROVIDER_<PROVIDER>_ENABLED=1
KLYX_PROVIDER_<PROVIDER>_SPEND_CAP_CONFIRMED=1
KLYX_PROVIDER_<PROVIDER>_MONTHLY_BUDGET_MINOR=<positive integer>
```

OpenAI additionally requires:

```text
KLYX_OPENAI_ENABLED=1
```

`SPEND_CAP_CONFIRMED` means the provider account itself has a hard cap / no-overage setting appropriate to that provider. KLYX's process-local budget is defense in depth, not invoice truth.

## Provider audit

| Provider | Current KLYX cost posture | Public free quota / pricing | Cost unit | Necessary calls | Calls to avoid | Free fallback | Cache / batching | Replaceable? | Paid threshold |
|---|---|---|---|---|---|---|---|---|---|
| OpenAI | **$0 target; blocked in `zero`**. Visible assistant already has deterministic fallback. | No permanent API-free allowance is assumed. GPT-5.6 Luna: $0.20/M input, $0.02/M cached input, $1.20/M output. Current code's historical default Terra is $2/M input, $12/M output. | tokens | only genuinely non-deterministic language/reasoning tasks after local routing | greetings, intake, dates/times/budget parsing, readiness, shadow comparison during zero-cost development | deterministic KLYX Brain | cache stable system/context; batch offline evaluations, never interactive mutations | yes | only after revenue/need justifies a provider-side hard cap; use Luna first for cost-sensitive tasks |
| Supabase | Connected project `supabase-amber-ferry` is `ACTIVE_HEALTHY`; account plan/cash invoice not exposed here. | Free: $0, unlimited API requests, 50k MAU, 500 MB DB/project, 5 GB uncached + 5 GB cached egress, 1 GB storage, 500k Edge Function invocations; 2 active free projects. Pro from $25/mo with spend cap available. | storage/egress/MAU/functions on paid plans | canonical DB/Auth/Storage reads/writes | duplicate polling, oversized payloads, avoidable storage downloads, unnecessary realtime | local Supabase for tests; fake adapters/fixtures for engines | cache reference catalogs; batch reads/writes where semantics permit | technically yes, strategically expensive | stay Free while quotas fit; do not upgrade merely for development convenience |
| Stripe | **$0 while TEST-only**; no financial LIVE activation in this mission. | Belgium standard pricing has no setup/monthly fee; standard EEA card ~1.5% + €0.25 per successful payment. | successful payment / optional products | payment, refund, transfer/settlement only when real economic action is required | health probes that create objects, duplicate payment attempts, unnecessary PaymentIntents | Stripe TEST + fake Stripe adapter + pure finance engine | cache read-only reference data; never cache financial truth; batch reconciliation reads where safe | yes at adapter boundary, migration cost high | only when KLYX deliberately enters financial LIVE; transaction fees must be covered by unit economics |
| Sumsub | **blocked in `zero`** | 14-day trial / 50 checks. Basic $1.35/verification with $149 minimum monthly commitment; Compliance $1.85 with $299 minimum. | successful verification + monthly commitment | KYC/KYB only when activity/economic rules require it | creating applicants/tokens before verification is actually needed; repeated status polling instead of webhooks | human review/test fixtures; economic eligibility remains blocked until proof | cache immutable verification evidence/status snapshots; webhook-driven updates | yes | not before KYC/KYB is operationally required and volume/revenue covers minimum commitment |
| Twilio Verify | **blocked in `zero`** | Free trial; Verify $0.05 per successful verification + channel fees. Belgium outbound SMS listed at $0.1113/segment, before applicable carrier fees. | verification + SMS segment | phone verification only where risk/policy requires it | OTP on every login, resend spam, duplicate challenge creation | email/manual verification where policy permits; test adapter | cannot safely cache OTP; dedupe requests and enforce cooldown/rate limits | yes | only when phone verification materially reduces risk or becomes a compliance/product requirement |
| Resend | **blocked externally in `zero`**; current connected usage observed: 15/3000 monthly, 1/100 daily. | Free $0: 3,000 emails/month, 100/day, 3 domains. Pro $20/mo for 50k; paid overage $0.90/1k when PAYG enabled. | email | transactional emails that cannot be replaced by in-app delivery | duplicate notifications, emails for events already visible in app | durable in-app notification/outbox | dedupe/idempotency; digest non-urgent notifications | yes | keep Free; external sends can later be allowed only with plan/overage controls explicitly confirmed |
| Tolgee | runtime is already static-snapshot oriented | Free €0: 500 keys, 3 seats, no card. Team €49/mo annual billing; Business €179/mo annual billing. | keys/seats/MT credits | translation management during authoring/sync | runtime translation API call per page/request | committed locale catalogs | cache/build translation catalogs; batch translation sync | yes | remain Free until key/team limits actually block localization work |
| Cloudflare Turnstile | designed to remain free | Free: up to 20 widgets, 10 hostnames/widget, unlimited challenges/verification requests; can run independently of other Cloudflare products. | effectively free under Free plan | bot challenge where abuse protection is needed | challenges on low-risk internal/dev flows | server-side rate limits under explicit degraded policy | browser token cannot be cached/reused; no batching | yes | no paid threshold expected for current KLYX scale; Enterprise only for advanced requirements |
| elmah.io | **blocked in `zero`**. Connected account details could not be retrieved reliably in this audit. | No permanent free plan; 21-day free trial then paid subscription. | log/event volume + subscription | high-value production errors only | info/debug logs, repetitive known errors, heartbeats during zero-cost mode | Vercel/runtime logs + KLYX structured logs | dedupe/sample repetitive errors; batch summaries rather than raw noise | yes | only when dedicated error-management value exceeds subscription cost |
| Vercel | connected KLYX project exists; account plan/invoice not exposed by current connector. | Hobby $0, 1M Edge Requests/month and 100 GB Fast Data Transfer included; Hobby cannot buy overage and is described for personal/non-commercial use. Pro $20/mo plus usage credit. | hosting/compute/transfer depending plan | deploy production/preview when code changes need deployment | redundant preview builds, unnecessary dynamic rendering/functions | local Next.js development/build; portable deployment target | aggressive static/data caching; collapse redundant CI/deploys | yes | for commercial launch, plan compliance must be reviewed; do not silently upgrade for development |
| GitHub | repo is public; standard GitHub-hosted Actions for public repos are free | Public repos: standard hosted runners free. GitHub Free private quota: 2,000 min/month, 500 MB artifact storage. Larger runners remain paid. | CI runner/storage depending repo/runner | source control and certification gates | duplicate full certifications for unchanged SHA, oversized artifacts, unnecessary retention | local Git + selective local tests | reuse npm cache carefully; artifact retention minimised; workflow path filters | yes | current public standard-runner CI can stay $0; avoid larger runners/paid storage |

## Calls actually worth keeping

```text
Supabase
-> user/domain truth that must persist

Stripe
-> only real payment/settlement mutations, and TEST during current development

Sumsub
-> only when KLYX eligibility rules require identity/compliance proof

Twilio
-> only when phone proof is explicitly required

Resend
-> only high-value transactional delivery; in-app is canonical fallback

Tolgee
-> authoring/sync, not request-time runtime dependency

Turnstile
-> abuse-sensitive public entry points

elmah.io
-> only high-value production failures if later paid

OpenAI
-> only non-deterministic requests that local KLYX logic cannot answer
```

## Automatic degradation policy

When a non-critical provider is disabled or blocked:

```text
OpenAI -> deterministic KLYX answer
Resend -> in-app/outbox
elmah.io -> structured Vercel/server logs
Tolgee -> committed locale snapshot
```

When a compliance/security provider is blocked:

```text
Sumsub -> no false verification; human_review / eligibility blocked
Twilio -> no false phone verification; alternate approved path or pending
Turnstile -> security policy decides fail-closed/degraded behavior; never silent bypass
```

When a financial provider is unavailable:

```text
Stripe mutation outcome unknown
-> block
-> reconciliation
-> retry only with proven/idempotent semantics
-> human_review if truth cannot be proven
```

## Cache and batching rules

Cache only data whose staleness cannot create incorrect financial/compliance authority. Good cache candidates: service catalogs, static configuration, locale catalogs, public provider metadata, deterministic assistant templates.

Do not cache as authority: payment truth, settlement eligibility, current KYC/KYB eligibility, booking concurrency state, idempotency claims.

Batch safe read/reporting work: metrics, reconciliation reads, notification digests, offline AI evaluations. Never batch unrelated sensitive mutations merely to save API calls.

## Cost alerts and circuit breakers

Guarded policies add:

- provider-specific daily quota;
- per-minute rate limit;
- bounded timeout;
- circuit breaker;
- monthly budget object with warning at 80%;
- provider-specific fallback.

These counters are instance-local today. Global invoice safety therefore comes from the pre-network zero-mode deny and, in guarded mode, the mandatory provider-side spend cap confirmation. A future shared atomic cost ledger may replace the process-local counters after concurrency certification.

## Sources checked 2026-09-29

- OpenAI model pricing: https://developers.openai.com/api/docs/models/gpt-5.6-luna and https://developers.openai.com/api/docs/models/gpt-5.6-terra
- Supabase pricing/billing: https://supabase.com/pricing and https://supabase.com/docs/guides/platform/billing-on-supabase
- Stripe Belgium: https://stripe.com/en-be/pricing
- Sumsub: https://sumsub.com/pricing/
- Twilio Verify: https://www.twilio.com/en-us/verify/pricing
- Twilio Belgium SMS: https://www.twilio.com/en-us/sms/pricing/be
- Resend: https://resend.com/pricing
- Tolgee: https://tolgee.io/pricing
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/plans/
- elmah.io: https://elmah.io/faq/
- Vercel: https://vercel.com/pricing
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions

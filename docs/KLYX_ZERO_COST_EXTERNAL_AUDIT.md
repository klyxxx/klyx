# KLYX — External cost audit and zero-budget policy

Audit date: 2026-09-28

## Invariant

> No external provider may create an uncontrolled invoice.

Current operating objective:

> KLYX must remain developable and testable with EUR 0 available.

The default runtime policy is therefore `zero_budget`.

`guarded_paid` deliberately remains fail-closed until a separate durable distributed spend authority is certified. Merely adding an API key must never enable paid usage.

## AI routing

Canonical rule:

```text
KLYX deterministic question
→ local deterministic response / internal engine read
→ EUR 0 external AI cost

otherwise
→ LLM fallback only when a paid budget authority is explicitly certified
```

The existing `assistant-capability-router` already routes KLYX information, payment/refund explanations, language/account support and other deterministic capabilities without the LLM. Sensitive payment, KYC, eligibility, settlement and refund decisions remain forbidden to the LLM.

OpenAI is now additionally blocked by the external cost governor even when `OPENAI_API_KEY` exists. If paid AI is enabled in a future certified mode, the default model is `gpt-5.6-luna`, conversation/context size is bounded and `max_output_tokens` is bounded.

## Provider matrix

| Provider | Current KLYX state / observed usage | Free allowance / current public pricing | Calls actually needed | Calls to remove / avoid | Free fallback, cache, batching | Replaceable? | Internal threshold before paid |
|---|---|---|---|---|---|---|---|
| OpenAI | No billing amount can be proven from repository data. External calls are now blocked in `zero_budget`. | GPT-5.6 Luna: $0.20/M input, $0.02/M cached input, $1.20/M output. Terra: $2/M input, $0.20/M cached, $12/M output. Sol: $4/M input, $0.40/M cached, $20/M output. | Only ambiguous conversational/reasoning cases that deterministic KLYX engines cannot answer. | Deterministic FAQ, payment/refund/KYC explanations, routing, account/language operations, repeated full-history prompts. | Local deterministic router first; bounded context; future prompt caching; Luna as future low-cost default. | Yes. LLM provider abstraction already exists. | **EUR/USD 0 now.** Paid mode stays uncertified. Future first budget should be a small hard cap (for example $5/month) only after durable metering exists. |
| Supabase | Connected production project is healthy. Last 24h audit showed ~25k edge-log events; the once-per-minute financial worker was the largest repeated DB request source. | Free: 2 projects, 500 MB DB/project, 50k MAU, 1 GB storage, 5 GB egress, 500k Edge Function invocations, 2M Realtime messages, 200 peak Realtime connections. Free-plan overage leads to restriction rather than automatic paid overage. | Auth, canonical DB, RLS, storage, durable workflows, ledger and internal engine state. | High-frequency polling when no LIVE finance or pending work exists; duplicate profile/account reads; unnecessary broad selects. | DB indexes/RPCs, cache read models, batching, event-driven jobs. Zero-budget financial heavy scan reduced to 15-minute recovery cadence while LIVE is off. | Technically yes, strategically expensive to replace now. | Alert at 70% of any free quota; optimize at 80%; consider paid only when sustained >85% or production availability requirements justify it. |
| Stripe | TEST remains authoritative for development. Financial LIVE remains separately blocked. Current TEST use costs EUR 0. | No setup/monthly fee on standard payments. Belgium standard EEA cards: 1.5% + EUR 0.25; premium EEA 2.8% + EUR 0.25; UK 2.5% + EUR 0.25; international 3.15% + EUR 0.25; Bancontact EUR 0.35. | Real payment/refund/transfer only after LIVE certification. TEST objects for development/certification. | Polling Stripe when a signed webhook/internal state already proves the answer; duplicate create calls. | TEST mode, local fake adapters, idempotency, webhook-driven updates, canonical ledger. | Payment processor is replaceable behind adapters, but not cheaply once LIVE. | EUR 0 until real launch. Cost governor never authorizes LIVE; existing financial activation gate remains the authority. |
| Sumsub | External paid verification must not run in zero-budget mode. Sandbox is the only externally allowed mode. | Basic: $1.35/successful verification with $149 minimum monthly commitment. Compliance: $1.85 with $299 minimum. Public trial: 14 days / 50 checks. | Only KYC/KYB when economic/activity eligibility requires it. | Rechecking already-valid identity; creating applicants before KYC is actually required. | Local fake adapter/fixtures for development; Sumsub sandbox; cache verified KLYX economic identity until expiry/recheck policy. | Yes, through identity-provider adapter, but migration/compliance cost is material. | Do not enter paid mode until KYC is required for real economic activity and monthly revenue can justify the minimum commitment. |
| Twilio Verify | Production Verify is blocked by zero-budget policy. Only explicit `KLYX_TWILIO_MODE=trial` is allowed. Existing route already has resend cooldown/lockout. | Verify: $0.05 per successful verification plus channel fees. Trial requires no card and only verified trial numbers are usable. | Phone ownership proof only when product/security policy genuinely requires it. | SMS for ordinary notifications, repeated OTP sends, phone verification before it is needed. | Supabase/email auth where adequate; trial numbers for development; existing 60s resend cooldown; in-app notification for non-auth messages. | Yes. | EUR 0 now. Paid only when phone verification becomes a proven requirement; add durable per-country spend metering before production SMS. |
| Resend | **Observed account usage:** 1/100 daily and 14/3000 monthly at audit time. | Free: 3,000 emails/month, 100/day, 3 domains, 10,000 automation runs. Pro: $20/month for 50k, then optional paid overage. | Transactional email that cannot be replaced by in-app state; critical operational alerts while free quota remains. | Duplicates/retries already covered by idempotency registry; avoid email for high-frequency internal telemetry. | `transactional_email_deliveries` idempotency + usage registry; KLYX hard cap now 5/min, 50/day, 1,500/month; after cap use in-app/outbox/log fallback. | Yes. | Review at 1,200/month; hard stop 1,500/month. Pay only if sustained legitimate demand exceeds this and email is essential. |
| Tolgee | Runtime architecture already uses committed/static locale catalogs rather than requiring Tolgee per user request. | Free: 500 keys, 3 seats, no card. | Translation authoring/sync, not normal production requests. | Any runtime translation request for already-known UI text. | Ship committed locale catalog; browser/server cache static translations; batch translation changes. | Yes; can self-host or use another localization workflow. | Review at 450 keys. Paid cloud only if >500 keys and Tolgee collaboration remains worth the cost; otherwise self-host/static workflow. |
| Cloudflare Turnstile | Used as anti-bot verification; zero-cost provider policy allows it. | Free: up to 20 widgets, unlimited challenges/verification requests, 10 hostnames/widget, 7-day analytics. | Signup/login/abuse-sensitive public actions as needed. | Do not challenge trusted internal/server traffic or every harmless read request. | Verification result/session throttling where security permits; application rate limiting remains fallback. | Yes. | Review at 18/20 widgets or when enterprise-only bot features become necessary. No paid threshold based on request volume. |
| elmah.io | Connected account usage could not be read through the current connector. Runtime delivery is now disabled in zero-budget mode. | No permanent free plan. 21-day free trial. Small Business public price currently $26/month for 10k messages/month. | Optional secondary production error export only. | Routine logs, successful requests, heartbeats when free internal/Vercel telemetry already covers them. | Vercel runtime logs + KLYX internal operational telemetry; sample/batch noncritical logs. | Yes, highly replaceable. | EUR 0 now. Do not pay until free observability is demonstrably insufficient. |
| Vercel | Production traffic observed over 7 days is very low; `/api/ops/financial-runtime-tick` was the dominant application route in runtime logs. | Hobby $0; includes 1M Edge Requests/month and 100 GB Fast Data Transfer/month. Hobby cannot buy overage and is paused at free-tier limits. Pro starts at $20/month. | Web/API hosting, deploys, server functions. | Minute-level heavy financial scans while LIVE is off; unnecessary dynamic rendering/functions for cacheable content. | CDN/cache static responses; zero-budget idle financial tick; batching. | Yes, but migration cost exists. | Alert at 70%, optimize at 80%, paid hosting only when commercial/availability requirements or sustained usage require it. |
| GitHub | Repository is public. Standard GitHub-hosted Actions therefore have zero minute charge. | Public repositories: standard GitHub-hosted Actions are free. GitHub Free private allowance: 2,000 min/month and 500 MB artifact storage. Larger runners are always billable. | Source control, PR checks, required Playwright certification, releases. | Duplicate CI matrices on unchanged code; unnecessarily long artifact retention; larger runners/Codespaces unless explicitly required. | Path filters, dependency cache, artifact retention limits, reusable workflows, public standard runners. | Yes, but repo/CI migration cost is high. | Stay on public standard runners. Paid runners/Codespaces require explicit separate budget approval. |

## Runtime cost governor

The governor is intentionally separate from financial/payment authority.

```text
provider call
→ determine zero-budget provider policy
→ check provider mode
→ check conservative free quota where KLYX can prove usage
→ allow free call
   OR local fallback
   OR fail closed
   OR open circuit
```

### Current zero-budget circuits

```text
OpenAI paid       → OPEN → local deterministic fallback
Sumsub production → OPEN → fail closed; sandbox only
Twilio production → OPEN → fail closed; trial only
elmah.io           → OPEN → internal/Vercel logs
Stripe LIVE        → NEVER authorized by cost governor; TEST only here
Resend             → CLOSED only below KLYX free-quota envelope
```

A noncritical provider is automatically degraded/disabled when its KLYX quota is exhausted. A critical identity or financial dependency fails closed rather than silently changing truth or authorization semantics.

## Resend quota policy

Provider free quota is deliberately not consumed to 100%.

```text
vendor: 100/day, 3000/month
KLYX:     50/day, 1500/month, 5/minute
```

This leaves a large concurrency/operational safety margin and prevents normal KLYX application traffic from reaching a paid overage threshold.

## Polling reduction

The production financial scheduler remains callable every minute as a recovery safety net. While all of the following are true:

```text
VERCEL_ENV=production
KLYX_EXTERNAL_COST_MODE=zero_budget (default)
KLYX_LIVE_PAYMENTS_ENABLED != true
```

the route performs authorization every minute but executes the expensive reconciliation/monitoring scan only every 15 minutes.

This preserves automation while reducing repeated Supabase reads and server work by roughly an order of magnitude during the current non-LIVE phase.

## Cost alerts

Cost decisions emit a structured server warning once per provider/reason per server instance:

```text
KLYX_EXTERNAL_COST_ALERT
```

Reasons distinguish quota exhaustion, uncertified paid mode and provider-specific circuit breakers. Resend additionally writes delivery failures/skips through the existing transactional email warning path.

Vendor-side billing/spend alerts must remain enabled where available. KLYX application guards complement vendor billing controls; they do not replace them.

## Rules before any paid mode

Paid mode remains deliberately uncertified. It must not be enabled merely because an API key or credit card exists.

Before changing that invariant, KLYX needs a separate certification proving:

1. distributed durable budget reservation before the external call;
2. atomic daily/monthly counters under concurrency;
3. actual-cost reconciliation after the provider response;
4. hard monthly money ceiling;
5. cost alert thresholds;
6. automatic circuit opening at the ceiling;
7. safe noncritical fallback;
8. fail-closed behavior for financial/KYC authorities;
9. no provider can authorize Stripe LIVE;
10. restart/retry/replay cannot double-reserve spend.

Until then, `guarded_paid` returns `KLYX_EXTERNAL_PAID_MODE_NOT_CERTIFIED`.

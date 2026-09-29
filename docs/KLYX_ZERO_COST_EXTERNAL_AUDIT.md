# KLYX — External cost audit and zero-budget policy

Audit date: 2026-09-29

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

OpenAI is blocked by the external cost governor even when `OPENAI_API_KEY` exists. The normal LLM path, photo vision and the admin health probe all pass through the OpenAI cost decision before a network call. If paid AI is enabled in a future certified mode, the default model is `gpt-6-luna`, conversation/context size is bounded and `max_output_tokens` is bounded.

## Provider matrix

| Provider | Current KLYX state / observed usage | Free allowance / current public pricing | Calls actually needed | Calls to remove / avoid | Free fallback, cache, batching | Replaceable? | Internal threshold before paid |
|---|---|---|---|---|---|---|---|
| OpenAI | Exact account spend is not exposed to KLYX. External runtime calls are blocked in `zero_budget`. | Public pricing verified 2026-09-29: GPT-6 Luna Standard is $0.10/M input, $0.01/M cached input, $0.125/M cache writes, $0.50/M output; Batch/Flex are 50% of Standard. No model-request free tier is available for Luna. | Only ambiguous conversational/reasoning or vision cases that deterministic KLYX engines cannot answer. | Deterministic FAQ, payment/refund/KYC explanations, routing, account/language operations, duplicate health probes, repeated full-history prompts. | Local deterministic router first; bounded context/output; stable-prefix prompt caching; Batch/Flex only for offline work. | Yes. LLM provider abstraction already exists. | **EUR/USD 0 now.** No paid OpenAI call until durable spend authority is certified. |
| Supabase | Connected production project `supabase-amber-ferry` is ACTIVE_HEALTHY. Exact billing plan is not exposed by the connector used for this audit. | Free public plan: $0, 2 active projects, 500 MB DB/project, 50k MAU, 5 GB egress + 5 GB cached egress, 1 GB storage, 500k Edge Function invocations, 2M Realtime messages, 200 peak connections. | Auth, canonical DB, RLS, storage, durable workflows, ledger and internal engine state. | High-frequency polling when no LIVE finance or pending work exists; duplicate profile/account reads; broad selects. | DB indexes/RPCs, cache read models, batching, event-driven jobs. Zero-budget financial heavy scan reduced to 15-minute recovery cadence while LIVE is off. | Technically yes, strategically expensive to replace now. | Alert at 70% of any free quota; optimize at 80%; consider paid only when sustained >85% or production availability requirements justify it. |
| Stripe | TEST remains the development/certification rail. Financial LIVE remains separately blocked; no LIVE mutation is introduced by this policy. | Standard Belgium pricing has no setup/monthly fee; standard EEA cards are 1.5% + EUR 0.25 and Bancontact is EUR 0.35 per successful payment. Other cards/currency conversion cost more. | Real payment/refund/transfer only after LIVE certification. TEST objects for development/certification. | Polling when signed webhook/internal state already proves the answer; duplicate create calls. | TEST mode, local fake adapters, idempotency, webhook-driven updates, canonical ledger. | Replaceable behind adapters, but costly after LIVE launch. | EUR 0 until real launch. Cost governor never authorizes LIVE; the existing financial activation gate remains authoritative. |
| Sumsub | Production paid verification is blocked in zero-budget mode. Only explicit sandbox mode is externally allowed. | Basic: $1.35/successful verification with $149 minimum monthly commitment. Compliance: $1.85 with $299 minimum. Trial/sandbox may be used for evaluation subject to account terms. | KYC/KYB only when economic/activity eligibility actually requires it. | Rechecking a still-valid identity; creating applicants before KYC is required. | Local fake adapter/fixtures for dev; sandbox; cache verified KLYX economic identity until expiry/recheck policy. | Yes, through identity-provider adapter. | Do not enter paid mode until real KYC demand and revenue justify the monthly minimum. |
| Twilio Verify | Production Verify is blocked by zero-budget policy. Only explicit `KLYX_TWILIO_MODE=trial` is allowed. | $0.05 per successful verification plus channel fees; SMS attempts also carry telecom/channel cost. Free trial is available. | Phone ownership proof only when policy genuinely requires it. | SMS notifications, repeated OTP sends, verification before it is needed. | Supabase/email auth where adequate; trial numbers for dev; resend cooldown; in-app notifications for non-auth messages. | Yes. | EUR 0 now. Paid only when phone verification is a proven requirement and durable country/channel spend metering exists. |
| Resend | Connected account observed on 2026-09-29: 1/100 daily, 15/3000 monthly; 1 domain of 3. | Free: $0, 3,000 emails/month, 100/day, 3 domains, 10,000 automation runs. Pro: $20/month for 50k; paid plans can enable overage. | Transactional email not replaceable by in-app state; critical operational notifications while inside the free envelope. | Duplicates, repeated notifications, high-frequency internal telemetry. | Existing idempotency/delivery registry; KLYX cap 5/min, 50/day, 1,500/month; then in-app/outbox/log fallback. | Yes. | Warn at 75%; review at 1,200/month; hard stop 1,500/month in zero-budget mode. |
| Tolgee | Runtime uses committed/static locale catalogs; no runtime Tolgee dependency is needed. | Free: EUR 0, 500 keys, 3 seats, 10k MT credits. | Translation authoring/sync, not normal product requests. | Runtime translation calls for already-known UI text. | Commit locale catalogs; cache static translations; batch authoring changes. | Yes; self-host/static alternatives exist. | Review around 450 keys or 2/3 seats; never upgrade automatically. |
| Cloudflare Turnstile | Kept enabled as the zero-cost anti-bot provider. | Free: 20 widgets, unlimited challenges/verification requests, 10 hostnames/widget, 7-day analytics. | Signup/login/abuse-sensitive public actions. | Trusted internal/server traffic and harmless reads. | Session/rate-limit logic where secure; KLYX durable API rate limiting remains fallback. | Yes. | Review at 18/20 widgets; no paid threshold based on request volume. |
| elmah.io | Connected KLYX organization reports plan label `Starter`; exact invoice amount is not exposed by the connector. Runtime export is disabled in zero-budget mode. | Current public lowest paid plan is Small Business at $26/month for 10k messages/month; public pricing does not show a permanent free production tier. | Optional secondary error export only. | Routine logs, success events and heartbeats already visible in free internal/platform logs. | Vercel/runtime logs + KLYX internal operational telemetry; sample/batch only if re-enabled later. | Yes, highly replaceable. | Runtime spend target is EUR 0. Existing subscription billing must be checked/cancelled separately if `Starter` is billable. |
| Vercel | KLYX project is connected. Exact current account plan/invoice is not exposed by the available connector. | Hobby is $0 but explicitly personal/non-commercial. Pro is the business plan and can incur usage beyond included credits. | Production web/API hosting and deployments. | Minute-level heavy recovery scans while LIVE is off; unnecessary dynamic functions/rendering. | Local `next build`/`next start` for EUR 0 development/testing; CDN/cache static content; batched jobs. | Yes, with migration cost. | **Do not claim commercial production is EUR 0 via Hobby.** Any paid/business hosting plan requires explicit approved budget/spend management. |
| GitHub | KLYX repository is public. | Standard GitHub-hosted runners are free for public repositories. GitHub Free includes 500 MB artifact storage for private-plan quota accounting; larger runners are always billable. | Source control, PR checks, required Playwright/security certification, releases. | Duplicate matrices, long artifact retention, larger runners/Codespaces without need. | Path filters, dependency cache, short artifact retention, reusable workflows, standard public runners. | Yes, but migration cost is high. | Stay on public standard runners. Configure metered-product budgets with hard stop; paid runners/Codespaces need separate approval. |

## Runtime cost governor

The governor is intentionally separate from financial/payment authority.

```text
provider call
→ zero-budget provider policy
→ provider mode check
→ conservative free quota where usage can be proven
→ allow free call
   OR local fallback
   OR fail closed
   OR open circuit
```

### Current zero-budget circuits

```text
OpenAI text/vision/health → OPEN → local deterministic fallback / no external probe
Sumsub production         → OPEN → fail closed; sandbox only
Twilio production         → OPEN → fail closed; trial only
elmah.io                   → OPEN → internal/platform logs
Stripe LIVE                → NEVER authorized by cost governor; TEST only here
Resend                     → CLOSED only below KLYX free-quota envelope
Tolgee runtime             → OPEN → committed catalogs
```

A noncritical provider is automatically degraded/disabled when its KLYX quota is exhausted. A critical identity or financial dependency fails closed rather than silently changing truth or authorization semantics.

## Resend quota policy

Provider free quota is deliberately not consumed to 100%.

```text
vendor: 100/day, 3000/month
KLYX:     50/day, 1500/month, 5/minute
warning: 75%
```

If quota state cannot be proven from `transactional_email_deliveries`, sending fails safe to `skipped` rather than risking external spend.

## Polling reduction

The production financial scheduler remains callable every minute as a recovery safety net. While all of the following are true:

```text
VERCEL_ENV=production
KLYX_EXTERNAL_COST_MODE=zero_budget (default)
KLYX_LIVE_PAYMENTS_ENABLED != true
```

the route performs authorization every minute but executes the expensive reconciliation/monitoring scan only every 15 minutes.

## Cost alerts and circuit behavior

Cost decisions emit a structured server warning once per provider/reason per server instance:

```text
KLYX_EXTERNAL_COST_ALERT
```

Vendor-side billing/spend controls must remain enabled where available. Application guards complement vendor billing controls; they do not replace them.

For the current zero-budget phase, the money budget for every metered paid provider is effectively **0**. The safe mechanism is therefore a pre-network deny rather than an estimated in-process monetary counter.

This policy governs **runtime metered calls**. It cannot by itself cancel an existing fixed subscription such as hosting or an observability plan. Those account-level subscriptions must be audited separately and explicitly downgraded/cancelled if a literal EUR 0 monthly cash outflow is required.

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

Until then, `guarded_paid` remains fully disabled.

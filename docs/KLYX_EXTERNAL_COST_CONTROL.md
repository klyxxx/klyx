# KLYX External Cost Control

Snapshot date: 2026-09-26.

## Invariant

```text
no explicit budget
=> no metered external call

budget exhausted or quota authority unavailable
=> cost circuit OPEN
=> non-critical provider call disabled
=> free/local fallback
```

KLYX must remain developable and testable with `0 EUR` available.

The cost plane is not a financial or business authorization authority. It only decides whether KLYX may initiate an external call that can create provider cost. Existing payment, settlement, eligibility, compliance and Mission 17 operational authorities remain authoritative.

## Modes

### `zero` — default

No environment variable is required. If `KLYX_EXTERNAL_COST_MODE` is missing or invalid, KLYX behaves as `zero`.

Blocked external-cost providers:

- OpenAI network calls;
- Stripe LIVE cost-bearing use remains governed by the existing financial LIVE gates; development uses TEST/fakes;
- Sumsub verification starts;
- Twilio Verify network calls;
- elmah.io delivery.

Allowed zero-cost paths:

- local deterministic KLYX responses;
- local/ephemeral Supabase for development and CI;
- Stripe TEST/fake adapters;
- local test OTP transport outside production;
- Resend only inside a safety-buffered free quota;
- committed Tolgee JSON catalogs;
- Cloudflare Turnstile Free;
- local Next.js development;
- standard GitHub-hosted runners while the repository is public.

### `guarded`

A metered provider requires an explicit provider budget:

```text
KLYX_EXTERNAL_COST_MODE=guarded
KLYX_EXTERNAL_COST_OPENAI_MONTHLY_BUDGET_MICRO_USD=5000000
KLYX_EXTERNAL_COST_OPENAI_MONTHLY_CALL_LIMIT=50
```

`1 USD = 1,000,000 microUSD`.

There is intentionally no uncapped `normal` mode.

## Provider audit

| Provider | Current observed KLYX state | Public free / base pricing snapshot | Calls actually necessary | Calls to avoid | Free fallback | Cache / batching | Replaceable? | Recommended paid threshold |
|---|---|---|---|---|---|---|---|---|
| OpenAI | Billing spend not observable from current connected tools. KLYX had text, photo-vision and admin health call surfaces. | GPT-5.6 Luna: $0.20/M input, $0.02/M cached input, $1.20/M output. | Only non-deterministic assistant reasoning or explicitly needed photo vision. | Deterministic greetings/help/budget replies and paid network health probes. | Deterministic local reply; description-only photo flow. | Prompt caching is possible upstream; KLYX first removes the call entirely. Batch only offline/non-user-critical jobs. | Yes, through the LLM/provider abstraction. | Current threshold: $0. Enable only with an explicit monthly budget. Start with Luna. Cost control reserves $0.10/call conservatively. |
| Supabase | Connected organization is Free. DB ~53.6 MB, 4 auth users, 18 storage objects / ~3.1 MB at audit time. | Free: $0; 50k MAU; 500 MB DB; 1 GB storage; 5 GB egress + 5 GB cached; unlimited API requests. | Durable state, auth, storage and existing rate-limit authority. | Repeated reads that can be kept in request/session caches; unnecessary CI against production. | Local/ephemeral Supabase. | Cache immutable/reference data; batch admin/report queries. | Yes architecturally, but replacement cost is high. | Stay Free. Re-evaluate around 70% of any hard Free quota; do not wait for exhaustion. |
| Stripe | Connected LIVE account exists; read-only audit found no balance transactions in the latest query. No LIVE mutation in this mission. | Standard Belgium pricing has no setup/monthly fee; EEA standard cards 1.5% + EUR0.25 per successful payment. | Real payment/refund/settlement only after existing LIVE readiness and user/business authorization. | Any real-money smoke test. | Stripe TEST + fake adapters + pure finance engine. | Idempotency and webhook dedupe already reduce duplicates; financial mutations must never be batched merely to save API calls. | Yes at integration boundary, but migration cost is high. | No paid-plan threshold: fees are COGS only when real payments are deliberately activated. |
| Sumsub | Account billing not observable. Runtime can start SDK verification and process status/webhooks. | Basic: $1.35 per verification with $149 minimum monthly commitment. | Start verification only when KLYX truly requires economic/compliance verification. | Verification during ordinary dev/test, duplicate applicant starts. | Local fixtures; pending verification state; never fake verified in production. | Cache resulting KYC state/evidence references; never repeat a valid verification without policy reason. | Yes through verification adapter boundary. | Keep disabled until business/compliance need justifies at least $149/month. |
| Twilio | Billing not observable. KLYX uses Verify SMS. | Verify: $0.05 per successful verification + channel fees. Belgium outbound SMS listed at $0.1113/segment plus possible carrier fees. | Production phone verification only when it provides real risk value. | Dev/test OTP; repeated resend spam. | Local test OTP outside production; email/auth/in-app flows where appropriate. | Reuse an active verification session; rate-limit resends. Batching is not appropriate for OTP. | Yes. | $0 now. Enable with explicit monthly budget only when phone verification becomes required. Reserve is $0.25/call. |
| Resend | Connected usage: 1/100 daily and 12/3000 monthly at audit time; current usage fits Free. | Free: $0, 3,000 emails/month, 100/day, 3 domains, 10k automation runs. | Transactional email that adds value or is required. | Duplicate notifications and emails where in-app notification is enough. | Durable in-app notification. | Existing idempotency; batch digests for non-urgent notifications. | Yes. | Guard at 80/day and 2,400/30d, leaving 20% free-tier safety margin. Pay only after dedupe/digests still exceed it. |
| Tolgee | Runtime reads committed local catalogs. Cloud pull workflow is manual only. | Free: EUR0, 500 keys, 3 seats. | Cloud synchronization when translations actually change. | Runtime lookup over network; scheduled pulls. | Committed JSON catalogs. | Runtime is fully cached in the application bundle; translation updates can be batched. | Yes. | Stay Free until approaching 500 keys or collaboration needs exceed 3 seats. |
| Cloudflare | KLYX code uses Turnstile, not paid CDN/Workers as a core dependency. | Turnstile Free: $0, up to 20 widgets, unlimited challenges/verification requests, 10 hostnames/widget. | Bot challenge verification where abuse risk warrants it. | Extra Cloudflare products without a measured need. | Application/Supabase auth rate limits. | Browser/token lifecycle provides natural short-lived reuse; no batching need. | Yes. | Stay Free until Turnstile Free limits or enterprise security requirements are genuinely exceeded. |
| elmah.io | Connected organization reports plan `Starter`; exact current invoice/usage was not available through the connector. | No permanent free plan; provider documents a 21-day trial followed by paid use. | Optional production error telemetry only if paid observability is intentionally funded. | Daily heartbeat/deployment/error delivery while budget is zero. | Vercel logs, local server logs, GitHub artifacts and KLYX operational tables. | Aggregate/dedupe repeated errors before external logging if re-enabled. | Yes. | Disable external calls now. If Starter is billing, cancel/downgrade at the account level; code disablement alone does not cancel a subscription. |
| Vercel | Connected project `klyx`; exact account plan was not exposed by the available connector. Git automatic deployment is disabled in `vercel.json`. | Hobby $0/month; Pro $20/month plus included usage credit. | Production deployment/hosting only. | Automatic deployment on every commit; unnecessary preview deployments. | Local Next.js for development/test. | Static/CDN caching; combine changes before production deploy. | Yes. | Keep Git auto-deploy off. Use paid plan only when production/commercial/team/usage requirements make it necessary. |
| GitHub | Repository is public; workflows observed use standard GitHub-hosted runners. | Standard hosted runners are free for public repositories; larger runners are billable. | Required security, build, test, E2E and certification gates. | Duplicate certifications on the same SHA; excessive artifact retention. | Local `npm test`, TypeScript and build for development. | Cache npm safely; group independent checks when it does not weaken certification. | Yes, but migration cost is high. | Keep repository public + standard runners. Never switch to larger runners without explicit budget. Keep artifact retention bounded. |

## IA routing

```text
user message
  -> deterministicKlyxReply()
      -> known deterministic KLYX question: local answer, $0
      -> otherwise:
          -> OpenAI enabled?
          -> external cost authorization?
          -> durable provider quota remaining?
              YES -> GPT-5.6 Luna
              NO  -> local safe fallback
```

OpenAI text, photo vision and the admin network health probe share one provider-level monthly quota. The health endpoint does not consume tokens in zero mode.

## Cost circuit breaker

The server-side guard uses the already certified durable `consumeApiRateLimit` authority. It does not create a second database counter.

For each metered provider:

1. default mode is `zero`;
2. `guarded` requires a positive explicit monthly budget;
3. a conservative per-call reserve derives a maximum call count;
4. an optional lower explicit monthly call limit may tighten it further;
5. every operation for the provider consumes the same provider-level monthly bucket;
6. at 80% usage KLYX emits `KLYX_EXTERNAL_COST_GUARD` warning logs;
7. at exhaustion the cost circuit opens;
8. non-critical external functionality falls back locally or is skipped;
9. if the durable quota authority is unavailable, metered calls fail closed.

The cost plane never grants permission for Stripe LIVE or settlement. Those remain governed by the existing financial authorities.

## Zero-cost test transports

For Twilio only:

```text
KLYX_LOCAL_TEST_TRANSPORTS=1
KLYX_LOCAL_TEST_OTP_CODE=000000
```

This transport is refused when `VERCEL_ENV=production`.

Mocked unit/integration tests may use:

```text
KLYX_EXTERNAL_COST_TEST_BYPASS=1
```

but the bypass is recognized only when `NODE_ENV=test`.

## Immediate operating policy

```text
KLYX_EXTERNAL_COST_MODE=zero
KLYX_OPENAI_ENABLED=0
KLYX_VISION_ENABLED=0
KLYX_LOCAL_TEST_TRANSPORTS=1   # local/CI only
```

Do not configure paid provider budgets until the business deliberately approves an amount.

Provider pricing changes over time. Re-verify provider pricing before increasing any budget or activating a paid integration.

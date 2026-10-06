# KLYX External Cost Minimum Audit — 2026-10-06

Status: **PASS for zero-euro development/testing posture**

## Executive decision

KLYX can continue development and certification with **€0 external variable-provider spend** when:

- `KLYX_EXTERNAL_COST_MODE` is absent/unknown => **zero mode**;
- OpenAI, Sumsub, Twilio, Resend and elmah.io remain blocked before network execution;
- deterministic KLYX answers are served locally before any LLM call;
- Stripe remains TEST-only for development;
- Supabase remains on the connected Free plan;
- Vercel remains on the connected Hobby plan;
- Tolgee runtime uses committed catalogs and cloud **push is explicitly billing-gated**;
- GitHub public-repository standard Actions are used;
- Cloudflare Turnstile remains on its Free plan.

**Invariant**

```text
no uncontrolled external invoice
        =
hard deny before external call
+
provider-side cap/plan control for any explicit paid opt-in
+
local quota/rate/budget/circuit controls
```

## Connected account observations

| Provider | Observation on 2026-10-06 | Cost posture |
|---|---|---|
| Supabase | KLYX organization = **Free**; `supabase-amber-ferry` = ACTIVE_HEALTHY | **$0 base plan** |
| Vercel | KLYX team = **Hobby**; project `klyx` linked to GitHub | **$0 base plan** |
| Stripe | Connected account exists in **livemode** | KLYX financial LIVE must remain independently disabled |
| GitHub | `klyxxx/klyx` is public | Standard public-repo Actions are free |
| OpenAI | Account billing not connected/observable | **$0 target**; blocked by default |
| Sumsub | Account billing not connected/observable | **$0 target**; blocked by default |
| Twilio | Account billing not connected/observable | **$0 target**; blocked by default |
| Resend | Current usage endpoint not exposed by connector in this audit | **$0 target**; blocked by default |
| Tolgee | Runtime does not require Cloud | **$0 target**; committed catalogs |
| Cloudflare | Account billing not connected/observable | Turnstile Free posture |
| elmah.io | Account billing not reverified in this pass | **$0 target**; blocked by default |

Account cost is never inferred from public pricing.

## Provider matrix

| Provider | Current/free cost | Cost per action | Necessary calls | Unnecessary calls | Free fallback | Cache | Batch | Replaceable | Paid threshold |
|---|---|---|---|---|---|---|---|---|---|
| **OpenAI** | No permanent API-free allowance assumed. **GPT-6 Luna: $0.10/M input, $0.50/M output; cached input $0.01/M.** | Example 1k input + 300 output ≈ **$0.00025** | Only non-deterministic reasoning/language tasks | Greetings, dates, budgets, explicit-time parsing, simple KLYX status/intake | Deterministic KLYX Brain | Prompt caching is automatic on supported models; stable prefixes matter | Batch only offline/evaluation work | Yes | Explicit business approval + provider-side cap + positive KLYX budget |
| **Supabase** | Free: $0; 50k MAU, 500 MB DB/project, 5 GB egress + 5 GB cached egress, 1 GB storage, 500k Edge Function invocations | $0 while Free limits fit | Canonical DB/Auth/Storage operations | Duplicate polling, oversized reads, unnecessary Realtime | Local/ephemeral Supabase + fixtures | Reference data | Batch safe reads/writes | Yes, but strategically expensive | Do not upgrade for development |
| **Stripe** | No setup/monthly fee; transaction fees apply in live | Belgium/EEA standard cards: **1.5% + €0.25**; Bancontact €0.35 | Real payment/refund/settlement only | Duplicate PaymentIntents, live health probes, test-to-live leakage | Stripe TEST + mocks | Never cache financial truth | Reconciliation reads only when safe | Adapter boundary yes | Revenue must cover transaction economics; LIVE remains disabled now |
| **Sumsub** | 14-day trial, 50 free checks; Basic **$1.35/verification + $149 monthly minimum** | Successful verification | KYC/KYB only when required by eligibility/compliance | Premature applicants, repeated polling | Test fixtures/manual evidence; block eligibility until proof | Verification evidence snapshots | Webhook-driven, not polling | Yes | Only after compliance need + revenue covers minimum |
| **Twilio** | Free trial; Verify **$0.05/successful verification + channel fees** | Belgium SMS currently **$0.1113/segment** before applicable carrier fees | Phone OTP only when policy requires it | OTP on every login, duplicate resend, SMS fallback loops | Email/manual verification or test adapter | Never cache OTP | Dedupe/cooldown instead | Yes | Only when phone verification has measurable product/risk value |
| **Resend** | Free **$0**, 3,000 emails/month, 100/day, 3 domains; Pro $20/50k | Free while quota fits; paid overage $0.90/1k on paid plans | Critical transactional notifications | Duplicate notifications, non-critical emails | In-app notifications/outbox | Dedupe by event/idempotency key | Digest non-urgent mail | Yes | Stay Free; enable paid only deliberately |
| **Tolgee** | Free **€0**, 30,000 hosted words, 3 seats, no credit card | $0 at Free | Authoring/sync only | Runtime translation API calls; unnecessary cloud pushes | Committed catalogs in repo | Build-time catalog cache | Batch sync | Yes | Free limit is 30k words; over-limit can trigger plan upgrade |
| **Cloudflare Turnstile** | Free; up to 20 widgets and unlimited challenges/verification requests | $0 on Free | Public abuse-protection challenge | Challenges on trusted/internal flows | KLYX rate limits where appropriate | Tokens are not reusable | N/A | Yes | No paid need expected at current scale |
| **elmah.io** | Dedicated error platform is not part of the zero-cost path; exact current account price not reverified | Subscription/usage dependent | High-value production errors only | Debug/info noise, duplicate heartbeats/log storms | Vercel/runtime logs + KLYX structured logs | Dedup/sample | Aggregate summaries | Yes | Only when observability value justifies subscription |
| **Vercel** | Connected team = **Hobby $0** | $0 while Hobby quotas fit; Pro starts at $20/mo | Hosting/deployment | Redundant previews/builds, unnecessary dynamic compute | Local Next.js + portable deployment | Static/data caching | Collapse redundant deploys | Yes | Do not upgrade for development |
| **GitHub** | Public repository; standard hosted Actions for public repos are free | $0 for standard public-repo runners | Source control + certification | Duplicate workflows, large artifacts, excessive retention | Local Git/tests | npm cache | Workflow path filters | Yes | Avoid paid runners/storage |

## Required call policy

### DEMANDER

```text
message
→ deterministic classifier/parser
→ local answer if sufficient
→ otherwise LLM
→ deterministic plan
→ provider calls only when the next state requires them
```

### GAGNER

```text
competence
→ local opportunity engine
→ eligibility
→ deterministic proposal
→ acceptance
→ mission
→ completion
→ settlement authority
```

The LLM is never an authority.

## Cost controls now enforced

### 1. Zero-cost default

Unknown `KLYX_EXTERNAL_COST_MODE` is treated as `zero`.

Variable-cost providers are denied before network execution.

### 2. OpenAI cost reduction

Default model changed to **`gpt-6-luna`** with low reasoning effort.

The request now also has a hard `max_output_tokens` cap:

- default: **1,600 total generated tokens**;
- configurable with `KLYX_OPENAI_MAX_OUTPUT_TOKENS`;
- hard maximum: **2,000**.

This cap includes reasoning tokens, so it bounds the worst-case output-side spend.

### 3. Tolgee billing guard

`npm run i18n:tolgee:push` now fails closed unless both are explicitly set:

```text
KLYX_EXTERNAL_COST_MODE=guarded
KLYX_TOLGEE_BILLING_APPROVED=1
```

Development uses committed catalogs and does not need cloud push.

### 4. Existing provider control plane

Already present and retained:

- quotas;
- rate limits;
- budgets;
- warning thresholds;
- health state;
- circuit breaker;
- timeout;
- retry policy;
- fallback/degraded action;
- audit events;
- provider disablement.

### 5. Financial circuit breaker

Stripe settlement/payment authority remains separate from external-provider cost control.

A provider-cost incident can disable the non-critical external function without authorizing any financial mutation.

## Zero-euro development profile

The following remains valid without purchasing anything:

```text
Next.js local
+ Supabase Free / local ephemeral Supabase
+ Stripe TEST
+ deterministic KLYX Brain
+ committed Tolgee catalogs
+ Cloudflare Turnstile Free
+ GitHub public repo / standard Actions
+ Vercel Hobby within quota

= KLYX development/certification
  without required external variable spend
```

OpenAI, Sumsub, Twilio, Resend and elmah.io are optional runtime accelerators, not development prerequisites.

## Official pricing references checked

- OpenAI GPT-6 Luna: https://developers.openai.com/api/docs/models/gpt-6-luna
- OpenAI prompt caching: https://developers.openai.com/api/docs/guides/prompt-caching
- Supabase: https://supabase.com/pricing
- Stripe Belgium: https://stripe.com/en-be/pricing
- Sumsub: https://sumsub.com/pricing/
- Twilio Verify: https://www.twilio.com/en-us/verify/pricing
- Twilio Belgium SMS: https://www.twilio.com/en-us/sms/pricing/be
- Resend: https://resend.com/pricing
- Tolgee: https://tolgee.io/pricing
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/plans/
- Vercel: https://vercel.com/pricing
- GitHub plans: https://docs.github.com/en/get-started/learning-about-github/githubs-plans

## Final verdict

**PASS — KLYX can be developed and tested with €0 available for external variable providers.**

Any future move from zero-cost mode to paid external runtime must be an explicit, observable, reversible change. No provider may silently create an invoice.

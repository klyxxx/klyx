# KLYX External Provider Audit

Audit snapshot: 2026-10-06. Current cost-minimum report: `KLYX_COST_MINIMUM_AUDIT_2026-10-06.md`.

This audit distinguishes repository integration, observable account configuration, production use, public pricing and actual observed KLYX cost. Unknown account billing is never inferred from public pricing.

## Verified matrix

| Provider | Integrated | Configured | Production | Pricing / observed cost | Indispensable | Free/degraded fallback | Failure handling | Secret boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI | Yes | Repository integration proven; account billing/configuration not externally observable | Not independently proven | GPT-6 Luna public API price: $0.10 / 1M input tokens, $0.50 / 1M output tokens. Actual KLYX spend: unknown | Important for conversational quality, not authority | Deterministic KLYX fallback with sensitive execution disabled | Bounded timeout + resilient fallback; vision also degrades safely | `OPENAI_API_KEY` server-only |
| Supabase | Yes | Yes: `supabase-amber-ferry`, ACTIVE_HEALTHY, Postgres 17 | Yes | KLYX organization is on Supabase Free: **$0/month base** | Yes, current DB/Auth/Storage | Local/isolated adapters and DR for certification/recovery; no transparent production-write fallback | Fail closed for authoritative writes; DR/recovery exists | Publishable browser key is intentional; privileged key server-only. Legacy anon key is still enabled |
| Stripe | Yes | Yes: KLYX Stripe account reachable in livemode | External LIVE account exists; KLYX financial LIVE authority remains separate | Standard Belgium: no setup/monthly fee; EEA cards 1.5% + €0.25; Bancontact €0.35. Live balance read returned zero transactions, so **€0 observed transaction fees**, not an invoice guarantee | Yes for paid flows | TEST/mocks only; never silently switch payment rail while external state is unknown | Strong fail-closed, idempotency, reconciliation, recovery and `human_review` | Secret + webhook keys server-only; publishable key may be public |
| Sumsub | Yes | Repository contract proven; live account/env not externally observable | Not independently proven | Basic public price: $1.35 / verification with $149 minimum monthly commitment; actual KLYX spend unknown | Conditional when KYC/KYB evidence is required | Human review/manual evidence path; eligibility remains blocked until proof exists | Fail closed; HMAC webhook verification; **15 s bounded transport timeout**; no blind POST retry | App token, secret and webhook secret server-only; browser receives short-lived SDK token only |
| Twilio | Yes | Repository integration proven; live account/env not externally observable | Not independently proven | Verify public price: $0.05 per successful verification + channel fees; actual KLYX spend unknown | Only when phone OTP is required | Alternate verification/manual policy may be selected explicitly; unavailable SMS never verifies a phone | Fail closed; KLYX cooldown/lockout + **15 s bounded transport timeout**; no blind OTP retry | Credentials server-only |
| Resend | Yes | Yes: `klyx.be` verified, sending enabled, EU region | Yes | Current observed usage: 14 / 3000 monthly emails; Free public plan is $0/month, matching observed limits => **$0/month base plan** | No | Durable/in-app state remains truth; delayed email can be retried | Delivery failure is non-authoritative and does not corrupt business state | `RESEND_API_KEY` server-only |
| Tolgee | Yes | Project configuration exists in repository | Live Tolgee is not required at runtime | Free cloud tier €0; 30,000 hosted words and 3 seats; actual KLYX account bill unknown | No | Committed `messages/tolgee` snapshots; self-hosting is also possible | Runtime is offline-capable and independent from Tolgee Cloud availability | Management API key is never required by browser runtime |
| Cloudflare Turnstile | Yes | Repository integration and production build contract proven; account itself not connected | Production auth policy requires the public site key | Free plan is free and supports unlimited challenges; actual account billing not externally observed | Important for public auth abuse protection | No silent production bypass; another anti-abuse provider/policy must be explicitly selected | Fail closed on protected auth surfaces | Site key public by design; verification secret must never enter client code |
| elmah.io | Yes | Previously verified: active KLYX log, uptime check, heartbeat and Slack integration | Yes | Connected account previously reported plan label `Starter`; exact current bill cannot be mapped safely to current public plans | No | Structured KLYX/Vercel logs | 2.5 s timeout and fail-open telemetry; observability outage never blocks business flow | API key production-only/server-only |
| Vercel | Yes | Yes: `klyx` team/project connected | Yes, current hosting control plane | Connected KLYX team is currently Hobby ($0/month); Pro is $20/month. Exact invoice amount is not exposed | Yes for current hosting, but architecture remains portable | Next.js build can move to another hosting adapter; not transparent live failover | Deployment/health gates stop control-plane mutation on uncertainty | Platform secrets never belong in client code |
| GitHub | Yes | Yes: repository connected; protected `main`; required Playwright check | Yes as source/CI control plane, not request runtime | Public GitHub Free $0; Team $4/user/month. Exact KLYX account plan/bill not exposed | Important for delivery, not for an already-running request | Git mirror/export to another trusted remote | Outage stops source/CI/release mutations, not the running production application | Actions/repository secrets stay outside browser/runtime code |

## Official public pricing references checked on 2026-09-28

- OpenAI GPT-5.6 Terra: https://developers.openai.com/api/docs/models/gpt-5.6-terra
- Supabase: https://supabase.com/pricing
- Stripe Belgium: https://stripe.com/en-be/pricing
- Sumsub: https://sumsub.com/pricing/
- Twilio Verify: https://www.twilio.com/en-us/verify/pricing
- Resend: https://resend.com/pricing
- Tolgee: https://tolgee.io/pricing
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/plans/
- Vercel: https://vercel.com/pricing
- GitHub: https://github.com/pricing

Provider price pages are reference prices, not proof of the KLYX account invoice. Actual account cost is stated only when observable from the connected account or usage state.

## Canonical architecture

The provider control plane is already canonical in `lib/providers/`:

- `contracts.ts`: provider IDs, client policy, failure policy and status contract;
- `catalog.ts`: authority boundaries and replacement semantics for all eleven providers;
- `runtime-adapters.ts`: semantic adapters for LLM, identity verification, phone OTP, email and observability;
- `server-registry.ts`: server-only configuration/status registry;
- `tests/unit/external-provider-control-plane.test.ts`: prevents privileged provider origins and secret markers from entering `use client` modules.

The design deliberately avoids one giant provider interface. Each capability keeps its own consistency and authority contract.

```text
client
  -> KLYX API / bounded public provider session
  -> semantic provider adapter
  -> external provider
  -> deterministic KLYX authority
  -> audit / state transition
```

A provider response is evidence or execution output. It is never automatically KLYX business truth.

## Authority rules

### Financial

```text
Stripe response
!= KLYX financial authority

KLYX Ledger
= Settlement truth
= reconciled Stripe truth
```

Unknown external financial state always becomes:

```text
block -> reconciliation -> retry only when proven OR human_review
```

### Identity

Sumsub can provide verified evidence. KLYX Economic Eligibility decides whether an actor may execute or receive settlement.

### AI

OpenAI can interpret or generate. It cannot authorize a payment, KYC/KYB outcome, booking mutation, settlement, refund or LIVE activation.

### Browser

Allowed browser-facing provider surfaces are limited to:

- Supabase publishable/RLS-bound client configuration;
- Stripe publishable configuration only where a client payment component requires it;
- Sumsub short-lived SDK session minted by KLYX server;
- Cloudflare Turnstile public site key/widget;
- committed Tolgee translation snapshots.

All privileged external provider transports remain server-only.

## Failure closure completed in this audit

Two remaining unbounded network transports were fixed:

- Sumsub REST requests now abort after 15 seconds;
- Twilio Verify send/check requests now abort after 15 seconds.

Neither transport adds automatic POST retries. A timeout may mean the provider accepted a mutation but KLYX did not receive the response, so retrying blindly could duplicate external state. The safe behavior is fail-closed and explicit recovery/reconciliation.

`tests/unit/external-provider-transport-resilience.test.ts` locks this contract.

## Remaining risks / next migrations

1. **Supabase security advisor debt**: current advisor reports externally facing `SECURITY DEFINER` execution grants, one mutable `search_path`, and leaked-password protection unavailable/disabled on the current Free plan. These require a separate audited migration; do not revoke grants blindly.
2. **Legacy Supabase anon key**: a modern publishable key is active, but the legacy anon key remains enabled. Retire it only after proving all consumers migrated.
3. **Stripe/Supabase portability debt**: many server modules still depend directly on their SDKs. This is acceptable only behind existing KLYX authority boundaries; migrate semantic capabilities incrementally with fake-adapter certification, not a mass rewrite.
4. **Unobservable billing**: OpenAI, Sumsub, Twilio, Tolgee, Turnstile, elmah.io, Vercel and GitHub exact account invoices are not all exposed by connected tools. Do not invent a cost.
5. **No automatic cross-provider financial failover**: replacing Stripe during an uncertain transaction is forbidden. Replacement is safe only before execution or after external state is reconciled.

## Replacement standard

A new provider can replace an existing provider when it satisfies the same KLYX capability contract and proves:

1. equivalent authority boundary;
2. equivalent or stricter fail-closed semantics where required;
3. server-only secret handling;
4. webhook/signature authenticity where applicable;
5. idempotency/recovery behavior;
6. deterministic fake-adapter tests;
7. exact-SHA certification before production activation.

The provider can change. KLYX domain authority must not.

# KLYX External Provider Audit

Audit snapshot: 2026-09-26.

This document separates four different questions that must never be conflated:

1. Is provider code integrated in the repository?
2. Is a real account/configuration observable?
3. Is the provider part of the production runtime/control plane?
4. Is the provider an authority, or only an external executor/tool?

KLYX remains the authority for financial truth, economic eligibility, booking truth, idempotency, recovery and certification. Provider availability never grants authority by itself.

## Verified matrix

| Provider | Integrated | Configuration actually observed | Production | Paid model | Current KLYX cost observed | Indispensable today | Free/degraded fallback | Failure handling | Secret boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI | Yes | Repository integration verified; account/API billing not observable from current connected tools | Not proven enabled | Usage-based | Unknown | No | Deterministic KLYX LLM fallback | Good: timeout + resilient fallback; LLM cannot execute sensitive actions | Server-only `OPENAI_API_KEY` |
| Supabase | Yes | Yes: `supabase-amber-ferry`, ACTIVE_HEALTHY, Postgres 17, modern publishable key plus legacy anon key | Yes | Free and paid tiers exist | Billing tier not exposed | Yes, current data/auth/storage infrastructure | Local/isolated Supabase + exact restore/DR; no transparent production-write failover | Strong DR/recovery, but production writes fail closed during unavailable state | Publishable browser key is intentional; privileged key remains server-only. Legacy anon should be retired when migration is complete |
| Stripe | Yes | Yes: KLYX Stripe account is reachable in livemode | External LIVE account exists, but KLYX financial LIVE authority remains disabled | Usage-based | 0 LIVE balance transactions observed, therefore 0 observed transaction fees | Yes for paid flows only | TEST/mocks for certification; no automatic financial provider switch for in-flight money | Strong: idempotency, reconciliation, recovery, fail-closed, human_review; invalid webhook signatures are rejected | Secret/webhook keys server-only |
| Sumsub | Yes | Repository configuration contract verified; live account/env values not observable | Not proven | Paid after trial | Unknown | Conditional: regulated/KYC activities | human_review/manual verification; never auto-approve | Partial: durable webhook retry exists, but direct REST transport currently lacks a bounded timeout | Tokens/secrets server-only; browser receives only short-lived SDK token |
| Twilio | Yes | Repository integration verified; live account/env values not observable | Not proven | Usage-based | Unknown | No; required only for phone OTP flow | KLYX may select another verification flow, but unavailable SMS never verifies a phone | Partial: KLYX cooldown/lockout is strong; direct Twilio transport currently lacks a bounded timeout | Credentials server-only |
| Resend | Yes | Yes: `klyx.be` verified, sending enabled, EU region | Yes; actual delivery observed | Free + paid tiers | Free-plan limits observed: 12 / 3000 monthly emails, therefore current base plan cost is $0/mo | No | Durable delivery state, retry/degraded notification path, replaceable adapter | Good: delivery failure is non-authoritative and does not corrupt business truth | `RESEND_API_KEY` server-only |
| Tolgee | Yes | Project configuration exists in repo | Runtime does not depend on live Tolgee | Free + paid cloud/self-host options | Account billing not observable | No | Committed `messages/tolgee` snapshots | Strong: runtime is offline-capable | Management API key server-only/not required by browser runtime |
| Cloudflare Turnstile | Yes | Repository integration + production configuration contract verified; Cloudflare account itself not connected | Production build policy requires the public site key | Free plan available | Account billing not observable; free product is sufficient for normal KLYX scale | Important for auth abuse protection | No silent production bypass; replace provider/policy deliberately | Fail closed for protected auth surfaces | Site key is public by design; validation secret stays outside client code |
| elmah.io | Yes | Yes: KLYX log active, production uptime check, daily heartbeat and Slack integration | Yes | Plan not exposed by connector | Unknown | No | Structured KLYX/Vercel server logs | Strong: 2.5s timeout and fail-open telemetry delivery | API key is production-only and server-only |
| Vercel | Yes | Yes: team `klyx`, project `klyx` connected | Yes | Free + paid tiers | Billing plan not exposed | Yes, current hosting runtime | Portable Next.js build + controlled alternate-host migration; not transparent failover | Deployment gates, health checks and DR are strong; runtime outage still requires infrastructure recovery/migration | Platform secrets are not exposed to browser; env inventory could not be read by current connector |
| GitHub | Yes | Yes: repository connected, protected `main`, required Playwright check | Yes as source/CI control plane, not request runtime | Free + paid tiers | Account plan/billing not exposed | Important for delivery, not for an already-running request | Git history can be mirrored to another remote | Outage blocks source/CI changes but not the running production app | Actions/repository secret values are not readable through current permissions; runtime must not depend on them |

## Real account evidence collected

- Supabase project is ACTIVE_HEALTHY in `eu-central-2` on Postgres 17. A modern publishable key is active; the legacy anon key is also still active.
- Stripe exposes the KLYX account in livemode, while the KLYX application LIVE gate remains a separate authority. A live balance-transaction read returned no transactions.
- Resend has one verified sending domain (`klyx.be`) with 12/3000 monthly emails used and 1/100 daily emails used at audit time.
- elmah.io has an active KLYX log, a production uptime check against `/api/health`, and a daily production heartbeat.
- Vercel exposes the `klyx` team/project. Its connected tool did not expose production environment-variable inventory, so secret presence is not guessed.
- GitHub `main` is protected and requires `Playwright browser verification`.

## Provider boundary rules

### Browser access explicitly allowed

Only these provider surfaces are intentionally browser-visible:

- Supabase publishable credentials through RLS/Auth-bounded clients;
- Sumsub WebSDK with a short-lived token created by KLYX server authority;
- Cloudflare Turnstile public widget/site key.

### Browser access forbidden

Client modules must never import or contain privileged transports/secrets for:

- OpenAI;
- Stripe secret/payment execution;
- Supabase privileged/admin client;
- Sumsub signed API transport;
- Twilio Verify credentials;
- Resend API transport;
- elmah.io ingestion credentials;
- GitHub control-plane tokens.

`tests/integration/provider-client-boundary-contract.test.ts` enforces this rule against every `use client` source file.

## Canonical adapter design

`lib/providers/` now defines:

- canonical provider IDs and capability contracts;
- a provider catalog describing authority, client exposure, failure mode and replacement mode;
- server-side provider adapters/registry;
- neutral capability accessors for LLM, phone verification, identity verification and transactional email;
- explicit status-only adapters for infrastructure/control-plane providers;
- `KlyxProviderError` for provider-neutral failure metadata.

This is intentionally not one giant provider interface. Payments, identity verification, email, LLM and infrastructure have different consistency and authority requirements.

## Financial exception: Stripe is not the ledger

The Stripe adapter is an **external executor boundary**, never financial authority.

The following remain KLYX-owned and provider-independent:

```text
booking truth
+ economic eligibility
+ KLYX ledger
+ settlement truth
+ LIVE authority
+ exact-SHA certification
+ reconciliation
+ recovery/human_review
```

An automatic Stripe-to-another-provider switch is forbidden while an external financial state is unknown. The safe path is:

```text
block
→ prove external state
→ reconcile
→ retry through the selected adapter OR human_review
```

## Remaining migration debt

The common layer is now the canonical entry point for newly unified capabilities, but legacy direct server-side calls still exist, especially for Stripe/Supabase and some provider-specific verification code. These are not client authority leaks; they are server-side portability debt.

Migration order:

1. keep KLYX authority and domain contracts stable;
2. move provider network calls behind semantic capability adapters;
3. keep compatibility shims while call sites migrate;
4. add contract tests with fake adapters;
5. only remove legacy direct provider modules after equivalent certification passes.

Do not mass-rewrite Stripe or Supabase in a single refactor: that would increase financial/data risk and make rollback harder.

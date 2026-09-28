# KLYX external provider audit — 2026-09-28

## Scope

Providers audited: OpenAI, Supabase, Stripe, Sumsub, Twilio, Resend, Tolgee, Cloudflare Turnstile, elmah.io, Vercel and GitHub.

This audit separates four facts that must not be conflated:

1. **integrated** — code exists in the repository;
2. **configured** — required account/configuration evidence was actually observable;
3. **production** — the currently deployed production is proven to contain/use it;
4. **cost** — current account charge/usage is observable, not inferred from a marketing page.

`unknown` means the connected tools do not expose enough account/billing evidence. KLYX must not guess.

## Executive result

The common provider control plane from PR #957 is merged in GitHub `main`. The current Vercel deployment inventory, however, still reports production on SHA `ecb24216ffb28eaa193daf7cdc57ffbe17196cfb`, which predates the #957 merge. Therefore the unified provider layer is **in source main but not yet proven deployed in production**.

The Android/iOS client merged later in #962 correctly delegates assistant, Stripe Checkout, Sumsub token/status and financial reads to KLYX Core. A follow-up guard in this audit extends provider-secret/server-origin scanning to the entire `mobile/` source tree.

## Provider matrix

| Provider | Integrated | Configuration/account evidence | Proven in current production | Current observed cost | Indispensable | Free/degraded fallback | Failure semantics | Secret boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI | yes | partial — server integration and health probe exist; production API-key presence/spend not independently observable | not proven on current deployment | unknown; usage-priced | important, not authoritative | deterministic KLYX fallback with no external generation | degrade | `OPENAI_API_KEY` server-only |
| Supabase | yes | **yes** — project `supabase-amber-ferry` is `ACTIVE_HEALTHY`; organization plan is Free | yes, current KLYX runtime depends on it | **$0/month plan** | **critical** DB/Auth/Storage | local mocks/adapters only for tests; no production authority fallback | **fail closed** | service role server-only; browser/mobile use publishable credentials only |
| Stripe | yes | **yes** — Klyx account visible in live Stripe context | account live context yes; **KLYX financial LIVE authority remains disabled** | **0 live balance transactions observed, therefore $0 processing fees observed so far** | **critical external payment rail** | tests/mocks only; never production money fallback | **fail closed** | secret/webhook server-only; publishable key may be public |
| Sumsub | yes | partial — signed server client/webhook verification exists; account plan/secrets not independently observable | not independently proven | unknown; public Basic starts at $1.35/check with $149 monthly minimum | critical when identity proof is required | human review/evidence collection may exist, but eligibility remains blocked until proof | **fail closed** | app token/secret/webhook server-only; web/mobile receive short-lived SDK session only |
| Twilio | yes | partial — Verify server adapter exists; account/config/spend not connected | not independently proven | unknown; public Verify base is $0.05 per successful verification plus channel fees | important when phone proof is required | email/manual only when policy explicitly permits | **fail closed** | API/auth secrets server-only |
| Resend | yes | **yes** — `klyx.be` verified, sending enabled, EU region; 12/3000 monthly emails observed | account is actively sending | **$0/month inferred from account limits matching Free plan** | important notifications | durable in-app notification/outbox where delayed email is acceptable | degrade | `RESEND_API_KEY` server-only |
| Tolgee | yes | partial — project/config and committed catalogs exist; cloud plan/API secret not independently observable | runtime does not require Tolgee | unknown; Free cloud plan is €0 and self-hosted core is available | optional build/authoring plane | committed translation snapshots | degrade | API key never enters runtime/client catalogs |
| Cloudflare Turnstile | yes | partial — production build requires public site key; secret-side Supabase/Turnstile config not independently observable | public-key requirement is enforced for Vercel production builds | public Free plan = $0 | important public-auth abuse protection | server rate limits only under an explicit degraded policy; never silent bypass | **fail closed** | site key public; secret must remain server/auth-side |
| elmah.io | yes | **yes** — KLYX log, uptime check and heartbeat exist; account reports `Starter` plan | integrated for production-only telemetry | exact billed amount unknown | optional observability | Vercel/runtime logs + KLYX internal telemetry | **fail open** | API key server-only |
| Vercel | yes | **yes** — KLYX team/project and READY production deployments observable | **yes**, but deployed SHA is behind current GitHub main | exact account plan/bill unknown | current hosting/control plane | portable build/deployment adapter required to migrate | stop control plane | deployment token never belongs in client |
| GitHub | yes | **yes** — public repo, protected main, required Playwright gate | control plane, not runtime | exact account plan/bill unknown | current source/CI/release control plane | local Git mirror/export; release mutations stop | stop control plane | token never belongs in client |

## Public pricing references checked on 2026-09-28

Public list prices are context only; they are **not** treated as KLYX invoices.

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

## Security findings

### Supabase

The connected production project is healthy, but the security advisor is not clean:

- 88 tables have RLS enabled with no policy; this is deny-by-default but requires intent review;
- one mutable `search_path` warning exists;
- multiple `SECURITY DEFINER` functions are executable by `anon` and/or `authenticated`, including finance-related functions;
- leaked-password protection is disabled.

These findings require a separate migration/review. Do **not** bulk-revoke permissions or change function security modes without mapping every caller first.

### elmah.io

The production heartbeat is currently **Missing**. It was Healthy on September 24, 25 and 26, then missed the expected September 27 check-in. `vercel.json` still declares the cron and the route remains fail-open, so KLYX user/financial execution is not blocked. The scheduler/production environment must nevertheless be repaired because monitoring cannot be considered healthy while its own heartbeat is missing.

### Client authority boundary

Web client modules are guarded against server-provider origins and secret markers. This audit extends the same rule to the complete `mobile/` JS/TS tree.

Allowed client exposure is limited to:

- Supabase publishable URL/key;
- Stripe publishable key where needed by a client SDK;
- short-lived Sumsub session token minted by KLYX;
- Turnstile public site key;
- committed Tolgee/static locale snapshots.

All authoritative payment, settlement, eligibility, KYC/KYB acceptance, OTP policy, email delivery, LLM orchestration and observability credentials stay behind KLYX server boundaries.

## Replacement contract

A provider replacement must preserve this sequence:

```text
KLYX capability
-> provider adapter
-> external provider
-> normalized result/evidence
-> deterministic KLYX authority
-> audit/state transition
```

The replacement must not require changing booking, ledger, settlement, economic eligibility, durable workflow or client-domain logic.

No replacement may weaken:

- fail-closed payment/KYC/auth behavior;
- webhook authenticity;
- idempotency;
- reconciliation;
- canonical ledger;
- Economic Eligibility;
- explicit Stripe LIVE authority;
- server-only secret handling.

## Open actions

1. Deploy/certify a current-main production SHA before calling the unified provider layer production-active.
2. Repair the missing elmah.io production heartbeat and prove subsequent Healthy check-ins.
3. Audit Supabase `SECURITY DEFINER` grants and mutable `search_path` in a dedicated migration mission.
4. Keep actual provider invoices/usage in the KLYX business-cost subsystem rather than hard-coding plan prices in runtime code.
5. Keep the mobile boundary test mandatory as the Android/iOS client evolves.

# KLYX External Provider Audit — 2026-09-28

Status: audited against repository state and connected provider accounts where those accounts expose verifiable data.

## Evidence rules

- `VERIFIED_ACCOUNT`: confirmed from a connected provider account/API.
- `REPO_VERIFIED`: confirmed from KLYX source/configuration/contracts, not from the provider billing account.
- `BILLING_UNVERIFIED`: the current invoice/subscription amount is not exposed by the available connected account tooling. Do not infer it from public pricing.

Internal KLYX quota counters are **not provider invoices**. They only prove how many provider calls KLYX reserved against its own safety limits.

## Canonical authority boundary

External providers supply capabilities. They do not become KLYX business authority.

- LLM output is not workflow, financial, KYC/KYB, eligibility, booking, ledger, settlement, refund, or LIVE authority.
- Stripe truth is reconciled with KLYX ledger/settlement authority; Stripe availability alone cannot authorize LIVE.
- Sumsub verification is external evidence; KLYX Economic Eligibility remains authoritative.
- Client code may receive only deliberately public artifacts such as Supabase publishable credentials, Stripe publishable keys, Turnstile site keys, or short-lived Sumsub SDK tokens.
- Provider secrets and privileged mutations remain server-only.

## Provider matrix

| Provider | Evidence | Integrated | Configured / production | Paid / current cost | Indispensable? | Free/degraded fallback | Outage behavior | Secret boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI | REPO_VERIFIED + BILLING_UNVERIFIED | Yes | Server provider, vision and admin diagnostics exist. Account billing/production spend not independently exposed. | Usage-priced provider; current KLYX bill unknown. Zero-budget mode defaults OpenAI calls to 0. | Important to conversational quality, **not authority** and not required for deterministic core execution. | Deterministic KLYX assistant/engines; provider can be disabled. | Resilient provider falls back without authorizing actions. | `OPENAI_API_KEY` server-only; no direct client OpenAI calls allowed. |
| Supabase | VERIFIED_ACCOUNT | Yes | Project `supabase-amber-ferry` is `ACTIVE_HEALTHY`, eu-central-2. | Organization plan verified `free`; base plan cost 0. | Current primary persistence/auth/storage, but adapters keep engines portable. | Local Supabase + deterministic/in-memory adapters for isolated engines/tests. | Critical state mutations fail closed when truth cannot be proven. | Publishable key may be client-side; service-role/privileged access server-only. |
| Stripe | VERIFIED_ACCOUNT | Yes | Klyx Stripe account is accessible in livemode; **KLYX financial LIVE authority remains separately disabled/not implied**. | 0 LIVE balance transactions observed in the audited read window/list; therefore 0 observed transaction fees from those transactions. Full invoice/account charges remain BILLING_UNVERIFIED. | Required for the current real-payment rail, not for pure-finance development/certification. | Stripe TEST + pure-finance adapters; no fake real-money success fallback. | Unknown/ambiguous payment state → block/reconciliation/human_review. | Publishable key may be client-side; secret/webhook/Connect mutations server-only. |
| Sumsub | REPO_VERIFIED + BILLING_UNVERIFIED | Yes | Server HMAC integration + short-lived SDK tokens + webhook verification. Provider account plan/bill not exposed. | Paid-risk verification provider; current billed cost unknown. Zero-budget mode blocks new sessions. | Needed where identity/compliance policy requires external KYC/KYB; vendor itself is replaceable. | Local fixtures only in development/test; never fake verified production identity. | Critical verification fails closed; webhook evidence is verified server-side. | App token, secret and webhook secret server-only; browser receives short-lived SDK token only. |
| Twilio | REPO_VERIFIED + BILLING_UNVERIFIED | Yes | Verify integration is server-only. Account configuration/billing not independently exposed. | Usage-priced provider; current billed cost unknown. Zero-budget mode blocks verification starts. | SMS channel is replaceable; verified phone capability may remain required by policy. | Test/local OTP fixtures or another approved channel; never fake production approval. | Critical verification fails closed. | API key/auth token server-only. |
| Resend | VERIFIED_ACCOUNT | Yes | `klyx.be` verified, eu-west-1, sending enabled. Observed usage: 12/3000 monthly emails at audit time. | Current usage is within exposed free-plan-like quota; actual invoice amount is not exposed, so billed cost remains unverified. KLYX caps at 90/day and 2700/month in zero-budget mode. | No. Transactional email is operationally useful but not core authority. | Durable in-app notification/outbox; sending can be skipped/degraded. | Delivery failures do not authorize/rollback business truth. | `RESEND_API_KEY` server-only; no `NEXT_PUBLIC_RESEND_*`. |
| Tolgee | REPO_VERIFIED + BILLING_UNVERIFIED | Yes | Project configuration and synchronized committed catalogs exist. Runtime uses static snapshots rather than Tolgee network calls. | Current account plan/bill unknown. | No runtime dependency. | Committed locale catalogs are the runtime fallback/default. | Tolgee outage does not break runtime translations already committed. | Management API key stays tooling/CI-side; runtime client contains no Tolgee secret/fetch. |
| Cloudflare Turnstile | REPO_VERIFIED + BILLING_UNVERIFIED | Yes | Production auth surfaces use Turnstile; production deploy contract requires public site key. | Current Cloudflare account billing not exposed. | Strong anti-abuse control, but provider is replaceable. | Server-side rate limiting only where policy explicitly allows degradation; do not silently bypass required CAPTCHA. | Auth trust remains validated by the server/Supabase flow, not by the browser. | Site key is intentionally public; secret/trust verification must not be client authority. |
| elmah.io | VERIFIED_ACCOUNT | Yes | `klyx Log` exists, production uptime check + heartbeat configured. Organization plan verified `Starter`. | Paid subscription confirmed by plan classification; exact billed amount unavailable. Zero-budget provider calls can be disabled. | No. Observability must never become transaction authority. | Vercel/runtime logs + KLYX internal telemetry; integration is fail-open with short timeout. | elmah outage never breaks booking/payment/account requests. | API key server-only and production-only. |
| Vercel | VERIFIED_ACCOUNT + BILLING_UNVERIFIED | Yes | Team/project connected; production deployments are READY and tied to exact Git SHAs. | Current Vercel plan/invoice not exposed by connector. | Current hosting/control plane, but application architecture must remain deployable elsewhere. | Local build/test and portable artifacts; rollback candidates exist. | Hosting failure is operational, never business-state authority. | Deployment/account credentials stay control-plane/server-side. |
| GitHub | VERIFIED_ACCOUNT + BILLING_UNVERIFIED | Yes | Private repo/PR/Actions workflow is active; protected-main certification is used. | Current GitHub account plan/invoice not exposed. | Required for current source/CI workflow, not runtime business authority. | Local Git + local certification commands. | CI outage must not mutate production truth or implicitly authorize LIVE. | Repository/Actions secrets remain server/CI-only. |

## Supabase security finding — P1 before broad production exposure

The live Supabase Security Advisor currently reports findings that require classification/remediation before considering the provider boundary fully hardened:

- 88 RLS-enabled tables with no policy (some may intentionally be service-role-only, so do not add permissive policies blindly);
- 1 function with mutable `search_path`;
- 19 `SECURITY DEFINER` functions executable by `anon`;
- 34 `SECURITY DEFINER` functions executable by `authenticated`;
- leaked-password protection disabled.

Required handling: inventory each function/table, prove intended exposure, revoke unnecessary `EXECUTE`, use `SECURITY INVOKER` where possible, pin `search_path`, keep sensitive tables unreachable to public roles, then rerun Supabase Security Advisor.

## Cost-control invariant

Default mode is `zero`; the only paid-call alternative is bounded quotas. There is no unrestricted provider mode.

Before a metered external call, KLYX atomically reserves quota in `klyx_external_provider_usage_windows` through the service-role-only RPC `klyx_reserve_external_provider_usage`. Store/RPC uncertainty fails closed. Non-critical providers may degrade; KYC/OTP and financial authority must never be faked.

Founder telemetry endpoint `/api/founder/external-costs` is read-only and reports **internal quota usage only**. It must never be presented as provider invoice truth.

## Replacement target

All future provider integrations must enter through a KLYX capability contract/adapter. Replacing a vendor changes the adapter and configuration, not the orchestration, ledger, eligibility, booking, workflow, or client authority model.

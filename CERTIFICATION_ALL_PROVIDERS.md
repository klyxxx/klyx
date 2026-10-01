# KLYX All Providers Certification

Target: certify DEMANDER, GAGNER, provider integrations, outage recovery, and Web/Android/iOS behavior without Stripe LIVE mutations.

## Scope

- DEMANDER: assistant → matching → quote → booking → Stripe → mission → incident → refund → close.
- GAGNER: assistant → profile → Twilio → Sumsub → eligibility → opportunity → mission → Stripe settlement.
- Transverse: Tolgee, Resend, Supabase, Cloudflare Turnstile + independent Durable Object WAL, elmah.io, OpenAI/fallback.
- Failure injection: OpenAI unavailable, Stripe unavailable, Supabase unavailable, Sumsub unavailable, delayed webhook, double click, network cut, worker crash, mobile/web resume.
- Recovery invariant: automatic retry/reconciliation first; `human_review` only when deterministic recovery cannot prove the external state.

## Evidence model

- Exact-SHA Complete Engine certification proves the KLYX orchestration engine.
- Exact-SHA Economic Chain certification uses Stripe TEST only.
- External providers are also checked with read-only network probes.
- Cloudflare independent WAL receives a separate safe certification write: HTTPS health, HMAC-authenticated encrypted Durable Object PUT, signed read-back, then acknowledgement. The probe uses an ephemeral encryption key so a racing recovery alarm cannot enqueue a synthetic canonical Supabase job.
- Supabase total-outage recovery receives PASS only when both the deterministic recovery suite and the real independent Cloudflare WAL proof pass. Missing WAL URL/secrets, unreachable Durable Object, failed signed write/read, or failed recovery tests remain FAIL.
- Web Desktop is exercised with Chromium.
- Android Web/PWA is exercised with a Pixel Chromium profile.
- iOS Web/PWA is exercised with an iPhone WebKit profile.
- Android native is certified on the exact SHA by KLYX Mobile CI through mobile TypeScript, Expo public configuration, native Android project generation, and the mobile/Core authority-boundary contract.
- iOS native is certified on the exact SHA by KLYX Mobile CI through native iOS project generation on macOS and the same mobile/Core authority-boundary contract.
- Native certification proves source configuration, native project generation, and authority boundaries. It does not claim physical-device, App Store, or Play Store delivery E2E unless a separate device/store certification exists.

## Strict outage verdict

The canonical execution queue remains Supabase, but every normal durable enqueue is prewritten to the independent Cloudflare Durable Object WAL before the canonical Supabase enqueue. If Supabase is unavailable after the prewrite, the external WAL retains the encrypted job and retries the signed recovery callback using the same idempotency key when Supabase returns.

The final report must fail closed unless it has both:

1. deterministic proof that replay/retry is idempotent and cannot create duplicate domain effects; and
2. real network proof that the independent Cloudflare Durable Object accepts and returns an encrypted durable entry outside the Supabase failure domain.

No report may infer Supabase outage recovery from source code alone.

## Safety

- No Stripe LIVE action.
- Provider outages are injected through deterministic tests/mocks unless an existing TEST-only certification proves the provider path.
- Provider health probes are read-only except the explicit non-financial Cloudflare WAL certification write; Stripe is TEST-only.
- The WAL probe performs zero canonical Supabase mutations and zero financial mutations.
- Ambiguous side effects are never blindly replayed.
- Financial truth remains `KLYX Ledger = Settlement truth = Stripe truth`.

## Re-certification trigger

- 2026-10-01: documentation-only trigger to re-run provider/WAL certification after the GitHub-connected cloud configuration was refreshed. No runtime behavior changed.

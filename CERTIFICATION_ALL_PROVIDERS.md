# KLYX All Providers Certification

Target: certify DEMANDER, GAGNER, provider integrations, outage recovery, and Web/Android/iOS behavior without Stripe LIVE mutations.

## Scope

- DEMANDER: assistant → matching → quote → booking → Stripe → mission → incident → refund → close.
- GAGNER: assistant → profile → Twilio → Sumsub → eligibility → opportunity → mission → Stripe settlement.
- Transverse: Tolgee, Resend, Supabase, Cloudflare Turnstile, elmah.io, OpenAI/fallback.
- Failure injection: OpenAI unavailable, Stripe unavailable, Supabase unavailable, Sumsub unavailable, delayed webhook, double click, network cut, worker crash, mobile/web resume.
- Recovery invariant: automatic retry/reconciliation first; `human_review` only when deterministic recovery cannot prove the external state.

## Evidence model

- Exact-SHA Complete Engine certification proves the KLYX orchestration engine.
- Exact-SHA Economic Chain certification uses Stripe TEST only.
- External providers are also checked with read-only network probes.
- Web Desktop is exercised with Chromium.
- Android Web/PWA is exercised with a Pixel Chromium profile.
- iOS Web/PWA is exercised with an iPhone WebKit profile.
- Android native is certified on the exact SHA by KLYX Mobile CI through mobile TypeScript, Expo public configuration, native Android project generation, and the mobile/Core authority-boundary contract.
- iOS native is certified on the exact SHA by KLYX Mobile CI through native iOS project generation on macOS and the same mobile/Core authority-boundary contract.
- Native certification proves source configuration, native project generation, and authority boundaries. It does not claim physical-device, App Store, or Play Store delivery E2E unless a separate device/store certification exists.

## Strict outage verdict

A total Supabase outage is not allowed to receive a false PASS. The canonical durable queue currently lives in Supabase. If Supabase is completely unavailable, KLYX can fail closed but cannot prove durable capture of a new recovery job in an independent failure domain. The final report therefore marks total Supabase outage recovery FAIL until an independent durable write-ahead/recovery channel exists.

## Safety

- No Stripe LIVE action.
- Provider outages are injected through deterministic tests/mocks unless an existing TEST-only certification proves the provider path.
- Provider health probes are read-only; Stripe is TEST-only.
- Ambiguous side effects are never blindly replayed.
- Financial truth remains `KLYX Ledger = Settlement truth = Stripe truth`.

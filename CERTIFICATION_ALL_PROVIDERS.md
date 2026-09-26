# KLYX All Providers Certification

Target: certify DEMANDER, GAGNER, provider integrations, outage recovery, and Web/Android/iOS behavior without Stripe LIVE mutations.

## Scope

- DEMANDER: assistant → matching → quote → booking → Stripe → mission → incident → refund → close.
- GAGNER: assistant → profile → Twilio → Sumsub → eligibility → opportunity → mission → Stripe settlement.
- Transverse: Tolgee, Resend, Supabase, Cloudflare Turnstile, elmah.io, OpenAI/fallback.
- Failure injection: OpenAI unavailable, Stripe unavailable, Supabase unavailable, Sumsub unavailable, delayed webhook, double click, network cut, worker crash, mobile/web resume.
- Recovery invariant: automatic retry/reconciliation first; `human_review` only when deterministic recovery cannot prove the external state.

## Safety

- No Stripe LIVE action.
- Provider outages are injected through deterministic tests/mocks unless an existing TEST-only certification proves the provider path.
- Ambiguous side effects are never blindly replayed.
- Financial truth remains `KLYX Ledger = Settlement truth = Stripe truth`.

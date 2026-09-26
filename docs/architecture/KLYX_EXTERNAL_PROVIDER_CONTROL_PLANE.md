# KLYX External Provider Control Plane

Status snapshot: 2026-09-26.

## Rule

External providers are replaceable transports, evidence sources or control planes. They are never allowed to become KLYX business authority by convenience.

```text
provider response
-> KLYX adapter/boundary
-> deterministic KLYX authority
-> audit / state transition
```

A browser may only receive data explicitly classified as public (`public_token_only`), a short-lived provider session (`public_session_only`), or a committed static snapshot. Provider secrets and server provider APIs are forbidden from client modules.

## Failure semantics

- `fail_closed`: database/auth, payments, KYC evidence, required phone verification and bot proof. No guessed success.
- `degrade`: LLM, email and localization can reduce functionality without inventing authoritative state.
- `fail_open`: observability failure must never break user or financial execution.
- `stop_control_plane`: source/deployment mutations stop when the trusted control plane is unavailable.

## Provider boundaries

| Provider | KLYX capability | Browser policy | Failure | Abstraction |
| --- | --- | --- | --- | --- |
| OpenAI | LLM / optional vision | server only | degrade | native LLM adapter |
| Supabase | DB / Auth / Storage | public token only | fail closed | governed boundary |
| Stripe | external payment rail | public token only | fail closed | governed financial boundary |
| Sumsub | KYC/KYB evidence | short-lived public session only | fail closed | governed identity boundary |
| Twilio | phone OTP transport | server only | fail closed | governed verification boundary |
| Resend | transactional email | server only | degrade | governed delivery boundary |
| Tolgee | translation authoring | static snapshots | degrade | static runtime snapshot |
| Cloudflare Turnstile | bot challenge | public token only | fail closed | governed auth boundary |
| elmah.io | error/uptime telemetry | server only | fail open | governed observability boundary |
| Vercel | hosting/deployment | control plane only | stop control plane | control plane |
| GitHub | source/CI/release gates | control plane only | stop control plane | control plane |

## Existing KLYX domain adapters remain authoritative

This control plane does not replace domain safety layers. In particular:

- Stripe remains behind KLYX financial runtime, ledger, settlement, reconciliation, Economic Eligibility and explicit LIVE authority.
- Supabase service-role access remains server-only; publishable browser credentials do not grant business authority.
- Sumsub evidence never directly authorizes settlement. KLYX eligibility decides.
- OpenAI output never performs a mutation.
- Turnstile challenge completion never replaces authenticated server policy.

## Replacement procedure

To replace a vendor:

1. keep the KLYX capability contract and authority semantics unchanged;
2. implement a new provider adapter/boundary;
3. map provider-specific errors into the existing KLYX failure policy;
4. keep secrets server-side and expose only explicitly public values;
5. replay deterministic fixtures and failure tests;
6. certify the new adapter on an exact SHA;
7. switch provider selection/configuration without changing the domain engine.

No replacement may relax `fail_closed`, ledger, eligibility, webhook authenticity, idempotency, reconciliation, or LIVE activation invariants.

## Known audit actions

The live Supabase security advisor currently reports public `SECURITY DEFINER` execution grants and a mutable `search_path` warning. These require a separate audited migration: do not revoke grants blindly without proving which RPCs are intentionally public.

Provider billing amounts are deliberately not hard-coded here because prices and account plans change. Runtime/provider metadata must remain architectural, while billing is collected by the business-cost subsystem and provider account audits.

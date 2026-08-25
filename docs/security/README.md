# KLYX Security Engine

This directory documents the internal security layer used to protect KLYX without changing the product's core mission.

## Purpose

KLYX Security runs as an internal, additive control plane. It must not add user-facing friction and must not replace the existing protected Playwright, performance, Supabase, Stripe, or operational checks.

Current foundation:

- repository secret-pattern detection;
- detection of service-role exposure in client-facing source;
- review signal for dynamic `eval()` usage;
- dependency vulnerability audit through `npm audit`;
- TypeScript safety verification;
- dedicated GitHub Actions certification job.

## Severity policy

- **critical**: credential/private-key style exposure. Blocks certification.
- **high**: dangerous privileged-secret usage in client-facing code. Blocks certification.
- **medium**: review signal. Reported, but does not block by itself.

The engine is intentionally conservative at first: false-positive-prone checks should be advisory until they have been calibrated against KLYX.

## Architecture

```text
KLYX repository / PR
        |
        v
KLYX Security Certification
        |
        +--> repository audit
        +--> dependency audit
        +--> TypeScript verification
        |
        v
classified findings
        |
        +--> critical/high => fail the security job
        +--> medium        => review signal
```

## Expansion path

Future additions should stay independent and be introduced only after proving useful:

1. Supabase RLS and SQL privilege policy checks.
2. Stripe webhook and authorization invariants.
3. API authorization/ownership regression tests.
4. SAST and dependency/license scanners.
5. IaC/Vercel configuration checks.
6. Safe DAST against owned KLYX environments.
7. Correlation/deduplication of findings and remediation guidance.
8. Regression baselines so fixed vulnerabilities cannot silently return.

## Design rules

- Security checks only target KLYX or systems KLYX is authorized to test.
- Do not expose secrets in logs or reports.
- Prefer deterministic checks before AI interpretation.
- AI may explain and prioritize findings, but a deterministic verifier should confirm blocking conditions whenever possible.
- Do not make production changes automatically from a security finding.
- Keep this layer additive so product development can continue independently.
- Do not replace the protected `Playwright browser verification` gate; security certification is an additional control.

## Local execution

```bash
node scripts/security/security-audit.mjs
npm audit --audit-level=high
npx tsc --noEmit --pretty false
```

The GitHub workflow uses `npm ci --ignore-scripts` for the audit environment so dependency installation does not execute package lifecycle scripts.

# KLYX ↔ ChatGPT plugin foundation

## Goal

Expose KLYX to ChatGPT through a dedicated MCP endpoint without weakening KLYX account, financial, compliance, or settlement boundaries.

Current phase: **public read-only foundation only**.

## Endpoint

```text
POST /mcp
```

Transport target:

```text
MCP Streamable HTTP
protocol: 2026-07-28
legacy initialize compatibility: 2025-11-25
```

## Current tool surface

```text
klyx_health
```

`klyx_health` is intentionally limited to connector reachability. It does not read:

- KLYX accounts;
- profiles;
- bookings;
- provider data;
- Supabase private data;
- Stripe objects;
- economic eligibility;
- ledger or settlement state.

It performs no mutation.

## Security invariant

```text
ChatGPT plugin connection
!=
KLYX account authorization
```

No private KLYX tool may be exposed until OAuth 2.1 authorization, scopes, token audience validation, revocation, audit, and account-first authorization are implemented and certified.

No MCP tool may become a financial authority.

```text
LLM != financial authority
LLM != KYC/KYB authority
LLM != settlement authority
```

Financial mutations must continue to pass through existing deterministic KLYX server boundaries.

## Planned authenticated phase

The authenticated connector should add OAuth 2.1 and narrow scopes such as:

```text
klyx.account.read
klyx.request.read
klyx.request.write
klyx.booking.read
klyx.booking.write
klyx.provider.read
klyx.provider.write
```

Financial or compliance scopes must not be granted as direct generic mutation permissions. Payment, refund, settlement, identity, and eligibility actions must remain behind their canonical KLYX domain engines and their own confirmation/gating rules.

Required OAuth controls:

- Authorization Code + PKCE;
- exact redirect URI validation;
- short-lived authorization codes;
- hashed/rotatable access tokens or signed audience-bound tokens;
- exact `aud` validation for `/mcp`;
- scope validation on every tool invocation;
- account-first authorization using canonical KLYX account identity;
- consent screen showing requested scopes;
- revocation;
- immutable connector audit trail;
- rate limiting;
- replay protection;
- no secrets in browser/mobile clients.

## ChatGPT developer-mode connection

Only after the branch is merged and deployed to a stable HTTPS origin:

1. Open ChatGPT Settings.
2. Open **Security and login**.
3. Enable **Developer mode**.
4. Open **Plugins** and select the plus button.
5. Add the KLYX MCP URL:

```text
https://<klyx-production-origin>/mcp
```

6. Name the connection `KLYX`.
7. Refresh the connection after MCP tool metadata changes.

During this foundation phase, only `klyx_health` must appear.

## Certification requirements before private tools

```text
MCP discovery
→ tool schema validation
→ OAuth discovery
→ PKCE authorization
→ token validation
→ scope enforcement
→ account-first authorization
→ tool audit
→ idempotency
→ provider outage recovery
→ revocation
→ Web + Android + iOS continuity
```

Private tools remain blocked until all required gates are PASS.

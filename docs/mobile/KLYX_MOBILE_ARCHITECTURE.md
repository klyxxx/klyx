# KLYX Mobile Architecture

## Goal

KLYX mobile is a thin Android/iOS client for the same KLYX Core used by the web product. It does not recreate marketplace, booking, financial, compliance, ledger, eligibility, settlement, recovery, or provider authority in the device application.

```text
                 KLYX Core
                    |
          orchestration / API
             +------+------+
             |             |
         Web Next.js    Mobile Expo
                        Android + iOS
```

## Authority boundary

The mobile application may contain only public configuration:

- `EXPO_PUBLIC_KLYX_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

It must never contain provider or server authority secrets, including Supabase service-role, Stripe secret/webhook keys, Sumsub secret keys, Twilio auth tokens, Resend API keys, or OpenAI API keys.

Mobile authenticates with Supabase Auth and sends the resulting access token to KLYX APIs as `Authorization: Bearer <token>`. `lib/api-auth.ts` remains the server authority: it validates the token, resolves the canonical KLYX account, verifies profile ownership, and projects allowed capabilities.

Profile selection is passed with `x-klyx-profile-id`. The header is untrusted and the server rejects any profile that does not belong to the authenticated account.

## Session storage

On Android/iOS, the Supabase session is persisted through `expo-secure-store`, backed by Android Keystore / iOS Keychain. Values are chunked so the adapter does not rely on large single native keychain entries. Passwords are not persisted by KLYX mobile.

## Initial vertical slice

The first mobile slice includes:

1. account creation and email/password sign-in through Supabase Auth;
2. secure persisted session;
3. `/api/mobile/bootstrap` for canonical account and owned profiles;
4. local profile selection using the existing server-verified profile header;
5. KLYX assistant conversation through `/api/brain/converse`;
6. a dedicated CI gate that typechecks the mobile client and rejects privileged secret references.

## Financial and paid-provider rule

The mobile client cannot activate Stripe LIVE, create authoritative ledger entries, decide economic eligibility, settle a provider, bypass KYC/KYB, or enable a paid external provider. Those mutations remain deterministic server-side operations behind existing KLYX gates.

## Rollout

Mobile publication follows the same product rollout states as KLYX:

```text
INTERNAL -> TEST -> PILOT -> LIMITED -> GENERAL
```

Each promotion requires exact-SHA CI, backend/web compatibility, mobile build certification, recovery evidence, observability, cost gates for paid providers, and a rollback path. Store submission is not authorization to advance the KLYX market rollout state.

# KLYX Mobile Architecture

```text
                 KLYX Core
                    │
          orchestration / API
             ┌──────┴──────┐
             │             │
         Web Next.js    Mobile KLYX
```

## Authority boundary

Mobile is an untrusted presentation client. It never becomes the source of truth for booking, Economic Eligibility, ledger, payment, settlement, refund, KYC/KYB, notification delivery or orchestration state.

The same authenticated user and KLYX profiles are reused. Supabase Auth establishes the mobile session; `/api/mobile/session` establishes the existing web-compatible secure cookie session. From that point, mobile calls the existing KLYX APIs exactly as the web client does.

## Engine mapping

| Engine | Mobile role | Authority |
| --- | --- | --- |
| Supabase | Auth, RLS-protected reads, realtime later | KLYX/Supabase server policy |
| Stripe | Native/payment presentation or server-created Checkout | KLYX financial runtime + Stripe server API |
| Sumsub | Native verification UI with short-lived server token | KLYX eligibility + Sumsub server state |
| Twilio | No provider credentials in app | KLYX API only |
| Resend | No provider credentials in app | KLYX API only |
| Tolgee | Consume KLYX-published catalog | KLYX/Tolgee catalog source |
| Assistant IA | Send messages to `/api/brain/respond` | KLYX deterministic orchestration |
| Economic Eligibility | Display server decision only | KLYX server |
| Ledger | Display/reconcile server truth only | KLYX canonical ledger |
| Booking | Read state; mutations via KLYX APIs | KLYX server |
| Notifications | RLS read + KLYX mutation endpoints | KLYX notification engine |

## Authentication bridge

1. Native client authenticates with Supabase public configuration.
2. Access/refresh tokens are stored in device secure storage.
3. Client POSTs both tokens over HTTPS to `/api/mobile/session`.
4. KLYX server validates them with Supabase and emits its normal secure auth cookies.
5. Existing profile, Brain, booking, payment and provider endpoints remain reusable.

This is a transport adapter, not a second backend.

## Financial invariant

```text
mobile intent
→ KLYX API
→ deterministic server authorization
→ Economic Eligibility
→ canonical ledger / payment runtime
→ external provider
```

The mobile bundle must never contain logic that can authorize a charge, choose a settlement beneficiary, alter a ledger entry, approve a refund, bypass KYC/KYB or activate LIVE.

## Phases

1. Foundation: auth/session bridge, profiles, assistant, bookings read, notifications read, Tolgee catalog.
2. Native verification/payment: Sumsub native flow, Stripe PaymentSheet/Checkout adapter using server-created payment state.
3. Device capabilities: push notifications, camera/photo request, voice, deep links, offline-safe read shells.
4. Certification: Android+iOS E2E, session recovery, profile switching, delayed network/webhook, payment redirect, KYC expiry, logout/relogin and no-secret bundle scan.

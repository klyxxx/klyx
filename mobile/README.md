# KLYX Mobile

Native Android + iOS client for the existing KLYX Core. It is not a second backend.

## Security contract

- Supabase publishable key only in the app; no service-role key.
- No Stripe secret, Sumsub secret, Twilio auth token, Resend key or AI provider key in the bundle.
- Auth tokens are persisted with `expo-secure-store`, never AsyncStorage/localStorage.
- The `/api/mobile/session` bridge converts the Supabase mobile session into the same secure server cookies used by the web app, so existing KLYX APIs and active-profile semantics are reused.
- Booking/payment/settlement/refund/eligibility decisions remain server-authoritative.
- Mobile may render a server-created checkout or native payment UI; it never computes authoritative money state.

## Stack

- Expo SDK 57 / React Native 0.86
- Expo Router
- Supabase Auth + RLS reads
- KLYX Next.js APIs for orchestration and mutations
- Stripe React Native SDK (public key only; server creates payment state)
- Sumsub React Native MobileSDK (ephemeral token fetched from KLYX API)
- Tolgee catalogs served by KLYX from the same certified catalog source

## Local start

```powershell
cd C:\Users\fenjo\Documents\klyx\mobile
Copy-Item .env.example .env.local
npm install
npx expo install --fix
npm run typecheck
npx expo prebuild
npm run android
```

For iOS, use EAS Build or a macOS/Xcode machine. Sumsub and Google/Apple Pay require a development/native build; Expo Go is not the certification target.

## Public environment values

Set only:

- `EXPO_PUBLIC_KLYX_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

All provider secrets stay in KLYX server environments.

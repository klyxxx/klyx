# KLYX Mobile Native Push — Activation Gate

Native push is deliberately fail-closed until all external credentials and the scheduler wake-up are configured.

## Server credentials

Configure only in the production server environment:

- `KLYX_FCM_PROJECT_ID`
- `KLYX_FCM_CLIENT_EMAIL`
- `KLYX_FCM_PRIVATE_KEY`
- `KLYX_APNS_TEAM_ID`
- `KLYX_APNS_KEY_ID`
- `KLYX_APNS_PRIVATE_KEY`
- `KLYX_APNS_BUNDLE_ID=app.klyx.mobile`
- `KLYX_APNS_ENV=production`

## Android application registration

The Android build must receive a Firebase `google-services.json`. Set `KLYX_GOOGLE_SERVICES_FILE` to its build-time path. Do not put the FCM service-account private key in the mobile project.

## Supabase scheduler wake-up

1. Generate a high-entropy bearer token.
2. Store the raw token in Supabase Vault as `klyx_mobile_push_scheduler_token`.
3. Store only its SHA-256 in `public.ops_mobile_push_scheduler.token_sha256`.
4. Verify `target_origin` points to the deployed KLYX Core origin.
5. Set `enabled=true` only after APNs + FCM test deliveries succeed.

## Required proof before activation

```text
Android physical device
→ permission granted
→ native FCM token registered
→ canonical user_notifications insert
→ mobile_push_outbox claim
→ FCM v1 accepted
→ device receives generic KLYX push
→ opening app retrieves canonical detail

IOS physical device
→ permission granted
→ native APNs token registered
→ canonical user_notifications insert
→ mobile_push_outbox claim
→ APNs accepted
→ device receives generic KLYX push
→ opening app retrieves canonical detail
```

Also certify:

- invalid token => installation disabled;
- provider outage => retry/backoff;
- worker crash => stale claim recovery;
- duplicate notification => no duplicate `(notification, installation)` delivery row;
- account switch => old-account delivery fails ownership check;
- signed-out device never receives sensitive notification text because the native payload is generic.

Activation is not implied by deployment. `enabled=false` remains the default.

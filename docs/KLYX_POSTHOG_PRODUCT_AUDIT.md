# KLYX PostHog product audit

Production audit date: 2026-09-06.

## Production state observed before this change

The connected PostHog project had no KLYX event ingested in the inspected production window. Its only dashboard was the default starter dashboard and every starter metric returned zero. No reusable PostHog actions existed.

KLYX already shipped a privacy-first manual capture boundary with these events:

- `account signed up`
- `account signed in`
- `service searched`
- `provider opened`
- `booking started`
- `booking confirmed`
- `booking abandoned`

The browser sends only an allowlisted event name plus a random session-scoped identifier. The server proxy does not create PostHog person profiles, disables GeoIP and does not forward route ids, profile ids, booking ids, search text, payment data or other business identifiers.

## Missing product milestones documented before repository modification

The requested journey could not be measured end-to-end because three indispensable stages were absent:

1. **Acquisition** — no anonymous visit/session-entry event existed.
2. **Profile** — neither successful profile creation nor successful active-profile selection had an analytics event.
3. **Payment** — booking confirmation was the last tracked milestone and must not be used as a payment proxy.

The production Vercel deployment contained the analytics code, but the available production tooling did not expose the values of `POSTHOG_PROJECT_TOKEN` or `POSTHOG_HOST`. Their correctness therefore was not inferred from the absence of events.

## Minimal privacy-first additions

This change adds only event names, never event properties:

- `visit started` — once per browser session when the root analytics observer is mounted.
- `profile created` — only after the profile creation API has succeeded and returned a profile.
- `profile selected` — only after the active-profile API has accepted the switch.
- `payment confirmed` — only after the server-side Stripe success page has retrieved the Checkout Session, verified `payment_status === "paid"` and synchronized KLYX payment state.

No Stripe webhook, Checkout creation route, Supabase migration, payment amount, Stripe session id, booking id, profile id, email, search term, URL or referrer is added to analytics.

## Product journey to build in PostHog

The primary session-level funnel is:

1. `visit started`
2. `account signed up`
3. `profile created` or `profile selected`
4. `service searched`
5. `provider opened`
6. `booking started`
7. `booking confirmed`
8. `payment confirmed`

Supporting analyses should include:

- visit → signup conversion;
- signup → profile conversion;
- profile → first search conversion;
- search → provider-open conversion;
- provider-open → booking-start conversion;
- booking-start → booking-confirmed conversion;
- booking-confirmed → payment-confirmed conversion;
- `booking abandoned` trend;
- signed-in usage as a separate returning-user metric.

## Dashboard creation gate

Do not populate a production product dashboard with synthetic data. Create or save the KLYX product funnel only after PostHog's live event schema confirms that the KLYX events are actually being ingested. Until then, the absence of events is an instrumentation/configuration signal, not a zero-conversion business result.

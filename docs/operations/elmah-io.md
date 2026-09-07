# KLYX elmah.io production observability

KLYX sends production-only server telemetry to the existing `klyx Log` on elmah.io. The integration is deliberately server-only and fail-open: an elmah.io outage must never break a booking, payment, account action, page render, or API response.

## Production environment

Configure these variables on the Vercel **Production** environment only:

- `ELMAH_IO_API_KEY`: dedicated elmah.io API key with the minimum write permissions required for Messages, Deployments, and Heartbeats.
- `ELMAH_IO_HEARTBEAT_ID`: ID of the heartbeat created for the KLYX production app.
- `CRON_SECRET`: random value of at least 16 characters used by Vercel to authenticate the heartbeat cron request.

Never expose these values through `NEXT_PUBLIC_*`, browser code, logs, screenshots, or source control.

## Error capture

- Standardized KLYX API errors are sent only for HTTP `5xx` responses.
- Unhandled Next.js server errors are captured through the root `instrumentation.ts` `onRequestError` hook.
- `requestId` is reused as elmah.io `correlationId` for standardized API failures.
- `VERCEL_GIT_COMMIT_SHA` is reduced to 12 hex characters and stored as the elmah.io message version.
- Only controlled metadata is sent: event/code, route pattern, method, status, duration, error class, and safe Next.js routing context.
- Raw exception messages, stack traces, cookies, authorization headers, request bodies, query strings, user IDs, IP addresses, emails, and payment data are not sent.
- HTTP `4xx` failures such as rejected Stripe webhook signatures remain in Vercel logs and do not consume the elmah.io error budget.

## Uptime

Create an elmah.io Uptime check on the same `klyx Log` for:

`https://klyx.be/api/health`

Use the normal five-minute uptime interval. Enable SSL expiry, domain expiry, canonical checks, and security-header checks where the current plan exposes them. The health endpoint returns only a minimal service status and never checks or leaks private dependencies.

## Heartbeat

Create one heartbeat named `KLYX production daily heartbeat` in the same log. Because the current Vercel Hobby plan permits native cron execution only once per day with hourly scheduling precision, configure the heartbeat for a 24-hour expected interval with at least a 2-hour grace period.

The production cron calls `/api/ops/elmah-heartbeat` daily at `03:17 UTC`. When `ELMAH_IO_HEARTBEAT_ID`, `ELMAH_IO_API_KEY`, or `CRON_SECRET` are absent, the endpoint is intentionally a no-op. Once all three are configured, only Vercel requests authenticated with `CRON_SECRET` can publish a Healthy heartbeat.

## Deployment correlation

`npm run build` invokes `scripts/operations/elmah-deployment.mjs` after a successful Next.js build. It is a no-op outside `VERCEL_ENV=production`. In production it creates an elmah.io deployment using the same 12-character Git SHA stored on error messages, which links new errors to the exact Vercel/GitHub release.

Deployment notification is fail-open. A temporary elmah.io failure cannot fail a KLYX production build.

## Alert rules

Keep alerts actionable:

1. Notify on new `Error` or `Fatal` messages from application `klyx.be`.
2. Notify on uptime failures and missing/unhealthy heartbeat events.
3. Add an occurrence/spike rule for repeated `5xx` errors so recurring failures are not hidden by new-error de-duplication.
4. Do not page on ordinary `4xx` traffic or rejected webhook signatures.
5. Treat payment/Stripe `5xx`, authentication/account `5xx`, booking confirmation failures, and production-wide uptime failures as high priority.

After configuration, send one controlled server-side test message and confirm that its version, application, route, severity, and correlation fields are present before relying on alerts.

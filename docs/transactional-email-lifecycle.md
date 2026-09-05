# KLYX transactional email lifecycle

This document is the coverage contract for important user-facing transactional emails. It exists so new product states are not added silently without deciding whether an email is required.

## Ownership rules

- KLYX application email is sent with the KLYX transactional mail layer and `support@klyx.be` branding.
- Supabase Auth owns authentication emails such as email confirmation, password reset, magic-link/OTP and email-address changes. KLYX must brand those templates in Supabase rather than duplicating them from application routes.
- Stripe is the source of truth for payment/refund terminal state. KLYX sends email only after KLYX has reconciled that state.
- Stripe-driven email is idempotent through `transactional_email_deliveries`; repeated webhooks must not create duplicate mail.
- Email failure must never roll back or relabel a successful booking, payment, refund, review or dispute mutation.

## Account and profiles

| Event | Recipient | Owner | Status |
| --- | --- | --- | --- |
| First KLYX profile created / account ready | Login email | KLYX | Covered |
| Additional client/provider profile created | Login email | KLYX | Covered |
| One profile deleted while another remains | Login email | KLYX | Covered |
| Final account/auth identity deleted | Former login email | KLYX | Covered |
| Email confirmation | Login email | Supabase Auth | Supabase-owned |
| Password reset | Login email | Supabase Auth | Supabase-owned |
| Email address change | Old/new login email | Supabase Auth | Supabase-owned |
| OTP / magic link | Login email | Supabase Auth | Supabase-owned |

## Quotes and reservations

| Event | Recipient | Status |
| --- | --- | --- |
| Quote requested | Provider | Covered |
| Quote sent | Client | Covered |
| Quote accepted | Provider | Covered |
| Quote rejected | Provider | Covered |
| Quote cancelled | Provider | Covered |
| Booking requested | Provider | Covered |
| Booking accepted | Client | Covered |
| Booking rejected | Client | Covered |
| Booking cancelled | Other participant | Covered |
| Refund started from booking cancellation | Client | Covered |

## Payments

| Event | Recipient | Status |
| --- | --- | --- |
| Single booking payment confirmed | Client | Covered |
| Single booking payment received | Provider | Covered |
| Single booking payment refused | Client | Covered |
| Group payment confirmed | Client | Covered |
| Group payment received | Provider | Covered |
| Group payment refused | Client | Covered |
| Split payment unit confirmed | Client + provider | Covered |
| Split payment unit refused | Client | Covered |
| Split payment session expired | Client | Covered |
| Provider Stripe account becomes fully payment-ready | Provider | Covered |

## Refunds

| Event | Recipient | Status |
| --- | --- | --- |
| Single refund started | Client | Covered at cancellation initiation |
| Single refund confirmed | Client | Covered |
| Single refund failed | Client | Covered |
| Group refund processing | Client + provider | Covered |
| Group refund confirmed | Client + provider | Covered |
| Group refund failed | Client + provider | Covered |
| Split refund processing | Client | Covered |
| Split refund partial | Client | Covered |
| Split refund confirmed | Client | Covered |
| Split refund failed | Client | Covered |

## Mission, trust and reviews

| Event | Recipient | Status |
| --- | --- | --- |
| Client confirms mission completed | Client | Review-request email covered |
| New review published | Provider | Covered only on first publication, not every edit |
| Group review published | Provider | Covered only on first publication, not every edit |
| Dispute opened | Opener + other participant | Covered |

## Deliberate non-email events

Routine tracking transitions such as `en_route`, `arrived` and `in_progress` remain in-app notifications. Sending an email for every tracking transition would create excessive mail and reduce the usefulness of transactional messages.

Individual chat messages also remain in-app for now. Before email-on-message is enabled, KLYX needs explicit notification preferences and digest/rate-limit behavior so active conversations cannot flood a mailbox.

## Change rule

Any future critical lifecycle state involving account access, a quote/reservation decision, money, refund, trust/safety, or a required user action must update this matrix and its integration contract in the same pull request.

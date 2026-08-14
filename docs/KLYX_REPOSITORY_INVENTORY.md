# KLYX Repository Inventory

Generated: 2026-08-14 14:32:14

## Repository

Local:
C:\Users\fenjo\Documents\klyx

GitHub:
klyxxx/klyx

Branch:
main

## Current continuity position

Last confirmed product step:
13.60

Current product step:
13.61

Next planned product step:
13.62

## Repository counts

App page/route files:
194

API route files:
104

Automated test files:
10

Supabase migration files:
1

## Canonical migration

supabase/migrations/20260814000000_klyx_canonical_baseline.sql

## Important Brain routes

- app/api/brain/respond/route.ts
- app/api/brain/actions
- app/api/brain/recommend
- app/api/brain/memory-context
- app/api/brain/market-publish
- app/api/brain/market-status
- app/api/brain/market-advice
- app/api/brain/llm-health

## Important product areas

- Assistant
- Accounts / profile switching
- Provider infrastructure
- Marketplace
- Bookings
- Split missions
- Stripe / Stripe Connect
- Payments
- Refund safety
- Reviews
- Messages
- Notifications
- Memory
- Brain
- LLM shadow infrastructure

## Current LLM operating mode

Paid OpenAI API:
DISABLED

KLYX_LLM_SHADOW_ENABLED:
0

Brain visible reply:
DETERMINISTIC

Automatic execution:
FALSE

## Mandatory verification

npm.cmd test

npx.cmd tsc --noEmit --pretty false

npm.cmd run build

## Secret policy

.env.local must never be committed.

API keys must never appear in repository documentation.

Secret values included in this document:
NONE
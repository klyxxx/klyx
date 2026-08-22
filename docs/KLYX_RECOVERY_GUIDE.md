# KLYX Recovery Guide

## Production incident

For a production outage, security/privacy incident, Supabase/Auth failure, payment/webhook anomaly or data-integrity concern, use:

`docs/operations/KLYX_INCIDENT_RUNBOOK.md`

This recovery guide is primarily for local/project recovery. Do not use local recovery shortcuts as a production incident procedure.

---

## If a new ChatGPT conversation is required

Give the new conversation these files first:

1. docs/KLYX_MASTER_STATE.md
2. docs/KLYX_CONTINUITY_STATE.json
3. docs/KLYX_NEXT_SESSION_PROMPT.md

Then say:

"Continue KLYX from the exact current step. Do not restart."

---

## If the local project is damaged

Repository:

C:\Users\fenjo\Documents\klyx

Remote:

klyxxx/klyx

Never delete the damaged repository immediately.

Rename it first, for example:

C:\Users\fenjo\Documents\klyx-damaged

Then clone the GitHub repository again.

Example:

git clone <KLYX-GITHUB-REMOTE> klyx

After cloning:

npm install

Then restore .env.local locally.

Never retrieve .env.local from GitHub because it must not exist there.

Then verify:

npm.cmd test

npx.cmd tsc --noEmit --pretty false

npm.cmd run build

---

## If .env.local disappears

Do not recreate secrets from memory.

Possible recovery sources:

- local safe backups
- VS Code Timeline / History
- original provider dashboards

Never paste the complete .env.local into ChatGPT.

Never commit it.

---

## If a code evolution fails

Do not advance.

Send the exact terminal error.

Fix only the current step.

---

## If Git becomes dirty

First inspect:

git status --short

Do not use:

git reset --hard

unless there is a deliberate recovery plan.

---

## Supabase protection

Canonical migration:

supabase/migrations/20260814000000_klyx_canonical_baseline.sql

Do not casually run linked destructive commands.

Avoid unplanned:

supabase db reset --linked
supabase db push --linked
supabase migration repair
supabase migration up --linked
supabase db pull

---

## KLYX safety invariants

automaticExecutionAllowed = false

Explicit confirmation required before:

- market publication
- provider selection
- booking
- payment

LLM infrastructure cannot silently execute transactions.

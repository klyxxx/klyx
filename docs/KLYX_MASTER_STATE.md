# KLYX MASTER STATE — Continuity Pack 1.0

Last continuity update: 14 August 2026

## 1. Project identity

Project: KLYX

Local repository:
C:\Users\fenjo\Documents\klyx

GitHub:
klyxxx/klyx

Default branch:
main

Primary market:
Brussels, Belgium

Primary language:
French

Core vision:

KLYX doit devenir le premier assistant IA qui organise tous les services du quotidien à la place de l'utilisateur.

Initial service categories:

- Babysitting
- Ménage
- Déménagement
- Bricolage

Commercial objective:

100 000 € de revenus au plus tard le 1er août 2029.

Current financial constraint:

Development must remain possible at 0 € until the founder has income.
Paid OpenAI API calls must remain disabled unless deliberately re-enabled later.

---

## 2. Technical stack

- Next.js 16.2.12
- App Router
- TypeScript
- Turbopack
- Tailwind CSS
- Supabase
- Stripe
- Stripe Connect
- Sumsub foundation
- Vercel
- GitHub
- Vitest
- Windows 10 / PowerShell

Local project path:

C:\Users\fenjo\Documents\klyx

Standard verification commands:

npm.cmd test
npx.cmd tsc --noEmit --pretty false
npm.cmd run build

---

## 3. Critical development rules

The assistant continuing KLYX must follow these rules.

1. Act as software architect.
2. Rewrite complete files or provide complete autonomous patchers.
3. Never provide fragile partial source fragments for production changes.
4. Always give exact paths.
5. Always provide verification commands.
6. If an error is reported, fix the current step only.
7. Do not advance while the current step is failing.
8. If the user says "send codes" without an error, treat the previous step as successful and continue.
9. Never ask the user to reconfirm a successful build after "send codes".
10. Prefer one autonomous PowerShell block using:

   & {
       ...
   }

11. A throw must stop the entire pasted block.
12. Avoid top-level if followed by separately pasted else.
13. Never use $matches as a normal variable because $Matches is automatic.
14. Backups must NOT end in .ts, .tsx, .js or .jsx.
15. Valid backup examples:

   route.ts.13-56.bak
   index.ts.13-61.bak

16. Never create backup.ts or backup.tsx inside compiled directories.
17. Prefer regex with \r?\n over exact multiline matching.
18. Never print secrets.
19. Never request the user to paste .env.local.
20. Never put passwords or API secrets in localStorage.
21. Never make production database writes from audit/checker scripts.
22. Never casually run linked Supabase migration repair/reset/push commands.

---

## 4. Product safety invariants

These are permanent KLYX rules.

The assistant or LLM must NEVER silently:

- publish a market request
- select a provider
- create a booking
- create a payment
- refund a payment
- execute another transactional action

Explicit user confirmation is required before:

- market publication
- provider selection
- booking
- payment

Permanent contract:

automaticExecutionAllowed = false

The deterministic Brain remains authoritative until a future explicitly validated migration changes this.

---

## 5. Core user journey

Target end-to-end KLYX journey:

User describes need
→ Brain understands
→ memory/context
→ missing information
→ readiness
→ market request
→ provider matching
→ offers
→ recommendation
→ explicit user confirmation
→ booking
→ payment
→ service tracking
→ completion
→ review

Long-term differentiators:

1. AI assistant that acts after confirmation
2. Personal memory
3. Search from photos
4. Automatic estimates
5. One-click reservation
6. KLYX trust score
7. Multi-service orchestration

---

## 6. Account architecture

Target model:

One primary login
→ multiple KLYX profiles
→ one-click switching

Demo profiles historically used:

Mohamed = client
Youssouf = provider

Requirements:

- roles stored reliably in Supabase
- no passwords stored in localStorage
- persistent Supabase session
- one-click profile switching

---

## 7. Database / migrations

Supabase is the primary data layer.

Important tables historically used include:

- profiles
- services
- user_services
- service_profiles
- bookings
- favorites
- messages
- notifications
- reviews
- stores

Migration history was normalized during steps 13.37–13.43.

Canonical local migration:

supabase/migrations/20260814000000_klyx_canonical_baseline.sql

Expected linked migration identity:

20260814000000

Important:

Do NOT casually execute:

- supabase db reset --linked
- supabase db push --linked
- supabase migration up --linked
- supabase migration repair
- supabase db pull

Migration normalization is considered completed.

---

## 8. Payment architecture

Stripe / Stripe Connect foundations are already significantly developed.

Historical completed areas include:

- payment safety contract
- price proof
- acceptance
- payment contract
- Stripe Connect readiness
- final payment proof
- split checkout
- destination charges
- KLYX platform fee
- idempotency
- webhook safety
- refund isolation / reconciliation
- prevention foundations against duplicated payment

Transactional payment operations must always remain confirmation-gated.

---

## 9. Brain / LLM state

Important Brain API:

app/api/brain/respond/route.ts

The deterministic Brain currently generates the visible reply.

Relevant APIs historically include:

- /api/brain/actions
- /api/brain/market-advice/[id]
- /api/brain/market-publish
- /api/brain/market-status/[id]
- /api/brain/memory-context
- /api/brain/recommend
- /api/brain/respond

LLM work completed:

13.52
Brain LLM Foundation Audit

13.53
LLM Provider Foundation + safety contract

13.54
OpenAI provider foundation

13.55
LLM Shadow integration

13.56
Shadow client isolation / sanitization

13.57
LLM health foundation

13.58
Real provider smoke infrastructure

13.59
Controlled shadow enable/disable scripts

13.60
Free deterministic mode chosen because paid OpenAI credits are unavailable.

Current operating mode:

KLYX_LLM_SHADOW_ENABLED=0

Paid OpenAI calls:
DISABLED

The OpenAI integration remains available as future infrastructure but must not block development.

---

## 10. Current exact development position

Last confirmed successful step:

13.60

Current step:

13.61 — Brain ↔ Shadow Comparison Observability Foundation

13.61 files created/planned:

lib/brain/shadow/shadow-comparison.ts
tests/unit/brain-shadow-comparison.test.ts
scripts/check-step-13-61.ps1

The shadow comparison module is intended to measure:

- deterministic intent
- shadow intent
- agreement/disagreement
- confidence
- confidence bucket

It must always return:

automaticExecutionAllowed: false
canInfluenceUserReply: false

Important:

13.61 has NOT yet been explicitly confirmed successful by the user.

Last 13.61 blocker:

.env.local had disappeared and was restored from:

.env.local.13-59.bak

Then the checker found that:

KLYX_LLM_SHADOW_ENABLED=0

was not normalized as expected.

A correction script was supplied to force exactly one occurrence:

KLYX_LLM_SHADOW_ENABLED=0

Next action:

Run:

powershell -ExecutionPolicy Bypass -File .\scripts\check-step-13-61.ps1

If it fails:
fix 13.61 only.

If the user says "send codes":
consider 13.61 successful and proceed to 13.62.

---

## 11. Environment-file safety

.env.local contains secrets.

Never display its complete contents.

Never ask the user to paste it.

A recovery incident occurred on 14 August 2026.

VS Code history successfully recovered .env.local.

A later available backup was:

.env.local.13-59.bak

Never commit .env.local to GitHub.

Never store secret values in this continuity pack.

Only variable NAMES may be documented.

Potential variables include:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- Stripe variables
- OPENAI_API_KEY
- KLYX_LLM_SHADOW_ENABLED
- KLYX_LLM_SHADOW_LOG
- KLYX_OPENAI_MODEL
- KLYX_OPENAI_TIMEOUT_MS

Values must remain secret.

An OpenAI key was exposed during conversation and must be considered compromised/revoked.
Any future OpenAI key must never be pasted into ChatGPT.

---

## 12. Financial operating mode

Until the founder has income:

Target infrastructure spending:
0 €

Keep using free tiers whenever possible.

Do NOT require:

- OpenAI paid API
- Supabase Pro
- Vercel Pro
- Apple Developer
- Google Play developer account
- paid advertising
- paid SMS
- paid KYC volume

These can be activated later when commercially justified.

Priority is completing the real KLYX product journey using free infrastructure.

---

## 13. Launch strategy

Do NOT attempt worldwide launch first.

Recommended first launch:

Brussels

Initial categories:

- cleaning
- babysitting
- handyman
- moving

First milestone:

A real client can:

1. describe a need
2. receive understanding from KLYX
3. find real providers
4. receive a recommendation
5. explicitly confirm
6. book
7. pay
8. follow completion
9. leave a verified review

First provider milestone:

A real provider can:

1. register
2. create provider profile
3. define services
4. define pricing
5. define area
6. define availability
7. receive mission
8. accept/refuse
9. perform service
10. receive payment

---

## 14. Major remaining product work

Highest priorities after current technical steps:

A. End-to-end assistant UX
B. Real provider onboarding
C. Service/pricing/area/availability
D. Search + matching
E. Recommendation engine
F. Calendar / availability
G. Trust & verification
H. Reviews after verified services
I. Real booking completion flow
J. Stripe production readiness
K. Disputes / refund UX
L. Notifications
M. Professional landing/onboarding
N. Mobile responsive polish
O. Legal/privacy/terms before public commercial launch

Avoid endless invisible infrastructure work if the main user journey is not progressing.

---

## 15. Estimated roadmap

Indicative estimates only:

MVP technically complete:
4–8 weeks

Real Brussels beta:
2–3 months

Public launch-quality KLYX:
3–5 months

Strongly differentiated version:
6–9 months

Large-scale maturity:
12–24+ months

Commercial deadline:
1 August 2029

---

## 16. Next planned steps

Immediate:

13.61
Finish Brain/Shadow comparison foundation.

Then likely:

13.62
Free local Brain statistics:
- readiness rate
- missing fields
- ambiguity
- completeness
- understood requests

After that, priority should increasingly shift toward visible end-to-end product completion rather than endless infrastructure.

---

## 17. Continuation instruction for any future ChatGPT session

When this file is supplied to a future ChatGPT conversation:

1. Read it completely.
2. Do not restart KLYX.
3. Do not redesign completed architecture without evidence.
4. Continue from CURRENT EXACT DEVELOPMENT POSITION.
5. Ask for current error output only if the current step is failing.
6. If user says "send codes", advance to next planned step.
7. Preserve all safety invariants.
8. Keep development possible at 0 €.
9. Always use complete files/autonomous PowerShell scripts.
10. Always validate with tests, TypeScript and Next.js build.

End of KLYX MASTER STATE.
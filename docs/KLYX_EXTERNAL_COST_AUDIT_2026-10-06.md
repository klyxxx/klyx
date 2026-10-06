# KLYX — External Cost Audit 2026-10-06

## Objective
Development must continue with 0 € available.
The default is fail-closed: KLYX_EXTERNAL_COST_MODE=zero.

## Runtime guard
Variable-cost providers are blocked before network I/O in zero mode:
- OpenAI
- Sumsub
- Twilio
- Resend
- elmah.io

Guarded mode applies provider enablement, provider-side spend-cap confirmation, quota, rate limit, local monthly budget, circuit breaker, provider call, actual-cost accounting, an 80% warning, and automatic block at 100%.

## AI
Routing: deterministic KLYX question -> local/free answer. Only unmatched requests can reach an external LLM.
Default external model: gpt-6-luna.

## Provider audit
| Provider | 0€ strategy | Free allowance / threshold | Cost trigger | Fallback |
|---|---|---|---|---|
| OpenAI | disabled by default | no guaranteed free API credit | token usage | deterministic/local answer |
| Supabase | Free plan | free quotas | quota/paid plan | cache/reduce queries |
| Stripe | TEST only | test mode | payment/Connect fees | no LIVE mutation |
| Sumsub | disabled | 14-day / 50 checks trial | $1.35/check + monthly minimum | manual/dev stub |
| Twilio | disabled | trial/free start only | Verify $0.05 success + channel fee | local OTP/dev bypass |
| Resend | Free | 3,000/mo + 100/day | Pro $20/mo; $0.90/1k overage | log/skip non-critical email |
| Tolgee | Free | 30k hosted words / 3 seats | paid tier | local static translations |
| Cloudflare | Free | Workers 100k/day; Turnstile unlimited challenges | paid usage | local/Vercel path |
| elmah.io | disabled | trial | paid plan | Vercel/GitHub logs |
| Vercel | Hobby | $0 with usage caps | Pro $20/mo / paid usage | stay Hobby while non-commercial |
| GitHub | public repo | public Actions standard runners free | private/paid runner/storage | public standard runners |

## Connected observations
- Supabase klyx organization: Free; supabase-amber-ferry: active/healthy.
- Resend: 2/3,000 monthly emails and 1/100 daily at audit time.
- Stripe LIVE balance: €0 available, €0 pending; no balance transactions observed.
- Vercel billing charges were not exposed by the connected billing endpoint; current invoice is unknown, not assumed zero.
- GitHub repository is public.

## Guarded mode requirements
- KLYX_EXTERNAL_COST_MODE=guarded
- KLYX_PROVIDER_<PROVIDER>_ENABLED=1
- KLYX_PROVIDER_<PROVIDER>_SPEND_CAP_CONFIRMED=1
- KLYX_PROVIDER_<PROVIDER>_MONTHLY_BUDGET_MINOR=<positive integer>
- OpenAI additionally requires KLYX_OPENAI_ENABLED=1 and a provider/project hard spend limit configured at OpenAI.

## Rules
- No external AI for deterministic questions.
- No paid provider health probes in zero mode.
- Cache read-only results where freshness permits.
- Batch non-interactive work.
- Do not enable Sumsub/Twilio/elmah.io for ordinary development.
- Do not enable Resend paid overages.
- Never use Stripe LIVE for certification.
- Keep Supabase Free and avoid unnecessary projects.
- Keep Vercel Hobby during non-commercial development.

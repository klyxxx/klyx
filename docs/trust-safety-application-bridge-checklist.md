# Trust & Safety application bridge rollout checklist

- [x] Canonical `accounts` identity is the Trust & Safety subject.
- [x] User eligibility responses are purpose-limited and redacted.
- [x] Human review / appeal requests are account-scoped and idempotent.
- [x] Admin review queue requires KLYX admin authorization.
- [x] Human replacement decisions append history instead of overwriting it.
- [x] Review resolution is atomic and service-role only.
- [x] No category or booking is switched to `enforce` by this phase.
- [ ] Activate a category only after the relevant policy has been legally reviewed and explicitly approved for rollout.

# KLYX Trust & Safety application bridge

This phase connects the Trust & Safety foundation to product APIs without activating category enforcement.

## User-facing server API

- `GET /api/trust/eligibility` returns only purpose-limited eligibility data for the authenticated canonical account.
- Raw `input_snapshot`, raw verification evidence and internal account identifiers are not exposed.
- `POST /api/trust/reviews` lets the canonical account request an available human review or appeal.
- Open review requests are idempotent to avoid duplicate cases.

## Human review operations

- `GET /api/admin/trust/reviews` exposes the operational review queue to authorized KLYX admins.
- `PATCH /api/admin/trust/reviews` can start a review, uphold the existing decision or replace it with a new human decision.
- Replacement decisions are appended and linked through `supersedes_id`; the original decision remains in history.
- Review resolution is performed by a server-only PostgreSQL function so the decision append and review completion remain atomic.
- Reviewer attribution and rationale are mandatory.

## Rollout invariant

This phase does **not** switch any `trust_mission_contexts.enforcement_mode` row to `enforce` and does not create a global active category policy.

Category enforcement remains an explicit later rollout step after the relevant Belgian category/jurisdiction policy has been legally reviewed, versioned and activated.

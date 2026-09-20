# KLYX Human Operations / Case Management

Mission 15 adds a human operational work queue on top of the existing KLYX authorities.

## Boundary

Human Operations coordinates **work**. It does not become business truth.

Canonical authorities remain unchanged:

- `trust_cases`, `trust_decision_reviews`, restrictions and eligibility decisions own Trust & Safety truth;
- `financial_reconciliation_cases` / `financial_reconciliation_events` own financial-divergence truth;
- Booking owns booking state;
- Settlement owns settlement state and Stripe reconciliation;
- Risk / Economic Eligibility own authorization;
- `ops_durable_jobs` owns durable execution state;
- `ops_events` remains the append-only Operations audit stream.

An Operations case may **reference** those resources. It may not silently rewrite them.

## Case model

Mission 15 adds:

- `ops_human_cases`
- `ops_human_case_links`
- `ops_durable_job_redrives`

`ops_human_cases` stores only the mutable work-queue state required for humans to coordinate:

- stable `case_key`;
- case/queue classification;
- canonical source reference;
- structured failure-domain scope;
- priority;
- current workflow state;
- assignee;
- optional due date;
- optimistic `version`;
- opened / claimed / resolved / closed timestamps.

It does **not** copy canonical domain payloads.

## Case lifecycle

```text
open
  -> triage
      -> in_review
          -> waiting_external
              -> in_review
          -> resolved
              -> in_review   # explicit reopen before closure
              -> closed
```

Direct state mutation is unavailable to browser roles and application service-role code.

Transitions use SECURITY DEFINER RPCs and optimistic version fencing.

A human transition requires ownership of the case.

## Assignment

Assignment is explicit.

`klyx_assign_human_ops_case`:

- locks the case;
- checks the expected version;
- records the assignee;
- moves `open -> triage` on first claim;
- increments the case version;
- appends `human_case.assigned` to `ops_events`.

Mission 15 does not create a second operator identity authority. The current application surface authorizes the Founder before passing an `auth.users.id` to server-only RPCs.

A future operator/role directory can extend that authorization layer without changing the case truth model.

## Audit

Mission 15 intentionally does **not** create a second universal case-event journal.

All operational case transitions append to existing `ops_events`:

- `human_case.opened`
- `human_case.linked`
- `human_case.assigned`
- `human_case.status_changed`
- `human_case.dlq_redrive_requested`

`ops_events` is already append-only under Mission 13.

`ops_human_case_links` and `ops_durable_job_redrives` are also immutable after insertion.

## Links to canonical authorities

`ops_human_case_links` stores references such as:

```text
durable_job
trust_case
trust_decision_review
financial_reconciliation
booking
settlement
operation
```

The set is intentionally extensible. A link is not an ownership transfer.

For example:

```text
ops_human_case
  -> financial_reconciliation:abc
```

means a human operator is working the financial divergence.

It does **not** mean Operations may alter the immutable ledger or resolve the financial case without the financial authority's own RPC.

## DLQ intake

Mission 14 deliberately stopped at a read-only DLQ.

Mission 15 adds explicit human intake:

`klyx_open_dlq_human_ops_case`

The function:

1. locks the durable job;
2. requires `status = dead_lettered`;
3. creates or idempotently reuses an Operations case;
4. copies only operational scope/reference fields;
5. links the case to the original durable job.

No automatic case trigger is installed.

No dead-letter job is automatically redriven.

## Explicit DLQ redrive

Redrive is manual and fail-closed.

Required conditions:

- the Operations case is `in_review`;
- the case is assigned to the human operator requesting redrive;
- the original job is still `dead_lettered`;
- the case is explicitly linked to that job;
- there is no active/succeeded redrive descendant;
- a stable `redrive_key` and reason code are provided.

The original dead-lettered row is never changed back to `queued`.

Instead:

```text
original job
status = dead_lettered
        |
        | explicit human redrive
        v
new durable job
status = queued
```

The new job is created through the Mission 14 `klyx_enqueue_durable_job` authority.

The lineage is written to `ops_durable_job_redrives`.

## Redrive idempotency

The redrive request identity is:

```text
(case_id, redrive_key)
```

The generated durable-job idempotency key is:

```text
redrive:<original_job_id>:<redrive_key>
```

A replay with the same case, original job, operator and reason returns the existing new job.

A contradictory replay fails closed.

A later redrive is allowed only after previous redrive descendants have themselves reached `dead_lettered`.

## Existing domain review systems are preserved

Mission 15 does not replace or modify the meaning of:

- Trust & Safety case investigation;
- trust decision appeals/reviews;
- financial reconciliation/human-review events;
- post-booking incident policy;
- refund risk gates;
- economic eligibility;
- settlement release claims;
- Stripe truth;
- immutable ledger events.

Human Operations may link to those systems and coordinate ownership, but resolution still belongs to the domain-specific authority.

## Security

The Human Operations tables are server-only:

- RLS enabled;
- no privileges for `public`, `anon` or `authenticated`;
- application `service_role` receives read-only table access;
- state changes occur through service-role-only RPCs;
- case links and redrive lineage are immutable;
- Founder API authorization is required for the current human-management route.

The server boundary is:

`lib/human-operations-server.ts`

The Founder route is:

`/api/founder/operations/cases`

## Data minimization

Cases should contain operational summaries and stable references.

Do not copy into Human Operations:

- KYC documents;
- raw identity payloads;
- complete financial records;
- secrets;
- arbitrary exception stacks;
- full domain objects.

Domain evidence stays with the domain authority.

## Out of scope

Mission 15 creates:

- no automatic sanction;
- no automatic refund;
- no automatic settlement release;
- no automatic financial reconciliation decision;
- no automatic DLQ redrive;
- no public worker endpoint;
- no Stripe LIVE activation;
- no Vercel mutation;
- no production Supabase migration application.

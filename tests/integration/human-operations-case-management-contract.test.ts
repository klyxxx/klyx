import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260920193000_klyx_human_operations_case_management.sql"
  ),
  "utf8"
);

const server = fs.readFileSync(
  path.join(root, "lib/human-operations-server.ts"),
  "utf8"
);

const route = fs.readFileSync(
  path.join(root, "app/api/founder/operations/cases/route.ts"),
  "utf8"
);

const doc = fs.readFileSync(
  path.join(root, "docs/KLYX_HUMAN_OPERATIONS_CASE_MANAGEMENT.md"),
  "utf8"
);

describe("Mission 15 Human Operations / Case Management", () => {
  it("creates an operational work queue without replacing domain case authorities", () => {
    expect(migration).toContain(
      "create table if not exists public.ops_human_cases"
    );
    expect(migration).toContain(
      "create table if not exists public.ops_human_case_links"
    );
    expect(migration).toContain(
      "create table if not exists public.ops_durable_job_redrives"
    );

    expect(migration).not.toContain(
      "create table if not exists public.trust_cases"
    );
    expect(migration).not.toContain(
      "create table if not exists public.financial_reconciliation_cases"
    );

    expect(doc).toContain(
      "Human Operations coordinates **work**. It does not become business truth."
    );
  });

  it("keeps Operations cases server-only and mutation-RPC controlled", () => {
    expect(migration).toContain(
      "alter table public.ops_human_cases enable row level security"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.ops_human_cases"
    );
    expect(migration).toContain(
      "grant select on table public.ops_human_cases to service_role"
    );
    expect(migration).not.toContain(
      "grant select, insert, update on table public.ops_human_cases"
    );

    for (const rpc of [
      "klyx_open_human_ops_case",
      "klyx_link_human_ops_case",
      "klyx_assign_human_ops_case",
      "klyx_transition_human_ops_case",
      "klyx_open_dlq_human_ops_case",
      "klyx_redrive_dead_lettered_job",
    ]) {
      expect(migration).toContain(
        `create or replace function public.${rpc}`
      );
    }

    expect(server).toContain('import "server-only";');
    expect(route).toContain("requireKlyxFounder");
  });

  it("uses optimistic version fencing and explicit ownership for human decisions", () => {
    expect(migration).toContain(
      "KLYX_HUMAN_OPS_CASE_VERSION_CONFLICT"
    );
    expect(migration).toContain(
      "v_case.assigned_to_auth_user_id is distinct from p_operator_auth_user_id"
    );
    expect(migration).toContain(
      "KLYX_HUMAN_OPS_CASE_NOT_OWNED"
    );
    expect(migration).toContain(
      "version = version + 1"
    );
    expect(doc).toContain(
      "A human transition requires ownership of the case."
    );
  });

  it("reuses the Mission 13 append-only Operations event stream", () => {
    expect(migration).toContain(
      "insert into public.ops_events"
    );

    for (const event of [
      "human_case.opened",
      "human_case.linked",
      "human_case.assigned",
      "human_case.status_changed",
      "human_case.dlq_redrive_requested",
    ]) {
      expect(migration).toContain(event);
    }

    expect(migration).not.toContain(
      "create table if not exists public.ops_human_case_events"
    );
    expect(doc).toContain(
      "Mission 15 intentionally does **not** create a second universal case-event journal."
    );
  });

  it("keeps case links and redrive lineage immutable", () => {
    expect(migration).toContain(
      "KLYX_HUMAN_OPS_AUDIT_IMMUTABLE"
    );
    expect(migration).toContain(
      "klyx_ops_human_case_links_immutable"
    );
    expect(migration).toContain(
      "klyx_ops_durable_job_redrives_immutable"
    );
    expect(migration).toContain(
      "before update or delete on public.ops_human_case_links"
    );
    expect(migration).toContain(
      "before update or delete on public.ops_durable_job_redrives"
    );
  });

  it("makes DLQ intake explicit and never automatic", () => {
    expect(migration).toContain(
      "v_job.status <> 'dead_lettered'"
    );
    expect(migration).toContain(
      "KLYX_HUMAN_OPS_DURABLE_JOB_NOT_DEAD_LETTERED"
    );
    expect(migration).not.toContain(
      "create trigger klyx_auto_open_dlq_case"
    );
    expect(migration).not.toContain(
      "create trigger klyx_auto_redrive"
    );
    expect(doc).toContain(
      "No automatic case trigger is installed."
    );
    expect(doc).toContain(
      "No dead-letter job is automatically redriven."
    );
  });

  it("redrives by creating a new durable job instead of resurrecting the terminal row", () => {
    expect(migration).toContain(
      "from public.klyx_enqueue_durable_job("
    );
    expect(migration).toContain(
      "create table if not exists public.ops_durable_job_redrives"
    );
    expect(migration).toContain(
      "KLYX_HUMAN_OPS_REDRIVE_REQUIRES_IN_REVIEW"
    );
    expect(migration).toContain(
      "KLYX_HUMAN_OPS_REDRIVE_ACTIVE_DESCENDANT"
    );
    expect(migration).toContain(
      "KLYX_HUMAN_OPS_REDRIVE_JOB_NOT_LINKED"
    );

    expect(migration).not.toMatch(
      /update\s+public\.ops_durable_jobs[\s\S]{0,220}status\s*=\s*'queued'/
    );

    expect(doc).toContain(
      "The original dead-lettered row is never changed back to `queued`."
    );
  });

  it("makes redrive idempotent and conflict-aware", () => {
    expect(migration).toContain(
      "constraint ops_durable_job_redrives_request_unique"
    );
    expect(migration).toContain(
      "unique (case_id, redrive_key)"
    );
    expect(migration).toContain(
      "KLYX_HUMAN_OPS_REDRIVE_KEY_CONFLICT"
    );
    expect(migration).toContain(
      "redrive:"
    );
    expect(doc).toContain(
      "A contradictory replay fails closed."
    );
  });

  it("does not grant Human Operations authority over sensitive domain mutations", () => {
    const mission = [migration, server, route, doc].join("\n");

    for (const forbidden of [
      "stripe.transfers.create(",
      "stripe.refunds.create(",
      "stripe.checkout.sessions.create(",
      '.from("financial_ledger_events").update(',
      '.from("trust_restrictions").update(',
      "KLYX_STRIPE_MODE=live",
    ]) {
      expect(mission).not.toContain(forbidden);
    }

    expect(doc).toContain("no Stripe LIVE activation");
    expect(doc).toContain("no Vercel mutation");
  });
});

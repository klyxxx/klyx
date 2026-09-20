import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8"
  );
}

const migration = read(
  "supabase/migrations/20260920190000_klyx_durable_jobs_retry_dlq.sql"
);
const server = read("lib/durable-jobs-server.ts");
const doc = read("docs/KLYX_DURABLE_JOBS_RETRY_DLQ.md");

describe("Mission 14 Durable Jobs + Retry / DLQ", () => {
  it("creates one durable operational job authority without replacing domain truth", () => {
    expect(migration).toContain(
      "create table if not exists public.ops_durable_jobs"
    );
    expect(migration).toContain(
      "operation_id uuid not null references public.ops_operations(id) on delete restrict"
    );
    expect(migration).toContain(
      "Durable at-least-once KLYX job queue"
    );
    expect(doc).toContain(
      "Durable Jobs coordinates execution. It does **not** become business truth."
    );
    expect(doc).toContain("at-least-once");
    expect(doc).not.toContain("exactly-once execution.");
  });

  it("binds idempotency keys to an immutable request fingerprint", () => {
    expect(migration).toContain(
      "unique (job_type, idempotency_key)"
    );
    expect(migration).toContain(
      "request_fingerprint jsonb not null"
    );
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("hashtextextended");
    expect(migration).toContain(
      "KLYX_DURABLE_JOB_IDEMPOTENCY_CONFLICT"
    );
    expect(doc).toContain(
      "Terminal jobs are never silently resurrected by enqueue."
    );
  });

  it("claims with SKIP LOCKED and fences workers by lease token", () => {
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain(
      "attempt_count = attempt_count + 1"
    );
    expect(migration).toContain(
      "lease_token = v_lease_token"
    );
    expect(migration).toContain(
      "last_claim_token = v_lease_token"
    );
    expect(migration).toContain(
      "v_job.lease_token is distinct from p_lease_token"
    );
    expect(migration).toContain(
      "v_job.lease_owner is distinct from v_worker_id"
    );
    expect(migration).toContain(
      "KLYX_DURABLE_JOB_LEASE_FENCED"
    );
  });

  it("supports bounded lease extension and rejects expired leases", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_extend_durable_job_lease"
    );
    expect(migration).toContain(
      "KLYX_DURABLE_JOB_LEASE_EXPIRED"
    );
    expect(server).toContain(
      "export async function extendKlyxDurableJobLease"
    );
  });

  it("reaps expired leases into retry_wait or dead_lettered", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_reap_expired_durable_jobs"
    );
    expect(migration).toContain(
      "status = 'dead_lettered'"
    );
    expect(migration).toContain(
      "status = 'retry_wait'"
    );
    expect(migration).toContain(
      "last_error_code = 'LEASE_EXPIRED'"
    );
  });

  it("uses deterministic capped exponential backoff", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_durable_job_backoff_seconds"
    );
    expect(migration).toContain("power(2::numeric");
    expect(migration).toContain(
      "p_backoff_max_seconds"
    );
    expect(doc).toContain(
      "delay = max(1, min(backoff_max, backoff_base * 2^(attempt_count - 1)))"
    );
  });

  it("makes completion and failure acknowledgements idempotent for the same claim", () => {
    expect(migration).toContain(
      "v_job.last_claim_token is not distinct from p_lease_token"
    );
    expect(migration).toContain(
      "v_job.last_worker_id is not distinct from v_worker_id"
    );
    expect(migration).toContain(
      "v_job.status = 'succeeded'"
    );
    expect(migration).toContain(
      "v_job.status in ('retry_wait', 'dead_lettered')"
    );
  });

  it("treats DLQ as terminal read-only state with no automatic redrive", () => {
    expect(migration).toContain(
      "create or replace view public.ops_durable_job_dlq"
    );
    expect(migration).toContain(
      "where status = 'dead_lettered'"
    );
    expect(server).toContain(
      "export async function listKlyxDeadLetterJobs"
    );
    expect(server).not.toContain("redrive");
    expect(migration).not.toContain(
      "klyx_redrive_durable_job"
    );
    expect(doc).toContain(
      "Human ownership, case creation and explicit redrive belong to Mission 15"
    );
  });

  it("reuses Mission 13 ops_events instead of creating another audit authority", () => {
    for (const event of [
      "durable_job.enqueued",
      "durable_job.claimed",
      "durable_job.retry_scheduled",
      "durable_job.succeeded",
      "durable_job.dead_lettered",
    ]) {
      expect(migration).toContain(event);
    }

    expect(migration).toContain(
      "insert into public.ops_events"
    );
    expect(migration).not.toContain(
      "create table if not exists public.ops_job_events"
    );
    expect(migration).not.toContain("ops_job_audit");
  });

  it("keeps direct job mutation unavailable even to service_role", () => {
    expect(migration).toContain(
      "alter table public.ops_durable_jobs enable row level security"
    );
    expect(migration).toMatch(
      /revoke all privileges on table public\.ops_durable_jobs[\s\S]*from public, anon, authenticated/
    );
    expect(migration).toMatch(
      /revoke all privileges on table public\.ops_durable_jobs[\s\S]*from service_role/
    );
    expect(migration).toMatch(
      /grant select on table public\.ops_durable_jobs[\s\S]*to service_role/
    );

    for (const rpc of [
      "klyx_enqueue_durable_job",
      "klyx_reap_expired_durable_jobs",
      "klyx_claim_durable_jobs",
      "klyx_extend_durable_job_lease",
      "klyx_complete_durable_job",
      "klyx_fail_durable_job",
    ]) {
      expect(migration).toContain(
        `grant execute on function public.${rpc}`
      );
    }

    expect(server).toContain('import "server-only"');
  });

  it("minimizes job payloads and never persists arbitrary exception messages", () => {
    expect(migration).toContain(
      "ops_durable_jobs_payload_size_check"
    );
    expect(migration).toContain(
      "ops_durable_jobs_fingerprint_size_check"
    );
    expect(migration).toContain(
      "last_error_code text"
    );
    expect(migration).not.toContain(
      "last_error_message text"
    );
    expect(doc).toContain(
      "The queue is not a secret store."
    );
  });

  it("does not rewrite webhook, settlement or Stripe mutation engines", () => {
    const missionFiles = [migration, server, doc].join("\n");

    for (const forbidden of [
      "stripe.transfers.create(",
      "stripe.refunds.create(",
      "stripe.checkout.sessions.create(",
      '.from("stripe_webhook_events").update(',
      '.from("sumsub_webhook_events").update(',
      "releasePlatformHeldBookingSettlement(",
      "reconcilePlatformHeldBookingSettlement(",
    ]) {
      expect(missionFiles).not.toContain(forbidden);
    }

    expect(doc).toContain(
      "Existing retry authorities are preserved"
    );
  });

  it("exposes only server-side lifecycle primitives and DLQ reads", () => {
    for (const exported of [
      "enqueueKlyxDurableJob",
      "claimKlyxDurableJobs",
      "extendKlyxDurableJobLease",
      "completeKlyxDurableJob",
      "failKlyxDurableJob",
      "listKlyxDeadLetterJobs",
    ]) {
      expect(server).toContain(
        `export async function ${exported}`
      );
    }

    expect(server).not.toContain("Stripe");
    expect(server).not.toContain("fetch(");
  });
});

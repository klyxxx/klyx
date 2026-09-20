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
  "supabase/migrations/20260920183000_klyx_durable_jobs_retry_dlq.sql"
);
const server = read("lib/jobs/durable-jobs-server.ts");
const doc = read("docs/KLYX_DURABLE_JOBS_RETRY_DLQ.md");

describe("Mission 14 Durable Jobs + Retry / DLQ", () => {
  it("creates a server-only durable jobs substrate without becoming domain truth", () => {
    expect(migration).toContain(
      "create table if not exists public.ops_jobs"
    );
    expect(migration).toContain(
      "references public.ops_operations(id) on delete restrict"
    );
    expect(migration).toContain(
      "Jobs coordinate retries and leases but never become canonical business truth"
    );
    expect(doc).toContain(
      "Durable Jobs coordinates execution. It does **not** become business truth."
    );
  });

  it("makes enqueue idempotent without silently resetting existing jobs", () => {
    expect(migration).toContain(
      "create unique index if not exists ops_jobs_idempotency_unique"
    );
    expect(migration).toContain(
      "on public.ops_jobs (queue, job_type, idempotency_key)"
    );
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("hashtextextended");
    expect(migration).toContain(
      "select v_job.id, false, v_job.status, v_job.attempt_count"
    );
    expect(doc).toContain(
      "Terminal jobs are not silently resurrected by enqueue."
    );
  });

  it("claims jobs with SKIP LOCKED and fences stale workers by lease token", () => {
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("lease_token = v_token");
    expect(migration).toContain("attempt_count = attempt_count + 1");
    expect(migration).toContain(
      "v_job.lease_token is distinct from p_lease_token"
    );
    expect(migration).toContain(
      "v_job.lease_worker_id is distinct from trim(p_worker_id)"
    );
    expect(migration).toContain("KLYX_JOB_LEASE_LOST");
  });

  it("reclaims stale leases but dead-letters exhausted stale jobs", () => {
    expect(migration).toContain("lease_expires_at <= now()");
    expect(migration).toContain("attempt_count >= max_attempts");
    expect(migration).toContain(
      "'durable_job_lease_expired'"
    );
    expect(migration).toContain(
      "'durable_job_dead_lettered'"
    );
    expect(migration).toContain(
      "'KLYX_JOB_LEASE_EXHAUSTED'"
    );
  });

  it("uses deterministic capped exponential backoff", () => {
    expect(migration).toContain("v_retry_seconds := least(");
    expect(migration).toContain(
      "v_job.base_backoff_seconds"
    );
    expect(migration).toContain("power(2::numeric");
    expect(migration).toContain(
      "v_job.max_backoff_seconds"
    );
    expect(migration).toContain(
      "'durable_job_retry_scheduled'"
    );
    expect(doc).toContain(
      "delay = min(max_backoff, base_backoff * 2^(attempt_count - 1))"
    );
  });

  it("treats dead-letter as terminal and exposes no automatic requeue", () => {
    expect(migration).toContain(
      "status = 'dead_letter'"
    );
    expect(migration).toContain(
      "dead_lettered_at = now()"
    );
    expect(server).toContain(
      "export async function listKlyxDeadLetterJobs"
    );
    expect(server).not.toContain("requeueDeadLetter");
    expect(migration).not.toContain(
      "klyx_requeue_dead_letter"
    );
    expect(doc).toContain(
      "Human requeue/case ownership belongs to Mission 15"
    );
  });

  it("reuses Mission 13 ops_events instead of creating a second audit system", () => {
    for (const event of [
      "durable_job_enqueued",
      "durable_job_claimed",
      "durable_job_lease_expired",
      "durable_job_retry_scheduled",
      "durable_job_succeeded",
      "durable_job_dead_lettered",
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

  it("keeps all job state and RPCs inaccessible to browser roles", () => {
    expect(migration).toContain(
      "alter table public.ops_jobs enable row level security"
    );
    expect(migration).toMatch(
      /revoke all privileges on table public\.ops_jobs[\s\S]*from public, anon, authenticated/
    );

    for (const rpc of [
      "klyx_enqueue_ops_job",
      "klyx_claim_ops_jobs",
      "klyx_complete_ops_job",
      "klyx_fail_ops_job",
    ]) {
      expect(migration).toContain(
        `revoke all on function public.${rpc}`
      );
      expect(migration).toContain(
        `grant execute on function public.${rpc}`
      );
    }

    expect(server).toContain('import "server-only"');
  });

  it("does not rewrite existing domain retry or financial mutation engines", () => {
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
      "Existing retries are not migrated"
    );
  });

  it("exposes only enqueue, claim, completion, failure and DLQ reads in the server boundary", () => {
    for (const exported of [
      "enqueueKlyxDurableJob",
      "claimKlyxDurableJobs",
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

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

const migration = read(
  "supabase/migrations/20260920190000_klyx_durable_jobs_retry_dlq.sql"
);
const server = read("lib/durable-jobs-server.ts");
const doc = read("docs/KLYX_DURABLE_JOBS_RETRY_DLQ.md");

describe("KLYX Mission 14 durable jobs contract", () => {
  it("stores durable work in PostgreSQL without becoming domain truth", () => {
    expect(migration).toContain(
      "create table if not exists public.ops_durable_jobs"
    );
    expect(migration).toContain(
      "references public.ops_operations(id) on delete restrict"
    );
    expect(doc).toContain(
      "Durable Jobs coordinates execution. It does **not** become business truth."
    );
    expect(migration).toContain("'retry_wait'");
    expect(migration).toContain("'dead_lettered'");
  });

  it("makes enqueue idempotent while binding only explicit scheduling intent", () => {
    expect(migration).toContain(
      "constraint ops_durable_jobs_unique_idempotency"
    );
    expect(migration).toContain(
      "unique (job_type, idempotency_key)"
    );
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain(
      "KLYX_DURABLE_JOB_IDEMPOTENCY_CONFLICT"
    );

    const start = migration.indexOf(
      "v_request_fingerprint := jsonb_build_object("
    );
    const end = migration.indexOf(");", start);
    const fingerprint = migration.slice(start, end);

    expect(fingerprint).toContain("'available_at', p_available_at");
    expect(server).toContain("p_available_at: optionalText(input.availableAt)");
    expect(server).not.toContain("p_available_at: new Date()");
    expect(doc).toContain(
      "Explicit `available_at` is part of the fingerprint when supplied."
    );
  });

  it("claims work atomically with SKIP LOCKED and a fencing lease token", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_claim_durable_jobs"
    );
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("lease_token = v_lease_token");
    expect(migration).toContain("last_claim_token = v_lease_token");
    expect(migration).toContain(
      "perform public.klyx_reap_expired_durable_jobs"
    );
  });

  it("fences stale workers and permits safe acknowledgement retries", () => {
    expect(migration).toContain(
      "KLYX_DURABLE_JOB_LEASE_FENCED"
    );
    expect(migration).toContain(
      "KLYX_DURABLE_JOB_LEASE_EXPIRED"
    );
    expect(migration).toContain(
      "v_job.last_claim_token is not distinct from p_lease_token"
    );
    expect(migration).toContain(
      "v_job.last_worker_id is not distinct from v_worker_id"
    );
  });

  it("reclaims expired leases with bounded capped exponential retry", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_reap_expired_durable_jobs"
    );
    expect(migration).toContain("lease_expires_at <= now()");
    expect(migration).toContain(
      "create or replace function public.klyx_durable_job_backoff_seconds"
    );
    expect(migration).toContain(
      "power(2::numeric, greatest(p_attempt_count - 1, 0))"
    );
    expect(migration).toContain(
      "v_job.attempt_count >= v_job.max_attempts"
    );
    expect(migration).toContain(
      "'durable_job.dead_lettered'"
    );
  });

  it("makes dead-letter terminal and exposes read-only DLQ projection", () => {
    expect(migration).toContain(
      "create or replace view public.ops_durable_job_dlq"
    );
    expect(migration).toContain(
      "where status = 'dead_lettered'"
    );
    expect(server).toContain(
      "export async function listKlyxDeadLetterJobs"
    );
    expect(migration).not.toContain(
      "klyx_auto_redrive_durable_job"
    );
    expect(doc).toContain(
      "Human ownership, case creation and explicit redrive belong to Mission 15"
    );
  });

  it("reuses Mission 13 operations and events instead of creating a second audit", () => {
    expect(migration).toContain(
      "insert into public.ops_operations"
    );
    expect(migration).toContain(
      "insert into public.ops_events"
    );

    for (const event of [
      "durable_job.enqueued",
      "durable_job.claimed",
      "durable_job.retry_scheduled",
      "durable_job.succeeded",
      "durable_job.dead_lettered",
    ]) {
      expect(migration).toContain(event);
    }

    expect(migration).not.toContain(
      "create table if not exists public.ops_job_events"
    );
    expect(migration).not.toContain(
      "create table if not exists public.job_audit"
    );
  });

  it("keeps direct queue mutation away from browser and service-role application code", () => {
    expect(migration).toContain(
      "alter table public.ops_durable_jobs enable row level security"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.ops_durable_jobs"
    );
    expect(migration).toContain(
      "grant select on table public.ops_durable_jobs"
    );
    expect(migration).not.toContain(
      "grant select, insert, update on table public.ops_durable_jobs"
    );
    expect(server).not.toContain('.from("ops_durable_jobs").insert');
    expect(server).not.toContain('.from("ops_durable_jobs").update');
    expect(server).not.toContain('.from("ops_durable_jobs").delete');
  });

  it("exposes only server-side atomic RPC boundaries", () => {
    expect(server).toContain('import "server-only"');

    for (const rpc of [
      "klyx_enqueue_durable_job",
      "klyx_claim_durable_jobs",
      "klyx_extend_durable_job_lease",
      "klyx_complete_durable_job",
      "klyx_fail_durable_job",
    ]) {
      expect(server).toContain(`"${rpc}"`);
      expect(migration).toContain(`public.${rpc}`);
    }

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
  });

  it("does not rewrite financial/webhook retry authorities or activate LIVE", () => {
    const mission = [migration, server, doc].join("\n");

    for (const forbidden of [
      "stripe.transfers.create(",
      "stripe.refunds.create(",
      "stripe.checkout.sessions.create(",
      '.from("stripe_webhook_events").update(',
      '.from("sumsub_webhook_events").update(',
      "releasePlatformHeldBookingSettlement(",
      "reconcilePlatformHeldBookingSettlement(",
    ]) {
      expect(mission).not.toContain(forbidden);
    }

    expect(doc).toContain(
      "Existing retry authorities are preserved"
    );
    expect(doc).toContain("no Stripe LIVE activation");
  });
});

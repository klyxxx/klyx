// KLYX_SUMSUB_PROTECTED_CI_RETRIGGER
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/sumsub/webhook/route.ts"
  ),
  "utf8"
);

const events = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/sumsub-webhook-events.ts"
  ),
  "utf8"
);

const leaseMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260909161000_klyx_sumsub_webhook_retry_lease.sql"
  ),
  "utf8"
);

describe("Sumsub webhook hardening", () => {
  it("verifies the signature before claiming and claims before KYC mutation", () => {
    const postIndex = route.indexOf(
      "export async function POST"
    );
    const signatureIndex = route.indexOf(
      "verifySumsubWebhook({",
      postIndex
    );
    const claimIndex = route.indexOf(
      "claim = await claimSumsubWebhookEvent({",
      signatureIndex
    );
    const profileMutationIndex = route.indexOf(
      '.from("provider_verifications")',
      claimIndex
    );

    expect(postIndex).toBeGreaterThanOrEqual(0);
    expect(signatureIndex).toBeGreaterThan(postIndex);
    expect(claimIndex).toBeGreaterThan(signatureIndex);
    expect(profileMutationIndex).toBeGreaterThan(claimIndex);
  });

  it("acknowledges a fresh concurrent delivery without a second worker", () => {
    const processingIndex = events.indexOf(
      'stored.status === "processing"'
    );
    const alreadyProcessingIndex = events.indexOf(
      'reason: "already_processing"',
      processingIndex
    );
    const reclaimIndex = events.indexOf(
      "const currentAttemptCount =",
      alreadyProcessingIndex
    );

    expect(processingIndex).toBeGreaterThanOrEqual(0);
    expect(alreadyProcessingIndex).toBeGreaterThan(
      processingIndex
    );
    expect(reclaimIndex).toBeGreaterThan(
      alreadyProcessingIndex
    );
    expect(events.slice(processingIndex, reclaimIndex)).toContain(
      "Date.now() - updatedAt > STALE_PROCESSING_MS"
    );
  });

  it("reclaims failed or stale processing with an atomic CAS lease", () => {
    const reclaimIndex = events.indexOf(
      ".update({\n      processed: false,\n      status: \"processing\""
    );
    const reclaimEndIndex = events.indexOf(
      '.maybeSingle();',
      reclaimIndex
    );
    const reclaim = events.slice(
      reclaimIndex,
      reclaimEndIndex
    );

    expect(reclaimIndex).toBeGreaterThanOrEqual(0);
    expect(reclaim).toMatch(
      /\.eq\("event_hash", params\.eventHash\)/
    );
    expect(reclaim).toMatch(
      /\.eq\("status", stored\.status\)/
    );
    expect(reclaim).toMatch(
      /\.eq\("attempt_count", stored\.attempt_count\)/
    );
    expect(reclaim).toMatch(
      /\.eq\("updated_at", stored\.updated_at\)/
    );
    expect(reclaim).toContain(
      "attempt_count: nextAttemptCount"
    );
  });

  it("fences successful finalization by the winning attempt", () => {
    const start = events.indexOf(
      "export async function markSumsubWebhookProcessed"
    );
    const end = events.indexOf(
      "export async function markSumsubWebhookFailed",
      start
    );
    const finalization = events.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(finalization).toContain(
      'status: "processed"'
    );
    expect(finalization).toMatch(
      /\.eq\("status", "processing"\)/
    );
    expect(finalization).toMatch(
      /\.eq\("attempt_count", attemptCount\)/
    );
  });

  it("fences failure finalization so an old worker cannot overwrite a newer lease", () => {
    const start = events.indexOf(
      "export async function markSumsubWebhookFailed"
    );
    const failure = events.slice(start);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(failure).toContain(
      'status: "failed"'
    );
    expect(failure).toMatch(
      /\.eq\("status", "processing"\)/
    );
    expect(failure).toMatch(
      /\.eq\("attempt_count", attemptCount\)/
    );
    expect(failure).toContain(
      'return data ? "recorded" : "superseded"'
    );
  });

  it("migrates the legacy journal into a durable lease without inventing active workers", () => {
    expect(leaseMigration).toContain(
      "add column if not exists status text"
    );
    expect(leaseMigration).toContain(
      "add column if not exists attempt_count integer"
    );
    expect(leaseMigration).toContain(
      "add column if not exists updated_at timestamptz"
    );
    expect(leaseMigration).toMatch(
      /when processed then 'processed'[\s\S]*else 'failed'/
    );
    expect(leaseMigration).toContain(
      "check (status in ('processing', 'processed', 'failed'))"
    );
    expect(leaseMigration).toContain(
      "check (attempt_count >= 1)"
    );
    expect(leaseMigration).toContain(
      "check (processed = (status = 'processed'))"
    );
  });

  it("never applies manually triggered Sumsub test callbacks", () => {
    const testModeIndex = route.indexOf(
      "if (payload.testMode === true)"
    );
    const profileMutationIndex = route.indexOf(
      "const profileId =",
      testModeIndex
    );

    expect(testModeIndex).toBeGreaterThanOrEqual(0);
    expect(route.slice(testModeIndex, profileMutationIndex)).toContain(
      'ignored: "test_mode"'
    );
    expect(profileMutationIndex).toBeGreaterThan(
      testModeIndex
    );
  });

  it("blocks sandbox decisions in production", () => {
    expect(route).toContain(
      "function isProductionRuntime(): boolean"
    );

    const sandboxGuardIndex = route.indexOf(
      "payload.sandboxMode === true &&"
    );
    const profileMutationIndex = route.indexOf(
      "const profileId =",
      sandboxGuardIndex
    );

    expect(sandboxGuardIndex).toBeGreaterThanOrEqual(0);
    expect(route.slice(sandboxGuardIndex, profileMutationIndex)).toContain(
      "isProductionRuntime()"
    );
    expect(route.slice(sandboxGuardIndex, profileMutationIndex)).toContain(
      '"sandbox_in_production"'
    );
  });

  it("does not erase a final review result when a later event omits it", () => {
    expect(route).toContain(
      "payload.reviewResult\n        ?.reviewAnswer !== undefined"
    );
    expect(route).toContain(
      "payload.reviewResult\n        ?.reviewRejectType !== undefined"
    );
    expect(route).toContain(
      "payload.reviewResult\n        ?.moderationComment !== undefined"
    );
  });
});

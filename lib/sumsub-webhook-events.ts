import {
  logServerError,
  logServerWarning,
} from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

type StoredSumsubEvent = {
  event_hash: string;
  status: "processing" | "processed" | "failed";
  attempt_count: number;
  updated_at: string;
};

type SumsubEventMetadata = {
  eventType: string | null;
  applicantId: string | null;
  externalUserId: string | null;
  reviewStatus: string | null;
  reviewAnswer: string | null;
  sandboxMode: boolean | null;
};

type SumsubWebhookClaim = {
  shouldProcess: boolean;
  reason: string;
  attemptCount: number | null;
};

export type SumsubWebhookFailureMarkResult =
  | "recorded"
  | "superseded"
  | "record_failed";

const STALE_PROCESSING_MS = 10 * 60 * 1000;

function normalizedAttemptCount(value: unknown): number {
  const count = Number(value);

  return Number.isInteger(count) && count >= 1 ? count : 1;
}

function logWebhookRetry(params: {
  eventHash: string;
  attemptCount: number;
  reason: "retry_failed_event" | "retry_stale_event";
}) {
  logServerWarning({
    event:
      params.attemptCount >= 3
        ? "sumsub_webhook_retry_escalated"
        : "sumsub_webhook_retry",
    route: "/api/sumsub/webhook",
    method: "POST",
    status: 500,
    code: params.reason,
    requestId: params.eventHash,
  });
}

export async function claimSumsubWebhookEvent(params: {
  eventHash: string;
  metadata: SumsubEventMetadata;
}): Promise<SumsubWebhookClaim> {
  const now = new Date().toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("sumsub_webhook_events")
    .insert({
      event_hash: params.eventHash,
      event_type: params.metadata.eventType,
      applicant_id: params.metadata.applicantId,
      external_user_id: params.metadata.externalUserId,
      review_status: params.metadata.reviewStatus,
      review_answer: params.metadata.reviewAnswer,
      sandbox_mode: params.metadata.sandboxMode,
      processed: false,
      status: "processing",
      attempt_count: 1,
      received_at: now,
      updated_at: now,
    });

  if (!insertError) {
    return {
      shouldProcess: true,
      reason: "new_event",
      attemptCount: 1,
    };
  }

  if (insertError.code !== "23505") {
    throw new Error(insertError.message);
  }

  const { data, error } = await supabaseAdmin
    .from("sumsub_webhook_events")
    .select("event_hash, status, attempt_count, updated_at")
    .eq("event_hash", params.eventHash)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const stored = data as StoredSumsubEvent;

  if (stored.status === "processed") {
    return {
      shouldProcess: false,
      reason: "already_processed",
      attemptCount: null,
    };
  }

  if (stored.status === "processing") {
    const updatedAt = new Date(stored.updated_at).getTime();
    const stale =
      !Number.isFinite(updatedAt) ||
      Date.now() - updatedAt > STALE_PROCESSING_MS;

    if (!stale) {
      return {
        shouldProcess: false,
        reason: "already_processing",
        attemptCount: null,
      };
    }
  }

  const currentAttemptCount = normalizedAttemptCount(stored.attempt_count);
  const nextAttemptCount = currentAttemptCount + 1;

  const { data: reclaimed, error: retryError } = await supabaseAdmin
    .from("sumsub_webhook_events")
    .update({
      processed: false,
      status: "processing",
      attempt_count: nextAttemptCount,
      last_error: null,
      updated_at: now,
    })
    .eq("event_hash", params.eventHash)
    .eq("status", stored.status)
    .eq("attempt_count", stored.attempt_count)
    .eq("updated_at", stored.updated_at)
    .select("event_hash, attempt_count")
    .maybeSingle();

  if (retryError) {
    throw new Error(retryError.message);
  }

  if (!reclaimed) {
    return {
      shouldProcess: false,
      reason: "retry_claim_lost",
      attemptCount: null,
    };
  }

  const reclaimedAttemptCount = normalizedAttemptCount(
    reclaimed.attempt_count
  );
  const retryReason =
    stored.status === "failed"
      ? "retry_failed_event"
      : "retry_stale_event";

  logWebhookRetry({
    eventHash: params.eventHash,
    attemptCount: reclaimedAttemptCount,
    reason: retryReason,
  });

  return {
    shouldProcess: true,
    reason: retryReason,
    attemptCount: reclaimedAttemptCount,
  };
}

export async function markSumsubWebhookProcessed(
  eventHash: string,
  attemptCount: number
): Promise<boolean> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("sumsub_webhook_events")
    .update({
      processed: true,
      status: "processed",
      processed_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("event_hash", eventHash)
    .eq("status", "processing")
    .eq("attempt_count", attemptCount)
    .select("event_hash")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function markSumsubWebhookFailed(
  eventHash: string,
  attemptCount: number,
  failureCode: string
): Promise<SumsubWebhookFailureMarkResult> {
  const safeFailureCode =
    failureCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "sumsub_webhook_failed";

  const { data, error } = await supabaseAdmin
    .from("sumsub_webhook_events")
    .update({
      processed: false,
      status: "failed",
      last_error: safeFailureCode,
      updated_at: new Date().toISOString(),
    })
    .eq("event_hash", eventHash)
    .eq("status", "processing")
    .eq("attempt_count", attemptCount)
    .select("event_hash")
    .maybeSingle();

  if (error) {
    logServerError({
      event: "sumsub_webhook_failure_record_failed",
      route: "/api/sumsub/webhook",
      method: "POST",
      status: 500,
      code: "sumsub_webhook_failure_record_failed",
      error,
    });

    return "record_failed";
  }

  return data ? "recorded" : "superseded";
}

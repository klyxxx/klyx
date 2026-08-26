import type Stripe from "stripe";
import {
  logServerError,
} from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

type StoredEvent = {
  stripe_event_id: string;
  status: "processing" | "processed" | "failed";
  attempt_count: number;
  updated_at: string;
};

type StripeWebhookClaim = {
  shouldProcess: boolean;
  reason: string;
  attemptCount: number | null;
};

const STALE_PROCESSING_MS = 10 * 60 * 1000;

function stripeObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: unknown };

  return typeof object?.id === "string" ? object.id : null;
}

function normalizedAttemptCount(value: unknown): number {
  const count = Number(value);

  return Number.isInteger(count) && count >= 1 ? count : 1;
}

export async function claimStripeWebhookEvent(
  event: Stripe.Event
): Promise<StripeWebhookClaim> {
  const now = new Date().toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      object_id: stripeObjectId(event),
      livemode: event.livemode,
      api_version: event.api_version ?? null,
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
    .from("stripe_webhook_events")
    .select("stripe_event_id, status, attempt_count, updated_at")
    .eq("stripe_event_id", event.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const stored = data as StoredEvent;

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
    .from("stripe_webhook_events")
    .update({
      status: "processing",
      attempt_count: nextAttemptCount,
      last_error: null,
      updated_at: now,
    })
    .eq("stripe_event_id", event.id)
    .eq("status", stored.status)
    .eq("attempt_count", stored.attempt_count)
    .eq("updated_at", stored.updated_at)
    .select("stripe_event_id, attempt_count")
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

  return {
    shouldProcess: true,
    reason:
      stored.status === "failed"
        ? "retry_failed_event"
        : "retry_stale_event",
    attemptCount: normalizedAttemptCount(reclaimed.attempt_count),
  };
}

export async function markStripeWebhookProcessed(
  eventId: string,
  attemptCount: number
): Promise<boolean> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "processed",
      processed_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("stripe_event_id", eventId)
    .eq("status", "processing")
    .eq("attempt_count", attemptCount)
    .select("stripe_event_id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function markStripeWebhookFailed(
  eventId: string,
  attemptCount: number,
  failureCode: string
): Promise<boolean> {
  const safeFailureCode =
    failureCode
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9_]/g,
        "_"
      )
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) ||
    "stripe_webhook_failed";

  const { data, error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "failed",
      last_error:
        safeFailureCode,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", eventId)
    .eq("status", "processing")
    .eq("attempt_count", attemptCount)
    .select("stripe_event_id")
    .maybeSingle();

  if (error) {
    logServerError({
      event:
        "stripe_webhook_failure_record_failed",
      route:
        "/api/stripe/webhook",
      method: "POST",
      status: 500,
      code:
        "stripe_webhook_failure_record_failed",
      error,
    });

    return false;
  }

  return Boolean(data);
}

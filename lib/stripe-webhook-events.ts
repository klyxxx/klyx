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

const STALE_PROCESSING_MS = 10 * 60 * 1000;

function stripeObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: unknown };

  return typeof object?.id === "string" ? object.id : null;
}

export async function claimStripeWebhookEvent(
  event: Stripe.Event
): Promise<{ shouldProcess: boolean; reason: string }> {
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
      };
    }
  }

  const { error: retryError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "processing",
      attempt_count: Math.max(Number(stored.attempt_count) || 1, 1) + 1,
      last_error: null,
      updated_at: now,
    })
    .eq("stripe_event_id", event.id);

  if (retryError) {
    throw new Error(retryError.message);
  }

  return {
    shouldProcess: true,
    reason:
      stored.status === "failed"
        ? "retry_failed_event"
        : "retry_stale_event",
  };
}

export async function markStripeWebhookProcessed(
  eventId: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "processed",
      processed_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("stripe_event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markStripeWebhookFailed(
  eventId: string,
  failureCode: string
): Promise<void> {
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

  const { error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "failed",
      last_error:
        safeFailureCode,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", eventId);

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
  }
}

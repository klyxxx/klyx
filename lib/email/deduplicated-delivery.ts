import "server-only";

import {
  sendKlyxProfileTransactionalEmail,
  sendKlyxTransactionalEmail,
} from "@/lib/email/resend";
import type { KlyxEmailDeliveryResult } from "@/lib/email/resend-core";
import { logServerWarning } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

type DeduplicatedDeliveryInput = {
  deduplicationKey: string;
  templateKey: string;
  profileId?: string | null;
  to?: string | null;
  subject: string;
  text: string;
  html?: string;
};

type DeliveryRow = {
  id: string;
  status: "sending" | "sent" | "failed";
  attempts: number;
  updated_at: string;
};

const STALE_SENDING_MS = 15 * 60 * 1000;

function skipped(): KlyxEmailDeliveryResult {
  return {
    ok: false,
    status: "skipped",
    provider: "resend",
  };
}

function warn(code: string): void {
  logServerWarning({
    event: "transactional_email_registry_warning",
    code,
  });
}

async function claimDelivery(
  input: DeduplicatedDeliveryInput
): Promise<string | null> {
  const now = new Date().toISOString();
  const insert = await supabaseAdmin
    .from("transactional_email_deliveries")
    .insert({
      deduplication_key: input.deduplicationKey,
      template_key: input.templateKey,
      recipient_profile_id: input.profileId?.trim() || null,
      recipient_email: input.to?.trim() || null,
      status: "sending",
      attempts: 1,
      updated_at: now,
    })
    .select("id")
    .maybeSingle();

  if (!insert.error && insert.data?.id) {
    return insert.data.id;
  }

  if (insert.error?.code !== "23505") {
    warn("KLYX_EMAIL_REGISTRY_INSERT_FAILED");
    return null;
  }

  const existingResult = await supabaseAdmin
    .from("transactional_email_deliveries")
    .select("id, status, attempts, updated_at")
    .eq("deduplication_key", input.deduplicationKey)
    .maybeSingle();

  if (existingResult.error || !existingResult.data) {
    warn("KLYX_EMAIL_REGISTRY_LOOKUP_FAILED");
    return null;
  }

  const existing = existingResult.data as DeliveryRow;

  if (existing.status === "sent") {
    return null;
  }

  const staleSending =
    existing.status === "sending" &&
    Number.isFinite(Date.parse(existing.updated_at)) &&
    Date.now() - Date.parse(existing.updated_at) >= STALE_SENDING_MS;

  if (existing.status === "sending" && !staleSending) {
    return null;
  }

  let retry = supabaseAdmin
    .from("transactional_email_deliveries")
    .update({
      status: "sending",
      attempts: Math.max(1, Number(existing.attempts) + 1),
      last_error: null,
      updated_at: now,
    })
    .eq("id", existing.id);

  retry =
    existing.status === "failed"
      ? retry.eq("status", "failed")
      : retry.eq("status", "sending").eq("updated_at", existing.updated_at);

  const retryResult = await retry.select("id").maybeSingle();

  if (retryResult.error) {
    warn("KLYX_EMAIL_REGISTRY_RECLAIM_FAILED");
    return null;
  }

  return retryResult.data?.id ?? null;
}

async function finishDelivery(
  id: string,
  result: KlyxEmailDeliveryResult
): Promise<void> {
  const success = result.ok && result.status === "sent";
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("transactional_email_deliveries")
    .update({
      status: success ? "sent" : "failed",
      last_error: success ? null : result.status,
      sent_at: success ? now : null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "sending");

  if (error) {
    warn("KLYX_EMAIL_REGISTRY_FINALIZE_FAILED");
  }
}

export async function sendKlyxDeduplicatedEmail(
  input: DeduplicatedDeliveryInput
): Promise<KlyxEmailDeliveryResult> {
  const deduplicationKey = input.deduplicationKey.trim();
  const templateKey = input.templateKey.trim();
  const profileId = input.profileId?.trim() || null;
  const to = input.to?.trim() || null;

  if (!deduplicationKey || !templateKey || (!profileId && !to)) {
    return skipped();
  }

  let claimId: string | null;

  try {
    claimId = await claimDelivery({
      ...input,
      deduplicationKey,
      templateKey,
      profileId,
      to,
    });
  } catch {
    warn("KLYX_EMAIL_REGISTRY_CLAIM_UNEXPECTED_FAILURE");
    return skipped();
  }

  if (!claimId) {
    return skipped();
  }

  let result: KlyxEmailDeliveryResult;

  try {
    result = profileId
      ? await sendKlyxProfileTransactionalEmail({
          profileId,
          subject: input.subject,
          text: input.text,
          html: input.html,
        })
      : await sendKlyxTransactionalEmail({
          to: to as string,
          subject: input.subject,
          text: input.text,
          html: input.html,
        });
  } catch {
    result = {
      ok: false,
      status: "failed",
      provider: "resend",
    };
  }

  try {
    await finishDelivery(claimId, result);
  } catch {
    warn("KLYX_EMAIL_REGISTRY_FINALIZE_UNEXPECTED_FAILURE");
  }

  return result;
}

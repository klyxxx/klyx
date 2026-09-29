import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getKlyxExternalProviderCostDecision,
  type KlyxExternalCostDecision,
} from "./cost-runtime";

function utcStartOfDay(now: Date): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  );
}

function utcStartOfMonth(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
}

async function sentCountSince(since: Date): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("transactional_email_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", since.toISOString());

  if (error) {
    throw new Error("KLYX_RESEND_QUOTA_READ_FAILED", { cause: error });
  }

  return count ?? 0;
}

export async function getKlyxResendZeroCostDecision(
  now = new Date()
): Promise<KlyxExternalCostDecision> {
  try {
    const [minute, day, month] = await Promise.all([
      sentCountSince(new Date(now.getTime() - 60_000)),
      sentCountSince(utcStartOfDay(now)),
      sentCountSince(utcStartOfMonth(now)),
    ]);

    return getKlyxExternalProviderCostDecision("resend", {
      minute,
      day,
      month,
    });
  } catch {
    return {
      provider: "resend",
      allowed: false,
      action: "degrade",
      circuitOpen: true,
      warning: true,
      reason: "KLYX_RESEND_QUOTA_STATE_UNPROVABLE",
    };
  }
}

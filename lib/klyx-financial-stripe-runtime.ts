import "server-only";

import { requireKlyxOpsCapabilityAvailable } from "@/lib/ops-control-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_RE = /^[0-9a-f]{40}$/;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function envTrue(name: string): boolean {
  return env(name).toLowerCase() === "true";
}

function exactSha(name: string): string {
  const value = env(name).toLowerCase();
  if (!SHA_RE.test(value)) {
    throw new Error(`KLYX_FINANCIAL_RUNTIME_${name}_INVALID`);
  }
  return value;
}

async function requireOpsPayments(): Promise<void> {
  await requireKlyxOpsCapabilityAvailable({
    capability: "payments",
    paymentProvider: "stripe",
  });
}

function requireExactLiveShaBoundary(): {
  deployedSha: string;
  drCertifiedSha: string;
} {
  const deployedSha = exactSha("VERCEL_GIT_COMMIT_SHA");
  const drCertifiedSha = exactSha("KLYX_DR_CERTIFIED_SHA");

  if (deployedSha !== drCertifiedSha) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_DR_SHA_MISMATCH");
  }

  return { deployedSha, drCertifiedSha };
}

export type KlyxFinancialStripeRuntime = {
  key: string;
  mode: "test" | "controlled_live_certification" | "certified_live";
  deployedSha: string | null;
};

export async function requireKlyxFinancialStripeRuntime(input: {
  clientProfileId: string;
}): Promise<KlyxFinancialStripeRuntime> {
  const key = env("STRIPE_SECRET_KEY");
  const stripeMode = env("KLYX_STRIPE_MODE").toLowerCase();

  if (!UUID_RE.test(input.clientProfileId)) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_CLIENT_PROFILE_INVALID");
  }

  if (key.startsWith("sk_test_")) {
    if (stripeMode !== "test") {
      throw new Error("KLYX_FINANCIAL_RUNTIME_TEST_MODE_MISMATCH");
    }

    return {
      key,
      mode: "test",
      deployedSha: null,
    };
  }

  if (!key.startsWith("sk_live_")) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_STRIPE_KEY_INVALID");
  }

  if (stripeMode !== "live") {
    throw new Error("KLYX_FINANCIAL_RUNTIME_LIVE_MODE_MISMATCH");
  }

  const { deployedSha } = requireExactLiveShaBoundary();

  if (envTrue("KLYX_LIVE_PAYMENTS_ENABLED")) {
    const certifiedSha = exactSha(
      "KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA"
    );

    if (certifiedSha !== deployedSha) {
      throw new Error("KLYX_FINANCIAL_RUNTIME_CERTIFIED_SHA_MISMATCH");
    }

    await requireOpsPayments();

    return {
      key,
      mode: "certified_live",
      deployedSha,
    };
  }

  if (!envTrue("KLYX_LIVE_CERTIFICATION_ENABLED")) {
    throw new Error("KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY");
  }

  const certificationSha = exactSha("KLYX_LIVE_CERTIFICATION_SHA");
  if (certificationSha !== deployedSha) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_CERTIFICATION_SHA_MISMATCH");
  }

  const certificationProfileId =
    env("KLYX_LIVE_CERTIFICATION_PROFILE_ID").toLowerCase();

  if (
    !UUID_RE.test(certificationProfileId) ||
    certificationProfileId !== input.clientProfileId.toLowerCase()
  ) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_CERTIFICATION_PROFILE_BLOCKED");
  }

  await requireOpsPayments();

  return {
    key,
    mode: "controlled_live_certification",
    deployedSha,
  };
}

export async function requireKlyxFinancialStripeRuntimeForBooking(
  bookingId: string
): Promise<KlyxFinancialStripeRuntime> {
  if (!UUID_RE.test(bookingId)) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_BOOKING_ID_INVALID");
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("parent_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_BOOKING_OWNER_READ_FAILED", {
      cause: error,
    });
  }

  const clientProfileId =
    typeof data?.parent_id === "string" ? data.parent_id : "";

  if (!clientProfileId) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_BOOKING_OWNER_MISSING");
  }

  return requireKlyxFinancialStripeRuntime({ clientProfileId });
}

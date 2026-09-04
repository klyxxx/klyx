import "server-only";

import { logServerWarning } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  sendResendEmail,
  type KlyxEmailDeliveryResult,
} from "@/lib/email/resend-core";

type KlyxTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type KlyxProfileTransactionalEmailInput = {
  profileId: string;
  subject: string;
  text: string;
  html?: string;
};

function skippedResult(): KlyxEmailDeliveryResult {
  return {
    ok: false,
    status: "skipped",
    provider: "resend",
  };
}

function failedResult(): KlyxEmailDeliveryResult {
  return {
    ok: false,
    status: "failed",
    provider: "resend",
  };
}

function resendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

function logDeliveryWarning(code: string): void {
  logServerWarning({
    event: "transactional_email_delivery_failed",
    code,
  });
}

export async function sendKlyxTransactionalEmail(
  input: KlyxTransactionalEmailInput
): Promise<KlyxEmailDeliveryResult> {
  const apiKey = resendApiKey();

  if (!apiKey) {
    return skippedResult();
  }

  const result = await sendResendEmail(input, { apiKey });

  if (result.status === "failed") {
    logDeliveryWarning("KLYX_RESEND_DELIVERY_FAILED");
  }

  return result;
}

export async function sendKlyxProfileTransactionalEmail(
  input: KlyxProfileTransactionalEmailInput
): Promise<KlyxEmailDeliveryResult> {
  const apiKey = resendApiKey();

  if (!apiKey) {
    return skippedResult();
  }

  const profileId = input.profileId.trim();

  if (!profileId) {
    return skippedResult();
  }

  try {
    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("owner_user_id")
        .eq("id", profileId)
        .maybeSingle();

    if (profileError || !profile?.owner_user_id) {
      logDeliveryWarning("KLYX_EMAIL_PROFILE_LOOKUP_FAILED");
      return failedResult();
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(
        profile.owner_user_id
      );

    if (authError) {
      logDeliveryWarning("KLYX_EMAIL_AUTH_LOOKUP_FAILED");
      return failedResult();
    }

    const email = authData.user?.email?.trim();

    if (!email) {
      return skippedResult();
    }

    const result = await sendResendEmail(
      {
        to: email,
        subject: input.subject,
        text: input.text,
        html: input.html,
      },
      { apiKey }
    );

    if (result.status === "failed") {
      logDeliveryWarning("KLYX_RESEND_DELIVERY_FAILED");
    }

    return result;
  } catch {
    logDeliveryWarning("KLYX_EMAIL_DELIVERY_UNEXPECTED_FAILURE");
    return failedResult();
  }
}

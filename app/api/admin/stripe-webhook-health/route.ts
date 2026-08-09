import { NextResponse } from "next/server";

import {
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    await requireKlyxAdmin();

    const secretKey =
      process.env.STRIPE_SECRET_KEY?.trim() ?? "";
    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
    const stripeMode =
      process.env.KLYX_STRIPE_MODE?.trim() ?? "";

    const secretKeyOk =
      secretKey.startsWith("sk_test_") ||
      secretKey.startsWith("sk_live_");

    const webhookSecretOk =
      webhookSecret.startsWith("whsec_");

    const modeOk =
      stripeMode === "test" ||
      stripeMode === "live";

    const { error: webhookEventsError } =
      await supabaseAdmin
        .from("stripe_webhook_events")
        .select(
          "stripe_event_id, event_type, status, attempt_count, updated_at"
        )
        .limit(1);

    const webhookEventsTableOk =
      !webhookEventsError;

    const checks = [
      {
        key: "stripe_secret",
        label: "Clé secrète Stripe",
        ok: secretKeyOk,
        detail: secretKeyOk
          ? "STRIPE_SECRET_KEY présente."
          : "STRIPE_SECRET_KEY absente ou préfixe invalide.",
      },
      {
        key: "webhook_secret",
        label: "Secret du webhook",
        ok: webhookSecretOk,
        detail: webhookSecretOk
          ? "STRIPE_WEBHOOK_SECRET whsec_ présent."
          : "STRIPE_WEBHOOK_SECRET absent ou invalide.",
      },
      {
        key: "stripe_mode",
        label: "Mode Stripe",
        ok: modeOk,
        detail: modeOk
          ? `KLYX_STRIPE_MODE=${stripeMode}`
          : "KLYX_STRIPE_MODE doit être test ou live.",
      },
      {
        key: "webhook_events_table",
        label: "Journal anti-doublon",
        ok: webhookEventsTableOk,
        detail: webhookEventsTableOk
          ? "public.stripe_webhook_events est accessible."
          : webhookEventsError?.message ??
            "public.stripe_webhook_events est inaccessible.",
      },
    ];

    return NextResponse.json({
      ready: checks.every((check) => check.ok),
      endpoint: "/api/stripe/webhook",
      checks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ready: false,
        error:
          error instanceof Error
            ? error.message
            : "Diagnostic webhook Stripe impossible.",
      },
      { status: adminErrorStatus(error) }
    );
  }
}

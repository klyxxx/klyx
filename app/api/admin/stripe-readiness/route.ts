import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  adminErrorPublicMessage,
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { inspectStripeRuntime } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxAdmin();

    const report = inspectStripeRuntime();
    const secretKey =
      process.env.STRIPE_SECRET_KEY?.trim() ?? "";

    const connectChecks: Array<{
      profileId: string;
      accountId: string;
      ok: boolean;
      detail: string;
    }> = [];

    if (
      report.checks.find((check) => check.key === "secret_key")
        ?.ok
    ) {
      const stripe = new Stripe(secretKey);

      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, stripe_account_id")
        .not("stripe_account_id", "is", null)
        .limit(25);

      if (error) {
        throw new Error(error.message);
      }

      for (const row of data ?? []) {
        const accountId =
          typeof row.stripe_account_id === "string"
            ? row.stripe_account_id
            : "";

        if (!accountId) continue;

        try {
          const account =
            await stripe.accounts.retrieve(accountId);

          connectChecks.push({
            profileId: row.id,
            accountId,
            ok: !("deleted" in account && account.deleted),
            detail:
              "Compte accessible avec la cle Stripe du mode actuel.",
          });
        } catch {
          connectChecks.push({
            profileId: row.id,
            accountId,
            ok: false,
            detail:
              "Ce compte Connect n'est pas accessible avec la cle Stripe actuelle. Il peut appartenir a l'autre mode test/live.",
          });
        }
      }
    }

    const connectReady =
      connectChecks.length === 0 ||
      connectChecks.every((check) => check.ok);

    return NextResponse.json({
      ...report,
      connectReady,
      ready: report.ready && connectReady,
      connectChecks,
    });
  } catch (error) {
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "admin_stripe_readiness_failed",
      route: "/api/admin/stripe-readiness",
      method: "GET",
      status,
      code: "KLYX_ADMIN_STRIPE_READINESS_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
      details: {
        ready: false,
      },
    });
  }
}

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
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";

    const connectChecks: Array<{
      accountId: string;
      stripeAccountId: string | null;
      state: string;
      ok: boolean;
      detail: string;
    }> = [];

    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from("accounts")
      .select("id, stripe_account_id, stripe_connect_state")
      .or("stripe_account_id.not.is.null,stripe_connect_state.eq.review_required")
      .limit(25);

    if (accountsError) {
      throw new Error(accountsError.message);
    }

    const stripeReady =
      report.checks.find((check) => check.key === "secret_key")?.ok === true;
    const stripe = stripeReady ? new Stripe(secretKey) : null;

    for (const row of accounts ?? []) {
      const stripeAccountId =
        typeof row.stripe_account_id === "string"
          ? row.stripe_account_id
          : null;
      const state = String(row.stripe_connect_state ?? "unlinked");

      if (state === "review_required") {
        connectChecks.push({
          accountId: row.id,
          stripeAccountId,
          state,
          ok: false,
          detail:
            "Conflit d'identité Stripe Connect : revue manuelle obligatoire.",
        });
        continue;
      }

      if (!stripeAccountId) {
        continue;
      }

      if (!stripe) {
        connectChecks.push({
          accountId: row.id,
          stripeAccountId,
          state,
          ok: false,
          detail: "Clé Stripe du mode actuel indisponible.",
        });
        continue;
      }

      try {
        const connectedAccount = await stripe.accounts.retrieve(
          stripeAccountId
        );

        connectChecks.push({
          accountId: row.id,
          stripeAccountId,
          state,
          ok: !("deleted" in connectedAccount && connectedAccount.deleted),
          detail:
            "Compte canonique accessible avec la clé Stripe du mode actuel.",
        });
      } catch {
        connectChecks.push({
          accountId: row.id,
          stripeAccountId,
          state,
          ok: false,
          detail:
            "Le compte Connect canonique n'est pas accessible avec la clé Stripe actuelle.",
        });
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

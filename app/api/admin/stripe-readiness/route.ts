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

type ConnectIdentityRow = {
  account_id: string;
  stripe_account_id: string | null;
  identity_state: "linked" | "conflict";
};

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

    const { data: identities, error: identitiesError } = await supabaseAdmin
      .from("account_stripe_connect_identities")
      .select("account_id, stripe_account_id, identity_state")
      .limit(25);

    if (identitiesError) {
      throw new Error(identitiesError.message);
    }

    const stripeReady =
      report.checks.find((check) => check.key === "secret_key")?.ok === true;
    const stripe = stripeReady ? new Stripe(secretKey) : null;

    for (const row of (identities ?? []) as ConnectIdentityRow[]) {
      const stripeAccountId = row.stripe_account_id?.trim() || null;
      const state = row.identity_state;

      if (state === "conflict") {
        connectChecks.push({
          accountId: row.account_id,
          stripeAccountId: null,
          state,
          ok: false,
          detail:
            "Conflit d'identité Stripe Connect : revue manuelle obligatoire.",
        });
        continue;
      }

      if (!stripeAccountId) {
        connectChecks.push({
          accountId: row.account_id,
          stripeAccountId: null,
          state,
          ok: false,
          detail: "Identité Connect liée sans identifiant Stripe.",
        });
        continue;
      }

      if (!stripe) {
        connectChecks.push({
          accountId: row.account_id,
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
          accountId: row.account_id,
          stripeAccountId,
          state,
          ok: !("deleted" in connectedAccount && connectedAccount.deleted),
          detail:
            "Compte canonique accessible avec la clé Stripe du mode actuel.",
        });
      } catch {
        connectChecks.push({
          accountId: row.account_id,
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

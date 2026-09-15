import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  enforceCheckoutTransactionRisk,
  isTransactionRiskGateError,
} from "@/lib/transaction-risk-server";
import { POST as corePost } from "./route-core";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { account, profile } = await getAuthenticatedAccount(request);
    requireAccountType(profile, "client");

    const body = (await request.clone().json().catch(() => null)) as {
      bookingId?: string;
    } | null;
    const bookingId = body?.bookingId?.trim() ?? "";

    if (!bookingId) {
      return corePost(request);
    }

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("parent_id, provider_id, babysitter_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    // Preserve the original core as the authority for not-found and ownership
    // responses. The risk preflight must not leak transaction existence.
    if (!booking || booking.parent_id !== profile.id) {
      return corePost(request);
    }

    const providerId = booking.provider_id ?? booking.babysitter_id;

    await enforceCheckoutTransactionRisk({
      payerAccount: account,
      recipientProfileIds: providerId ? [providerId] : [],
      subjectType: "booking",
      subjectId: bookingId,
    });

    return corePost(request);
  } catch (error) {
    if (isTransactionRiskGateError(error)) {
      return NextResponse.json(
        {
          error:
            error.decision === "blocked"
              ? "Ce paiement est temporairement bloqué pour vérification de sécurité."
              : "Ce paiement nécessite une vérification de sécurité avant de continuer.",
          code: error.code,
          participant: error.participant,
          automaticSuspension: false,
        },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Préflight de paiement impossible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "transaction_risk_single_checkout_failed",
      route: "/api/stripe/create-checkout-session",
      method: "POST",
      status,
      code: "KLYX_TRANSACTION_RISK_PREFLIGHT_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

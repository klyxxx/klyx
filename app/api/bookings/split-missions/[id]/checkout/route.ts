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
import { GET as coreGet, POST as corePost } from "./route-core";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PaymentPlanSnapshot = {
  units?: Array<{ providerId?: unknown }>;
};

function providerIdsFromSnapshot(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const units = (value as PaymentPlanSnapshot).units;
  if (!Array.isArray(units)) return [];

  return Array.from(
    new Set(
      units
        .map((unit) =>
          typeof unit?.providerId === "string"
            ? unit.providerId.trim()
            : ""
        )
        .filter(Boolean)
    )
  );
}

export async function GET(request: Request, context: RouteContext) {
  return coreGet(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const { account, profile } = await getAuthenticatedAccount(request);
    requireAccountType(profile, "client");

    const { id: batchId } = await context.params;
    const { data: run, error: runError } = await supabaseAdmin
      .from("split_booking_payment_runs")
      .select("client_profile_id, payment_confirmation_id")
      .eq("batch_id", batchId)
      .maybeSingle();

    if (runError) throw new Error(runError.message);

    if (run && run.client_profile_id !== profile.id) {
      return corePost(request, context);
    }

    let confirmationQuery = supabaseAdmin
      .from("split_booking_payment_confirmations")
      .select("client_profile_id, payment_plan_snapshot");

    if (run?.payment_confirmation_id) {
      confirmationQuery = confirmationQuery.eq(
        "id",
        run.payment_confirmation_id
      );
    } else {
      confirmationQuery = confirmationQuery
        .eq("batch_id", batchId)
        .eq("client_profile_id", profile.id)
        .is("invalidated_at", null)
        .is("consumed_at", null)
        .order("confirmed_at", { ascending: false })
        .limit(1);
    }

    const { data: confirmation, error: confirmationError } =
      await confirmationQuery.maybeSingle();

    if (confirmationError) throw new Error(confirmationError.message);

    if (!confirmation || confirmation.client_profile_id !== profile.id) {
      return corePost(request, context);
    }

    const providerIds = providerIdsFromSnapshot(
      confirmation.payment_plan_snapshot
    );

    // A malformed or incomplete plan cannot reach Stripe because the frozen
    // core validates its canonical hash and live bookings. Preserve that core
    // response rather than masking it with a risk decision.
    if (providerIds.length === 0) {
      return corePost(request, context);
    }

    await enforceCheckoutTransactionRisk({
      payerAccount: account,
      recipientProfileIds: providerIds,
      subjectType: "split_batch",
      subjectId: batchId,
    });

    return corePost(request, context);
  } catch (error) {
    if (isTransactionRiskGateError(error)) {
      return NextResponse.json(
        {
          error:
            error.decision === "blocked"
              ? "Ce paiement multi-prestataires est temporairement bloqué pour vérification de sécurité."
              : "Ce paiement multi-prestataires nécessite une vérification de sécurité avant de continuer.",
          code: error.code,
          participant: error.participant,
          automaticSuspension: false,
        },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Préflight du paiement multi-prestataires impossible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "transaction_risk_split_checkout_failed",
      route: "/api/bookings/split-missions/[id]/checkout",
      method: "POST",
      status,
      code: "KLYX_TRANSACTION_RISK_PREFLIGHT_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

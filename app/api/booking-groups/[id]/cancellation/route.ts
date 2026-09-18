import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { preparePlatformHeldBookingGroupRefund } from "@/lib/booking-group-settlement-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  enforceRefundTransactionRisk,
  isTransactionRiskGateError,
} from "@/lib/transaction-risk-server";
import { POST as corePost } from "./route-core";

export { GET } from "./route-core";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RefundPreflightGroup = {
  id: string;
  client_profile_id: string;
  provider_profile_id: string;
  payment_status: string;
  payment_mode: string | null;
  cancellation_request_status: string;
  cancellation_requested_by: string | null;
  cancellation_resolution: string;
  refund_status: string;
};

export async function POST(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const body = (await request.clone().json().catch(() => null)) as {
      action?: string;
    } | null;

    if (body?.action !== "approve") {
      return corePost(request, context);
    }

    const { id } = await context.params;
    const { account, profile } = await getAuthenticatedAccount(request);
    const { data, error } = await supabaseAdmin
      .from("booking_groups")
      .select(
        "id, client_profile_id, provider_profile_id, payment_status, payment_mode, cancellation_request_status, cancellation_requested_by, cancellation_resolution, refund_status"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    // Preserve the core route as authority for not-found, participant and
    // cancellation-state errors. The risk preflight must not disclose a group.
    if (!data) {
      return corePost(request, context);
    }

    const group = data as RefundPreflightGroup;
    const isParticipant =
      group.client_profile_id === profile.id ||
      group.provider_profile_id === profile.id;
    const isSelfApproval = group.cancellation_requested_by === profile.id;
    const pendingApproval = group.cancellation_request_status === "requested";
    const approvedRetry =
      group.cancellation_resolution === "approved" &&
      ["processing", "failed", "review_required"].includes(
        group.refund_status
      );
    const mayCreateRefund =
      isParticipant &&
      !isSelfApproval &&
      group.payment_status === "paid" &&
      group.refund_status !== "refunded" &&
      (pendingApproval || approvedRetry);

    if (!mayCreateRefund) {
      return corePost(request, context);
    }

    await enforceRefundTransactionRisk({
      requesterAccount: account,
      refundRecipientProfileId: group.client_profile_id,
      subjectType: "booking_group",
      subjectId: group.id,
    });

    if (group.payment_mode === "platform_held") {
      const preparation = await preparePlatformHeldBookingGroupRefund(group.id);

      if (
        preparation.status === "busy" ||
        preparation.status === "not_ready"
      ) {
        return NextResponse.json(
          {
            error:
              "Le settlement groupé doit être réconcilié avant ce remboursement.",
            code: "KLYX_GROUP_SETTLEMENT_REFUND_NOT_READY",
          },
          { status: 409 }
        );
      }
    }

    return corePost(request, context);
  } catch (error) {
    if (isTransactionRiskGateError(error)) {
      return NextResponse.json(
        {
          error:
            "Ce remboursement nécessite une vérification de sécurité avant de continuer.",
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
        : "Préflight de remboursement groupé impossible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "transaction_risk_group_refund_failed",
      route: "/api/booking-groups/[id]/cancellation",
      method: "POST",
      status,
      code: "KLYX_REFUND_RISK_PREFLIGHT_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

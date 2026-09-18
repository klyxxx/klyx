import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  enforceRefundTransactionRisk,
  isTransactionRiskGateError,
} from "@/lib/transaction-risk-server";
import { POST as corePost } from "./route-core";

type RefundPreflightBooking = {
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  status: string;
  payment_status: string | null;
  refund_status: string | null;
};

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = (await request.clone().json().catch(() => null)) as {
      bookingId?: string;
      status?: string;
    } | null;
    const bookingId = body?.bookingId?.trim() ?? "";

    if (body?.status !== "cancelled" || !bookingId) {
      return corePost(request);
    }

    const { account, profile } = await getAuthenticatedAccount(request);
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "parent_id, provider_id, babysitter_id, status, payment_status, refund_status"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    // Preserve the core route as authority for not-found, ownership and all
    // cancellation validation. The preflight must not leak booking existence.
    if (!data) {
      return corePost(request);
    }

    const booking = data as RefundPreflightBooking;
    const providerId = booking.provider_id ?? booking.babysitter_id;
    const isParticipant =
      booking.parent_id === profile.id || providerId === profile.id;
    const mayCreateRefund =
      isParticipant &&
      booking.payment_status === "paid" &&
      ["pending", "accepted"].includes(booking.status) &&
      !["processing", "succeeded"].includes(booking.refund_status ?? "");

    if (!mayCreateRefund) {
      return corePost(request);
    }

    await enforceRefundTransactionRisk({
      requesterAccount: account,
      refundRecipientProfileId: booking.parent_id,
      subjectType: "booking",
      subjectId: bookingId,
    });

    return corePost(request);
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
        : "Préflight de remboursement impossible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "transaction_risk_booking_refund_failed",
      route: "/api/bookings/status",
      method: "POST",
      status,
      code: "KLYX_REFUND_RISK_PREFLIGHT_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

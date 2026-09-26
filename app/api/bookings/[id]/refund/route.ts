import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { reconcileCentralFinancialTruth } from "@/lib/financial-ledger-reconciliation-server";
import {
  refundPlatformHeldBooking,
  type SinglePlatformHeldRefundRequest,
} from "@/lib/platform-held-booking-refund-server";
import { isTransactionRiskGateError } from "@/lib/transaction-risk-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type JsonRow = Record<string, unknown>;

function asRecord(value: unknown): JsonRow | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRow)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cents(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const { account, profile } = await getAuthenticatedAccount(request);
    const { id: bookingId } = await context.params;
    const body = asRecord(await request.json());
    const kind = text(body?.kind);
    const requestKey = text(body?.requestKey);

    if (!bookingId || !requestKey || !["total", "partial"].includes(kind)) {
      return NextResponse.json(
        {
          error: "Plan de remboursement invalide.",
          code: "KLYX_SINGLE_REFUND_REQUEST_INVALID",
        },
        { status: 400 }
      );
    }

    let refundRequest: SinglePlatformHeldRefundRequest;

    if (kind === "total") {
      refundRequest = { kind: "total", requestKey };
    } else {
      const amountCents = cents(body?.amountCents);

      if (!amountCents) {
        return NextResponse.json(
          {
            error: "Le montant du remboursement partiel est invalide.",
            code: "KLYX_SINGLE_PARTIAL_REFUND_AMOUNT_INVALID",
          },
          { status: 400 }
        );
      }

      refundRequest = {
        kind: "partial",
        requestKey,
        amountCents,
      };
    }

    const financialTruth = await reconcileCentralFinancialTruth({
      bookingId,
    });

    if (financialTruth.status !== "coherent") {
      return NextResponse.json(
        {
          error:
            financialTruth.status === "human_review"
              ? "Le remboursement nécessite une vérification financière humaine."
              : "Le remboursement est bloqué par une réconciliation financière.",
          code:
            financialTruth.status === "human_review"
              ? "KLYX_FINANCIAL_HUMAN_REVIEW"
              : "KLYX_FINANCIAL_RECONCILIATION_REQUIRED",
        },
        { status: 409 }
      );
    }

    const result = await refundPlatformHeldBooking({
      bookingId,
      requesterAccount: account,
      requesterProfileId: profile.id,
      request: refundRequest,
    });

    return NextResponse.json(result, {
      status: result.status === "review_required" ? 409 : 200,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
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
        : "Impossible d'exécuter le remboursement.";

    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "platform_held_booking_refund_failed",
      route: "/api/bookings/[id]/refund",
      method: "POST",
      status,
      code: "KLYX_SINGLE_PLATFORM_HELD_REFUND_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

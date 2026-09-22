import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  refundSinglePlatformHeldBooking,
  type SinglePlatformHeldRefundRequest,
} from "@/lib/platform-held-booking-refund-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
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

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedAccount(request);
    requireAccountType(profile, "client");
    const { id: bookingId } = await context.params;

    const [bookingResult, settlementResult] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select(
          "id, parent_id, payment_status, payment_mode, refund_status, refunded_amount_cents, currency"
        )
        .eq("id", bookingId)
        .eq("parent_id", profile.id)
        .maybeSingle(),
      supabaseAdmin
        .from("booking_settlements")
        .select(
          "booking_id, state, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, refunded_amount_cents, refunded_platform_fee_cents, refunded_provider_amount_cents, released_provider_amount_cents, reversed_provider_amount_cents"
        )
        .eq("booking_id", bookingId)
        .maybeSingle(),
    ]);

    if (bookingResult.error) throw new Error(bookingResult.error.message);
    if (settlementResult.error) throw new Error(settlementResult.error.message);

    if (!bookingResult.data || !settlementResult.data) {
      return NextResponse.json(
        { error: "Réservation Platform-Held introuvable." },
        { status: 404 }
      );
    }

    const settlement = settlementResult.data;

    return NextResponse.json(
      {
        bookingId,
        state: settlement.state,
        currency: settlement.currency,
        grossAmountCents: Number(settlement.gross_amount_cents),
        platformFeeCents: Number(settlement.platform_fee_cents),
        providerAmountCents: Number(settlement.provider_amount_cents),
        refundedAmountCents: Number(settlement.refunded_amount_cents),
        refundedPlatformFeeCents: Number(
          settlement.refunded_platform_fee_cents
        ),
        refundedProviderAmountCents: Number(
          settlement.refunded_provider_amount_cents
        ),
        releasedProviderAmountCents: Number(
          settlement.released_provider_amount_cents
        ),
        reversedProviderAmountCents: Number(
          settlement.reversed_provider_amount_cents
        ),
        refundableAmountCents:
          Number(settlement.gross_amount_cents) -
          Number(settlement.refunded_amount_cents),
        partialRefundEconomicsCalculatedServerSide: true,
        totalRefundMeansRemainingFrozenEconomics: true,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de lire le remboursement.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "single_platform_held_refund_read_failed",
      route: "/api/bookings/[id]/refund",
      method: "GET",
      status,
      code: "KLYX_SINGLE_HELD_REFUND_READ_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const { account, profile } = await getAuthenticatedAccount(request);
    requireAccountType(profile, "client");
    const { id: bookingId } = await context.params;
    const body = asRecord(await request.json());
    const kind = text(body?.kind);
    const requestKey = text(body?.requestKey);

    if (!requestKey || !["partial", "total"].includes(kind)) {
      return NextResponse.json(
        {
          error: "Plan de remboursement invalide.",
          code: "KLYX_SINGLE_HELD_REFUND_REQUEST_INVALID",
        },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, payment_status, payment_mode, booking_group_id"
      )
      .eq("id", bookingId)
      .eq("parent_id", profile.id)
      .maybeSingle();

    if (bookingError) throw new Error(bookingError.message);
    if (!booking) {
      return NextResponse.json(
        { error: "Réservation introuvable." },
        { status: 404 }
      );
    }

    if (
      booking.payment_mode !== "platform_held" ||
      booking.booking_group_id ||
      booking.payment_status !== "paid"
    ) {
      return NextResponse.json(
        {
          error: "Cette réservation ne peut pas utiliser ce remboursement.",
          code: "KLYX_SINGLE_HELD_REFUND_NOT_APPLICABLE",
        },
        { status: 409 }
      );
    }

    let refundRequest: SinglePlatformHeldRefundRequest;

    if (kind === "total") {
      refundRequest = {
        kind: "total",
        requestKey,
      };
    } else {
      const amountCents = cents(body?.amountCents);

      if (!amountCents) {
        return NextResponse.json(
          {
            error: "Le montant partiel est invalide.",
            code: "KLYX_SINGLE_HELD_PARTIAL_REFUND_AMOUNT_INVALID",
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

    const result = await refundSinglePlatformHeldBooking({
      bookingId,
      requesterAccount: account,
      requesterProfileId: profile.id,
      request: refundRequest,
    });

    return NextResponse.json(result, {
      status: result.status === "review_required" ? 409 : 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
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
      event: "single_platform_held_refund_failed",
      route: "/api/bookings/[id]/refund",
      method: "POST",
      status,
      code: "KLYX_SINGLE_HELD_REFUND_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

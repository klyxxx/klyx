import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import {
  getPlatformHeldSettlementRecoveryMetrics,
  reconcilePlatformHeldBookingSettlement,
  reconcilePlatformHeldSettlementBacklog,
} from "@/lib/booking-settlement-recovery-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function recoveryErrorStatus(error: unknown): number {
  const founderStatus = founderErrorStatus(error);
  if (founderStatus !== 500) return founderStatus;

  const message = error instanceof Error ? error.message : "";
  if (
    message === "KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY" ||
    message === "KLYX_SETTLEMENT_STRIPE_TEST_KEY_REQUIRED"
  ) {
    return 409;
  }

  return 500;
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const [metrics, auditResult] = await Promise.all([
      getPlatformHeldSettlementRecoveryMetrics(),
      supabaseAdmin
        .from("booking_settlement_recovery_events")
        .select(
          "id, booking_id, action, state_before, state_after, stripe_transfer_id, stripe_transfer_reversal_id, reason_codes, details, observed_at"
        )
        .order("observed_at", { ascending: false })
        .limit(100),
    ]);

    if (auditResult.error) throw new Error(auditResult.error.message);

    return NextResponse.json(
      {
        mode: "platform_held",
        stripeEnvironment: "test_only",
        moneyMovementByRecovery: false,
        metrics,
        audit: auditResult.data ?? [],
      },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  } catch (error) {
    const status = recoveryErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_settlement_recovery_read_failed",
      route: "/api/founder/settlement-recovery",
      method: "GET",
      status,
      code: "KLYX_FOUNDER_SETTLEMENT_RECOVERY_READ_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const body = (await request.json().catch(() => ({}))) as {
      bookingId?: unknown;
      limit?: unknown;
    };

    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";

    if (bookingId) {
      const result = await reconcilePlatformHeldBookingSettlement(bookingId);
      return NextResponse.json(result, {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }

    const requestedLimit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.trunc(body.limit)
        : 25;
    const results = await reconcilePlatformHeldSettlementBacklog({
      limit: requestedLimit,
    });

    return NextResponse.json(
      {
        processed: results.length,
        results,
      },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  } catch (error) {
    const status = recoveryErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_settlement_recovery_run_failed",
      route: "/api/founder/settlement-recovery",
      method: "POST",
      status,
      code: "KLYX_FOUNDER_SETTLEMENT_RECOVERY_RUN_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}

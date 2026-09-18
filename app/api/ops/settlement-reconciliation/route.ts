import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import {
  getPlatformHeldSettlementMetrics,
  reconcilePendingPlatformHeldSettlements,
} from "@/lib/booking-settlement-reconciliation-server";

export const dynamic = "force-dynamic";

function noStore(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function authorized(request: NextRequest): boolean {
  const secret =
    process.env.KLYX_SETTLEMENT_RECONCILIATION_SECRET?.trim() ?? "";

  if (!secret) {
    return false;
  }

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function configured(): boolean {
  return Boolean(
    process.env.KLYX_SETTLEMENT_RECONCILIATION_SECRET?.trim()
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!configured()) {
    return noStore(503, {
      ok: false,
      code: "KLYX_SETTLEMENT_RECONCILIATION_NOT_CONFIGURED",
    });
  }

  if (!authorized(request)) {
    return noStore(401, {
      ok: false,
      code: "KLYX_SETTLEMENT_RECONCILIATION_UNAUTHORIZED",
    });
  }

  const metrics = await getPlatformHeldSettlementMetrics();

  return noStore(200, {
    ok: true,
    paymentMode: "platform_held",
    scope: "single_booking_only",
    metrics,
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!configured()) {
    return noStore(503, {
      ok: false,
      code: "KLYX_SETTLEMENT_RECONCILIATION_NOT_CONFIGURED",
    });
  }

  if (!authorized(request)) {
    return noStore(401, {
      ok: false,
      code: "KLYX_SETTLEMENT_RECONCILIATION_UNAUTHORIZED",
    });
  }

  let limit = 50;

  try {
    const body = (await request.json()) as { limit?: unknown };
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) {
      limit = Math.trunc(body.limit);
    }
  } catch {
    // Empty/non-JSON body intentionally uses the bounded default.
  }

  const reconciliation = await reconcilePendingPlatformHeldSettlements({
    limit,
    source: "scheduled",
  });
  const metrics = await getPlatformHeldSettlementMetrics();

  return noStore(200, {
    ok: true,
    paymentMode: "platform_held",
    scope: "single_booking_only",
    reconciliation,
    metrics,
  });
}

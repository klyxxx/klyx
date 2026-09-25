import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import {
  MAX_CONTROLLED_PURE_FINANCE_SHADOW_BOOKINGS,
  verifyControlledPureFinanceRuntimeShadow,
} from "@/lib/pure-finance-shadow-batch-server";
import { verifyPureFinanceRuntimeShadow } from "@/lib/pure-finance-shadow-server";

export const dynamic = "force-dynamic";

function noStore(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function configured(): boolean {
  return Boolean(process.env.KLYX_FINANCIAL_RECONCILIATION_SECRET?.trim());
}

function authorized(request: NextRequest): boolean {
  const secret =
    process.env.KLYX_FINANCIAL_RECONCILIATION_SECRET?.trim() ?? "";
  if (!secret) return false;

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);

  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
}

type ShadowRequestBody = {
  bookingId?: unknown;
  bookingIds?: unknown;
};

export async function POST(request: NextRequest): Promise<Response> {
  if (!configured()) {
    return noStore(503, {
      ok: false,
      code: "KLYX_FINANCIAL_RECONCILIATION_NOT_CONFIGURED",
    });
  }

  if (!authorized(request)) {
    return noStore(401, {
      ok: false,
      code: "KLYX_PURE_FINANCE_SHADOW_UNAUTHORIZED",
    });
  }

  let body: ShadowRequestBody;
  try {
    body = (await request.json()) as ShadowRequestBody;
  } catch {
    return noStore(400, {
      ok: false,
      code: "KLYX_PURE_FINANCE_SHADOW_BODY_INVALID",
    });
  }

  const hasSingle = body.bookingId !== undefined;
  const hasBatch = body.bookingIds !== undefined;
  if (hasSingle && hasBatch) {
    return noStore(400, {
      ok: false,
      code: "KLYX_PURE_FINANCE_SHADOW_MODE_AMBIGUOUS",
    });
  }

  if (hasBatch) {
    if (
      !Array.isArray(body.bookingIds) ||
      body.bookingIds.length === 0 ||
      body.bookingIds.length > MAX_CONTROLLED_PURE_FINANCE_SHADOW_BOOKINGS ||
      body.bookingIds.some((value) => typeof value !== "string")
    ) {
      return noStore(400, {
        ok: false,
        code: "KLYX_PURE_FINANCE_CONTROLLED_SHADOW_BOOKINGS_INVALID",
      });
    }

    try {
      const result = await verifyControlledPureFinanceRuntimeShadow({
        bookingIds: body.bookingIds as string[],
      });
      return noStore(200, { ok: true, mode: "controlled_batch", result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("KLYX_PURE_FINANCE_CONTROLLED_SHADOW_")) {
        return noStore(400, { ok: false, code: message });
      }
      return noStore(500, {
        ok: false,
        code: "KLYX_PURE_FINANCE_CONTROLLED_SHADOW_FAILED",
      });
    }
  }

  const bookingId =
    typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!bookingId) {
    return noStore(400, {
      ok: false,
      code: "KLYX_PURE_FINANCE_SHADOW_BOOKING_REQUIRED",
    });
  }

  try {
    const result = await verifyPureFinanceRuntimeShadow({ bookingId });
    return noStore(200, { ok: true, mode: "single", result });
  } catch {
    return noStore(500, {
      ok: false,
      code: "KLYX_PURE_FINANCE_SHADOW_FAILED",
    });
  }
}

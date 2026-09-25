import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { verifyPureFinanceRecognitionShadow } from "@/lib/pure-finance-shadow-server";

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

  let bookingId = "";
  try {
    const body = (await request.json()) as { bookingId?: unknown };
    bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  } catch {
    bookingId = "";
  }

  if (!bookingId) {
    return noStore(400, {
      ok: false,
      code: "KLYX_PURE_FINANCE_SHADOW_BOOKING_REQUIRED",
    });
  }

  try {
    const result = await verifyPureFinanceRecognitionShadow({ bookingId });
    return noStore(200, { ok: true, result });
  } catch {
    return noStore(500, {
      ok: false,
      code: "KLYX_PURE_FINANCE_SHADOW_FAILED",
    });
  }
}

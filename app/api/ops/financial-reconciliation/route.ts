import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { reconcileCentralFinancialTruth } from "@/lib/financial-ledger-reconciliation-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

export async function GET(request: NextRequest): Promise<Response> {
  if (!configured()) {
    return noStore(503, {
      ok: false,
      code: "KLYX_FINANCIAL_RECONCILIATION_NOT_CONFIGURED",
    });
  }

  if (!authorized(request)) {
    return noStore(401, {
      ok: false,
      code: "KLYX_FINANCIAL_RECONCILIATION_UNAUTHORIZED",
    });
  }

  const { data, error } = await supabaseAdmin
    .from("financial_reconciliation_current")
    .select("state");

  if (error) {
    return noStore(500, {
      ok: false,
      code: "KLYX_FINANCIAL_RECONCILIATION_METRICS_FAILED",
    });
  }

  const metrics = {
    reconciliation: 0,
    humanReview: 0,
    resolved: 0,
  };

  for (const row of data ?? []) {
    if (row.state === "reconciliation") metrics.reconciliation += 1;
    if (row.state === "human_review") metrics.humanReview += 1;
    if (row.state === "resolved") metrics.resolved += 1;
  }

  return noStore(200, {
    ok: true,
    authority: "klyx_financial_ledger",
    stripeRole: "external_evidence",
    correctionMode: "no_silent_correction",
    metrics,
  });
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
      code: "KLYX_FINANCIAL_RECONCILIATION_UNAUTHORIZED",
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
      code: "KLYX_FINANCIAL_RECONCILIATION_BOOKING_REQUIRED",
    });
  }

  const result = await reconcileCentralFinancialTruth({ bookingId });

  return noStore(200, {
    ok: true,
    result,
  });
}

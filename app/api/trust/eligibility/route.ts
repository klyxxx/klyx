import { NextResponse } from "next/server";

import { apiErrorStatus } from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  getAuthenticatedTrustAccount,
  listTrustDecisions,
} from "@/lib/trust-safety/server";

const TARGET_TYPES = new Set([
  "category",
  "service",
  "request",
  "booking",
  "mission",
]);

function clean(value: string | null, max: number): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : null;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { accountId } = await getAuthenticatedTrustAccount(request);
    const url = new URL(request.url);
    const targetType = clean(url.searchParams.get("targetType"), 40);
    const targetRef = clean(url.searchParams.get("targetRef"), 200);
    const categoryKey = clean(url.searchParams.get("categoryKey"), 120);
    const jurisdictionCode = clean(
      url.searchParams.get("jurisdictionCode"),
      32
    );

    if (targetType && !TARGET_TYPES.has(targetType)) {
      return NextResponse.json(
        { error: "Type de cible Trust & Safety invalide." },
        { status: 400 }
      );
    }

    if (targetRef && !targetType) {
      return NextResponse.json(
        { error: "targetType est requis avec targetRef." },
        { status: 400 }
      );
    }

    const decisions = await listTrustDecisions({
      accountId,
      targetType,
      targetRef,
      categoryKey,
      jurisdictionCode,
      limit: 10,
    });

    return NextResponse.json({ decisions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "KLYX_TRUST_ACCOUNT_REQUIRED"
        ? 403
        : apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "trust_eligibility_read_failed",
      route: "/api/trust/eligibility",
      method: "GET",
      status,
      code: "KLYX_TRUST_ELIGIBILITY_READ_FAILED",
      startedAt,
    });
  }
}

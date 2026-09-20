import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { getKlyxObservabilityFinancialMonitoringSnapshot } from "@/lib/observability-financial-monitoring-server";

const ROUTE = "/api/founder/operations/monitoring";

function boundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (value === null || value.trim() === "") return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const url = new URL(request.url);
    const signalLimit = boundedInteger(
      url.searchParams.get("limit"),
      250,
      1,
      500
    );
    const staleReleaseSeconds = boundedInteger(
      url.searchParams.get("staleReleaseSeconds"),
      900,
      60,
      86400
    );

    const snapshot =
      await getKlyxObservabilityFinancialMonitoringSnapshot({
        signalLimit,
        staleReleaseSeconds,
      });

    return NextResponse.json(snapshot);
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_observability_financial_monitoring_failed",
      route: ROUTE,
      method: "GET",
      status,
      code: "KLYX_FOUNDER_MONITORING_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}

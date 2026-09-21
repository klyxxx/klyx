import "server-only";

import type { NextRequest } from "next/server";

import { runKlyxCriticalAlertDeliveryProbe } from "@/lib/critical-alert-delivery-server";
import {
  isKlyxFinancialOpsAuthorized,
  isKlyxFinancialOpsConfigured,
} from "@/lib/financial-ops-auth-server";

export const dynamic = "force-dynamic";

function noStore(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isKlyxFinancialOpsConfigured()) {
    return noStore(503, {
      ok: false,
      code: "KLYX_FINANCIAL_OPS_NOT_CONFIGURED",
    });
  }

  if (!isKlyxFinancialOpsAuthorized(request)) {
    return noStore(401, {
      ok: false,
      code: "KLYX_FINANCIAL_OPS_UNAUTHORIZED",
    });
  }

  try {
    const result = await runKlyxCriticalAlertDeliveryProbe();
    const healthy = result.status === "healthy";

    return noStore(healthy ? 200 : 503, {
      ok: healthy,
      code: healthy
        ? "KLYX_CRITICAL_ALERT_DELIVERY_HEALTHY"
        : "KLYX_CRITICAL_FINANCIAL_SIGNAL_OPEN",
      result,
    });
  } catch {
    return noStore(503, {
      ok: false,
      code: "KLYX_CRITICAL_ALERT_DELIVERY_FAILED",
    });
  }
}

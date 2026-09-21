import "server-only";

import type { NextRequest } from "next/server";

import {
  isKlyxFinancialOpsAuthorized,
  isKlyxFinancialOpsConfigured,
} from "@/lib/financial-ops-auth-server";
import { runKlyxFinancialDurableWorker } from "@/lib/financial-durable-worker-server";

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

  let limit = 5;

  try {
    const body = (await request.json()) as { limit?: unknown };

    if (body.limit !== undefined) {
      limit = Number(body.limit);
    }
  } catch {
    limit = 5;
  }

  try {
    const result = await runKlyxFinancialDurableWorker({ limit });
    const healthy = result.status === "healthy";

    return noStore(healthy ? 200 : 503, {
      ok: healthy,
      code: healthy
        ? "KLYX_FINANCIAL_DURABLE_WORKER_HEALTHY"
        : "KLYX_FINANCIAL_DURABLE_WORKER_DEGRADED",
      result,
    });
  } catch {
    return noStore(503, {
      ok: false,
      code: "KLYX_FINANCIAL_DURABLE_WORKER_FAILED",
    });
  }
}

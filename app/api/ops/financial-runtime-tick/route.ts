import "server-only";

import {
  authorizeFinancialRuntimeTick,
  runFinancialRuntimeTick,
} from "@/lib/financial-runtime-worker-server";
import { logServerError } from "@/lib/server-log";

export const dynamic = "force-dynamic";
export const maxDuration = 50;

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() ?? "";
}

function statusFor(error: unknown): number {
  const message =
    error instanceof Error ? error.message : "";

  if (message === "KLYX_FINANCIAL_WORKER_AUTH_INVALID") {
    return 401;
  }

  if (
    message === "KLYX_FINANCIAL_WORKER_DISABLED" ||
    message === "KLYX_FINANCIAL_WORKER_CONFIG_MISSING"
  ) {
    return 503;
  }

  return 500;
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    const token = bearerToken(request);
    await authorizeFinancialRuntimeTick(token);

    const result = await runFinancialRuntimeTick();

    return Response.json(
      {
        ok: true,
        sourceSha: result.sourceSha,
        counters: result.counters,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const status = statusFor(error);

    logServerError({
      error,
      event: "financial_runtime_tick_failed",
      route: "/api/ops/financial-runtime-tick",
      method: "POST",
      status,
      code:
        error instanceof Error
          ? error.message.slice(0, 120)
          : "KLYX_FINANCIAL_RUNTIME_TICK_FAILED",
      durationMs: Math.max(0, Date.now() - startedAt),
    });

    return Response.json(
      {
        ok: false,
        code:
          status === 401
            ? "KLYX_FINANCIAL_WORKER_UNAUTHORIZED"
            : status === 503
              ? "KLYX_FINANCIAL_WORKER_NOT_READY"
              : "KLYX_FINANCIAL_WORKER_FAILED",
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}

import "server-only";

import {
  authorizeMobilePushTick,
  runMobilePushTick,
} from "@/lib/mobile-push-server";
import { logServerError } from "@/lib/server-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 50;

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() ?? "";
}

function statusFor(error: unknown): number {
  const message = error instanceof Error ? error.message : "";

  if (message === "KLYX_MOBILE_PUSH_WORKER_AUTH_INVALID") return 401;
  if (
    message === "KLYX_MOBILE_PUSH_WORKER_DISABLED" ||
    message === "KLYX_MOBILE_PUSH_WORKER_CONFIG_MISSING"
  ) {
    return 503;
  }
  return 500;
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    await authorizeMobilePushTick(bearerToken(request));
    const result = await runMobilePushTick();

    return Response.json(
      {
        ok: true,
        workerId: result.workerId,
        counters: result.counters,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = statusFor(error);
    logServerError({
      error,
      event: "mobile_push_tick_failed",
      route: "/api/ops/mobile-push-tick",
      method: "POST",
      status,
      code:
        error instanceof Error
          ? error.message.slice(0, 120)
          : "KLYX_MOBILE_PUSH_TICK_FAILED",
      durationMs: Math.max(0, Date.now() - startedAt),
    });

    return Response.json(
      {
        ok: false,
        code:
          status === 401
            ? "KLYX_MOBILE_PUSH_UNAUTHORIZED"
            : status === 503
              ? "KLYX_MOBILE_PUSH_NOT_READY"
              : "KLYX_MOBILE_PUSH_FAILED",
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

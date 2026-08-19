import { secureApiErrorResponse } from "@/lib/api-error";
import {
  GET as getSplitBookingRecoveryCore,
  POST as postSplitBookingRecoveryCore,
} from "./recovery-route-core";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function secureCoreResponse(params: {
  request: Request;
  context: RouteContext;
  method: "GET" | "POST";
}) {
  const startedAt = Date.now();
  const handler =
    params.method === "GET"
      ? getSplitBookingRecoveryCore
      : postSplitBookingRecoveryCore;

  try {
    const response = await handler(params.request, params.context);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error(`Split booking recovery ${params.method} failed.`),
      status: response.status,
      event:
        params.method === "GET"
          ? "split_booking_recovery_check_failed"
          : "split_booking_recovery_finalize_failed",
      route: "/api/market/requests/[id]/split-fallback/book/recovery",
      method: params.method,
      code:
        params.method === "GET"
          ? "KLYX_SPLIT_BOOKING_RECOVERY_CHECK_FAILED"
          : "KLYX_SPLIT_BOOKING_RECOVERY_FINALIZE_FAILED",
      startedAt,
      details: {
        canFinalize: false,
        automaticRetry: false,
        automaticBooking: false,
        automaticPayment: false,
      },
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      status: 500,
      event:
        params.method === "GET"
          ? "split_booking_recovery_check_failed"
          : "split_booking_recovery_finalize_failed",
      route: "/api/market/requests/[id]/split-fallback/book/recovery",
      method: params.method,
      code:
        params.method === "GET"
          ? "KLYX_SPLIT_BOOKING_RECOVERY_CHECK_FAILED"
          : "KLYX_SPLIT_BOOKING_RECOVERY_FINALIZE_FAILED",
      startedAt,
      details: {
        canFinalize: false,
        automaticRetry: false,
        automaticBooking: false,
        automaticPayment: false,
      },
    });
  }
}

export async function GET(request: Request, context: RouteContext) {
  return secureCoreResponse({ request, context, method: "GET" });
}

export async function POST(request: Request, context: RouteContext) {
  return secureCoreResponse({ request, context, method: "POST" });
}

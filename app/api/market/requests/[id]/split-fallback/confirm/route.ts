import { secureApiErrorResponse } from "@/lib/api-error";
import {
  GET as getSplitConfirmationCore,
  POST as postSplitConfirmationCore,
} from "./confirm-route-core";

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
      ? getSplitConfirmationCore
      : postSplitConfirmationCore;

  try {
    const response = await handler(params.request, params.context);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error(`Split plan confirmation ${params.method} failed.`),
      status: response.status,
      event:
        params.method === "GET"
          ? "split_plan_confirmation_check_failed"
          : "split_plan_confirmation_create_failed",
      route: "/api/market/requests/[id]/split-fallback/confirm",
      method: params.method,
      code:
        params.method === "GET"
          ? "KLYX_SPLIT_PLAN_CONFIRMATION_CHECK_FAILED"
          : "KLYX_SPLIT_PLAN_CONFIRMATION_CREATE_FAILED",
      startedAt,
      details: {
        automaticProviderSelection: false,
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
          ? "split_plan_confirmation_check_failed"
          : "split_plan_confirmation_create_failed",
      route: "/api/market/requests/[id]/split-fallback/confirm",
      method: params.method,
      code:
        params.method === "GET"
          ? "KLYX_SPLIT_PLAN_CONFIRMATION_CHECK_FAILED"
          : "KLYX_SPLIT_PLAN_CONFIRMATION_CREATE_FAILED",
      startedAt,
      details: {
        automaticProviderSelection: false,
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

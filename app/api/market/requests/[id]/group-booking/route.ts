import { secureApiErrorResponse } from "@/lib/api-error";
import { POST as corePost } from "./group-booking-core";

type GroupBookingRouteContext = {
  params: Promise<{ id: string }>;
};

async function secureCoreResponse(
  response: Response,
  startedAt: number
): Promise<Response> {
  if (response.status < 500) {
    return response;
  }

  let error: unknown = new Error("Group booking operation failed.");

  try {
    const payload = (await response.clone().json()) as {
      error?: unknown;
    };

    if (typeof payload.error === "string" && payload.error.trim()) {
      error = new Error(payload.error);
    }
  } catch {
    // The public 5xx response is replaced below; parsing failure is non-fatal.
  }

  return secureApiErrorResponse({
    error,
    event: "market_group_booking_create_failed",
    route: "/api/market/requests/[id]/group-booking",
    method: "POST",
    status: response.status,
    code: "KLYX_MARKET_GROUP_BOOKING_CREATE_FAILED",
    startedAt,
  });
}

export async function POST(
  request: Request,
  context: GroupBookingRouteContext
) {
  const startedAt = Date.now();

  try {
    const response = await corePost(request, context);
    return secureCoreResponse(response, startedAt);
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "market_group_booking_create_failed",
      route: "/api/market/requests/[id]/group-booking",
      method: "POST",
      status: 500,
      code: "KLYX_MARKET_GROUP_BOOKING_CREATE_FAILED",
      startedAt,
    });
  }
}

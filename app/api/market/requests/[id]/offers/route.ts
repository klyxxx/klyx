import { secureApiErrorResponse } from "@/lib/api-error";
import {
  PATCH as corePatch,
  POST as corePost,
} from "./offer-route-core";

type OfferRouteContext = {
  params: Promise<{ id: string }>;
};

type OfferMethod = "POST" | "PATCH";

async function secureCoreResponse(
  response: Response,
  method: OfferMethod,
  startedAt: number
): Promise<Response> {
  if (response.status < 500) {
    return response;
  }

  let error: unknown = new Error("Market offer operation failed.");

  try {
    const payload = (await response.clone().json()) as {
      error?: unknown;
    };

    if (typeof payload.error === "string" && payload.error.trim()) {
      error = new Error(payload.error);
    }
  } catch {
    // The public response is replaced below; parsing failure is intentionally ignored.
  }

  return secureApiErrorResponse({
    error,
    event:
      method === "POST"
        ? "market_offer_create_failed"
        : "market_offer_update_failed",
    route: "/api/market/requests/[id]/offers",
    method,
    status: response.status,
    code:
      method === "POST"
        ? "KLYX_MARKET_OFFER_CREATE_FAILED"
        : "KLYX_MARKET_OFFER_UPDATE_FAILED",
    startedAt,
  });
}

export async function POST(
  request: Request,
  context: OfferRouteContext
) {
  const startedAt = Date.now();

  try {
    const response = await corePost(request, context);
    return secureCoreResponse(response, "POST", startedAt);
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "market_offer_create_failed",
      route: "/api/market/requests/[id]/offers",
      method: "POST",
      status: 500,
      code: "KLYX_MARKET_OFFER_CREATE_FAILED",
      startedAt,
    });
  }
}

export async function PATCH(
  request: Request,
  context: OfferRouteContext
) {
  const startedAt = Date.now();

  try {
    const response = await corePatch(request, context);
    return secureCoreResponse(response, "PATCH", startedAt);
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "market_offer_update_failed",
      route: "/api/market/requests/[id]/offers",
      method: "PATCH",
      status: 500,
      code: "KLYX_MARKET_OFFER_UPDATE_FAILED",
      startedAt,
    });
  }
}

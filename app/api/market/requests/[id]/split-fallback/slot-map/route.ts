import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as getSlotMapCore } from "./slot-map-core";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  const startedAt = Date.now();

  try {
    const response = await getSlotMapCore(
      request,
      context
    );

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error(
        "Split fallback slot map core returned an internal server error."
      ),
      event: "market_split_fallback_slot_map_failed",
      route: "/api/market/requests/[id]/split-fallback/slot-map",
      method: "GET",
      status: 500,
      code: "KLYX_MARKET_SPLIT_FALLBACK_SLOT_MAP_FAILED",
      startedAt,
      details: {
        splitPlanPossible: false,
        automaticProviderSelection: false,
        automaticBooking: false,
        automaticPayment: false,
      },
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "market_split_fallback_slot_map_failed",
      route: "/api/market/requests/[id]/split-fallback/slot-map",
      method: "GET",
      status: 500,
      code: "KLYX_MARKET_SPLIT_FALLBACK_SLOT_MAP_FAILED",
      startedAt,
      details: {
        splitPlanPossible: false,
        automaticProviderSelection: false,
        automaticBooking: false,
        automaticPayment: false,
      },
    });
  }
}

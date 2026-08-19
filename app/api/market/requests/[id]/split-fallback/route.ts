import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as getSplitFallbackCore } from "./split-fallback-core";

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
    const response = await getSplitFallbackCore(
      request,
      context
    );

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error(
        "Split fallback core returned an internal server error."
      ),
      event: "market_split_fallback_load_failed",
      route: "/api/market/requests/[id]/split-fallback",
      method: "GET",
      status: 500,
      code: "KLYX_MARKET_SPLIT_FALLBACK_LOAD_FAILED",
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
      event: "market_split_fallback_load_failed",
      route: "/api/market/requests/[id]/split-fallback",
      method: "GET",
      status: 500,
      code: "KLYX_MARKET_SPLIT_FALLBACK_LOAD_FAILED",
      startedAt,
      details: {
        automaticProviderSelection: false,
        automaticBooking: false,
        automaticPayment: false,
      },
    });
  }
}

import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as providerSearchCore } from "./providers-route-core";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await providerSearchCore(request);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error("Provider search failed."),
      event: "provider_search_failed",
      route: "/api/search/providers",
      method: "GET",
      code: "KLYX_PROVIDER_SEARCH_FAILED",
      status: response.status,
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_search_failed",
      route: "/api/search/providers",
      method: "GET",
      code: "KLYX_PROVIDER_SEARCH_FAILED",
      status: 500,
      startedAt,
    });
  }
}

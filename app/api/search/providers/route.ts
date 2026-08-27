import { after } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { recordAggregateProductMetric } from "@/lib/product-analytics";
import { GET as providerSearchCore } from "./providers-route-core";

async function recordSearchOutcome(
  request: Request,
  response: Response
): Promise<void> {
  const analyticsDisabled =
    new URL(request.url).searchParams.get("analytics") === "0";

  if (analyticsDisabled || response.status !== 200) {
    return;
  }

  try {
    const body = (await response.clone().json()) as {
      providers?: unknown;
    };
    const hasResults =
      Array.isArray(body.providers) && body.providers.length > 0;

    await recordAggregateProductMetric(
      hasResults
        ? "provider_search_with_results"
        : "provider_search_no_results"
    );
  } catch {
    // Product metrics are optional and never alter a successful search.
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await providerSearchCore(request);

    if (response.status < 500) {
      after(async () => {
        await recordSearchOutcome(request, response);
      });
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

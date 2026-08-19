import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as coverageCore } from "./coverage-route-core";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await coverageCore(request);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error("Search coverage failed."),
      event: "search_coverage_failed",
      route: "/api/search/coverage",
      method: "GET",
      code: "KLYX_SEARCH_COVERAGE_FAILED",
      status: response.status,
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "search_coverage_failed",
      route: "/api/search/coverage",
      method: "GET",
      code: "KLYX_SEARCH_COVERAGE_FAILED",
      status: 500,
      startedAt,
    });
  }
}

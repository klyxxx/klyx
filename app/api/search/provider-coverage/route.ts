import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as providerCoverageCore } from "./provider-coverage-route-core";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await providerCoverageCore(request);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error("Provider coverage check failed."),
      event: "provider_coverage_check_failed",
      route: "/api/search/provider-coverage",
      method: "GET",
      code: "KLYX_PROVIDER_COVERAGE_CHECK_FAILED",
      status: response.status,
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_coverage_check_failed",
      route: "/api/search/provider-coverage",
      method: "GET",
      code: "KLYX_PROVIDER_COVERAGE_CHECK_FAILED",
      status: 500,
      startedAt,
    });
  }
}

import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { POST as analyzeRequestCore } from "./analyze-route-core";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const policy = API_RATE_LIMIT_POLICIES.requestAnalysis;
    const rateLimit = await consumeApiRateLimit(profile.id, policy);

    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(policy, rateLimit);
    }

    const response = await analyzeRequestCore(request);

    for (const [name, value] of Object.entries(
      rateLimitResponseHeaders(policy, rateLimit)
    )) {
      response.headers.set(name, value);
    }

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error("Universal request analysis failed."),
      event: "request_analysis_failed",
      route: "/api/requests/analyze",
      method: "POST",
      code: "KLYX_REQUEST_ANALYSIS_FAILED",
      status: response.status,
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "request_analysis_failed",
      route: "/api/requests/analyze",
      method: "POST",
      code: "KLYX_REQUEST_ANALYSIS_FAILED",
      status: 500,
      startedAt,
    });
  }
}

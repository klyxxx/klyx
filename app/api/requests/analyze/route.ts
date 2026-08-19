import { secureApiErrorResponse } from "@/lib/api-error";
import { POST as analyzeRequestCore } from "./analyze-route-core";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await analyzeRequestCore(request);

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

import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as coreGet } from "./activity-summary-core";

async function secureCoreResponse(
  response: Response,
  startedAt: number
): Promise<Response> {
  if (response.status < 500) {
    return response;
  }

  let error: unknown = new Error("Provider activity summary failed.");

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
    event: "provider_activity_summary_load_failed",
    route: "/api/provider/activity-summary",
    method: "GET",
    status: response.status,
    code: "KLYX_PROVIDER_ACTIVITY_SUMMARY_LOAD_FAILED",
    startedAt,
    details: {
      automaticExecutionAllowed: false,
    },
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await coreGet(request);
    return secureCoreResponse(response, startedAt);
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_activity_summary_load_failed",
      route: "/api/provider/activity-summary",
      method: "GET",
      status: 500,
      code: "KLYX_PROVIDER_ACTIVITY_SUMMARY_LOAD_FAILED",
      startedAt,
      details: {
        automaticExecutionAllowed: false,
      },
    });
  }
}

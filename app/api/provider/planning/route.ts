import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as coreGet } from "./planning-route-core";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await coreGet(request);

    if (response.status < 500) {
      return response;
    }

    let error: unknown = new Error(
      `Provider planning GET returned HTTP ${response.status}`
    );

    try {
      const payload = (await response.clone().json()) as {
        error?: unknown;
      };

      if (typeof payload.error === "string" && payload.error.trim()) {
        error = new Error(payload.error);
      }
    } catch {
      // Keep the synthetic error when the core response is not JSON.
    }

    return secureApiErrorResponse({
      error,
      event: "provider_planning_load_failed",
      route: "/api/provider/planning",
      method: "GET",
      status: response.status,
      code: "KLYX_PROVIDER_PLANNING_LOAD_FAILED",
      details: {
        automaticChanges: false,
      },
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_planning_load_failed",
      route: "/api/provider/planning",
      method: "GET",
      status: 500,
      code: "KLYX_PROVIDER_PLANNING_LOAD_FAILED",
      details: {
        automaticChanges: false,
      },
      startedAt,
    });
  }
}

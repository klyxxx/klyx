import { secureApiErrorResponse } from "@/lib/api-error";
import {
  GET as coreGet,
  PATCH as corePatch,
  POST as corePost,
} from "./assistant-route-core";

type Method = "GET" | "POST" | "PATCH";

async function secureBoundary(
  method: Method,
  handler: (request: Request) => Promise<Response>,
  request: Request
) {
  const startedAt = Date.now();

  try {
    const response = await handler(request);

    if (response.status < 500) {
      return response;
    }

    let error: unknown = new Error(
      `Provider assistant ${method} returned HTTP ${response.status}`
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
      event: `provider_assistant_${method.toLowerCase()}_failed`,
      route: "/api/provider/assistant",
      method,
      status: response.status,
      code: `KLYX_PROVIDER_ASSISTANT_${method}_FAILED`,
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: `provider_assistant_${method.toLowerCase()}_failed`,
      route: "/api/provider/assistant",
      method,
      status: 500,
      code: `KLYX_PROVIDER_ASSISTANT_${method}_FAILED`,
      startedAt,
    });
  }
}

export async function GET(request: Request) {
  return secureBoundary("GET", coreGet, request);
}

export async function POST(request: Request) {
  return secureBoundary("POST", corePost, request);
}

export async function PATCH(request: Request) {
  return secureBoundary("PATCH", corePatch, request);
}

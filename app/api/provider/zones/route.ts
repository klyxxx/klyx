import { secureApiErrorResponse } from "@/lib/api-error";
import {
  DELETE as coreDelete,
  GET as coreGet,
  PATCH as corePatch,
  POST as corePost,
} from "./zones-route-core";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function secureResponse(
  method: Method,
  startedAt: number,
  run: () => Promise<Response>
) {
  try {
    const response = await run();

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error("Provider zones core returned an unexpected 5xx response."),
      event: "provider_zones_request_failed",
      route: "/api/provider/zones",
      method,
      status: 500,
      code: "KLYX_PROVIDER_ZONES_REQUEST_FAILED",
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_zones_request_failed",
      route: "/api/provider/zones",
      method,
      status: 500,
      code: "KLYX_PROVIDER_ZONES_REQUEST_FAILED",
      startedAt,
    });
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  return secureResponse("GET", startedAt, () => coreGet(request));
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  return secureResponse("POST", startedAt, () => corePost(request));
}

export async function PATCH(request: Request) {
  const startedAt = Date.now();
  return secureResponse("PATCH", startedAt, () => corePatch(request));
}

export async function DELETE(request: Request) {
  const startedAt = Date.now();
  return secureResponse("DELETE", startedAt, () => coreDelete(request));
}

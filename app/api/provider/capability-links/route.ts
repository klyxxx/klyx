import { secureApiErrorResponse } from "@/lib/api-error";
import {
  DELETE as coreDelete,
  GET as coreGet,
  POST as corePost,
} from "./capability-links-route-core";

type Method = "GET" | "POST" | "DELETE";

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
      error: new Error(
        "Provider capability links core returned an unexpected 5xx response."
      ),
      event: "provider_capability_links_request_failed",
      route: "/api/provider/capability-links",
      method,
      status: 500,
      code: "KLYX_PROVIDER_CAPABILITY_LINKS_REQUEST_FAILED",
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_capability_links_request_failed",
      route: "/api/provider/capability-links",
      method,
      status: 500,
      code: "KLYX_PROVIDER_CAPABILITY_LINKS_REQUEST_FAILED",
      startedAt,
    });
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  return secureResponse("GET", startedAt, () => coreGet(request));
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  return secureResponse("POST", startedAt, () => corePost(request));
}

export async function DELETE(request: Request) {
  const startedAt = Date.now();
  return secureResponse("DELETE", startedAt, () => coreDelete(request));
}

import { secureApiErrorResponse } from "@/lib/api-error";
import { providerPublicationQualificationPreflight } from "@/lib/provider-publication-qualification-readiness";
import { providerPublicationZonePreflight } from "@/lib/provider-publication-zone-readiness";
import {
  DELETE as coreDelete,
  GET as coreGet,
  POST as corePost,
  PUT as corePut,
} from "./studio-route-core";

type Method = "GET" | "PUT" | "POST" | "DELETE";

async function secureStudioResponse(
  method: Method,
  execute: () => Promise<Response>
) {
  const startedAt = Date.now();

  try {
    const response = await execute();

    if (response.status < 500) {
      return response;
    }

    let internalError: unknown = new Error("Provider studio request failed.");

    try {
      const payload = (await response.clone().json()) as {
        error?: unknown;
      };

      if (typeof payload?.error === "string" && payload.error.trim()) {
        internalError = new Error(payload.error);
      }
    } catch {
      // Keep the generic internal error for structured server logging.
    }

    return secureApiErrorResponse({
      error: internalError,
      event: "provider_studio_request_failed",
      route: "/api/provider/studio",
      method,
      status: response.status,
      code: "KLYX_PROVIDER_STUDIO_REQUEST_FAILED",
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_studio_request_failed",
      route: "/api/provider/studio",
      method,
      status: 500,
      code: "KLYX_PROVIDER_STUDIO_REQUEST_FAILED",
      startedAt,
    });
  }
}

export async function GET() {
  return secureStudioResponse("GET", () => coreGet());
}

export async function PUT(request: Request) {
  return secureStudioResponse("PUT", async () => {
    const zonePreflight = await providerPublicationZonePreflight(
      request.clone()
    );

    if (zonePreflight) return zonePreflight;

    const qualificationPreflight =
      await providerPublicationQualificationPreflight(request.clone());

    if (qualificationPreflight) return qualificationPreflight;

    return corePut(request);
  });
}

export async function POST(request: Request) {
  return secureStudioResponse("POST", () => corePost(request));
}

export async function DELETE(request: Request) {
  return secureStudioResponse("DELETE", () => coreDelete(request));
}

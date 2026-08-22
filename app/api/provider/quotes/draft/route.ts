import { secureApiErrorResponse } from "@/lib/api-error";
import { POST as corePost } from "./quote-draft-route-core";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await corePost(request);

    if (response.status < 500) {
      return response;
    }

    let error: unknown = new Error(
      `Provider quote draft returned HTTP ${response.status}`
    );

    try {
      const payload = (await response.clone().json()) as {
        error?: unknown;
      };

      if (typeof payload.error === "string" && payload.error.trim()) {
        error = new Error(payload.error);
      }
    } catch {
      // The public 5xx response is replaced below.
    }

    return secureApiErrorResponse({
      error,
      event: "provider_quote_draft_failed",
      route: "/api/provider/quotes/draft",
      method: "POST",
      status: response.status,
      code: "KLYX_PROVIDER_QUOTE_DRAFT_FAILED",
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_quote_draft_failed",
      route: "/api/provider/quotes/draft",
      method: "POST",
      status: 500,
      code: "KLYX_PROVIDER_QUOTE_DRAFT_FAILED",
      startedAt,
    });
  }
}

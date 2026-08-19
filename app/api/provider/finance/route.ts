import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as coreGet } from "./finance-route-core";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await coreGet(request);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error(
        "Provider finance core returned an unexpected 5xx response."
      ),
      event: "provider_finance_load_failed",
      route: "/api/provider/finance",
      method: "GET",
      status: response.status,
      code: "KLYX_PROVIDER_FINANCE_LOAD_FAILED",
      details: {
        automaticExecutionAllowed: false,
      },
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_finance_load_failed",
      route: "/api/provider/finance",
      method: "GET",
      status: 500,
      code: "KLYX_PROVIDER_FINANCE_LOAD_FAILED",
      details: {
        automaticExecutionAllowed: false,
      },
      startedAt,
    });
  }
}

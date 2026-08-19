import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as coreGet } from "./jobs-route-core";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await coreGet(request);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error(
        "Provider jobs core returned an unexpected 5xx response."
      ),
      event: "provider_jobs_load_failed",
      route: "/api/provider/jobs",
      method: "GET",
      status: response.status,
      code: "KLYX_PROVIDER_JOBS_LOAD_FAILED",
      details: {
        automaticExecutionAllowed: false,
        automaticOffer: false,
        automaticBooking: false,
        automaticPayment: false,
      },
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_jobs_load_failed",
      route: "/api/provider/jobs",
      method: "GET",
      status: 500,
      code: "KLYX_PROVIDER_JOBS_LOAD_FAILED",
      details: {
        automaticExecutionAllowed: false,
        automaticOffer: false,
        automaticBooking: false,
        automaticPayment: false,
      },
      startedAt,
    });
  }
}

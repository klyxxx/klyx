import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as coreGet } from "./phone-access-history-route-core";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await coreGet(request);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error("Phone access history core returned an unexpected 5xx response."),
      event: "profile_phone_access_history_failed",
      route: "/api/profile/phone/access-history",
      method: "GET",
      status: 500,
      code: "KLYX_PROFILE_PHONE_ACCESS_HISTORY_FAILED",
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "profile_phone_access_history_failed",
      route: "/api/profile/phone/access-history",
      method: "GET",
      status: 500,
      code: "KLYX_PROFILE_PHONE_ACCESS_HISTORY_FAILED",
      startedAt,
    });
  }
}

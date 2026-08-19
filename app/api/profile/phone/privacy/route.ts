import { secureApiErrorResponse } from "@/lib/api-error";
import {
  GET as coreGet,
  PUT as corePut,
} from "./phone-privacy-route-core";

type Method = "GET" | "PUT";

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
      error: new Error("Phone privacy core returned an unexpected 5xx response."),
      event: "profile_phone_privacy_request_failed",
      route: "/api/profile/phone/privacy",
      method,
      status: 500,
      code: "KLYX_PROFILE_PHONE_PRIVACY_REQUEST_FAILED",
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "profile_phone_privacy_request_failed",
      route: "/api/profile/phone/privacy",
      method,
      status: 500,
      code: "KLYX_PROFILE_PHONE_PRIVACY_REQUEST_FAILED",
      startedAt,
    });
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  return secureResponse("GET", startedAt, () => coreGet(request));
}

export async function PUT(request: Request) {
  const startedAt = Date.now();
  return secureResponse("PUT", startedAt, () => corePut(request));
}

import { secureApiErrorResponse } from "@/lib/api-error";
import { POST as corePost } from "./otp-send-route-core";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await corePost(request);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error("Phone OTP send core returned an unexpected 5xx response."),
      event: "profile_phone_otp_send_failed",
      route: "/api/profile/phone/otp/send",
      method: "POST",
      status: 500,
      code: "KLYX_PROFILE_PHONE_OTP_SEND_FAILED",
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "profile_phone_otp_send_failed",
      route: "/api/profile/phone/otp/send",
      method: "POST",
      status: 500,
      code: "KLYX_PROFILE_PHONE_OTP_SEND_FAILED",
      startedAt,
    });
  }
}

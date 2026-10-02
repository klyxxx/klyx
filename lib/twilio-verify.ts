import "server-only";

import {
  fetchWithProviderRecovery,
} from "@/lib/provider-http-recovery";
import {
  assertKlyxExternalProviderSpendAllowed,
} from "@/lib/providers/cost-control";

// KLYX_TWILIO_VERIFY_12_69

type TwilioResponse = {
  status?: string;
  message?: string;
  code?: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      "Configuration SMS KLYX manquante : " + name
    );
  }

  return value;
}

function authCredentials() {
  const apiKeySid =
    process.env.TWILIO_API_KEY_SID?.trim();

  const apiKeySecret =
    process.env.TWILIO_API_KEY_SECRET?.trim();

  if (apiKeySid && apiKeySecret) {
    return {
      username: apiKeySid,
      password: apiKeySecret,
    };
  }

  return {
    username: requiredEnv("TWILIO_ACCOUNT_SID"),
    password: requiredEnv("TWILIO_AUTH_TOKEN"),
  };
}

function authorizationHeader() {
  const credentials = authCredentials();

  const token = Buffer.from(
    credentials.username + ":" + credentials.password
  ).toString("base64");

  return "Basic " + token;
}

async function parseResponse(
  response: Response
): Promise<TwilioResponse> {
  const data =
    (await response.json()) as TwilioResponse;

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Service SMS KLYX indisponible."
    );
  }

  return data;
}

export async function sendPhoneOtp(
  phoneNumber: string
) {
  assertKlyxExternalProviderSpendAllowed("twilio");

  const serviceSid =
    requiredEnv("TWILIO_VERIFY_SERVICE_SID");

  const body = new URLSearchParams({
    To: phoneNumber,
    Channel: "sms",
  });

  // Starting a verification can send an SMS. A timeout is therefore
  // ambiguous: never replay it blindly and risk duplicate messages.
  const response = await fetchWithProviderRecovery(
    "https://verify.twilio.com/v2/Services/" +
      encodeURIComponent(serviceSid) +
      "/Verifications",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: authorizationHeader(),
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
    {
      provider: "twilio",
      operation: "start_verification",
      replaySafety: "ambiguous",
      timeoutMs: 8_000,
      maxAttempts: 1,
    }
  );

  return parseResponse(response);
}

export async function verifyPhoneOtp(
  phoneNumber: string,
  code: string
) {
  assertKlyxExternalProviderSpendAllowed("twilio");

  const serviceSid =
    requiredEnv("TWILIO_VERIFY_SERVICE_SID");

  const body = new URLSearchParams({
    To: phoneNumber,
    Code: code,
  });

  // Verification checks do not create the SMS side effect, so transient
  // provider/network failures may be retried automatically.
  const response = await fetchWithProviderRecovery(
    "https://verify.twilio.com/v2/Services/" +
      encodeURIComponent(serviceSid) +
      "/VerificationCheck",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: authorizationHeader(),
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
    {
      provider: "twilio",
      operation: "check_verification",
      replaySafety: "safe",
      timeoutMs: 8_000,
      maxAttempts: 3,
    }
  );

  const data = await parseResponse(response);

  return {
    approved: data.status === "approved",
    status: data.status ?? "unknown",
  };
}

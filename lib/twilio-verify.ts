import "server-only";

import { authorizeKlyxExternalCall } from "@/lib/external-cost-control-server";

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

function localTestTransportEnabled(): boolean {
  return (
    process.env.KLYX_LOCAL_TEST_TRANSPORTS === "1" &&
    process.env.VERCEL_ENV !== "production"
  );
}

function localTestOtpCode(): string {
  const configured = process.env.KLYX_LOCAL_TEST_OTP_CODE?.trim();
  return /^\d{6}$/.test(configured ?? "") ? configured! : "000000";
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
  const cost = await authorizeKlyxExternalCall({
    provider: "twilio",
    operation: "verify_sms_send",
    estimatedCostMicroUsd: 250_000,
    criticality: "non_critical",
  });

  if (!cost.allowed) {
    if (localTestTransportEnabled()) {
      return {
        status: "pending",
        message: "KLYX local zero-cost OTP transport",
      };
    }
    throw new Error(`KLYX_EXTERNAL_COST_BLOCKED:twilio:${cost.reason}`);
  }

  const serviceSid =
    requiredEnv("TWILIO_VERIFY_SERVICE_SID");

  const body = new URLSearchParams({
    To: phoneNumber,
    Channel: "sms",
  });

  const response = await fetch(
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
    }
  );

  return parseResponse(response);
}

export async function verifyPhoneOtp(
  phoneNumber: string,
  code: string
) {
  if (localTestTransportEnabled()) {
    const approved = code.trim() === localTestOtpCode();
    return {
      approved,
      status: approved ? "approved" : "pending",
    };
  }

  const cost = await authorizeKlyxExternalCall({
    provider: "twilio",
    operation: "verify_check",
    estimatedCostMicroUsd: 250_000,
    criticality: "non_critical",
  });
  if (!cost.allowed) {
    throw new Error(`KLYX_EXTERNAL_COST_BLOCKED:twilio:${cost.reason}`);
  }

  const serviceSid =
    requiredEnv("TWILIO_VERIFY_SERVICE_SID");

  const body = new URLSearchParams({
    To: phoneNumber,
    Code: code,
  });

  const response = await fetch(
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
    }
  );

  const data = await parseResponse(response);

  return {
    approved: data.status === "approved",
    status: data.status ?? "unknown",
  };
}

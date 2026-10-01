import { KLYX_API_BASE_URL } from "./config";
import { getSelectedProfileId } from "./profile-selection";
import { supabase } from "./supabase";

export type MobileProfile = {
  id: string;
  accountType: "client" | "provider";
  legacyAccountType: "client" | "provider";
  canRequestServices: boolean;
  canOfferServices: boolean;
  firstName: string;
  lastName: string;
  countryCode: string;
  currencyCode: string;
};

export type MobileBootstrap = {
  user: { id: string; email: string | null };
  account: {
    id: string;
    canRequestServices: boolean;
    canOfferServices: boolean;
    enabledCapabilities: string[];
  };
  activeProfileId: string;
  canonicalProfileId: string;
  profiles: MobileProfile[];
  clientContract: {
    authority: "klyx_core";
    bearerAuth: "supabase_access_token";
    financialAuthorityOnClient: false;
    eligibilityAuthorityOnClient: false;
    ledgerAuthorityOnClient: false;
  };
};

export type MobilePhoneStatus = {
  phoneNumber: string | null;
  verified: boolean;
  verifiedAt: string | null;
  visibility: string;
};

type CoreRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

async function coreRequest<T>(
  pathname: string,
  options: CoreRequestOptions = {}
): Promise<T> {
  const [sessionResult, selectedProfileId] = await Promise.all([
    supabase.auth.getSession(),
    getSelectedProfileId(),
  ]);
  const session = sessionResult.data.session;

  if (!session?.access_token) {
    throw new Error("Session KLYX absente.");
  }

  const response = await fetch(`${KLYX_API_BASE_URL}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "x-klyx-mobile-client": "expo",
      ...(selectedProfileId
        ? { "x-klyx-profile-id": selectedProfileId }
        : {}),
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `KLYX Core HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export function getMobileBootstrap(): Promise<MobileBootstrap> {
  return coreRequest<MobileBootstrap>("/api/mobile/bootstrap");
}

export function sendAssistantMessage(input: {
  message: string;
  conversationId?: string;
}) {
  return coreRequest<{
    conversationId: string;
    reply: string;
    payload?: Record<string, unknown>;
    aiMode?: string;
  }>("/api/assistant/unified", {
    method: "POST",
    body: input,
  });
}

export function createCheckout(bookingId: string) {
  return coreRequest<{
    url: string;
    reused: boolean;
    paymentMode: string;
    amountTotalMinor: number;
    presentmentCurrency: string;
  }>("/api/stripe/create-checkout-session", {
    method: "POST",
    body: { bookingId },
  });
}

export function getKycStatus() {
  return coreRequest<Record<string, unknown>>("/api/provider/sumsub/status");
}

export function createSumsubSdkToken() {
  return coreRequest<{ token: string; expiresIn: number }>(
    "/api/provider/sumsub/token",
    { method: "POST", body: {} }
  );
}

export function getProviderFinance() {
  return coreRequest<Record<string, unknown>>("/api/provider/finance");
}

export function markNotificationRead(input: {
  profileId: string;
  notificationId?: string;
  markAll?: boolean;
}) {
  return coreRequest<{ success: true }>("/api/mobile/notifications/read", {
    method: "POST",
    body: input,
  });
}

export function registerPushInstallation(input: {
  installationId: string;
  platform: "ios" | "android";
  token: string;
}) {
  return coreRequest<{
    ok: true;
    installationId: string;
    platform: "ios" | "android";
  }>("/api/mobile/push/installation", {
    method: "POST",
    body: input,
  });
}

export function unregisterPushInstallation(installationId: string) {
  return coreRequest<{ ok: true }>("/api/mobile/push/installation", {
    method: "DELETE",
    body: { installationId },
  });
}

export function getPhoneStatus() {
  return coreRequest<MobilePhoneStatus>("/api/profile/phone");
}

export function savePhoneNumber(phoneNumber: string) {
  return coreRequest<MobilePhoneStatus & { saved: true }>("/api/profile/phone", {
    method: "PUT",
    body: { phoneNumber },
  });
}

export function sendPhoneOtp() {
  return coreRequest<{
    sent: boolean;
    verified: boolean;
    alreadyVerified?: boolean;
    maskedPhone?: string;
    retryAfter?: number;
  }>("/api/profile/phone/otp/send", {
    method: "POST",
    body: {},
  });
}

export function verifyPhoneOtp(code: string) {
  return coreRequest<{
    verified: boolean;
    alreadyVerified?: boolean;
    verifiedAt?: string;
    phoneNumber?: string;
  }>("/api/profile/phone/otp/verify", {
    method: "POST",
    body: { code },
  });
}

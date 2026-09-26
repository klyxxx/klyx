import { supabase } from "./supabase";

const apiBaseUrl = (
  process.env.EXPO_PUBLIC_KLYX_API_BASE_URL?.trim() || "https://www.klyx.be"
).replace(/\/$/, "");

type JsonObject = Record<string, unknown>;

async function accessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("KLYX_MOBILE_SESSION_MISSING");
  return token;
}

export async function klyxApi<T = JsonObject>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  const body = (await response.json().catch(() => ({}))) as JsonObject;
  if (!response.ok) {
    const error = typeof body.error === "string" ? body.error : `KLYX_HTTP_${response.status}`;
    throw new Error(error);
  }
  return body as T;
}

export type MobileBootstrap = {
  profiles: Array<{
    id: string;
    firstName: string;
    lastName: string;
    accountType: "client" | "provider";
    countryCode: string | null;
    currencyCode: string | null;
  }>;
  services: Array<{ id: string; name: string; slug: string }>;
};

export function getMobileBootstrap() {
  return klyxApi<MobileBootstrap>("/api/mobile/profile/bootstrap");
}

export function createMobileProfile(input: {
  firstName: string;
  lastName: string;
  city: string;
  countryCode: string;
  currencyCode: string;
  accountType: "client" | "provider";
  serviceId?: string | null;
}) {
  return klyxApi<{ profileId: string }>("/api/mobile/profile/bootstrap", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPhone() {
  return klyxApi<{ phoneNumber: string | null; verified: boolean }>("/api/profile/phone");
}

export function savePhone(phoneNumber: string) {
  return klyxApi<{ saved: boolean; verified: boolean }>("/api/profile/phone", {
    method: "PUT",
    body: JSON.stringify({ phoneNumber }),
  });
}

export function sendPhoneOtp() {
  return klyxApi<{ sent: boolean; retryAfter?: number }>("/api/profile/phone/otp/send", {
    method: "POST",
  });
}

export function verifyPhoneOtp(code: string) {
  return klyxApi<{ verified: boolean }>("/api/profile/phone/otp/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export type AssistantReply = {
  conversationId?: string;
  reply?: string;
  payload?: {
    assistantAction?: {
      href?: string;
      label?: string;
      kind?: string;
    } | null;
    [key: string]: unknown;
  };
};

export function converse(message: string, conversationId?: string) {
  return klyxApi<AssistantReply>("/api/brain/converse", {
    method: "POST",
    body: JSON.stringify({ message, ...(conversationId ? { conversationId } : {}) }),
  });
}

export function absoluteKlyxUrl(href: string): string {
  if (/^https:\/\//i.test(href)) return href;
  return `${apiBaseUrl}/${href.replace(/^\//, "")}`;
}

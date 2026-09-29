import { supabase } from "./supabase";

export type KlyxProfile = {
  id: string;
  accountType: "client" | "provider";
  canRequestServices: boolean;
  canOfferServices: boolean;
  firstName: string;
  lastName: string;
  countryCode: string;
  currencyCode: string;
};

export type KlyxBootstrap = {
  user: {
    id: string;
    email: string | null;
  };
  account: {
    id: string;
    canRequestServices: boolean;
    canOfferServices: boolean;
    capabilitySource: string;
    enabledCapabilities: string[];
  };
  profiles: KlyxProfile[];
  canonicalProfileId: string;
};

export type KlyxAssistantResponse = {
  reply?: string;
  conversationId?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

export class KlyxApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "KlyxApiError";
  }
}

function apiBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_KLYX_API_URL?.trim() || "https://www.klyx.be")
    .replace(/\/+$/, "");
}

async function accessToken(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new KlyxApiError(401, "KLYX_MOBILE_SESSION_MISSING", "Session KLYX manquante.");
  }

  return session.access_token;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: {
    profileId?: string | null;
    capability?: "client" | "provider" | null;
  } = {}
): Promise<T> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.profileId) {
    headers.set("x-klyx-profile-id", options.profileId);
  }

  if (options.capability) {
    headers.set("x-klyx-assistant-capability", options.capability);
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  const raw = await response.text();
  let payload: unknown = null;

  if (raw) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = { error: raw };
    }
  }

  if (!response.ok) {
    const body = payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
    const message =
      typeof body.error === "string"
        ? body.error
        : `KLYX API error (${response.status})`;
    const code =
      typeof body.code === "string"
        ? body.code
        : "KLYX_MOBILE_API_ERROR";

    throw new KlyxApiError(response.status, code, message);
  }

  return payload as T;
}

export function loadMobileBootstrap(): Promise<KlyxBootstrap> {
  return request<KlyxBootstrap>("/api/mobile/bootstrap", {
    method: "GET",
  });
}

export function converseWithKlyx(params: {
  message: string;
  conversationId?: string | null;
  profileId?: string | null;
  capability?: "client" | "provider";
}): Promise<KlyxAssistantResponse> {
  return request<KlyxAssistantResponse>(
    "/api/brain/converse",
    {
      method: "POST",
      body: JSON.stringify({
        message: params.message,
        ...(params.conversationId
          ? { conversationId: params.conversationId }
          : {}),
      }),
    },
    {
      profileId: params.profileId,
      capability: params.capability ?? "client",
    }
  );
}

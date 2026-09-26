import type { Session } from "@supabase/supabase-js";

import { mobileConfig } from "@/src/config";

export type ActiveProfile = {
  id: string;
  ownerUserId: string;
  firstName: string;
  lastName: string;
  city: string;
  countryCode: string | null;
  currencyCode: string | null;
  accountType: "client" | "provider";
  canRequestServices: boolean;
  canOfferServices: boolean;
  avatarUrl: string | null;
};

export type ProfilesPayload = {
  profiles: ActiveProfile[];
  activeProfileId: string | null;
};

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${mobileConfig.apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; code?: string })
    | null;

  if (!response.ok || payload === null) {
    const message = payload?.error ?? `KLYX API ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function syncWebSession(session: Session): Promise<void> {
  await apiFetch<{ ok: true }>("/api/mobile/session", {
    method: "POST",
    body: JSON.stringify({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    }),
  });
}

export async function loadProfiles(): Promise<ProfilesPayload> {
  const payload = await apiFetch<ProfilesPayload>("/api/profiles/active");

  if (payload.profiles.length > 0 && !payload.activeProfileId) {
    const first = payload.profiles[0];
    await selectProfile(first.id);
    return { ...payload, activeProfileId: first.id };
  }

  return payload;
}

export async function selectProfile(profileId: string): Promise<void> {
  await apiFetch("/api/profiles/active", {
    method: "POST",
    body: JSON.stringify({ profileId }),
  });
}

export type BrainResponse = {
  conversationId: string;
  reply: string;
  payload: {
    ready: boolean;
    missing: string[];
    readiness: {
      score: number;
      label: string;
      requiresConfirmation: boolean;
    };
  };
};

export async function sendAssistantMessage(input: {
  message: string;
  conversationId?: string;
}): Promise<BrainResponse> {
  return apiFetch<BrainResponse>("/api/brain/respond", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

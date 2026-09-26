import type { Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

import { mobileConfig } from "@/src/config";
import { supabase } from "@/src/lib/supabase";

const ACTIVE_PROFILE_KEY = "klyx.mobile.active-profile.v1";
const ACTIVE_PROFILE_HEADER = "x-klyx-active-profile-id";

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

type ApiFetchOptions = {
  accessToken?: string | null;
  anonymous?: boolean;
  omitActiveProfile?: boolean;
};

async function currentAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}

export async function getMobileActiveProfileId(): Promise<string | null> {
  const value = await SecureStore.getItemAsync(ACTIVE_PROFILE_KEY);
  return value?.trim() || null;
}

async function setMobileActiveProfileId(profileId: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, profileId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearMobileProfileSelection(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_PROFILE_KEY);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<T> {
  const accessToken = options.anonymous
    ? null
    : options.accessToken === undefined
      ? await currentAccessToken()
      : options.accessToken;
  const activeProfileId = options.omitActiveProfile
    ? null
    : await getMobileActiveProfileId();

  const response = await fetch(`${mobileConfig.apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(activeProfileId
        ? { [ACTIVE_PROFILE_HEADER]: activeProfileId }
        : {}),
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
  await apiFetch<{ ok: true }>(
    "/api/mobile/session",
    {
      method: "POST",
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      }),
    },
    { accessToken: session.access_token, omitActiveProfile: true }
  );
}

export async function clearWebSession(): Promise<void> {
  await apiFetch<{ ok: true }>(
    "/api/mobile/session",
    { method: "DELETE" },
    { anonymous: true, omitActiveProfile: true }
  );
}

export async function loadProfiles(): Promise<ProfilesPayload> {
  const payload = await apiFetch<ProfilesPayload>("/api/mobile/profiles");
  const storedProfileId = await getMobileActiveProfileId();
  const storedOwned =
    storedProfileId &&
    payload.profiles.some((profile) => profile.id === storedProfileId);
  const activeProfileId = storedOwned
    ? storedProfileId
    : payload.activeProfileId &&
        payload.profiles.some((profile) => profile.id === payload.activeProfileId)
      ? payload.activeProfileId
      : payload.profiles[0]?.id ?? null;

  if (activeProfileId && activeProfileId !== storedProfileId) {
    await setMobileActiveProfileId(activeProfileId);
  }

  return { ...payload, activeProfileId };
}

export async function selectProfile(profileId: string): Promise<void> {
  await apiFetch(
    "/api/mobile/profiles",
    {
      method: "POST",
      body: JSON.stringify({ profileId }),
    },
    { omitActiveProfile: true }
  );
  await setMobileActiveProfileId(profileId);
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

export type ProviderOpportunity = {
  id: string;
  title: string;
  description?: string;
  city?: string;
  currency?: string;
  budget_max?: number | null;
  budgetTotal?: number | null;
  requested_date?: string | null;
  requested_time?: string | null;
  requestMode?: string;
  slotCount?: number;
  service?: {
    name?: string | null;
    slug?: string;
  } | null;
  match?: {
    score: number;
    reasons: string[];
  } | null;
  liveEligibility?: {
    checked: boolean;
    eligible: boolean;
    code: string;
    checkedAt: string;
  };
};

export type ProviderJobsPayload = {
  role?: "provider";
  requests?: ProviderOpportunity[];
  jobs?: ProviderOpportunity[];
  count?: number;
  liveEligibilityChecked?: boolean;
  multiSlotJobsChecked?: number;
  staleMultiSlotJobsRemoved?: number;
  unresolvedMultiSlotJobsRemoved?: number;
  liveValidationFailures?: number;
  automaticExecutionAllowed?: false;
};

export async function loadProviderOpportunities(): Promise<ProviderJobsPayload> {
  return apiFetch<ProviderJobsPayload>("/api/provider/jobs", {
    method: "GET",
  });
}

export type ProviderFinanceSummary = {
  currency: string;
  grossPaidCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  refundedCents: number;
  refundsProcessingCents: number;
  successfulPayments: number;
  failedPayments: number;
  successfulRefunds: number;
};

export type ProviderFinanceTransaction = {
  id: string;
  bookingId: string;
  bookingGroupId: string | null;
  grouped: boolean;
  bookingDate: string | null;
  bookingStatus: string | null;
  entryType: string;
  status: string;
  currency: string;
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number | null;
  refundAmountCents: number;
  createdAt: string;
};

export type ProviderFinancePayload = {
  summary: ProviderFinanceSummary;
  transactions: ProviderFinanceTransaction[];
  reconciliation?: {
    checked: boolean;
    reconciled: boolean;
    status: "ok" | "review_required" | string;
    readOnly: boolean;
    ledgerModified: false;
    stripeModified: false;
    automaticCorrection: false;
  };
  automaticExecutionAllowed: false;
};

export async function loadProviderFinance(): Promise<ProviderFinancePayload> {
  return apiFetch<ProviderFinancePayload>("/api/provider/finance", {
    method: "GET",
  });
}

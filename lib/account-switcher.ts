"use client";

export type AccountType = "client" | "provider";

export type SavedAccount = {
  id: string;
  ownerUserId: string;
  firstName: string;
  lastName: string;
  city: string;
  countryCode: string | null;
  currencyCode: string | null;
  accountType: AccountType;
  avatarUrl: string | null;
};

export type ServiceOption = {
  id: string;
  name: string;
  slug: string;
};

export type ProfileFormValues = {
  firstName: string;
  lastName: string;
  city: string;
  countryCode: string;
  accountType: AccountType;
  serviceId: string | null;
};

type ProfilesResponse = {
  profiles?: SavedAccount[];
  activeProfileId?: string | null;
  error?: string;
};

export const KLYX_ACTIVE_PROFILE_CHANGED =
  "klyx-active-profile-changed";

export type ActiveProfileChangedDetail = {
  profileId: string;
  accountType: AccountType;
  changedAt: number;
};

let activeProfileSwitchPromise: Promise<void> | null = null;

function emitActiveProfileChanged(
  profileId: string,
  accountType: AccountType
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ActiveProfileChangedDetail>(
      KLYX_ACTIVE_PROFILE_CHANGED,
      {
        detail: {
          profileId,
          accountType,
          changedAt: Date.now(),
        },
      }
    )
  );
}

async function readResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const result = (await response.json()) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(result.error ?? fallbackMessage);
  }

  return result;
}

export async function getProfilesState(): Promise<{
  profiles: SavedAccount[];
  activeProfileId: string | null;
}> {
  const response = await fetch("/api/profiles/active", {
    method: "GET",
    cache: "no-store",
  });

  const result = (await response.json()) as ProfilesResponse;

  if (!response.ok) {
    throw new Error(
      result.error ?? "Impossible de charger les profils."
    );
  }

  return {
    profiles: Array.isArray(result.profiles) ? result.profiles : [],
    activeProfileId:
      typeof result.activeProfileId === "string"
        ? result.activeProfileId
        : null,
  };
}

export async function getProfiles(): Promise<SavedAccount[]> {
  const result = await getProfilesState();
  return result.profiles;
}

export async function getActiveProfileAccount(): Promise<SavedAccount> {
  const result = await getProfilesState();

  const profile = result.profiles.find(
    (item) => item.id === result.activeProfileId
  );

  if (!profile) {
    throw new Error("Profil KLYX actif introuvable.");
  }

  return profile;
}

export async function getActiveClientProfile(): Promise<SavedAccount> {
  const profile = await getActiveProfileAccount();

  if (profile.accountType !== "client") {
    throw new Error("Le profil KLYX actif n’est pas un profil client.");
  }

  return profile;
}

async function performAccountSwitch(profileId: string): Promise<void> {
  const response = await fetch("/api/profiles/active", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId }),
  });

  const result = (await response.json()) as {
    accountType?: AccountType;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      result.error ?? "Impossible de changer de profil."
    );
  }

  if (
    result.accountType !== "client" &&
    result.accountType !== "provider"
  ) {
    throw new Error("Rôle du profil KLYX introuvable.");
  }

  emitActiveProfileChanged(profileId, result.accountType);
}

export async function switchAccount(profileId: string): Promise<void> {
  if (activeProfileSwitchPromise) {
    throw new Error("Un changement de profil KLYX est déjà en cours.");
  }

  const pendingSwitch = performAccountSwitch(profileId);
  activeProfileSwitchPromise = pendingSwitch;

  try {
    await pendingSwitch;
  } finally {
    if (activeProfileSwitchPromise === pendingSwitch) {
      activeProfileSwitchPromise = null;
    }
  }
}

export async function getAvailableServices(): Promise<ServiceOption[]> {
  const response = await fetch("/api/profiles/manage", {
    method: "GET",
    cache: "no-store",
  });

  const result = await readResponse<{
    services?: ServiceOption[];
  }>(response, "Impossible de charger les services.");

  return Array.isArray(result.services) ? result.services : [];
}

export async function createProfile(
  values: ProfileFormValues
): Promise<string> {
  const response = await fetch("/api/profiles/manage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  const result = await readResponse<{
    profileId?: string;
  }>(response, "Impossible de créer le profil.");

  if (!result.profileId) {
    throw new Error("Le nouveau profil est introuvable.");
  }

  return result.profileId;
}

export async function updateProfile(
  profileId: string,
  values: Pick<
    ProfileFormValues,
    "firstName" | "lastName" | "city" | "countryCode"
  > & {
    avatarUrl?: string | null;
  }
): Promise<void> {
  const response = await fetch("/api/profiles/manage", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profileId,
      ...values,
    }),
  });

  await readResponse<{
    success?: boolean;
  }>(response, "Impossible de modifier le profil.");
}

export async function deleteProfile(profileId: string): Promise<void> {
  const response = await fetch("/api/profiles/manage", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId }),
  });

  await readResponse<{
    success?: boolean;
  }>(response, "Impossible de supprimer le profil.");
}

import { secureStorage } from "./secure-storage";

export const KLYX_ACTIVE_PROFILE_STORAGE_KEY = "klyx.mobile.active-profile";

export function getSelectedProfileId(): Promise<string | null> {
  return secureStorage.getItem(KLYX_ACTIVE_PROFILE_STORAGE_KEY);
}

export function setSelectedProfileId(profileId: string): Promise<void> {
  return secureStorage.setItem(KLYX_ACTIVE_PROFILE_STORAGE_KEY, profileId);
}

export function clearSelectedProfileId(): Promise<void> {
  return secureStorage.removeItem(KLYX_ACTIVE_PROFILE_STORAGE_KEY);
}

import FounderCompactMenu from "@/app/components/FounderCompactMenu";
import {
  getActiveProfile,
  getOwnedProfiles,
} from "@/lib/active-profile";
import { isKlyxFounder } from "@/lib/founder-auth";

export default async function FounderAccessBar() {
  const founder =
    await isKlyxFounder();

  if (!founder) {
    return null;
  }

  const [activeProfile, profiles] =
    await Promise.all([
      getActiveProfile(),
      getOwnedProfiles(),
    ]);

  const clientProfile =
    profiles.find(
      (profile) =>
        profile.accountType === "client"
    ) ?? null;

  const providerProfile =
    profiles.find(
      (profile) =>
        profile.accountType === "provider"
    ) ?? null;

  return (
    <FounderCompactMenu
      currentProfileId={
        activeProfile?.id ?? null
      }
      currentMode={
        activeProfile?.accountType ??
        null
      }
      clientProfileId={
        clientProfile?.id ?? null
      }
      providerProfileId={
        providerProfile?.id ?? null
      }
    />
  );
}

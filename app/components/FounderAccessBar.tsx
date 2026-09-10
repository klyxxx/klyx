import FounderCompactMenu from "@/app/components/FounderCompactMenu";
import { isKlyxFounder } from "@/lib/founder-auth";

/*
 * KLYX_FOUNDER_LAZY_ADMIN_PHASE_7B_1
 *
 * IMPORTANT :
 *
 * Le layout KLYX charge FounderAccessBar sur toutes les pages,
 * y compris les pages publiques.
 *
 * active-profile importe le client Supabase admin et nécessite
 * donc SUPABASE_SERVICE_ROLE_KEY.
 *
 * Nous ne devons pas charger cette dépendance privilégiée pour
 * un visiteur anonyme ou un utilisateur non fondateur.
 *
 * Le module privilégié est donc importé uniquement APRES avoir
 * confirmé que l'utilisateur courant est réellement fondateur.
 */
export default async function FounderAccessBar() {
  const founder =
    await isKlyxFounder();

  if (!founder) {
    return null;
  }

  const {
    getActiveProfile,
    getOwnedProfiles,
  } =
    await import(
      "@/lib/active-profile"
    );

  const [
    activeProfile,
    profiles,
  ] =
    await Promise.all([
      getActiveProfile(),
      getOwnedProfiles(),
    ]);

  const clientProfile =
    profiles.find(
      (profile) =>
        profile.accountType ===
        "client"
    ) ?? null;

  const providerProfile =
    profiles.find(
      (profile) =>
        profile.accountType ===
        "provider"
    ) ?? null;

  return (
    <FounderCompactMenu
      currentProfileId={
        activeProfile?.id ??
        null
      }
      currentMode={
        activeProfile?.accountType ??
        null
      }
      clientProfileId={
        clientProfile?.id ??
        null
      }
      providerProfileId={
        providerProfile?.id ??
        null
      }
    />
  );
}
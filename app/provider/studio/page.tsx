import { redirect } from "next/navigation";

import ProviderCapabilitiesEntry from "@/app/components/ProviderCapabilitiesEntry";
import ProviderStudio from "@/app/components/ProviderStudio";
import ProviderReadinessStatus from "@/app/components/ProviderReadinessStatus";
import { getOfferCompatibilityProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";

export default async function ProviderStudioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getOfferCompatibilityProfile();

  if (!profile) {
    redirect("/dashboard");
  }

  return (
    <>
      <ProviderReadinessStatus />
      <ProviderCapabilitiesEntry />
      <ProviderStudio profileId={profile.id} />
    </>
  );
}

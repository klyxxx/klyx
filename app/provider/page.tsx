import { redirect } from "next/navigation";
import ProviderStudio from "@/app/components/ProviderStudio";
import ProviderReadinessStatus from "@/app/components/ProviderReadinessStatus";
import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";

export default async function ProviderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getActiveProfile();

  if (!profile) {
    redirect("/accounts");
  }

  if (profile.accountType !== "provider") {
    redirect("/dashboard");
  }

  return (
    <>
      <ProviderReadinessStatus />
      <ProviderStudio profileId={profile.id} />
    </>
  );
}



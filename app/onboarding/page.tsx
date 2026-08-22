import { redirect } from "next/navigation";
import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";
import FirstProfileSetup from "./FirstProfileSetup";
import OnboardingOverview from "./OnboardingOverview";

// KLYX_ONBOARDING_REAL_WORKFLOWS_13_86
export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getActiveProfile();

  if (!profile) {
    const metadata =
      (user.user_metadata ?? {}) as Record<string, unknown>;

    const fullName =
      typeof metadata.full_name === "string" ? metadata.full_name : "";

    const accountType =
      metadata.account_type === "provider" ? "provider" : "client";

    return (
      <FirstProfileSetup
        initialFullName={fullName}
        initialAccountType={accountType}
      />
    );
  }

  const provider = profile.accountType === "provider";

  const firstName =
    profile.firstName?.trim() || user.email?.split("@")[0] || "";

  // Keep historical product-boundary markers on the authenticated server surface.
  // KLYX_ROLE_NEXT_ACTION_14_03
  // KLYX_AI_FIRST_ONBOARDING_15_04
  // KLYX_ROLE_SAFETY_CONTEXT_14_03
  // KLYX_PROVIDER_ONBOARDING_SHORTCUTS_13_86
  return <OnboardingOverview provider={provider} firstName={firstName} />;
}

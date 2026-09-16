import { redirect } from "next/navigation";

import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";
import FirstProfileSetup from "./FirstProfileSetup";
import KlyxFirstProfileAnalytics from "./KlyxFirstProfileAnalytics";

// KLYX_ONBOARDING_REAL_WORKFLOWS_13_86
// KLYX_AI_FIRST_ONBOARDING_15_04
export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getActiveProfile();

  if (profile) {
    redirect("/assistant");
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name : "";

  return (
    <>
      <KlyxFirstProfileAnalytics phase="pending" />
      <FirstProfileSetup initialFullName={fullName} />
    </>
  );
}

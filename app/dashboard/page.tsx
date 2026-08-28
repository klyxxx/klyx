import { redirect } from "next/navigation";

import AccountSwitcher from "@/app/components/AccountSwitcher";
import { getActiveProfile } from "@/lib/active-profile";
import { isKlyxFounder } from "@/lib/founder-auth";
import { createClient } from "@/lib/supabase/server";

import ClientDashboard from "./ClientDashboard";
import DashboardResumeCenter from "./DashboardResumeCenter";
import Header from "./Header";
import ProviderDashboard from "./ProviderDashboard";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile, founder] = await Promise.all([
    getActiveProfile(),
    isKlyxFounder(),
  ]);

  if (!profile) {
    redirect("/accounts");
  }

  const fullName =
    `${profile.firstName} ${profile.lastName}`.trim() || user.email || "KLYX";

  return (
    <main className="klyx-page">
      <div className="mb-8 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <Header
          email={user.email ?? ""}
          displayName={fullName}
          isFounder={founder}
          accountType={profile.accountType}
        />

        <AccountSwitcher currentProfileId={profile.id} />
      </div>

      {/* KLYX_DASHBOARD_RESUME_CENTER_14_04 */}
      {/* KLYX_AI_FIRST_DASHBOARD_15_02 */}
      <DashboardResumeCenter accountType={profile.accountType} />

      {profile.accountType === "provider" ? (
        <ProviderDashboard firstName={profile.firstName} />
      ) : (
        <ClientDashboard firstName={profile.firstName} />
      )}
    </main>
  );
}

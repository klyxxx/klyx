import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveProfile } from "@/lib/active-profile";
import AccountSwitcher from "@/app/components/AccountSwitcher";
import Header from "./Header";
import ClientDashboard from "./ClientDashboard";
import ProviderDashboard from "./ProviderDashboard";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getActiveProfile();

  if (!profile) {
    redirect("/profile");
  }

  const fullName =
    `${profile.firstName} ${profile.lastName}`.trim() ||
    user.email ||
    "Utilisateur KLYX";

  return (
    <main className="klyx-page">
      <div className="mb-8 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <Header
          email={user.email ?? ""}
          displayName={fullName}
        />
        <AccountSwitcher currentProfileId={profile.id} />
      </div>

      {profile.accountType === "provider" ? (
        <ProviderDashboard firstName={profile.firstName} />
      ) : (
        <ClientDashboard firstName={profile.firstName} />
      )}
    </main>
  );
}

import { redirect } from "next/navigation";

import { getActiveProfile } from "@/lib/active-profile";
import { getKlyxAccountHome } from "@/lib/account-home";
import { createClient } from "@/lib/supabase/server";

export default async function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  if (profile.accountType !== "client") {
    redirect(getKlyxAccountHome(profile.accountType));
  }

  return children;
}

import { redirect } from "next/navigation";

import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";

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
    redirect("/accounts");
  }

  if (profile.canRequestServices) {
    redirect("/assistant");
  }

  if (profile.canOfferServices) {
    redirect("/provider/assistant");
  }

  redirect("/profile");
}

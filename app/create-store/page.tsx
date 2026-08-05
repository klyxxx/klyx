import { redirect } from "next/navigation";
import { getActiveProfile } from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";

export default async function CreateStorePage() {
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

  if (profile.accountType === "provider") {
    redirect("/provider");
  }

  redirect("/accounts");
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveProfile } from "@/lib/active-profile";

export default async function ProviderLayout({
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
    redirect("/profile");
  }

  if (profile.accountType !== "provider") {
    redirect("/dashboard");
  }

  return children;
}

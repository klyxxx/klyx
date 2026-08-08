import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function getApprovedUserServiceIds(
  userServiceIds: string[]
): Promise<Set<string>> {
  const ids = Array.from(
    new Set(userServiceIds.map((id) => id.trim()).filter(Boolean))
  );

  if (ids.length === 0) return new Set();

  const { data, error } = await supabaseAdmin
    .from("provider_skill_verifications")
    .select("user_service_id")
    .in("user_service_id", ids)
    .eq("status", "approved");

  if (error) throw new Error(error.message);

  return new Set(
    (data ?? []).map((row) => row.user_service_id as string)
  );
}

export async function isUserServiceApproved(params: {
  profileId: string;
  userServiceId: string;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("provider_skill_verifications")
    .select("id")
    .eq("profile_id", params.profileId)
    .eq("user_service_id", params.userServiceId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw new Error(error.message);

  return Boolean(data);
}

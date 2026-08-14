import "server-only";

import { createClient } from "@/lib/supabase/server";

function configuredAdminIds(): Set<string> {
  return new Set(
    (process.env.KLYX_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export async function requireKlyxAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("KLYX_ADMIN_UNAUTHENTICATED");
  }

  if (!configuredAdminIds().has(user.id)) {
    throw new Error("KLYX_ADMIN_FORBIDDEN");
  }

  return user;
}

export function adminErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";

  if (message === "KLYX_ADMIN_UNAUTHENTICATED") return 401;
  if (message === "KLYX_ADMIN_FORBIDDEN") return 403;

  return 500;
}

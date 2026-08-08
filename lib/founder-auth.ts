import "server-only";

import { createClient } from "@/lib/supabase/server";

function configuredFounderIds(): Set<string> {
  return new Set(
    (process.env.KLYX_FOUNDER_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export async function requireKlyxFounder() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("KLYX_FOUNDER_UNAUTHENTICATED");
  if (!configuredFounderIds().has(user.id)) {
    throw new Error("KLYX_FOUNDER_FORBIDDEN");
  }

  return user;
}

export function founderErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "KLYX_FOUNDER_UNAUTHENTICATED") return 401;
  if (message === "KLYX_FOUNDER_FORBIDDEN") return 403;
  return 500;
}

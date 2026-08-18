import "server-only";

import { createClient } from "@/lib/supabase/server";

function splitIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function configuredAdminIds(): Set<string> {
  return new Set([
    ...splitIds(process.env.KLYX_ADMIN_USER_IDS),
    ...splitIds(process.env.KLYX_FOUNDER_USER_IDS),
  ]);
}

export async function requireKlyxAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("KLYX_ADMIN_UNAUTHENTICATED");
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

export function adminErrorPublicMessage(
  status: number
): string | undefined {
  if (status === 401) return "Non connecté.";
  if (status === 403) return "Accès administrateur refusé.";
  return undefined;
}

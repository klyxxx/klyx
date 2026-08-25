import "server-only";

import { NextResponse } from "next/server";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { isUserServiceTransactionEligible } from "@/lib/provider-skill-publication";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function quoteTransactionQualificationPreflight(
  request: Request
): Promise<Response | null> {
  const body = (await request.json()) as {
    providerProfileId?: unknown;
    userServiceId?: unknown;
  };

  const providerProfileId =
    typeof body.providerProfileId === "string"
      ? body.providerProfileId.trim()
      : "";
  const userServiceId =
    typeof body.userServiceId === "string"
      ? body.userServiceId.trim()
      : "";

  // Preserve the core route's validation responses for incomplete payloads.
  if (!providerProfileId || !userServiceId) return null;

  const { profile } = await getAuthenticatedProfile(request);
  requireAccountType(profile, "client");

  // Preserve the core route's explicit self-quote response.
  if (providerProfileId === profile.id) return null;

  const { data: userService, error: userServiceError } = await supabaseAdmin
    .from("user_services")
    .select("id")
    .eq("id", userServiceId)
    .eq("user_id", providerProfileId)
    .eq("active", true)
    .eq("provider_enabled", true)
    .maybeSingle();

  if (userServiceError) throw new Error(userServiceError.message);

  // Let the core route keep ownership of its canonical not-found response.
  if (!userService) return null;

  const eligible = await isUserServiceTransactionEligible({
    profileId: providerProfileId,
    userServiceId,
  });

  if (eligible) return null;

  return NextResponse.json(
    {
      error:
        "Ce métier ne satisfait pas actuellement les exigences de qualification KLYX et ne peut pas recevoir de devis.",
      code: "KLYX_QUOTE_SKILL_QUALIFICATION_REQUIRED",
    },
    { status: 409 }
  );
}

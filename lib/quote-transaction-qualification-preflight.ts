import "server-only";

import { NextResponse } from "next/server";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { isUserServiceTransactionEligible } from "@/lib/provider-skill-publication";
import { supabaseAdmin } from "@/lib/supabase-admin";

type QuoteLifecycleRow = {
  provider_profile_id: string | null;
  client_profile_id: string | null;
  user_service_id: string | null;
  status: string;
};

function qualificationRequiredResponse(message: string): Response {
  return NextResponse.json(
    {
      error: message,
      code: "KLYX_QUOTE_SKILL_QUALIFICATION_REQUIRED",
    },
    { status: 409 }
  );
}

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

  if (!providerProfileId || !userServiceId) return null;

  const { profile } = await getAuthenticatedProfile(request);
  requireAccountType(profile, "client");

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
  if (!userService) return null;

  const eligible = await isUserServiceTransactionEligible({
    profileId: providerProfileId,
    userServiceId,
  });

  if (eligible) return null;

  return qualificationRequiredResponse(
    "Ce métier ne satisfait pas actuellement les exigences de qualification KLYX et ne peut pas recevoir de devis."
  );
}

export async function quoteLifecycleQualificationPreflight(
  request: Request
): Promise<Response | null> {
  const body = (await request.json()) as {
    quoteId?: unknown;
    action?: unknown;
    providerPrice?: unknown;
  };

  const quoteId =
    typeof body.quoteId === "string"
      ? body.quoteId.trim()
      : "";
  const action =
    typeof body.action === "string"
      ? body.action.trim()
      : "";

  if (!quoteId || (action !== "send" && action !== "accept")) return null;

  const { profile } = await getAuthenticatedProfile(request);

  const { data: quote, error: quoteError } = await supabaseAdmin
    .from("service_quotes")
    .select(
      "provider_profile_id, client_profile_id, user_service_id, status"
    )
    .eq("id", quoteId)
    .maybeSingle();

  if (quoteError) throw new Error(quoteError.message);
  if (!quote) return null;

  const lifecycleQuote = quote as QuoteLifecycleRow;

  if (action === "send") {
    const providerPrice = Number(body.providerPrice);

    if (
      !profile.canOfferServices ||
      lifecycleQuote.provider_profile_id !== profile.id ||
      lifecycleQuote.status !== "requested" ||
      !Number.isFinite(providerPrice) ||
      providerPrice < 0 ||
      providerPrice > 1000000
    ) {
      return null;
    }
  } else if (
    !profile.canRequestServices ||
    lifecycleQuote.client_profile_id !== profile.id ||
    lifecycleQuote.status !== "sent"
  ) {
    return null;
  }

  const providerProfileId =
    lifecycleQuote.provider_profile_id?.trim() ?? "";
  const userServiceId =
    lifecycleQuote.user_service_id?.trim() ?? "";

  if (!providerProfileId || !userServiceId) {
    return qualificationRequiredResponse(
      "Ce devis ne peut plus avancer car sa qualification métier actuelle ne peut pas être vérifiée."
    );
  }

  const eligible = await isUserServiceTransactionEligible({
    profileId: providerProfileId,
    userServiceId,
  });

  if (eligible) return null;

  return qualificationRequiredResponse(
    action === "send"
      ? "Ce métier ne satisfait plus les exigences de qualification KLYX. Le devis ne peut pas être envoyé."
      : "Ce métier ne satisfait plus les exigences de qualification KLYX. Le devis ne peut pas être accepté."
  );
}

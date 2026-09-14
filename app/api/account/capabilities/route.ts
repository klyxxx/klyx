import { NextResponse } from "next/server";

import {
  ensureLegacyOfferCompatibilityProfile,
  loadAccountCapabilityState,
  writeAccountCapabilities,
} from "@/lib/account-actor-capabilities-server";
import { secureApiErrorResponse } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type UpdateCapabilitiesBody = {
  requestServices?: unknown;
  offerServices?: unknown;
};

async function authenticatedCanonicalAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: accountData, error: accountError }, profilesResult] =
    await Promise.all([
      supabaseAdmin
        .from("accounts")
        .select("id, auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("account_type")
        .eq("owner_user_id", user.id),
    ]);

  if (accountError) {
    throw new Error(accountError.message);
  }

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  const account = accountData as {
    id: string;
    auth_user_id: string;
  } | null;

  if (!account || account.auth_user_id !== user.id) {
    throw new Error("Compte KLYX introuvable.");
  }

  const legacyProfiles = ((profilesResult.data ?? []) as Array<{
    account_type: string | null;
  }>).map((profile) => ({
    accountType:
      profile.account_type === "provider"
        ? ("provider" as const)
        : ("client" as const),
  }));

  return {
    accountId: account.id,
    legacyProfiles,
  };
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const authenticated = await authenticatedCanonicalAccount();

    if (!authenticated) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    const state = await loadAccountCapabilityState(
      authenticated.accountId,
      authenticated.legacyProfiles
    );

    return NextResponse.json({
      account: {
        id: authenticated.accountId,
        canRequestServices: state.canRequestServices,
        canOfferServices: state.canOfferServices,
        capabilitySource: state.capabilitySource,
        enabledCapabilities: Array.from(state.enabledCapabilities),
      },
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "account_capabilities_load_failed",
      route: "/api/account/capabilities",
      method: "GET",
      status: 500,
      code: "KLYX_ACCOUNT_CAPABILITIES_LOAD_FAILED",
      startedAt,
    });
  }
}

export async function PATCH(request: Request) {
  const startedAt = Date.now();

  try {
    const authenticated = await authenticatedCanonicalAccount();

    if (!authenticated) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    let body: UpdateCapabilitiesBody;

    try {
      body = (await request.json()) as UpdateCapabilitiesBody;
    } catch {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    const patch: Record<string, boolean> = {};

    if (typeof body.requestServices === "boolean") {
      patch.request_services = body.requestServices;
    }

    if (typeof body.offerServices === "boolean") {
      patch.offer_services = body.offerServices;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Aucune capacité KLYX valide à modifier." },
        { status: 400 }
      );
    }

    // Enabling offer_services never publishes a service or regulated category.
    // It only prepares a minimal legacy storage adapter when old provider
    // consumers still need profiles.id/provider_profiles.profile_id.
    if (patch.offer_services === true) {
      await ensureLegacyOfferCompatibilityProfile(authenticated.accountId);
    }

    await writeAccountCapabilities(authenticated.accountId, patch, {
      source: "user",
    });

    const state = await loadAccountCapabilityState(
      authenticated.accountId,
      authenticated.legacyProfiles
    );

    return NextResponse.json({
      success: true,
      account: {
        id: authenticated.accountId,
        canRequestServices: state.canRequestServices,
        canOfferServices: state.canOfferServices,
        capabilitySource: state.capabilitySource,
        enabledCapabilities: Array.from(state.enabledCapabilities),
      },
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "account_capabilities_update_failed",
      route: "/api/account/capabilities",
      method: "PATCH",
      status: 500,
      code: "KLYX_ACCOUNT_CAPABILITIES_UPDATE_FAILED",
      startedAt,
    });
  }
}

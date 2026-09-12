import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { writeProfileCapabilityState } from "@/lib/profile-actor-capabilities-server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type UpdateCapabilitiesBody = {
  profileId?: unknown;
  requestServices?: unknown;
  offerServices?: unknown;
};

export async function PATCH(request: Request) {
  const startedAt = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    let body: UpdateCapabilitiesBody;

    try {
      body = (await request.json()) as UpdateCapabilitiesBody;
    } catch {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    const profileId =
      typeof body.profileId === "string" ? body.profileId.trim() : "";

    if (!profileId) {
      return NextResponse.json({ error: "Profil invalide." }, { status: 400 });
    }

    if (
      typeof body.requestServices !== "boolean" ||
      typeof body.offerServices !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Les capacités du profil sont invalides." },
        { status: 400 }
      );
    }

    if (!body.requestServices && !body.offerServices) {
      return NextResponse.json(
        { error: "Active au moins une capacité KLYX." },
        { status: 400 }
      );
    }

    const { data: ownedProfile, error: ownershipError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (ownershipError) {
      throw ownershipError;
    }

    if (!ownedProfile) {
      return NextResponse.json(
        { error: "Ce profil ne t’appartient pas." },
        { status: 403 }
      );
    }

    await writeProfileCapabilityState(profileId, {
      canRequestServices: body.requestServices,
      canOfferServices: body.offerServices,
    });

    return NextResponse.json({
      success: true,
      profileId,
      capabilities: {
        requestServices: body.requestServices,
        offerServices: body.offerServices,
      },
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "profile_capabilities_update_failed",
      route: "/api/profiles/capabilities",
      method: "PATCH",
      status: 500,
      code: "KLYX_PROFILE_CAPABILITIES_UPDATE_FAILED",
      startedAt,
    });
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { findBelgianLocality } from "@/lib/belgian-localities";

async function providerServices(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_services")
    .select(
      "id, service_id, custom_name, provider_enabled, services(name, slug)"
    )
    .eq("user_id", profileId)
    .eq("provider_enabled", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}

async function ownsService(
  profileId: string,
  userServiceId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_services")
    .select("id")
    .eq("id", userServiceId)
    .eq("user_id", profileId)
    .eq("provider_enabled", true)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return Boolean(data);
}

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "provider");

    const [services, zonesResult] = await Promise.all([
      providerServices(profile.id),
      supabaseAdmin
        .from("provider_service_zones")
        .select(
          "id, user_service_id, country_code, locality, postal_code, radius_km, is_primary, is_active, created_at, updated_at"
        )
        .eq("profile_id", profile.id)
        .order("is_primary", { ascending: false })
        .order("locality", { ascending: true }),
    ]);

    if (zonesResult.error) {
      throw new Error(zonesResult.error.message);
    }

    return NextResponse.json({
      services,
      zones: zonesResult.data ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les zones.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "provider");

    const body = (await request.json()) as {
      userServiceId?: unknown;
      locality?: unknown;
      postalCode?: unknown;
      radiusKm?: unknown;
      isPrimary?: unknown;
    };

    const userServiceId =
      typeof body.userServiceId === "string"
        ? body.userServiceId.trim()
        : "";
    const localityInput =
      typeof body.locality === "string"
        ? body.locality.trim()
        : "";
    const postalInput =
      typeof body.postalCode === "string"
        ? body.postalCode.trim()
        : "";
    const radiusKm = Number(body.radiusKm);
    const isPrimary = body.isPrimary === true;

    if (
      !userServiceId ||
      !(await ownsService(profile.id, userServiceId))
    ) {
      return NextResponse.json(
        { error: "Métier prestataire invalide." },
        { status: 403 }
      );
    }

    const knownLocality =
      findBelgianLocality(localityInput) ||
      findBelgianLocality(postalInput);

    if (!knownLocality) {
      return NextResponse.json(
        {
          error:
            "Choisis une commune belge proposée dans la liste.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(radiusKm) ||
      radiusKm < 1 ||
      radiusKm > 100
    ) {
      return NextResponse.json(
        {
          error:
            "Le rayon doit être compris entre 1 et 100 km.",
        },
        { status: 400 }
      );
    }

    if (isPrimary) {
      const { error: primaryError } = await supabaseAdmin
        .from("provider_service_zones")
        .update({
          is_primary: false,
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profile.id)
        .eq("user_service_id", userServiceId);

      if (primaryError) {
        throw new Error(primaryError.message);
      }
    }

    const postalCode =
      postalInput ||
      knownLocality.postalCodes[0] ||
      null;

    const { data, error } = await supabaseAdmin
      .from("provider_service_zones")
      .upsert(
        {
          profile_id: profile.id,
          user_service_id: userServiceId,
          country_code: "BE",
          locality: knownLocality.name,
          postal_code: postalCode,
          radius_km: radiusKm,
          is_primary: isPrimary,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:
            "user_service_id,country_code,locality,postal_code",
        }
      )
      .select(
        "id, user_service_id, country_code, locality, postal_code, radius_km, is_primary, is_active"
      )
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      zone: data,
      message: "Zone d’intervention enregistrée.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’enregistrer la zone.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "provider");

    const body = (await request.json()) as {
      zoneId?: unknown;
      radiusKm?: unknown;
      isPrimary?: unknown;
      isActive?: unknown;
    };

    const zoneId =
      typeof body.zoneId === "string"
        ? body.zoneId.trim()
        : "";
    const radiusKm = Number(body.radiusKm);

    const { data: zone, error: zoneError } =
      await supabaseAdmin
        .from("provider_service_zones")
        .select("id, user_service_id")
        .eq("id", zoneId)
        .eq("profile_id", profile.id)
        .maybeSingle();

    if (zoneError) throw new Error(zoneError.message);

    if (!zone) {
      return NextResponse.json(
        { error: "Zone introuvable." },
        { status: 404 }
      );
    }

    if (
      !Number.isInteger(radiusKm) ||
      radiusKm < 1 ||
      radiusKm > 100
    ) {
      return NextResponse.json(
        { error: "Rayon invalide." },
        { status: 400 }
      );
    }

    if (body.isPrimary === true) {
      const { error } = await supabaseAdmin
        .from("provider_service_zones")
        .update({
          is_primary: false,
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profile.id)
        .eq("user_service_id", zone.user_service_id);

      if (error) throw new Error(error.message);
    }

    const { error } = await supabaseAdmin
      .from("provider_service_zones")
      .update({
        radius_km: radiusKm,
        is_primary: body.isPrimary === true,
        is_active: body.isActive !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", zone.id)
      .eq("profile_id", profile.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      message: "Zone mise à jour.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de modifier la zone.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "provider");

    const body = (await request.json()) as {
      zoneId?: unknown;
    };

    const zoneId =
      typeof body.zoneId === "string"
        ? body.zoneId.trim()
        : "";

    const { error } = await supabaseAdmin
      .from("provider_service_zones")
      .delete()
      .eq("id", zoneId)
      .eq("profile_id", profile.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      message: "Zone supprimée.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de supprimer la zone.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

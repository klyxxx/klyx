import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { findBelgianLocality } from "@/lib/belgian-localities";
import {
  coverageStatus,
  distanceBetweenLocalitiesKm,
} from "@/lib/service-zone-distance";

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const url = new URL(request.url);
    const providerId =
      url.searchParams.get("providerId")?.trim() ?? "";
    const serviceSlug =
      url.searchParams.get("service")?.trim() ?? "";
    const localityInput =
      url.searchParams.get("locality")?.trim() ?? "";

    if (
      !providerId ||
      !serviceSlug ||
      !localityInput
    ) {
      return NextResponse.json({
        available: false,
        covered: null,
        reason: "missing_parameters",
      });
    }

    const locality = findBelgianLocality(
      localityInput
    );

    if (!locality) {
      return NextResponse.json({
        available: false,
        covered: null,
        reason: "unknown_locality",
      });
    }

    const { data: service, error: serviceError } =
      await supabaseAdmin
        .from("services")
        .select("id, slug")
        .eq("slug", serviceSlug)
        .maybeSingle();

    if (serviceError) {
      throw new Error(serviceError.message);
    }

    if (!service) {
      return NextResponse.json({
        available: false,
        covered: null,
        reason: "unknown_service",
      });
    }

    const { data: userService, error: userServiceError } =
      await supabaseAdmin
        .from("user_services")
        .select("id")
        .eq("user_id", providerId)
        .eq("service_id", service.id)
        .eq("provider_enabled", true)
        .maybeSingle();

    if (userServiceError) {
      throw new Error(userServiceError.message);
    }

    if (!userService) {
      return NextResponse.json({
        available: false,
        covered: null,
        reason: "provider_service_not_found",
      });
    }

    const { data: zones, error: zonesError } =
      await supabaseAdmin
        .from("provider_service_zones")
        .select(
          "id, locality, postal_code, radius_km, is_primary"
        )
        .eq("profile_id", providerId)
        .eq("user_service_id", userService.id)
        .eq("is_active", true)
        .order("is_primary", { ascending: false });

    if (zonesError) {
      throw new Error(zonesError.message);
    }

    if (!zones?.length) {
      return NextResponse.json({
        available: false,
        covered: null,
        reason: "no_service_zone",
      });
    }

    const evaluated = zones
      .map((zone) => {
        const zoneLocality =
          findBelgianLocality(zone.locality) ??
          findBelgianLocality(
            zone.postal_code ?? ""
          );

        if (!zoneLocality) return null;

        const distanceKm =
          distanceBetweenLocalitiesKm(
            locality,
            zoneLocality
          );

        const status = coverageStatus(
          distanceKm,
          Number(zone.radius_km)
        );

        return {
          zoneLocality: zoneLocality.name,
          radiusKm: Number(zone.radius_km),
          distanceKm,
          remainingKm: status.remainingKm,
          covered: status.covered,
          isPrimary: zone.is_primary,
        };
      })
      .filter(
        (
          item
        ): item is NonNullable<typeof item> =>
          Boolean(item)
      )
      .sort((first, second) => {
        if (first.covered !== second.covered) {
          return first.covered ? -1 : 1;
        }

        if (first.distanceKm !== second.distanceKm) {
          return first.distanceKm - second.distanceKm;
        }

        return first.isPrimary ? -1 : 1;
      });

    const best = evaluated[0];

    if (!best) {
      return NextResponse.json({
        available: false,
        covered: null,
        reason: "zone_not_geocoded",
      });
    }

    return NextResponse.json({
      available: true,
      covered: best.covered,
      requestedLocality: locality.name,
      zoneLocality: best.zoneLocality,
      distanceKm: best.distanceKm,
      radiusKm: best.radiusKm,
      remainingKm: best.remainingKm,
      isPrimary: best.isPrimary,
      message: best.covered
        ? best.distanceKm === 0
          ? `Ce prestataire intervient directement à ${locality.name}.`
          : `${locality.name} est à environ ${best.distanceKm} km de sa zone ${best.zoneLocality}, dans son rayon de ${best.radiusKm} km.`
        : `${locality.name} est à environ ${best.distanceKm} km de sa zone ${best.zoneLocality}, au-delà de son rayon de ${best.radiusKm} km.`,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de vérifier la zone.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

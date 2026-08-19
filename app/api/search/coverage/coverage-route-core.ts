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

type ServiceRelation =
  | { id: string; name: string | null; slug: string | null }
  | { id: string; name: string | null; slug: string | null }[]
  | null;

function firstService(
  relation: ServiceRelation
): { id: string; name: string | null; slug: string | null } | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const url = new URL(request.url);
    const localityInput =
      url.searchParams.get("locality")?.trim() ?? "";
    const serviceSlug =
      url.searchParams.get("service")?.trim() ?? "";

    const { data: services, error: servicesError } =
      await supabaseAdmin
        .from("services")
        .select("id, name, slug")
        .order("name", { ascending: true });

    if (servicesError) throw new Error(servicesError.message);

    if (!localityInput || !serviceSlug) {
      return NextResponse.json({
        services: services ?? [],
        locality: null,
        providers: [],
        searched: false,
      });
    }

    const requestedLocality =
      findBelgianLocality(localityInput);

    if (!requestedLocality) {
      return NextResponse.json(
        {
          error:
            "Choisis une commune belge proposée par KLYX.",
        },
        { status: 400 }
      );
    }

    const { data: selectedService, error: serviceError } =
      await supabaseAdmin
        .from("services")
        .select("id, name, slug")
        .eq("slug", serviceSlug)
        .maybeSingle();

    if (serviceError) throw new Error(serviceError.message);

    if (!selectedService) {
      return NextResponse.json(
        { error: "Service introuvable." },
        { status: 404 }
      );
    }

    const { data: userServices, error: userServicesError } =
      await supabaseAdmin
        .from("user_services")
        .select(
          "id, user_id, custom_name, provider_enabled, services(id, name, slug)"
        )
        .eq("service_id", selectedService.id)
        .eq("provider_enabled", true);

    if (userServicesError) {
      throw new Error(userServicesError.message);
    }

    const userServiceIds = (userServices ?? []).map(
      (item) => item.id
    );

    if (userServiceIds.length === 0) {
      return NextResponse.json({
        services: services ?? [],
        locality: requestedLocality,
        providers: [],
        searched: true,
        calculationMode: "municipality_centers",
      });
    }

    const { data: zones, error: zonesError } =
      await supabaseAdmin
        .from("provider_service_zones")
        .select(
          "id, profile_id, user_service_id, locality, postal_code, radius_km, is_primary"
        )
        .in("user_service_id", userServiceIds)
        .eq("is_active", true);

    if (zonesError) throw new Error(zonesError.message);

    const evaluatedZones = (zones ?? [])
      .map((zone) => {
        const zoneLocality =
          findBelgianLocality(zone.locality) ??
          findBelgianLocality(zone.postal_code ?? "");

        if (!zoneLocality) return null;

        const distanceKm =
          distanceBetweenLocalitiesKm(
            requestedLocality,
            zoneLocality
          );

        const status = coverageStatus(
          distanceKm,
          Number(zone.radius_km)
        );

        return {
          ...zone,
          zoneLocality,
          distanceKm,
          covered: status.covered,
          remainingKm: status.remainingKm,
        };
      })
      .filter(
        (
          zone
        ): zone is NonNullable<typeof zone> =>
          Boolean(zone?.covered)
      );

    const bestZoneByProvider = new Map<
      string,
      (typeof evaluatedZones)[number]
    >();

    for (const zone of evaluatedZones) {
      const existing = bestZoneByProvider.get(
        zone.profile_id
      );

      if (
        !existing ||
        zone.distanceKm < existing.distanceKm ||
        (zone.distanceKm === existing.distanceKm &&
          zone.is_primary &&
          !existing.is_primary)
      ) {
        bestZoneByProvider.set(
          zone.profile_id,
          zone
        );
      }
    }

    const selectedZones = [
      ...bestZoneByProvider.values(),
    ];

    const profileIds = selectedZones.map(
      (zone) => zone.profile_id
    );

    const { data: profiles, error: profilesError } =
      profileIds.length > 0
        ? await supabaseAdmin
            .from("profiles")
            .select(
              "id, first_name, last_name, avatar_url, account_type"
            )
            .in("id", profileIds)
            .eq("account_type", "provider")
        : { data: [], error: null };

    if (profilesError) {
      throw new Error(profilesError.message);
    }

    const profileMap = new Map(
      (profiles ?? []).map((provider) => [
        provider.id,
        provider,
      ])
    );

    const userServiceMap = new Map(
      (userServices ?? []).map((item) => [
        item.id,
        item,
      ])
    );

    const providers = selectedZones
      .map((zone) => {
        const provider = profileMap.get(
          zone.profile_id
        );
        const userService = userServiceMap.get(
          zone.user_service_id
        );

        if (!provider || !userService) return null;

        const service = firstService(
          userService.services as ServiceRelation
        );

        return {
          profileId: provider.id,
          displayName:
            `${provider.first_name ?? ""} ${
              provider.last_name ?? ""
            }`.trim() || "Prestataire KLYX",
          avatarUrl: provider.avatar_url ?? null,
          serviceName:
            userService.custom_name ||
            service?.name ||
            selectedService.name ||
            "Service KLYX",
          serviceSlug:
            service?.slug ?? selectedService.slug,
          requestedLocality: requestedLocality.name,
          zoneLocality: zone.zoneLocality.name,
          zonePostalCode: zone.postal_code,
          radiusKm: Number(zone.radius_km),
          distanceKm: zone.distanceKm,
          remainingKm: zone.remainingKm,
          isPrimary: zone.is_primary,
          coverageMessage:
            zone.distanceKm === 0
              ? `Intervient directement à ${requestedLocality.name}.`
              : `${requestedLocality.name} se trouve à environ ${zone.distanceKm} km du centre de sa zone ${zone.zoneLocality.name}, dans son rayon déclaré de ${zone.radius_km} km.`,
        };
      })
      .filter(Boolean)
      .sort((first, second) => {
        if (!first || !second) return 0;

        if (first.distanceKm !== second.distanceKm) {
          return first.distanceKm - second.distanceKm;
        }

        if (first.isPrimary !== second.isPrimary) {
          return first.isPrimary ? -1 : 1;
        }

        return first.displayName.localeCompare(
          second.displayName
        );
      });

    return NextResponse.json({
      services: services ?? [],
      locality: requestedLocality,
      providers,
      searched: true,
      calculationMode: "municipality_centers",
      privacyNotice:
        "La distance est une estimation entre centres de communes. KLYX n’utilise ni l’adresse privée ni la position GPS du prestataire.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de vérifier la couverture.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

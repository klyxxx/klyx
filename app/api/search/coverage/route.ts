import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  findBelgianLocality,
  normalizeLocality,
} from "@/lib/belgian-localities";

type ServiceRelation =
  | {
      id: string;
      name: string | null;
      slug: string | null;
    }
  | {
      id: string;
      name: string | null;
      slug: string | null;
    }[]
  | null;

function firstService(
  relation: ServiceRelation
): {
  id: string;
  name: string | null;
  slug: string | null;
} | null {
  return Array.isArray(relation)
    ? relation[0] ?? null
    : relation;
}

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

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

    if (servicesError) {
      throw new Error(servicesError.message);
    }

    if (!localityInput || !serviceSlug) {
      return NextResponse.json({
        services: services ?? [],
        locality: null,
        providers: [],
        searched: false,
      });
    }

    const locality = findBelgianLocality(localityInput);

    if (!locality) {
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

    if (serviceError) {
      throw new Error(serviceError.message);
    }

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
        locality,
        providers: [],
        searched: true,
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

    if (zonesError) {
      throw new Error(zonesError.message);
    }

    const normalizedRequested = normalizeLocality(
      locality.name
    );

    const matchingZones = (zones ?? []).filter((zone) => {
      const normalizedZone = normalizeLocality(
        zone.locality
      );

      return (
        normalizedZone === normalizedRequested ||
        locality.postalCodes.includes(
          zone.postal_code ?? ""
        )
      );
    });

    const profileIds = [
      ...new Set(
        matchingZones.map((zone) => zone.profile_id)
      ),
    ];

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

    const profilesMap = new Map(
      (profiles ?? []).map((provider) => [
        provider.id,
        provider,
      ])
    );

    const userServicesMap = new Map(
      (userServices ?? []).map((item) => [
        item.id,
        item,
      ])
    );

    const providers = matchingZones
      .map((zone) => {
        const provider = profilesMap.get(
          zone.profile_id
        );
        const userService = userServicesMap.get(
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
          locality: zone.locality,
          postalCode: zone.postal_code,
          radiusKm: Number(zone.radius_km),
          isPrimary: zone.is_primary,
          coverageMessage:
            `Intervient à ${zone.locality} dans un rayon déclaré de ${zone.radius_km} km.`,
        };
      })
      .filter(Boolean)
      .sort((first, second) => {
        if (!first || !second) return 0;

        if (first.isPrimary !== second.isPrimary) {
          return first.isPrimary ? -1 : 1;
        }

        return first.radiusKm - second.radiusKm;
      });

    return NextResponse.json({
      services: services ?? [],
      locality,
      providers,
      searched: true,
      privacyNotice:
        "KLYX affiche uniquement la commune et le rayon professionnel déclaré, jamais l’adresse privée du prestataire.",
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

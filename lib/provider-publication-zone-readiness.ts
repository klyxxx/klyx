import { NextResponse } from "next/server";

import {
  BELGIAN_LOCALITIES_COUNTRY_CODE,
} from "@/lib/belgian-localities";
import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type StudioPublicationBody = {
  publish?: unknown;
  services?: unknown;
};

type StudioServiceInput = {
  serviceId?: unknown;
  enabled?: unknown;
};

type UserServiceRow = {
  id: string;
  service_id: string;
};

type ZoneRow = {
  user_service_id: string;
  country_code: string;
  is_active: boolean;
};

function enabledServiceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      (value as StudioServiceInput[])
        .filter((service) => service?.enabled === true)
        .map((service) =>
          typeof service?.serviceId === "string"
            ? service.serviceId.trim()
            : ""
        )
        .filter(Boolean)
    )
  );
}

export async function providerPublicationZonePreflight(
  request: Request
): Promise<Response | null> {
  const body = (await request.json()) as StudioPublicationBody;

  if (body.publish !== true) return null;

  const serviceIds = enabledServiceIds(body.services);
  if (serviceIds.length === 0) return null;

  const { profile } = await getAuthenticatedProfile(request);
  requireAccountType(profile, "provider");

  const { data: userServices, error: userServicesError } = await supabaseAdmin
    .from("user_services")
    .select("id, service_id")
    .eq("user_id", profile.id)
    .eq("provider_enabled", true)
    .in("service_id", serviceIds);

  if (userServicesError) throw new Error(userServicesError.message);

  const rows = (userServices ?? []) as UserServiceRow[];
  const userServiceByServiceId = new Map(
    rows.map((row) => [row.service_id, row.id])
  );

  const missingDraftService = serviceIds.some(
    (serviceId) => !userServiceByServiceId.has(serviceId)
  );

  if (missingDraftService) {
    return NextResponse.json(
      {
        error:
          "Enregistre d’abord tes services en brouillon, puis configure leurs zones d’intervention avant de publier.",
        code: "KLYX_PROVIDER_SERVICE_DRAFT_REQUIRED",
      },
      { status: 409 }
    );
  }

  const userServiceIds = serviceIds.map(
    (serviceId) => userServiceByServiceId.get(serviceId) as string
  );
  const { data: zones, error: zonesError } = await supabaseAdmin
    .from("provider_service_zones")
    .select("user_service_id, country_code, is_active")
    .eq("profile_id", profile.id)
    .in("user_service_id", userServiceIds)
    .eq("is_active", true);

  if (zonesError) throw new Error(zonesError.message);

  const readyUserServiceIds = new Set(
    ((zones ?? []) as ZoneRow[])
      .filter(
        (zone) =>
          zone.is_active !== false &&
          zone.country_code.trim().toUpperCase() ===
            BELGIAN_LOCALITIES_COUNTRY_CODE
      )
      .map((zone) => zone.user_service_id)
  );

  const serviceWithoutZone = serviceIds.find((serviceId) => {
    const userServiceId = userServiceByServiceId.get(serviceId);
    return !userServiceId || !readyUserServiceIds.has(userServiceId);
  });

  if (serviceWithoutZone) {
    return NextResponse.json(
      {
        error:
          "Ajoute au moins une zone d’intervention active à chaque service avant de publier.",
        code: "KLYX_PROVIDER_ACTIVE_ZONE_REQUIRED",
      },
      { status: 409 }
    );
  }

  return null;
}

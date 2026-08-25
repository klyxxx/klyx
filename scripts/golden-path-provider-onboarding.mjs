import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";
const CLEANING_SERVICE_SLUGS = [
  "menage-a-domicile",
  "cleaning",
  "menage",
  "ménage",
];

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function cleaningService(services) {
  for (const slug of CLEANING_SERVICE_SLUGS) {
    const service = services.find((candidate) => candidate.slug === slug);
    if (service) return service;
  }

  return undefined;
}

function availabilityPayload() {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    enabled: true,
    startTime: "08:00",
    endTime: "20:00",
  }));
}

async function parseJsonResponse(response, label) {
  const raw = await response.text();
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`${label} returned non-JSON status ${response.status}.`);
    }
  }

  if (!response.ok) {
    const safeMessage =
      payload && typeof payload.error === "string"
        ? payload.error
        : "unexpected response";
    throw new Error(`${label} returned ${response.status}: ${safeMessage}`);
  }

  return payload;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  expect(
    localSupabase,
    "Provider onboarding golden proof is allowed only on ephemeral local Supabase."
  );

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;
  expect(
    appOrigin === "http://127.0.0.1:3100",
    "Provider onboarding golden proof requires the isolated local production server."
  );

  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const admin = createClient(e2eOrigin, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cookieJar = new Map();
  const sessionClient = createServerClient(e2eOrigin, publishableKey, {
    cookies: {
      getAll() {
        return Array.from(cookieJar.entries()).map(([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          cookieJar.set(name, value);
        }
      },
    },
  });

  const { data: signInData, error: signInError } =
    await sessionClient.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session?.access_token || !signInData.user) {
    throw new Error("Unable to authenticate provider onboarding golden account.");
  }

  expect(cookieJar.size > 0, "Supabase SSR sign-in did not produce auth cookies.");

  const accessToken = signInData.session.access_token;

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select(
      "id, owner_user_id, account_type, country_code, currency_code, city, avatar_url"
    )
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(`Unable to load golden profiles: ${profilesError.message}`);
  }

  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );
  expect(Boolean(provider), "Golden provider profile is missing.");
  expect(
    provider.country_code === "BE" &&
      provider.currency_code === "EUR" &&
      provider.city === "Bruxelles",
    "Golden provider must use the BE/EUR Brussels market."
  );

  const { data: services, error: servicesError } = await admin
    .from("services")
    .select("id, slug, name")
    .order("name", { ascending: true })
    .limit(500);

  if (servicesError) {
    throw new Error(`Unable to load KLYX service catalog: ${servicesError.message}`);
  }

  const service = cleaningService(services ?? []);
  expect(Boolean(service), "Canonical cleaning service is missing.");

  const { data: userService, error: userServiceError } = await admin
    .from("user_services")
    .select("id, service_id")
    .eq("user_id", provider.id)
    .eq("service_id", service.id)
    .maybeSingle();

  if (userServiceError || !userService) {
    throw new Error(
      `Golden provider base user_service is missing: ${
        userServiceError?.message ?? "not found"
      }`
    );
  }

  const now = new Date().toISOString();

  const { error: profilePrerequisiteError } = await admin
    .from("profiles")
    .update({
      avatar_url: "https://example.test/klyx-golden-provider-avatar.png",
      updated_at: now,
    })
    .eq("id", provider.id)
    .eq("owner_user_id", signInData.user.id);

  if (profilePrerequisiteError) {
    throw new Error(
      `Unable to prepare provider avatar prerequisite: ${profilePrerequisiteError.message}`
    );
  }

  const { error: documentError } = await admin
    .from("provider_documents")
    .upsert(
      {
        profile_id: provider.id,
        document_type: "identity",
        file_name: "golden-provider-identity.pdf",
        storage_path: `${provider.id}/identity/golden-provider-identity.pdf`,
        status: "verified",
        rejection_reason: null,
        updated_at: now,
      },
      { onConflict: "profile_id,document_type" }
    );

  if (documentError) {
    throw new Error(
      `Unable to prepare provider identity prerequisite: ${documentError.message}`
    );
  }

  const { error: resetZonesError } = await admin
    .from("provider_service_zones")
    .delete()
    .eq("profile_id", provider.id)
    .eq("user_service_id", userService.id);
  if (resetZonesError) {
    throw new Error(`Unable to reset provider zones: ${resetZonesError.message}`);
  }

  const { error: resetAvailabilityError } = await admin
    .from("availability_slots")
    .delete()
    .eq("user_service_id", userService.id);
  if (resetAvailabilityError) {
    throw new Error(
      `Unable to reset provider availability: ${resetAvailabilityError.message}`
    );
  }

  const { error: resetServiceProfileError } = await admin
    .from("service_profiles")
    .delete()
    .eq("user_service_id", userService.id);
  if (resetServiceProfileError) {
    throw new Error(
      `Unable to reset provider service profile: ${resetServiceProfileError.message}`
    );
  }

  const { error: resetUserServiceError } = await admin
    .from("user_services")
    .update({ active: false, provider_enabled: false })
    .eq("id", userService.id)
    .eq("user_id", provider.id);
  if (resetUserServiceError) {
    throw new Error(
      `Unable to reset provider user_service: ${resetUserServiceError.message}`
    );
  }

  const { error: resetPublicationError } = await admin
    .from("provider_profiles")
    .update({ is_published: false, updated_at: now })
    .eq("profile_id", provider.id);
  if (resetPublicationError) {
    throw new Error(
      `Unable to reset provider publication state: ${resetPublicationError.message}`
    );
  }

  const authCookieHeader = Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  const cookieHeader = `${authCookieHeader}; ${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(
    provider.id
  )}`;

  const studioBaseBody = {
    businessName: "KLYX Golden Cleaning",
    headline: "Ménage fiable pour le golden path KLYX",
    bio:
      "Prestataire éphémère configuré par la vraie API studio afin de valider le parcours prestataire KLYX de bout en bout.",
    yearsExperience: 5,
    services: [
      {
        serviceId: service.id,
        enabled: true,
        title: "Ménage Golden Path KLYX",
        description:
          "Service de ménage éphémère configuré par l’API prestataire pour la recherche, le devis, la réservation et la finance KLYX.",
        pricingType: "hourly",
        price: 35,
        hourlyPrice: 35,
        fixedPrice: null,
        city: "Bruxelles",
        serviceArea: ["Bruxelles"],
        travelRadiusKm: 30,
        availability: availabilityPayload(),
      },
    ],
  };

  const draftResponse = await fetch(`${appOrigin}/api/provider/studio`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...studioBaseBody,
      publish: false,
    }),
  });

  const draft = await parseJsonResponse(
    draftResponse,
    "PUT /api/provider/studio draft"
  );

  expect(draft?.success === true, "Provider studio draft did not report success.");
  expect(draft?.published === false, "Provider studio draft must stay unpublished.");

  const zoneResponse = await fetch(`${appOrigin}/api/provider/zones`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userServiceId: userService.id,
      locality: "Bruxelles",
      postalCode: "1000",
      radiusKm: 30,
      isPrimary: true,
    }),
  });

  const zonePayload = await parseJsonResponse(
    zoneResponse,
    "POST /api/provider/zones"
  );
  const zone = zonePayload?.zone;

  expect(Boolean(zone), "Provider zones API did not return a zone.");
  expect(
    zone.user_service_id === userService.id &&
      zone.country_code === "BE" &&
      zone.locality === "Bruxelles" &&
      zone.postal_code === "1000" &&
      Number(zone.radius_km) === 30 &&
      zone.is_primary === true &&
      zone.is_active === true,
    "Provider zones API persisted an unexpected Brussels service zone."
  );

  const studioResponse = await fetch(`${appOrigin}/api/provider/studio`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...studioBaseBody,
      publish: true,
    }),
  });

  const studio = await parseJsonResponse(
    studioResponse,
    "PUT /api/provider/studio publish"
  );

  expect(studio?.success === true, "Provider studio did not report success.");
  expect(studio?.published === true, "Provider studio did not publish provider.");
  expect(
    studio?.data?.providerProfile?.isPublished === true,
    "Provider studio response does not expose published provider state."
  );

  const studioService = Array.isArray(studio?.data?.services)
    ? studio.data.services.find((item) => item.serviceId === service.id)
    : null;

  expect(Boolean(studioService), "Provider studio response is missing cleaning service.");
  expect(
    studioService.enabled === true &&
      studioService.pricingType === "hourly" &&
      Number(studioService.hourlyPrice) === 35 &&
      studioService.city === "Bruxelles" &&
      Array.isArray(studioService.serviceArea) &&
      studioService.serviceArea.includes("Bruxelles") &&
      Number(studioService.travelRadiusKm) === 30,
    "Provider studio persisted an unexpected service/tariff/area state."
  );
  expect(
    Array.isArray(studioService.availability) &&
      studioService.availability.filter((day) => day.enabled).length === 7,
    "Provider studio must persist seven active golden availability days."
  );

  const { data: persistedUserService, error: persistedUserServiceError } =
    await admin
      .from("user_services")
      .select("id, active, provider_enabled")
      .eq("id", userService.id)
      .eq("user_id", provider.id)
      .single();
  if (persistedUserServiceError) {
    throw new Error(
      `Unable to verify persisted provider service: ${persistedUserServiceError.message}`
    );
  }

  const { data: persistedProviderProfile, error: providerProfileError } =
    await admin
      .from("provider_profiles")
      .select("profile_id, is_published, verification_status")
      .eq("profile_id", provider.id)
      .single();
  if (providerProfileError) {
    throw new Error(
      `Unable to verify persisted provider profile: ${providerProfileError.message}`
    );
  }

  const { data: persistedServiceProfile, error: serviceProfileError } = await admin
    .from("service_profiles")
    .select(
      "user_service_id, pricing_type, price, hourly_price, city, service_area, travel_radius_km, available"
    )
    .eq("user_service_id", userService.id)
    .single();
  if (serviceProfileError) {
    throw new Error(
      `Unable to verify persisted service profile: ${serviceProfileError.message}`
    );
  }

  const { data: persistedAvailability, error: availabilityError } = await admin
    .from("availability_slots")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("user_service_id", userService.id)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true });
  if (availabilityError) {
    throw new Error(
      `Unable to verify persisted availability: ${availabilityError.message}`
    );
  }

  const { data: persistedZone, error: persistedZoneError } = await admin
    .from("provider_service_zones")
    .select(
      "id, profile_id, user_service_id, country_code, locality, postal_code, radius_km, is_primary, is_active"
    )
    .eq("id", zone.id)
    .eq("profile_id", provider.id)
    .single();
  if (persistedZoneError) {
    throw new Error(`Unable to verify provider zone: ${persistedZoneError.message}`);
  }

  expect(
    persistedUserService.active === true &&
      persistedUserService.provider_enabled === true,
    "Provider studio must reactivate the canonical user_service."
  );
  expect(
    persistedProviderProfile.is_published === true &&
      persistedProviderProfile.verification_status === "verified",
    "Provider publication/verification state is invalid after onboarding."
  );
  expect(
    persistedServiceProfile.pricing_type === "hourly" &&
      Number(persistedServiceProfile.price) === 35 &&
      Number(persistedServiceProfile.hourly_price) === 35 &&
      persistedServiceProfile.city === "Bruxelles" &&
      Array.isArray(persistedServiceProfile.service_area) &&
      persistedServiceProfile.service_area.includes("Bruxelles") &&
      Number(persistedServiceProfile.travel_radius_km) === 30 &&
      persistedServiceProfile.available === true,
    "Persisted provider service profile does not match studio onboarding."
  );
  expect(
    (persistedAvailability ?? []).length === 7 &&
      (persistedAvailability ?? []).every(
        (slot) =>
          slot.is_active === true &&
          String(slot.start_time).slice(0, 5) === "08:00" &&
          String(slot.end_time).slice(0, 5) === "20:00"
      ),
    "Persisted provider availability does not match the seven-day API payload."
  );
  expect(
    persistedZone.country_code === "BE" &&
      persistedZone.locality === "Bruxelles" &&
      persistedZone.postal_code === "1000" &&
      Number(persistedZone.radius_km) === 30 &&
      persistedZone.is_primary === true &&
      persistedZone.is_active === true,
    "Persisted provider zone does not match the zones API payload."
  );

  await sessionClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      providerOnboardingVerified: true,
      providerProfileId: provider.id,
      serviceId: service.id,
      serviceSlug: service.slug,
      userServiceId: userService.id,
      published: true,
      hourlyPrice: 35,
      city: "Bruxelles",
      zone: "Bruxelles 1000",
      radiusKm: 30,
      availabilityDays: 7,
      stripeConnectNetworkClaimed: false,
      payoutClaimed: false,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path provider onboarding failed: ${message}`);
  process.exitCode = 1;
});